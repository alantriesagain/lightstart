/**
 * @file Room over real WebRTC: two peers open a direct data channel and
 * round-trip a megabyte, fall back to the presence signaler's data frames
 * when ICE cannot connect, carry a camera track and swap it, and report a
 * peer that leaves. The signaling between the two rooms is an in-page
 * presence bus: light's browser runner serves static files only, so no
 * `/_relay` hub is listening at `location.origin`. The relay client and hub
 * themselves are covered by `test/relay.test.ts` and `test/relay-hub.test.ts`
 * against the real `/_relay` protocol.
 */

import assert from "node:assert/strict";
import { after, afterEach, describe, it } from "node:test";
import { createRoom } from "../room.js";
import { createRtcPeer } from "../rtc/peer.js";

/** @import { Room, SignalPayload } from "../types.ts" */

/**
 * @typedef {{
 *   id: string,
 *   selfId: string,
 *   presence: true,
 *   ready: Promise<void>,
 *   peers: () => string[],
 *   onPeer: (handler: (peerId: string) => void) => () => boolean,
 *   onPeerGone: (handler: (peerId: string) => void) => () => boolean,
 *   onOffer: (handler: (signal: SignalPayload) => void) => () => boolean,
 *   onAnswer: (handler: (signal: SignalPayload) => void) => () => boolean,
 *   onCandidate: (handler: (signal: SignalPayload) => void) => () => boolean,
 *   onData: (handler: (frame: unknown, from: string) => void) => () => boolean,
 *   onClose: (handler: (reason: string) => void) => () => boolean,
 *   offer: (to: string, offerId: string, payload: unknown) => void,
 *   answer: (to: string, offerId: string, payload: unknown) => void,
 *   candidate: (to: string, offerId: string, payload: unknown) => void,
 *   sendData: (to: string | null, frame: unknown) => void,
 *   close: () => void,
 *   _peer: (peerId: string) => void,
 *   _gone: (peerId: string) => void,
 *   _offer: (signal: SignalPayload) => void,
 *   _answer: (signal: SignalPayload) => void,
 *   _candidate: (signal: SignalPayload) => void,
 *   _data: (frame: unknown, from: string) => void,
 * }} Endpoint
 */

/** @type {Map<string, Endpoint>} */
const endpoints = new Map();

/**
 * @param {string} selfId
 * @returns {Endpoint}
 */
const presenceSignaler = (selfId) => {
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

  /** @type {Endpoint} */
  const self = {
    id: "in-page-presence",
    selfId,
    presence: true,
    ready: Promise.resolve(),
    peers: () => [...endpoints.keys()].filter((id) => id !== selfId),
    onPeer: (handler) => { peerHandlers.add(handler); return () => peerHandlers.delete(handler); },
    onPeerGone: (handler) => { goneHandlers.add(handler); return () => goneHandlers.delete(handler); },
    onOffer: (handler) => { offerHandlers.add(handler); return () => offerHandlers.delete(handler); },
    onAnswer: (handler) => { answerHandlers.add(handler); return () => answerHandlers.delete(handler); },
    onCandidate: (handler) => { candidateHandlers.add(handler); return () => candidateHandlers.delete(handler); },
    onData: (handler) => { dataHandlers.add(handler); return () => dataHandlers.delete(handler); },
    onClose: (handler) => { closeHandlers.add(handler); return () => closeHandlers.delete(handler); },
    offer: (to, offerId, payload) => { endpoints.get(to)?._offer({ peerId: selfId, offerId, payload }); },
    answer: (to, offerId, payload) => { endpoints.get(to)?._answer({ peerId: selfId, offerId, payload }); },
    candidate: (to, offerId, payload) => { endpoints.get(to)?._candidate({ peerId: selfId, offerId, payload }); },
    sendData: (to, frame) => {
      for (const [id, other] of endpoints) if (id !== selfId && (!to || to === id)) other._data(frame, selfId);
    },
    _peer: (peerId) => { for (const handler of [...peerHandlers]) handler(peerId); },
    _gone: (peerId) => { for (const handler of [...goneHandlers]) handler(peerId); },
    _offer: (signal) => { for (const handler of [...offerHandlers]) handler(signal); },
    _answer: (signal) => { for (const handler of [...answerHandlers]) handler(signal); },
    _candidate: (signal) => { for (const handler of [...candidateHandlers]) handler(signal); },
    _data: (frame, from) => {
      for (const handler of [...dataHandlers]) handler(frame, from);
    },
    close: () => {
      if (!endpoints.delete(selfId)) return;
      for (const other of endpoints.values()) other._gone(selfId);
      for (const handler of [...closeHandlers]) handler("closed");
    },
  };
  endpoints.set(selfId, self);
  for (const other of endpoints.values()) if (other.selfId !== selfId) { other._peer(selfId); self._peer(other.selfId); }
  return self;
};

/**
 * @typedef {{ iceServers?: RTCIceServer[], rtcConfig?: RTCConfiguration, video?: boolean, fallbackMs?: number }} PeerOptions
 */

/** @type {Room[]} */
const rooms = [];

/**
 * @param {string} selfId
 * @param {PeerOptions} [extra]
 * @returns {Room}
 */
