// node-only
/**
 * @file The torrent signaler against a fake tracker: the offer pool under the
 * 20-byte info_hash, forwarded offers, answers back to the offerer, the
 * tracker's interval, dedupe, and ignoring its own offers and other rooms.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { App, Channel, upgrade, type Socket } from "@lightstart/server";
import { serve, type NodeServer } from "@lightstart/server/node";
import { createTorrentSignaler } from "../signal/torrent.js";

type Announce = {
  info_hash: string;
  peer_id: string;
  numwant?: number;
  offers?: Array<{ offer_id: string, offer: { type: string, sdp: string } }>;
  answer?: { type: string, sdp: string };
  to_peer_id?: string;
  offer_id?: string;
  interval?: number;
};

const announces: Announce[] = [];
const swarms = new Map<string, Map<string, Socket>>();

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (predicate: () => boolean, label = "condition") => {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await wait(20);
  }
  throw new Error(`timed out waiting for ${label}`);
};

class FakeTracker extends Channel {
  registered: { hash: string, peerId: string } | null = null;

  override message(ws: Socket, text: string): void {
    const msg = /** @type {Announce} */ (JSON.parse(text));
    announces.push(msg);
    if (!swarms.has(msg.info_hash)) swarms.set(msg.info_hash, new Map());
    const swarm = swarms.get(msg.info_hash);
    if (swarm === undefined) return;
    swarm.set(msg.peer_id, ws);
    this.registered = { hash: msg.info_hash, peerId: msg.peer_id };
    if (msg.answer) {
      const target = swarm.get(msg.to_peer_id ?? "");
      target?.send(JSON.stringify({ action: "announce", info_hash: msg.info_hash, peer_id: msg.peer_id, offer_id: msg.offer_id, answer: msg.answer }));
      return;
    }
    for (const offer of msg.offers || [])
      for (const [peerId, other] of swarm)
        if (peerId !== msg.peer_id)
          other.send(JSON.stringify({ action: "announce", info_hash: msg.info_hash, peer_id: msg.peer_id, offer_id: offer.offer_id, offer: offer.offer }));
    ws.send(JSON.stringify({ action: "announce", info_hash: msg.info_hash, interval: 120, complete: 0, incomplete: swarm.size }));
  }

  override close(): void {
    if (this.registered) swarms.get(this.registered.hash)?.delete(this.registered.peerId);
  }
}

const tracker = new App().get("/announce", (c) => upgrade(c, new FakeTracker()));

const hash = Uint8Array.from({ length: 20 }, (_, i) => i * 12);
let server: NodeServer | null = null;
let url = "";

const signaler = (selfId: string, extra: { announceInterval?: number } = {}) =>
  createTorrentSignaler({ trackers: [`${url}/announce`], infoHash: hash, selfId, announceInterval: 200, ...extra });

try {
  server = await serve(tracker, { port: 0, sockets: {} });
  url = `ws://localhost:${server.port}`;

  {
    const a = signaler("aaaaaaaaaaaaaaaaaaaa");
    const b = signaler("bbbbbbbbbbbbbbbbbbbb");
    await Promise.all([a.ready, b.ready]);
    const offersAtB: unknown[] = [];
    b.onOffer((s) => offersAtB.push(s));
    b.announce([]);
    await until(() => announces.some((m) => m.peer_id === "bbbbbbbbbbbbbbbbbbbb"), "b registered");
    a.announce([{ offerId: "o1", payload: "sealed-offer" }]);
    await until(() => offersAtB.length === 1, "b receives the offer");
    eq("the offer lands with its sender and payload", JSON.stringify(offersAtB[0]), JSON.stringify({ peerId: "aaaaaaaaaaaaaaaaaaaa", offerId: "o1", payload: "sealed-offer" }));
    const sent = announces.find((m) => m.peer_id === "aaaaaaaaaaaaaaaaaaaa" && (m.offers?.length ?? 0) > 0);
    ok("a's pool was announced", sent !== undefined);
    if (sent) {
      eq("the info_hash is 20 bytes", String(sent.info_hash.length), "20");
      eq("the info_hash is the room digest", sent.info_hash, String.fromCharCode(...hash));
      eq("the tracker is asked for ten peers", String(sent.numwant), "10");
      eq("the pool carries the sealed offer", JSON.stringify(sent.offers), JSON.stringify([{ offer_id: "o1", offer: { type: "offer", sdp: "sealed-offer" } }]));
    }
    a.close();
    b.close();
  }

  {
    const a = signaler("cccccccccccccccccccc");
    const b = signaler("dddddddddddddddddddd");
    await Promise.all([a.ready, b.ready]);
    const answers: unknown[] = [];
    const offers: unknown[] = [];
    a.onAnswer((s) => answers.push(s));
    b.onOffer((s) => offers.push(s));
    b.announce([]);
    await until(() => announces.some((m) => m.peer_id === "dddddddddddddddddddd"), "b registered");
    a.announce([{ offerId: "o2", payload: "sealed" }]);
    await until(() => offers.length === 1, "b has the offer");
    b.answer("cccccccccccccccccccc", "o2", "sealed-answer");
    await until(() => answers.length === 1, "a has the answer");
    eq("the answer lands with its sender and payload", JSON.stringify(answers[0]), JSON.stringify({ peerId: "dddddddddddddddddddd", offerId: "o2", payload: "sealed-answer" }));
    await wait(500);
    eq("the re-announced offer is not delivered twice", String(offers.length), "1");
    a.close();
    b.close();
  }

  {
    const a = signaler("eeeeeeeeeeeeeeeeeeee", { announceInterval: 60 });
    await a.ready;
    const mine = () => announces.filter((m) => m.peer_id === "eeeeeeeeeeeeeeeeeeee").length;
    await until(() => mine() >= 1, "registered on open");
    a.announce([{ offerId: "o3", payload: "x" }]);
    await until(() => mine() >= 2, "the pool announced");
    const count = mine();
    await wait(400);
    eq("the tracker's 120s interval replaced the 60ms one", String(mine()), String(count));
    a.close();
  }

  {
    const a = signaler("ffffffffffffffffffff");
    const other = createTorrentSignaler({ trackers: [`${url}/announce`], infoHash: hash.map((b) => b + 1), selfId: "gggggggggggggggggggg" });
    await Promise.all([a.ready, other.ready]);
    const offers: unknown[] = [];
    a.onOffer((s) => offers.push(s));
    other.onOffer((s) => offers.push(s));
    a.announce([{ offerId: "o4", payload: "mine" }]);
    other.announce([{ offerId: "o5", payload: "theirs" }]);
    await wait(300);
    eq("it ignores its own offers and other rooms", JSON.stringify(offers), "[]");
    a.close();
    other.close();
  }
} finally {
  if (server !== null) await server.close();
}

done();
