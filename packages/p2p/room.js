/**
 * @file The room: a mesh of peers reached through any number of signalers.
 *
 * `createRoom` is the pure mesh manager (signalers and the peer factory
 * are injected; node tests script both). `joinRoom` wires the real
 * signalers, the room crypto, and `RTCPeerConnection` behind it.
 *
 * Mesh rules: one peer id per device across every signaler, so a peer
 * seen twice is one peer. Broadcast signalers get a pool of gathered
 * offers; a taken offer is refilled and re-announced. Two connections to
 * the same peer resolve to the one the lower id offered. A peer joins
 * when its channel opens, or, with a presence signaler that still sees
 * it, when no channel opened within the fallback window: its actions
 * then ride the signaler's data frames until a channel opens. A hub
 * leave while a channel is still open is probed with a ping: no pong
 * within the probe window and the peer has left.
 *
 * Video rides the direct links of a room whose peers were made with
 * `video`: `setTrack` puts one track on every link, pooled offers and
 * links still to come included, and `onTrack` hears a peer's video once
 * its link is the one the mesh kept.
 */

import { createRtcPeer } from "./rtc/peer.js";
import { createRelaySignaler } from "./signal/relay.js";
import { createTorrentSignaler } from "./signal/torrent.js";
import { createMqttSignaler } from "./signal/mqtt.js";
import { bytesToHex, deriveRoomKey, hasSubtle, open, roomDigest, seal } from "./crypto.js";

/** @import { BroadcastSignaler, PeerTransport, PresenceSignaler, Room, RoomAction, RtcPeer, Signaler, SignalPayload } from "./types.ts" */

const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * @param {number} [length]
 * @returns {string}
 */
export const randomId = (length = 20) => {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("");
};

/**
 * @typedef {{
 *   id: string,
 *   offerId: string,
 *   offerer: string,
 *   peer: RtcPeer,
 *   signaler: Signaler,
 *   open: boolean,
 *   dispose: Array<() => void>,
 * }} Link
 */

/**
 * @param {{
 *   selfId: string,
 *   signalers: Signaler[],
 *   createPeer: () => RtcPeer,
 *   seal?: (value: unknown) => Promise<unknown>,
 *   open?: (payload: unknown) => Promise<unknown>,
 *   poolSize?: number,
 *   fallbackMs?: number,
 *   retryMs?: number,
 *   connectTimeoutMs?: number,
 *   probeMs?: number,
 * }} options
 * @returns {Room}
 */
