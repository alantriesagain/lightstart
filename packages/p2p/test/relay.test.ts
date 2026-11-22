// node-only
/**
 * @file The relay signaler against the real hub: presence, targeted signals,
 * data frames unicast and broadcast (queued until joined), a wrong secret,
 * a peer leaving, and the hub going away.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { App, upgrade } from "@lightstart/server";
import { serve, type NodeServer } from "@lightstart/server/node";
import { createRelayHub, type RelayHub } from "../cli/relay-hub.ts";
import { createRelaySignaler } from "../signal/relay.js";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (predicate: () => boolean, label = "condition") => {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await wait(20);
  }
  throw new Error(`timed out waiting for ${label}`);
};

const serveHub = (relay: RelayHub): Promise<NodeServer> =>
  serve(new App().get("/_relay", (c) => upgrade(c, relay.channel())), { port: 0, sockets: {} });

let server: NodeServer | null = null;
let hub: RelayHub | null = null;
let url = "";
const join = (roomId: string, selfId: string, password = "pw") =>
  createRelaySignaler({ url, appId: "app", password, roomId, selfId });

try {
  hub = createRelayHub();
  server = await serveHub(hub);
  url = `http://localhost:${server.port}`;

  {
    const a = join("presence", "aaaaaaaaaaaaaaaaaaaa");
    await a.ready;
    const seenByB: string[] = [];
    const b = join("presence", "bbbbbbbbbbbbbbbbbbbb");
    b.onPeer((peerId) => seenByB.push(peerId));
    const seenByA: string[] = [];
    a.onPeer((peerId) => seenByA.push(peerId));
    await b.ready;
    await until(() => seenByA.length === 1 && seenByB.length === 1, "both sides see each other");
    eq("a sees b", JSON.stringify(seenByA), JSON.stringify(["bbbbbbbbbbbbbbbbbbbb"]));
    eq("b sees a", JSON.stringify(seenByB), JSON.stringify(["aaaaaaaaaaaaaaaaaaaa"]));
    eq("the peer list answers b", JSON.stringify(a.peers()), JSON.stringify(["bbbbbbbbbbbbbbbbbbbb"]));
    a.close();
    b.close();
  }

  {
    const a = join("signals", "aaaaaaaaaaaaaaaaaaaa");
    const b = join("signals", "bbbbbbbbbbbbbbbbbbbb");
    const c = join("signals", "cccccccccccccccccccc");
    await Promise.all([a.ready, b.ready, c.ready]);
    const gotB: Array<[string, unknown]> = [];
    const gotC: Array<[string, unknown]> = [];
    b.onOffer((s) => gotB.push(["offer", s]));
    b.onCandidate((s) => gotB.push(["candidate", s]));
    c.onOffer((s) => gotC.push(["offer", s]));
    a.offer("bbbbbbbbbbbbbbbbbbbb", "o1", { sdp: "v=0" });
    a.candidate("bbbbbbbbbbbbbbbbbbbb", "o1", { candidate: "c" });
    await until(() => gotB.length === 2, "b receives both");
    eq("the offer is targeted at b", JSON.stringify(gotB[0]), JSON.stringify(["offer", { peerId: "aaaaaaaaaaaaaaaaaaaa", offerId: "o1", payload: { sdp: "v=0" } }]));
    eq("the candidate is targeted at b", JSON.stringify(gotB[1]), JSON.stringify(["candidate", { peerId: "aaaaaaaaaaaaaaaaaaaa", offerId: "o1", payload: { candidate: "c" } }]));
    const answers: Array<{ payload: unknown }> = [];
    a.onAnswer((s) => answers.push({ payload: s.payload }));
    b.answer("aaaaaaaaaaaaaaaaaaaa", "o1", { sdp: "v=1" });
    await until(() => answers.length === 1, "a receives the answer");
    eq("the answer lands with its sdp", JSON.stringify(answers[0]?.payload), JSON.stringify({ sdp: "v=1" }));
    eq("it never reached c", String(gotC.length), "0");
    a.close();
    b.close();
    c.close();
  }

  {
    const b = join("data", "bbbbbbbbbbbbbbbbbbbb");
    await b.ready;
    const gotB: Array<[unknown, string]> = [];
    b.onData((frame, from) => gotB.push([frame, from]));
    const a = join("data", "aaaaaaaaaaaaaaaaaaaa");
    a.sendData("bbbbbbbbbbbbbbbbbbbb", { hello: "queued" });
    await a.ready;
    await until(() => gotB.length === 1, "b receives the queued unicast");
    eq("the queued frame lands", JSON.stringify(gotB), JSON.stringify([[{ hello: "queued" }, "aaaaaaaaaaaaaaaaaaaa"]]));
    const c = join("data", "cccccccccccccccccccc");
    const gotC: Array<[unknown, string]> = [];
    c.onData((frame, from) => gotC.push([frame, from]));
    await c.ready;
    await until(() => a.peers().length === 2, "a sees both");
    a.sendData(null, { hello: "all" });
    await until(() => gotB.length === 2 && gotC.length === 1, "broadcast lands on both");
    eq("the broadcast lands on c", JSON.stringify(gotC), JSON.stringify([[{ hello: "all" }, "aaaaaaaaaaaaaaaaaaaa"]]));
    a.close();
    b.close();
    c.close();
  }

  {
    const a = join("auth", "aaaaaaaaaaaaaaaaaaaa", "right");
    await a.ready;
    const bad = join("auth", "bbbbbbbbbbbbbbbbbbbb", "wrong");
    let rejected = false;
    try { await bad.ready; } catch (error) { rejected = String(error).includes("bad-auth"); }
    ok("a wrong secret rejects ready with bad-auth", rejected);
    const gone: string[] = [];
    a.onPeerGone((peerId) => gone.push(peerId));
    const b = join("auth", "bbbbbbbbbbbbbbbbbbbb", "right");
    await b.ready;
    await until(() => a.peers().length === 1, "b present");
    b.close();
    await until(() => gone.length === 1, "a sees b leave");
    eq("a saw b leave", JSON.stringify(gone), JSON.stringify(["bbbbbbbbbbbbbbbbbbbb"]));
    a.close();
  }

  {
    const localHub = createRelayHub();
    const localServer = await serveHub(localHub);
    const localUrl = `http://localhost:${localServer.port}`;
    const a = createRelaySignaler({ url: localUrl, appId: "app", password: "pw", roomId: "r", selfId: "aaaaaaaaaaaaaaaaaaaa" });
    const b = createRelaySignaler({ url: localUrl, appId: "app", password: "pw", roomId: "r", selfId: "bbbbbbbbbbbbbbbbbbbb" });
    await Promise.all([a.ready, b.ready]);
    await until(() => a.peers().length === 1, "b present");
    const gone: string[] = [];
    const closes: string[] = [];
    a.onPeerGone((peerId) => gone.push(peerId));
    a.onClose((reason) => closes.push(reason));
    localHub.close();
    await localServer.close();
    await until(() => closes.length === 1, "onClose fired");
    eq("losing the hub drops the peer", JSON.stringify(gone), JSON.stringify(["bbbbbbbbbbbbbbbbbbbb"]));
    eq("losing the hub leaves no peers", JSON.stringify(a.peers()), "[]");
    a.close();
    b.close();
  }
} finally {
  hub?.close();
  if (server !== null) await server.close();
}

done();
