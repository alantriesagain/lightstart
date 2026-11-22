// node-only
/**
 * @file The room mesh over scripted signalers and scripted peers: the offer
 * pool, actions, a three-peer mesh, leave, the presence offerer, relayed
 * fallback and promotion, timeouts, probes, a hub loss, both kinds at once,
 * and video tracks.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { createRoom as createRoomBare } from "../room.js";
import type { BroadcastSignaler, PresenceSignaler, Room, RtcPeer, SignalPayload } from "../types.ts";

type RoomOptions = Parameters<typeof createRoomBare>[0];

const live: Room[] = [];
const createRoom = (options: RoomOptions): Room => {
  const room = createRoomBare({ connectTimeoutMs: 300, ...options });
  live.push(room);
  return room;
};

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (predicate: () => boolean, label = "condition", timeout = 3000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await tick(5);
  }
  throw new Error(`timed out waiting for ${label}`);
};

type Emitter<Args extends unknown[]> = {
  on(handler: (...args: Args) => void): () => void;
  emit(...args: Args): void;
};

const emitter = <Args extends unknown[]>(): Emitter<Args> => {
  const handlers = new Set<(...args: Args) => void>();
  return {
    on: (h) => { handlers.add(h); return () => handlers.delete(h); },
    emit: (...args) => { for (const h of [...handlers]) h(...args); },
  };
};

interface FakePeer extends RtcPeer {
  _deliver(text: string): void;
  _receive(track: MediaStreamTrack): void;
  _link(other: FakePeer): void;
}

interface FakeBroadcast extends BroadcastSignaler {
  announced: Array<Array<{ offerId: string, payload: unknown }>>;
  _offer(signal: SignalPayload): void;
  _answer(signal: SignalPayload): void;
}

interface FakePresence extends PresenceSignaler {
  _peer(peerId: string): void;
  _gone(peerId: string): void;
  _offer(signal: SignalPayload): void;
  _answer(signal: SignalPayload): void;
  _candidate(signal: SignalPayload): void;
  _data(frame: unknown, from: string): void;
  drop(): void;
}

const createBus = () => {
  const broadcast = new Map<string, FakeBroadcast>();
  const presence = new Map<string, FakePresence>();
  let sdpCounter = 0;
  const offering = new Map<string, FakePeer>();
  const answering = new Map<string, { answerer: FakePeer, offer: string }>();

  const fakePeer = ({ openDelay = 5, fail = false, failAfter = 20 }: { openDelay?: number, fail?: boolean, failAfter?: number } = {}): FakePeer => {
    const message = emitter<[string]>();
    const open = emitter<[]>();
    const close = emitter<[string]>();
    const candidate = emitter<[RTCIceCandidateInit]>();
    const track = emitter<[MediaStreamTrack]>();
    let state: "connecting" | "open" | "closed" = "connecting";
    let localTrack: MediaStreamTrack | null = null;
    let remoteTrack: MediaStreamTrack | null = null;
    let link: FakePeer | null = null;

    const self: FakePeer = {
      get state() { return state; },
      _deliver: (text) => message.emit(text),
      _receive: (incoming) => { remoteTrack = incoming; track.emit(incoming); },
      get remoteTrack() { return remoteTrack; },
      async setTrack(next) {
        localTrack = next;
        if (link && next) setTimeout(() => link?._receive(next), 0);
      },
      onTrack: track.on,
      _link: (other) => {
        link = other;
        const track = localTrack;
        if (track) setTimeout(() => other._receive(track), 0);
        if (fail) return void setTimeout(() => self.close(), failAfter);
        setTimeout(() => { if (state === "connecting") { state = "open"; open.emit(); } }, openDelay);
      },
      async offer() { const sdp = `offer:${++sdpCounter}`; offering.set(sdp, self); return sdp; },
      async answer(sdp) {
        const reply = `answer:${sdp}:${++sdpCounter}`;
        if (offering.get(sdp)) answering.set(reply, { answerer: self, offer: sdp });
        return reply;
      },
      async accept(sdp) {
        const taken = answering.get(sdp);
        if (!taken || offering.get(taken.offer) !== self) return;
        answering.delete(sdp);
        offering.delete(taken.offer);
        self._link(taken.answerer);
        taken.answerer._link(self);
      },
      async addCandidate() {},
      async send(text) {
        if (state !== "open") throw new Error("fake peer not open");
        const target = link;
        if (target) setTimeout(() => target._deliver(text), 0);
      },
      onMessage: message.on,
      onOpen: open.on,
      onClose: close.on,
      onCandidate: candidate.on,
      close: () => {
        if (state === "closed") return;
        state = "closed";
        close.emit("closed");
        if (link && link.state !== "closed") link.close();
      },
    };
    return self;
  };

  const broadcastSignaler = (selfId: string): FakeBroadcast => {
    const offer = emitter<[SignalPayload]>();
    const answer = emitter<[SignalPayload]>();
    const closeE = emitter<[string]>();
    let current: Array<{ offerId: string, payload: unknown }> = [];
    const deliver = (offers: Array<{ offerId: string, payload: unknown }>) => {
      for (const [id, other] of broadcast)
        if (id !== selfId) for (const o of offers) other._offer({ peerId: selfId, offerId: o.offerId, payload: o.payload });
    };
    const interval = setInterval(() => deliver(current), 40);
    const self: FakeBroadcast = {
      id: "fake-broadcast", selfId, ready: Promise.resolve(), announced: [],
      announce: (offers) => {
        self.announced.push(offers);
        current = offers;
        setTimeout(() => deliver(offers), 0);
      },
      answer: (peerId, offerId, payload) => setTimeout(() => broadcast.get(peerId)?._answer({ peerId: selfId, offerId, payload }), 0),
      _offer: offer.emit, _answer: answer.emit,
      onOffer: offer.on, onAnswer: answer.on, onClose: closeE.on,
      close: () => { clearInterval(interval); broadcast.delete(selfId); closeE.emit("closed"); },
    };
    broadcast.set(selfId, self);
    return self;
  };

  const presenceSignaler = (selfId: string): FakePresence => {
    const peer = emitter<[string]>();
    const gone = emitter<[string]>();
    const offer = emitter<[SignalPayload]>();
    const answer = emitter<[SignalPayload]>();
    const candidate = emitter<[SignalPayload]>();
    const data = emitter<[unknown, string]>();
    const closeE = emitter<[string]>();
    const self: FakePresence = {
      id: "fake-presence", selfId, presence: true, ready: Promise.resolve(),
      peers: () => [...presence.keys()].filter((id) => id !== selfId),
      onPeer: peer.on, onPeerGone: gone.on, onOffer: offer.on, onAnswer: answer.on, onCandidate: candidate.on, onData: data.on, onClose: closeE.on,
      offer: (to, offerId, payload) => setTimeout(() => presence.get(to)?._offer({ peerId: selfId, offerId, payload }), 0),
      answer: (to, offerId, payload) => setTimeout(() => presence.get(to)?._answer({ peerId: selfId, offerId, payload }), 0),
      candidate: (to, offerId, payload) => setTimeout(() => presence.get(to)?._candidate({ peerId: selfId, offerId, payload }), 0),
      sendData: (to, frame) => setTimeout(() => {
        for (const [id, other] of presence) if (id !== selfId && (!to || to === id)) other._data(frame, selfId);
      }, 0),
      _peer: peer.emit, _gone: gone.emit, _offer: offer.emit, _answer: answer.emit, _candidate: candidate.emit, _data: data.emit,
      drop: () => { presence.delete(selfId); closeE.emit("hub gone"); },
      close: () => {
        if (!presence.delete(selfId)) return;
        for (const other of presence.values()) other._gone(selfId);
      },
    };
    for (const other of presence.values()) setTimeout(() => other._peer(selfId), 0);
    presence.set(selfId, self);
    return self;
  };

  return { fakePeer, broadcastSignaler, presenceSignaler };
};

const A = "aaaaaaaaaaaaaaaaaaaa";
const B = "bbbbbbbbbbbbbbbbbbbb";
const C = "cccccccccccccccccccc";

try {
  {
    const bus = createBus();
    const sa = bus.broadcastSignaler(A);
    const sb = bus.broadcastSignaler(B);
    const a = createRoom({ selfId: A, signalers: [sa], createPeer: () => bus.fakePeer(), poolSize: 2 });
    const b = createRoom({ selfId: B, signalers: [sb], createPeer: () => bus.fakePeer(), poolSize: 2 });
    const joins: Array<[string, string]> = [];
    a.onPeerJoin((id) => joins.push(["a", id]));
    b.onPeerJoin((id) => joins.push(["b", id]));
    await until(() => a.peers().length === 1 && b.peers().length === 1, "both joined");
    eq("a has b", JSON.stringify(a.peers()), JSON.stringify([B]));
    eq("a is direct to b", String(a.transportOf(B)), "direct");
    eq("b is direct to a", String(b.transportOf(A)), "direct");
    eq("a joined b once", String(joins.filter(([side]) => side === "a").length), "1");
    eq("b joined a once", String(joins.filter(([side]) => side === "b").length), "1");

    const got: Array<[unknown, string]> = [];
    b.action("rpc").on((data, from) => got.push([data, from]));
    await a.action("rpc").send({ n: 1 });
    await a.action("rpc").send({ n: 2 }, B);
    await until(() => got.length === 2, "b received both");
    eq("both actions land with their sender", JSON.stringify(got), JSON.stringify([[{ n: 1 }, A], [{ n: 2 }, A]]));
    await until(() => sa.announced.at(-1)?.length === 2, "a's pool refilled to 2");
    a.leave();
    b.leave();
  }

  {
    const bus = createBus();
    const sa = bus.broadcastSignaler(A);
    const sb = bus.broadcastSignaler(B);
    const wrap = { seal: async (v: unknown) => `sealed:${JSON.stringify(v)}`, open: async (p: unknown) => (typeof p === "string" && p.startsWith("sealed:") ? JSON.parse(p.slice(7)) : null) };
    const a = createRoom({ selfId: A, signalers: [sa], createPeer: () => bus.fakePeer(), poolSize: 1, ...wrap });
    const b = createRoom({ selfId: B, signalers: [sb], createPeer: () => bus.fakePeer(), poolSize: 1, ...wrap });
    await until(() => a.peers().length === 1 && b.peers().length === 1, "both joined");
    ok("the announced payload was sealed", String(sa.announced[0]?.[0]?.payload).startsWith("sealed:"));
    a.leave();
    b.leave();
  }

  {
    const bus = createBus();
    const rooms = [A, B, C].map((id) => createRoom({ selfId: id, signalers: [bus.broadcastSignaler(id)], createPeer: () => bus.fakePeer(), poolSize: 3 }));
    const joins = new Map<string, string[]>(rooms.map((r) => [r.selfId, []]));
    for (const room of rooms) room.onPeerJoin((id) => joins.get(room.selfId)?.push(id));
    await until(() => rooms.every((r) => r.peers().length === 2), "full mesh", 15000);
    await tick(100);
    for (const room of rooms) eq(`${room.selfId} joined each peer once`, String(joins.get(room.selfId)?.length), "2");
    const got: string[] = [];
    const cRoom = rooms[2];
    if (cRoom) cRoom.action("x").on((_data, from) => got.push(from));
    const aRoom = rooms[0];
    const bRoom = rooms[1];
    if (aRoom) await aRoom.action("x").send(1);
    if (bRoom) await bRoom.action("x").send(1);
    await until(() => got.length === 2, "c heard a and b");
    eq("c heard a and b", JSON.stringify(got.sort()), JSON.stringify([A, B]));
    for (const room of rooms) room.leave();
  }

  {
    const bus = createBus();
    const a = createRoom({ selfId: A, signalers: [bus.broadcastSignaler(A)], createPeer: () => bus.fakePeer(), poolSize: 1 });
    const b = createRoom({ selfId: B, signalers: [bus.broadcastSignaler(B)], createPeer: () => bus.fakePeer(), poolSize: 1 });
    await until(() => a.peers().length === 1 && b.peers().length === 1, "joined");
    const left: string[] = [];
    a.onPeerLeave((id) => left.push(id));
    b.leave();
    await until(() => left.length === 1, "a saw b leave");
    eq("a saw b leave", JSON.stringify(left), JSON.stringify([B]));
    eq("a has no peers", JSON.stringify(a.peers()), "[]");
    a.leave();
  }

  {
    const bus = createBus();
    const sa = bus.presenceSignaler(A);
    const a = createRoom({ selfId: A, signalers: [sa], createPeer: () => bus.fakePeer(), fallbackMs: 200 });
    const sb = bus.presenceSignaler(B);
    const b = createRoom({ selfId: B, signalers: [sb], createPeer: () => bus.fakePeer(), fallbackMs: 200 });
    await until(() => a.peers().length === 1 && b.peers().length === 1, "joined");
    eq("a is direct to b", String(a.transportOf(B)), "direct");
    eq("b is direct to a", String(b.transportOf(A)), "direct");
    const got: unknown[] = [];
    a.action("rpc").on((data) => got.push(data));
    await b.action("rpc").send("hi");
    await until(() => got.length === 1, "delivered");
    a.leave();
    b.leave();
  }

  {
    const bus = createBus();
    let failing = true;
    const peerFor = () => bus.fakePeer(failing ? { fail: true, failAfter: 30 } : { openDelay: 5 });
    const sa = bus.presenceSignaler(A);
    const a = createRoom({ selfId: A, signalers: [sa], createPeer: peerFor, fallbackMs: 100, retryMs: 60 });
    const sb = bus.presenceSignaler(B);
    const b = createRoom({ selfId: B, signalers: [sb], createPeer: peerFor, fallbackMs: 100, retryMs: 60 });
    const transports: Array<[string, string]> = [];
    a.onTransportChange((id, t) => transports.push([id, t]));
    const joins: string[] = [];
    a.onPeerJoin((id) => joins.push(id));
    await until(() => a.peers().length === 1 && b.peers().length === 1, "joined relayed");
    eq("a is relayed to b", String(a.transportOf(B)), "relayed");
    eq("b is relayed to a", String(b.transportOf(A)), "relayed");
    const got: Array<[unknown, string]> = [];
    b.action("rpc").on((data, from) => got.push([data, from]));
    await a.action("rpc").send({ via: "relay" });
    await until(() => got.length === 1, "relayed data landed");
    eq("relayed data lands", JSON.stringify(got), JSON.stringify([[{ via: "relay" }, A]]));

    failing = false;
    await until(() => a.transportOf(B) === "direct" && b.transportOf(A) === "direct", "retry promoted to direct", 4000);
    eq("the last transport change is direct", JSON.stringify(transports.at(-1)), JSON.stringify([B, "direct"]));
    eq("promotion is not a second join", JSON.stringify(joins), JSON.stringify([B]));
    await a.action("rpc").send({ via: "direct" });
    await until(() => got.length === 2, "direct data landed");
    a.leave();
    b.leave();
  }

  {
    const bus = createBus();
    let attempts = 0;
    const sa = bus.broadcastSignaler(A);
    const sb = bus.broadcastSignaler(B);
    const peerFor = () => { attempts++; return bus.fakePeer(attempts <= 2 ? { fail: true, failAfter: 5000 } : {}); };
    const a = createRoom({ selfId: A, signalers: [sa], createPeer: () => bus.fakePeer(), poolSize: 1 });
    const b = createRoom({ selfId: B, signalers: [sb], createPeer: peerFor, poolSize: 1, connectTimeoutMs: 80 });
    await until(() => a.peers().length === 1 && b.peers().length === 1, "joined after the timeout", 4000);
    ok(`retried after timing out (${attempts} attempts)`, attempts > 2);
    a.leave();
    b.leave();
  }

  {
    const bus = createBus();
    const sa = bus.presenceSignaler(A);
    const a = createRoom({ selfId: A, signalers: [sa], createPeer: () => bus.fakePeer(), fallbackMs: 200, probeMs: 60 });
    const sb = bus.presenceSignaler(B);
    const b = createRoom({ selfId: B, signalers: [sb], createPeer: () => bus.fakePeer(), fallbackMs: 200, probeMs: 60 });
    await until(() => a.transportOf(B) === "direct" && b.transportOf(A) === "direct", "direct");
    const left: string[] = [];
    a.onPeerLeave((id) => left.push(id));
    sa._gone(B);
    await tick(150);
    eq("b answered the ping and stays", JSON.stringify(left), "[]");
    eq("a is still direct to b", String(a.transportOf(B)), "direct");
    b.leave();
    sa._gone(B);
    await until(() => left.length === 1, "no pong: a drops b");
    eq("a has no peers", JSON.stringify(a.peers()), "[]");
    a.leave();
  }

  {
    const bus = createBus();
    const sa = bus.presenceSignaler(A);
    const a = createRoom({ selfId: A, signalers: [sa], createPeer: () => bus.fakePeer({ fail: true }), fallbackMs: 50 });
    const sb = bus.presenceSignaler(B);
    const b = createRoom({ selfId: B, signalers: [sb], createPeer: () => bus.fakePeer({ fail: true }), fallbackMs: 50 });
    await until(() => a.transportOf(B) === "relayed", "relayed");
    const left: string[] = [];
    a.onPeerLeave((id) => left.push(id));
    sb.close();
    await until(() => left.length === 1, "a saw b go");
    eq("a has no peers", JSON.stringify(a.peers()), "[]");
    a.leave();
    b.leave();
  }

  {
    const bus = createBus();
    const sa = bus.presenceSignaler(A);
    const a = createRoom({ selfId: A, signalers: [sa], createPeer: () => bus.fakePeer({ fail: true }), fallbackMs: 50 });
    const sb = bus.presenceSignaler(B);
    const b = createRoom({ selfId: B, signalers: [sb], createPeer: () => bus.fakePeer({ fail: true }), fallbackMs: 50 });
    await until(() => a.transportOf(B) === "relayed", "relayed");
    const closes: string[] = [];
    const left: string[] = [];
    a.onClose((reason) => closes.push(reason));
    a.onPeerLeave((id) => left.push(id));
    sa.drop();
    eq("losing the hub drops relayed peers", JSON.stringify(left), JSON.stringify([B]));
    ok("losing the hub reports the close", /hub gone/.test(closes[0] ?? ""));
    a.leave();
    b.leave();
  }

  {
    const bus = createBus();
    const a = createRoom({ selfId: A, signalers: [bus.presenceSignaler(A), bus.broadcastSignaler(A)], createPeer: () => bus.fakePeer(), poolSize: 1, fallbackMs: 500 });
    const b = createRoom({ selfId: B, signalers: [bus.presenceSignaler(B), bus.broadcastSignaler(B)], createPeer: () => bus.fakePeer(), poolSize: 1, fallbackMs: 500 });
    const joins: string[] = [];
    a.onPeerJoin((id) => joins.push(id));
    await until(() => a.peers().length === 1 && b.peers().length === 1, "joined");
    await tick(150);
    eq("a peer reachable both ways joins once", JSON.stringify(joins), JSON.stringify([B]));
    eq("it is direct", String(a.transportOf(B)), "direct");
    const got: unknown[] = [];
    b.action("rpc").on((d) => got.push(d));
    await a.action("rpc").send("once");
    await tick(50);
    eq("an action lands once", JSON.stringify(got), JSON.stringify(["once"]));
    a.leave();
    b.leave();
  }

  {
    const bus = createBus();
    const a = createRoom({ selfId: A, signalers: [bus.broadcastSignaler(A)], createPeer: () => bus.fakePeer(), poolSize: 1 });
    const camera = { kind: "video", id: "camera-1" } as unknown as MediaStreamTrack;
    await a.setTrack(camera);
    const b = createRoom({ selfId: B, signalers: [bus.broadcastSignaler(B)], createPeer: () => bus.fakePeer(), poolSize: 1 });
    const heard: Array<[string, string]> = [];
    b.onTrack((peerId, track) => heard.push([peerId, track.id]));
    await until(() => heard.length > 0, "b heard a's track");
    eq("b heard a's camera", JSON.stringify(heard.at(-1)), JSON.stringify([A, "camera-1"]));
    eq("b's track of a is the camera", String(b.trackOf(A)?.id), "camera-1");
    eq("a has no track of b", JSON.stringify(a.trackOf(B)), "null");
    a.leave();
    b.leave();
  }

  {
    const bus = createBus();
    const sa = bus.presenceSignaler(A);
    const sb = bus.presenceSignaler(B);
    const a = createRoom({ selfId: A, signalers: [sa], createPeer: () => bus.fakePeer() });
    const b = createRoom({ selfId: B, signalers: [sb], createPeer: () => bus.fakePeer() });
    await until(() => a.transportOf(B) === "direct" && b.transportOf(A) === "direct", "direct");
    const heard: string[] = [];
    a.onTrack((_peerId, track) => heard.push(track.id));
    await b.setTrack({ kind: "video", id: "back" } as unknown as MediaStreamTrack);
    await until(() => heard.includes("back"), "back camera");
    await b.setTrack({ kind: "video", id: "front" } as unknown as MediaStreamTrack);
    await until(() => heard.includes("front"), "front camera");
    eq("a's track of b is the front camera", String(a.trackOf(B)?.id), "front");
    a.leave();
    b.leave();
  }
} finally {
  for (const room of live) room.leave();
}

done();