export const createRoom = ({
  selfId, signalers, createPeer,
  seal: sealPayload = async (value) => value,
  open: openPayload = async (payload) => payload,
  poolSize = 10, fallbackMs = 8000, retryMs = 5000, connectTimeoutMs = 15000, probeMs = 2000,
}) => {
  /** @type {Map<string, { id: string, link: Link | null, relayed: boolean, joined: boolean, timer: ReturnType<typeof setTimeout> | null, retry: ReturnType<typeof setTimeout> | null, retryDelay: number }>} */
  const peers = new Map();
  /** @type {Map<string, Link>} */
  const links = new Map();
  /** @type {Map<string, { peer: RtcPeer, payload: unknown, dispose: () => void }>} */
  const pool = new Map();
  /** @type {Map<string, Set<(data: unknown, from: string) => void>>} */
  const actions = new Map();
  /** @type {Set<(peerId: string) => void>} */
  const joinHandlers = new Set();
  /** @type {Set<(peerId: string) => void>} */
  const leaveHandlers = new Set();
  /** @type {Set<(peerId: string, transport: PeerTransport) => void>} */
  const transportHandlers = new Set();
  /** @type {Set<(reason: string) => void>} */
  const closeHandlers = new Set();
  /** @type {Set<(peerId: string, track: MediaStreamTrack) => void>} */
  const trackHandlers = new Set();
  /** @type {MediaStreamTrack | null} */
  let localTrack = null;
  const broadcast = /** @type {BroadcastSignaler[]} */ (signalers.filter((s) => !s.presence));
  const presence = /** @type {PresenceSignaler[]} */ (signalers.filter((s) => s.presence));
  let left = false;

  /**
   * @param {Set<(detail: string) => void>} handlers
   * @param {string} detail
   */
  const emitAll = (handlers, detail) => {
    for (const handler of handlers)
      try { handler(detail); } catch (e) { console.warn("[room] handler threw:", e); }
  };

  /**
   * @param {string} peerId
   * @param {PeerTransport} transport
   */
  const emitTransport = (peerId, transport) => {
    for (const handler of transportHandlers)
      try { handler(peerId, transport); } catch (e) { console.warn("[room] transport handler threw:", e); }
  };

  /** @param {string} peerId */
  const entry = (peerId) => {
    let current = peers.get(peerId);
    if (!current) {
      current = { id: peerId, link: null, relayed: false, joined: false, timer: null, retry: null, retryDelay: retryMs };
      peers.set(peerId, current);
    }
    return current;
  };

  /** @param {string} peerId @returns {PeerTransport | null} */
  const transportOf = (peerId) => {
    const current = peers.get(peerId);
    if (!current || !current.joined) return null;
    return current.link?.open ? "direct" : current.relayed ? "relayed" : null;
  };

  /** @param {ReturnType<typeof entry>} current */
  const join = (current) => {
    if (current.joined) return;
    current.joined = true;
    if (current.timer) { clearTimeout(current.timer); current.timer = null; }
    emitAll(joinHandlers, current.id);
  };

  /** @param {ReturnType<typeof entry>} current */
  const leave = (current) => {
    if (current.timer) { clearTimeout(current.timer); current.timer = null; }
    if (current.retry) { clearTimeout(current.retry); current.retry = null; }
    peers.delete(current.id);
    if (current.joined) emitAll(leaveHandlers, current.id);
  };

  /** @param {string} text @param {string} from */
  const dispatch = (text, from) => {
    let envelope;
    try { envelope = typeof text === "string" ? JSON.parse(text) : text; } catch { return; }
    if (!envelope || typeof envelope !== "object" || typeof envelope.a !== "string") return;
    if (envelope.a === "$ping") return void answerPing(from);
    if (envelope.a === "$pong") return void settleProbe(from);
    const handlers = actions.get(envelope.a);
    if (!handlers) return;
    for (const handler of handlers)
      try { handler(envelope.d, from); } catch (e) { console.warn(`[room] action "${envelope.a}" handler threw:`, e); }
  };

  /** @param {Link} link */
  const emitTrack = (link) => {
    const track = link.peer.remoteTrack;
    if (!track || !link.open || peers.get(link.id)?.link !== link) return;
    for (const handler of trackHandlers)
      try { handler(link.id, track); } catch (e) { console.warn("[room] track handler threw:", e); }
  };

  /** @param {string} peerId */
  const stillSeen = (peerId) => presence.some((s) => s.peers().includes(peerId));

  /** @param {Link} link @returns {Link | null} */
  const siblingOf = (link) =>
    [...links.values()].find((other) => other.id === link.id && other !== link) ?? null;

  /** @param {Link} link @param {string} reason */
  const dropLink = (link, reason) => {
    links.delete(link.offerId);
    for (const dispose of link.dispose) dispose();
    link.peer.close();
    const current = peers.get(link.id);
    if (!current || current.link !== link) return;
    current.link = siblingOf(link);
    if (left || current.link) return;
    if (stillSeen(link.id)) {
      if (current.joined && !current.relayed) {
        current.relayed = true;
        emitTransport(link.id, "relayed");
      } else if (!current.joined) armFallback(current);
      scheduleRetry(current);
      return;
    }
    if (reason !== "superseded") leave(current);
    announce();
  };

  /** @param {ReturnType<typeof entry>} current */
  const scheduleRetry = (current) => {
    if (current.retry || left) return;
    current.retry = setTimeout(() => {
      current.retry = null;
      current.retryDelay = Math.min(current.retryDelay * 2, 60000);
      if (current.link || left) return;
      const signaler = presence.find((s) => s.peers().includes(current.id));
      if (signaler) onPresencePeer(signaler, current.id).catch(() => {});
    }, current.retryDelay);
  };

  /** @param {Link} link */
  const attach = (link) => {
    links.set(link.offerId, link);
    const first = entry(link.id);
    const deadline = setTimeout(() => { if (!link.open) dropLink(link, "connect timeout"); }, connectTimeoutMs);
    link.dispose.push(() => clearTimeout(deadline));
    link.dispose.push(link.peer.onMessage((text) => dispatch(text, link.id)));
    link.dispose.push(link.peer.onTrack(() => emitTrack(link)));
    if (localTrack) link.peer.setTrack(localTrack).catch(() => {});
    link.dispose.push(link.peer.onClose((reason) => dropLink(link, reason)));
    link.dispose.push(link.peer.onOpen(() => {
      link.open = true;
      clearTimeout(deadline);
      const current = entry(link.id);
      current.retryDelay = retryMs;
      const existing = current.link;
      if (existing && existing !== link && existing.open) {
        const keep = existing.offerer < link.offerer ? existing : link;
        const drop = keep === existing ? link : existing;
        if (drop === link) return void dropLink(link, "superseded");
        current.link = link;
        dropLink(existing, "superseded");
      } else current.link = link;
      const wasRelayed = current.relayed;
      current.relayed = false;
      const alreadyJoined = current.joined;
      join(current);
      if (alreadyJoined && wasRelayed) emitTransport(link.id, "direct");
      emitTrack(link);
    }));
    if (!first.link) first.link = link;
  };

  /** @param {ReturnType<typeof entry>} current */
  const armFallback = (current) => {
    if (current.timer || current.joined || !presence.length) return;
    current.timer = setTimeout(() => {
      current.timer = null;
      if (current.joined || !stillSeen(current.id)) return;
      current.relayed = true;
      join(current);
    }, fallbackMs);
  };

  const refill = async () => {
    if (left || !broadcast.length) return;
    while (pool.size < poolSize && !left) {
      const offerId = randomId();
      const peer = createPeer();
      const sdp = await peer.offer({ trickle: false });
      if (left) return void peer.close();
      const payload = await sealPayload({ sdp });
      const dispose = peer.onClose(() => {
        if (pool.delete(offerId)) refill().catch(() => {});
      });
      pool.set(offerId, { peer, payload, dispose });
    }
    announce();
  };

  const announce = () => {
    const offers = [...pool].map(([offerId, { payload }]) => ({ offerId, payload }));
    for (const signaler of broadcast) signaler.announce(offers);
  };

  /** @param {BroadcastSignaler} signaler @param {SignalPayload} signal */
  const onBroadcastOffer = async (signaler, { peerId, offerId, payload }) => {
    if (peerId === selfId || left) return;
    const current = entry(peerId);
    if (current.link || links.has(offerId)) return;
    const opened = /** @type {{ sdp?: string } | null} */ (await openPayload(payload));
    if (!opened?.sdp || current.link || links.has(offerId) || left) return;
    const peer = createPeer();
    const link = { id: peerId, offerId, offerer: peerId, peer, signaler, open: false, dispose: /** @type {Array<() => void>} */ ([]) };
    attach(link);
    try {
      const sdp = await peer.answer(opened.sdp, { trickle: false });
      signaler.answer(peerId, offerId, await sealPayload({ sdp }));
    } catch (e) {
      console.warn("[room] answering failed:", e);
      dropLink(link, "answer failed");
    }
  };

  /** @param {SignalPayload} signal */
  const onBroadcastAnswer = async ({ peerId, offerId, payload }) => {
    const pooled = pool.get(offerId);
    if (!pooled || peerId === selfId || left) return;
    const opened = /** @type {{ sdp?: string } | null} */ (await openPayload(payload));
    if (!opened?.sdp) return;
    pool.delete(offerId);
    pooled.dispose();
    const link = { id: peerId, offerId, offerer: selfId, peer: pooled.peer, signaler: broadcast[0], open: false, dispose: /** @type {Array<() => void>} */ ([]) };
    attach(link);
    try { await pooled.peer.accept(opened.sdp); }
    catch (e) { console.warn("[room] accept failed:", e); dropLink(link, "accept failed"); }
    refill().catch(() => {});
  };

  /** @param {PresenceSignaler} signaler @param {string} peerId */
  const onPresencePeer = async (signaler, peerId) => {
    if (peerId === selfId || left) return;
    const current = entry(peerId);
    armFallback(current);
    if (current.link) return;
    if (selfId > peerId) return;
    const offerId = randomId();
    const peer = createPeer();
    const link = { id: peerId, offerId, offerer: selfId, peer, signaler, open: false, dispose: /** @type {Array<() => void>} */ ([]) };
    attach(link);
    link.dispose.push(peer.onCandidate((candidate) => signaler.candidate(peerId, offerId, { candidate })));
    try {
      const sdp = await peer.offer({ trickle: true });
      signaler.offer(peerId, offerId, { sdp });
    } catch (e) {
      console.warn("[room] offer failed:", e);
      dropLink(link, "offer failed");
    }
  };

  /** @param {PresenceSignaler} signaler @param {SignalPayload} signal */
  const onPresenceOffer = async (signaler, { peerId, offerId, payload }) => {
    if (peerId === selfId || left || links.has(offerId)) return;
    const opened = /** @type {{ sdp?: string } | null} */ (payload);
    if (!opened?.sdp) return;
    const current = entry(peerId);
    armFallback(current);
    const peer = createPeer();
    const link = { id: peerId, offerId, offerer: peerId, peer, signaler, open: false, dispose: /** @type {Array<() => void>} */ ([]) };
    attach(link);
    link.dispose.push(peer.onCandidate((candidate) => signaler.candidate(peerId, offerId, { candidate })));
    try {
      const sdp = await peer.answer(opened.sdp, { trickle: true });
      signaler.answer(peerId, offerId, { sdp });
    } catch (e) {
      console.warn("[room] answering failed:", e);
      dropLink(link, "answer failed");
    }
  };

  /** @param {SignalPayload} signal */
  const onPresenceAnswer = async ({ offerId, payload }) => {
    const link = links.get(offerId);
    const opened = /** @type {{ sdp?: string } | null} */ (payload);
    if (!link || !opened?.sdp) return;
    try { await link.peer.accept(opened.sdp); }
    catch (e) { console.warn("[room] accept failed:", e); dropLink(link, "accept failed"); }
  };

  /** @param {SignalPayload} signal */
  const onPresenceCandidate = ({ offerId, payload }) => {
    const link = links.get(offerId);
    const opened = /** @type {{ candidate?: RTCIceCandidateInit } | null} */ (payload);
    if (link && opened?.candidate) link.peer.addCandidate(opened.candidate).catch(() => {});
  };

  /** @type {Map<string, ReturnType<typeof setTimeout>>} */
  const probes = new Map();

  /** @param {string} from */
  const answerPing = (from) => {
    const link = peers.get(from)?.link;
    if (link?.open) link.peer.send(JSON.stringify({ a: "$pong" })).catch(() => {});
  };

  /** @param {string} from */
  const settleProbe = (from) => {
    const timer = probes.get(from);
    if (!timer) return;
    clearTimeout(timer);
    probes.delete(from);
  };

  /** @param {Link} link */
  const probe = (link) => {
    if (probes.has(link.id)) return;
    probes.set(link.id, setTimeout(() => {
      probes.delete(link.id);
      if (link.open) dropLink(link, "peer gone");
    }, probeMs));
    link.peer.send(JSON.stringify({ a: "$ping" })).catch(() => {
      settleProbe(link.id);
      dropLink(link, "peer gone");
    });
  };

  /** @param {string} peerId */
  const onPresenceGone = (peerId) => {
    const current = peers.get(peerId);
    if (!current) return;
    if (current.link?.open) return void probe(current.link);
    if (current.link) dropLink(current.link, "peer gone");
    leave(current);
  };

  /** @type {Array<() => void>} */
  const disposers = [];
  for (const signaler of broadcast) {
    disposers.push(signaler.onOffer((signal) => { onBroadcastOffer(signaler, signal).catch(() => {}); }));
    disposers.push(signaler.onAnswer((signal) => { onBroadcastAnswer(signal).catch(() => {}); }));
  }
  for (const signaler of presence) {
    disposers.push(signaler.onPeer((peerId) => { onPresencePeer(signaler, peerId).catch(() => {}); }));
    disposers.push(signaler.onPeerGone(onPresenceGone));
    disposers.push(signaler.onOffer((signal) => { onPresenceOffer(signaler, signal).catch(() => {}); }));
    disposers.push(signaler.onAnswer((signal) => { onPresenceAnswer(signal).catch(() => {}); }));
    disposers.push(signaler.onCandidate(onPresenceCandidate));
    disposers.push(signaler.onData((frame, from) => dispatch(/** @type {string} */ (frame), from)));
    disposers.push(signaler.onClose((reason) => {
      for (const current of [...peers.values()])
        if (!current.link?.open) leave(current);
      emitAll(closeHandlers, `${signaler.id}: ${reason}`);
    }));
    for (const peerId of signaler.peers()) onPresencePeer(signaler, peerId).catch(() => {});
  }
  refill().catch((e) => console.warn("[room] offer pool failed:", e));

  const ready = Promise.any(signalers.map((s) => s.ready)).catch(() => {
    throw new Error("room: no signaler became ready");
  });

  /** @param {string} name @returns {RoomAction} */
  const action = (name) => {
    if (!actions.has(name)) actions.set(name, new Set());
    const handlers = /** @type {Set<(data: unknown, from: string) => void>} */ (actions.get(name));
    return {
      send: async (data, to) => {
        const targets = to == null ? [...peers.keys()].filter((id) => /** @type {NonNullable<ReturnType<typeof peers.get>>} */ (peers.get(id)).joined)
          : Array.isArray(to) ? to : [to];
        const text = JSON.stringify({ a: name, d: data });
        await Promise.all(targets.map(async (peerId) => {
          const current = peers.get(peerId);
          if (!current?.joined) return;
          if (current.link?.open) return current.link.peer.send(text);
          const carrier = presence.find((s) => s.peers().includes(peerId));
          if (carrier) return carrier.sendData(peerId, text);
          throw new Error(`room: no transport to ${peerId}`);
        }));
      },
      on: (handler) => { handlers.add(handler); return () => handlers.delete(handler); },
    };
  };

  return {
    selfId,
    ready,
    peers: () => [...peers.values()].filter((p) => p.joined).map((p) => p.id),
    transportOf,
    action,
    onPeerJoin: (handler) => { joinHandlers.add(handler); return () => joinHandlers.delete(handler); },
    onPeerLeave: (handler) => { leaveHandlers.add(handler); return () => leaveHandlers.delete(handler); },
    onTransportChange: (handler) => { transportHandlers.add(handler); return () => transportHandlers.delete(handler); },
    onClose: (handler) => { closeHandlers.add(handler); return () => closeHandlers.delete(handler); },
    setTrack: async (track) => {
      localTrack = track;
      const targets = [...[...links.values()].map((link) => link.peer), ...[...pool.values()].map((pooled) => pooled.peer)];
      await Promise.all(targets.map((peer) => peer.setTrack(track).catch(() => {})));
    },
    trackOf: (peerId) => {
      const link = peers.get(peerId)?.link;
      return link?.open ? link.peer.remoteTrack : null;
    },
    onTrack: (handler) => { trackHandlers.add(handler); return () => trackHandlers.delete(handler); },
    leave: () => {
      if (left) return;
      left = true;
      for (const dispose of disposers) dispose();
      for (const link of [...links.values()]) { for (const d of link.dispose) d(); link.peer.close(); }
      links.clear();
      for (const timer of probes.values()) clearTimeout(timer);
      probes.clear();
      for (const { peer, dispose } of pool.values()) { dispose(); peer.close(); }
      pool.clear();
      for (const current of [...peers.values()]) leave(current);
      for (const signaler of signalers) signaler.close();
    },
  };
};