const join = (selfId, extra = {}) => {
  const signaler = presenceSignaler(selfId);
  const room = createRoom({
    selfId,
    signalers: [signaler],
    createPeer: () => createRtcPeer({ iceServers: extra.iceServers, rtcConfig: extra.rtcConfig, video: extra.video }),
    fallbackMs: extra.fallbackMs ?? 8000,
  });
  rooms.push(room);
  return room;
};

/**
 * @param {() => boolean} predicate
 * @param {string} [label]
 * @param {number} [timeout]
 */
const until = async (predicate, label = "condition", timeout = 15000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`timed out waiting for ${label}`);
};

describe("room with real WebRTC", () => {
  afterEach(() => {
    for (const room of rooms.splice(0)) room.leave();
    endpoints.clear();
  });
  after(() => { for (const room of rooms.splice(0)) room.leave(); });

  it("two rooms in one page open a direct data channel and round-trip a 1 MB action", async () => {
    const a = join("aaaaaaaaaaaaaaaaaaaa");
    const b = join("bbbbbbbbbbbbbbbbbbbb");
    await Promise.all([a.ready, b.ready]);
    await until(() => a.transportOf("bbbbbbbbbbbbbbbbbbbb") === "direct" && b.transportOf("aaaaaaaaaaaaaaaaaaaa") === "direct", "direct both ways");
    /** @type {Array<[{ big: string }, string]>} */
    const got = [];
    b.action("rpc").on((data, from) => got.push([/** @type {{ big: string }} */ (data), from]));
    const big = "x".repeat(1024 * 1024);
    await a.action("rpc").send({ big });
    await until(() => got.length === 1, "1 MB landed");
    const first = got[0];
    assert.ok(first !== undefined);
    if (first !== undefined) {
      assert.equal(first[0].big.length, big.length);
      assert.equal(first[1], "aaaaaaaaaaaaaaaaaaaa");
    }
    /** @type {unknown[]} */
    const back = [];
    a.action("rpc").on((data) => back.push(data));
    await b.action("rpc").send("pong", "aaaaaaaaaaaaaaaaaaaa");
    await until(() => back.length === 1, "reply landed");
    assert.deepEqual(back, ["pong"]);
  });

  it("falls back to relayed data when ICE cannot connect", async () => {
    const blocked = { iceServers: [], rtcConfig: { iceTransportPolicy: /** @type {const} */ ("relay") }, fallbackMs: 1500 };
    const a = join("cccccccccccccccccccc", blocked);
    const b = join("dddddddddddddddddddd", blocked);
    await Promise.all([a.ready, b.ready]);
    await until(() => a.transportOf("dddddddddddddddddddd") === "relayed" && b.transportOf("cccccccccccccccccccc") === "relayed", "relayed both ways");
    /** @type {Array<[unknown, string]>} */
    const got = [];
    b.action("rpc").on((data, from) => got.push([data, from]));
    await a.action("rpc").send({ via: "relay" });
    await until(() => got.length === 1, "relayed data landed");
    assert.deepEqual(got, [[{ via: "relay" }, "cccccccccccccccccccc"]]);
  });

  it("a room joined with video carries a camera track to the other phone, and swaps it", async () => {
    const a = join("gggggggggggggggggggg", { video: true });
    const b = join("hhhhhhhhhhhhhhhhhhhh", { video: true });
    await until(() => a.transportOf("hhhhhhhhhhhhhhhhhhhh") === "direct" && b.transportOf("gggggggggggggggggggg") === "direct", "direct both ways");
    const canvas = Object.assign(document.createElement("canvas"), { width: 160, height: 120 });
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("no 2d context");
    let hue = 0;
    const paint = setInterval(() => { context.fillStyle = `hsl(${(hue += 20)} 80% 50%)`; context.fillRect(0, 0, 160, 120); }, 30);
    try {
      const [track] = canvas.captureStream(30).getVideoTracks();
      await a.setTrack(track);
      const video = Object.assign(document.createElement("video"), { muted: true, playsInline: true, autoplay: true });
      await until(() => !!b.trackOf("gggggggggggggggggggg"), "b has a's track");
      const remote = b.trackOf("gggggggggggggggggggg");
      if (remote === null) throw new Error("b has no track");
      video.srcObject = new MediaStream([remote]);
      await video.play().catch(() => {});
      await until(() => video.videoWidth === 160, "frames arrive");
      const smaller = Object.assign(document.createElement("canvas"), { width: 80, height: 60 });
      const paintSmall = setInterval(() => {
        const c = smaller.getContext("2d");
        if (c === null) return;
        c.fillStyle = "#123";
        c.fillRect(0, 0, 80, 60);
      }, 30);
      try {
        await a.setTrack(smaller.captureStream(30).getVideoTracks()[0]);
        await until(() => video.videoWidth === 80, "the swapped track arrives without a new offer");
      } finally {
        clearInterval(paintSmall);
      }
      assert.equal(a.trackOf("hhhhhhhhhhhhhhhhhhhh")?.kind, "video");
    } finally {
      clearInterval(paint);
    }
  });

  it("a peer that leaves is reported gone", async () => {
    const a = join("eeeeeeeeeeeeeeeeeeee");
    const b = join("ffffffffffffffffffff");
    await until(() => a.peers().length === 1 && b.peers().length === 1, "joined");
    /** @type {string[]} */
    const left = [];
    a.onPeerLeave((id) => left.push(id));
    b.leave();
    await until(() => left.length === 1, "a saw b leave");
    assert.deepEqual(a.peers(), []);
  });
});
