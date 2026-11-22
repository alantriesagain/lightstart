/**
 * @file Relay signaler: a room on the `/_relay` WebSocket hub
 * (`cli/relay-hub.ts`). The hub knows who is in the room, so this is a
 * presence signaler: peers appear and vanish, offers, answers and ICE
 * candidates travel targeted and in the clear (the room secret gates every
 * join), and `data` frames double as the transport when a direct channel
 * never opens. Pure client: no app, no secure-context APIs, so it runs on a
 * plain-http LAN.
 *
 * Wire (JSON): `join/joined/peer-joined/peer-left/data/leave/error` frames
 * as the hub documents; `data` frames carry `action: "signal"` with
 * `{ t: "offer"|"answer"|"candidate", offerId, payload }` or
 * `action: "data"` with a room envelope.
 */

/** @import { PresenceSignaler, SignalPayload } from "../types.ts" */

/**
 * @param {{ url: string, appId: string, password: string, roomId: string, selfId: string, WebSocket?: typeof WebSocket }} config
 * @returns {PresenceSignaler}
 */
export const createRelaySignaler = ({ url, appId, password, roomId, selfId, WebSocket: Socket = globalThis.WebSocket }) => {
  const wsUrl = `${url.replace(/^http/, "ws")}/_relay`;
  /** @type {Set<string>} */
  const peers = new Set();
  /** @type {Set<(peerId: string) => void>} */
  const peerHandlers = new Set();
  /** @type {Set<(peerId: string) => void>} */
  const goneHandlers = new Set();
  /** @type {Set<(signal: SignalPayload) => void>} */
  const offerHandlers = new Set();
  /** @type {Set<(signal: SignalPayload) => void>} */
  const answerHandlers = new Set();
  /** @type {Set<(signal: SignalPayload) => void>} */
  const candidateHandlers = new Set();
  /** @type {Set<(frame: unknown, from: string) => void>} */
  const dataHandlers = new Set();
  /** @type {Set<(reason: string) => void>} */
  const closeHandlers = new Set();
  /** @type {string[]} */
  const outbox = [];
  let joined = false;
  let closed = false;
  /** @type {(value?: unknown) => void} */
  let resolveReady = () => {};
  /** @type {(error: Error) => void} */
  let rejectReady = () => {};
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  ready.catch(() => {});

  const sock = new Socket(wsUrl);

  /** @param {object} frame */
  const push = (frame) => {
    const raw = JSON.stringify(frame);
    if (joined && sock.readyState === 1) sock.send(raw);
    else outbox.push(raw);
  };

  /**
   * @param {string} to
   * @param {"offer" | "answer" | "candidate"} t
   * @param {string} offerId
   * @param {unknown} payload
   */
  const signal = (to, t, offerId, payload) => push({ t: "data", action: "signal", payload: { t, offerId, payload }, to });

  /**
   * @template T
   * @param {Set<(detail: T) => void>} handlers
   * @param {T} detail
   */
  const emitAll = (handlers, detail) => {
    for (const handler of handlers)
      try { handler(detail); }
      catch (e) { console.warn("[relay] handler threw:", e); }
  };

  const dropAll = () => {
    for (const peerId of [...peers]) {
      peers.delete(peerId);
      emitAll(goneHandlers, peerId);
    }
  };

  sock.addEventListener("open", () => {
    sock.send(JSON.stringify({ t: "join", roomId, peerId: selfId, auth: `${appId}\n${password}` }));
  });

  sock.addEventListener("message", (event) => {
    let msg;
    try { msg = JSON.parse(String(event.data)); } catch { return; }

    if (msg.t === "joined") {
      joined = true;
      resolveReady();
      for (const raw of outbox.splice(0)) sock.send(raw);
      for (const peerId of msg.peers || []) {
        peers.add(peerId);
        emitAll(peerHandlers, peerId);
      }
      return;
    }
    if (msg.t === "peer-joined") {
      peers.add(msg.peerId);
      emitAll(peerHandlers, msg.peerId);
      return;
    }
    if (msg.t === "peer-left") {
      if (!peers.delete(msg.peerId)) return;
      emitAll(goneHandlers, msg.peerId);
      return;
    }
    if (msg.t === "data") {
      if (msg.action === "signal" && msg.payload && typeof msg.payload === "object") {
        const { t, offerId, payload } = msg.payload;
        const detail = { peerId: msg.from, offerId, payload };
        if (t === "offer") emitAll(offerHandlers, detail);
        else if (t === "answer") emitAll(answerHandlers, detail);
        else if (t === "candidate") emitAll(candidateHandlers, detail);
        return;
      }
      if (msg.action === "data")
        for (const handler of dataHandlers)
          try { handler(msg.payload, msg.from); }
          catch (e) { console.warn("[relay] data handler threw:", e); }
      return;
    }
    if (msg.t === "error") {
      const reason = `relay join rejected: ${msg.code}`;
      console.warn(`[relay] ${reason}`);
      rejectReady(new Error(reason));
    }
  });

  sock.addEventListener("close", () => {
    if (closed) return;
    joined = false;
    dropAll();
    rejectReady(new Error("relay socket closed"));
    emitAll(closeHandlers, "closed");
  });

  sock.addEventListener("error", () => {
    if (!joined) rejectReady(new Error("relay socket failed"));
  });

  return {
    id: "relay",
    presence: true,
    selfId,
    ready,
    peers: () => [...peers],
    onPeer: (handler) => { peerHandlers.add(handler); return () => peerHandlers.delete(handler); },
    onPeerGone: (handler) => { goneHandlers.add(handler); return () => goneHandlers.delete(handler); },
    offer: (peerId, offerId, payload) => signal(peerId, "offer", offerId, payload),
    answer: (peerId, offerId, payload) => signal(peerId, "answer", offerId, payload),
    candidate: (peerId, offerId, payload) => signal(peerId, "candidate", offerId, payload),
    onOffer: (handler) => { offerHandlers.add(handler); return () => offerHandlers.delete(handler); },
    onAnswer: (handler) => { answerHandlers.add(handler); return () => answerHandlers.delete(handler); },
    onCandidate: (handler) => { candidateHandlers.add(handler); return () => candidateHandlers.delete(handler); },
    sendData: (peerId, frame) => push({ t: "data", action: "data", payload: frame, ...(peerId ? { to: peerId } : {}) }),
    onData: (handler) => { dataHandlers.add(handler); return () => dataHandlers.delete(handler); },
    onClose: (handler) => { closeHandlers.add(handler); return () => closeHandlers.delete(handler); },
    close: () => {
      closed = true;
      try {
        if (sock.readyState === 1) sock.send(JSON.stringify({ t: "leave" }));
        sock.close();
      } catch {}
      dropAll();
    },
  };
};