/**
 * @typedef {{
 *   appId: string,
 *   password: string,
 *   signalers?: string[],
 *   relayUrl?: string,
 *   trackers?: string[],
 *   brokers?: string[],
 *   iceServers?: RTCIceServer[],
 *   rtcConfig?: RTCConfiguration,
 *   video?: boolean,
 *   selfId?: string,
 *   fallbackMs?: number,
 * }} JoinConfig
 */

/**
 * @param {JoinConfig} config
 * @param {string} roomId
 * @returns {Promise<Room>}
 */
export const joinRoom = async (config, roomId) => {
  const selfId = config.selfId ?? randomId();
  const wanted = config.signalers ?? ["torrent", "mqtt"];
  const needsKey = wanted.some((id) => id !== "relay");
  const secure = hasSubtle();
  if (needsKey && !secure) console.warn("[room] public signalers need a secure context (crypto.subtle); only the relay is available here");
  const key = needsKey && secure ? await deriveRoomKey(config.appId, config.password) : null;
  const digest = needsKey && secure ? await roomDigest(config.appId, roomId) : null;
  /** @type {Signaler[]} */
  const signalers = [];
  for (const id of wanted)
    if (id === "relay" && config.relayUrl)
      signalers.push(createRelaySignaler({ url: config.relayUrl, appId: config.appId, password: config.password, roomId, selfId }));
    else if (id === "torrent" && digest)
      signalers.push(createTorrentSignaler({ trackers: config.trackers, infoHash: digest, selfId }));
    else if (id === "mqtt" && digest)
      signalers.push(createMqttSignaler({ brokers: config.brokers, roomHash: bytesToHex(digest), selfId }));

  if (!signalers.length) throw new Error(`room: none of [${wanted.join(", ")}] can run here`);
  return createRoom({
    selfId,
    signalers,
    createPeer: () => createRtcPeer({ iceServers: config.iceServers, rtcConfig: config.rtcConfig, video: config.video }),
    seal: key ? (value) => seal(key, value) : undefined,
    open: key ? (payload) => open(key, /** @type {string} */ (payload)) : undefined,
    fallbackMs: config.fallbackMs,
  });
};
