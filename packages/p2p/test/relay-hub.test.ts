// node-only
/**
 * @file The relay hub and its routes: pairing presence, auth and duplicate
 * refusal, targeted and broadcast data, peer-left and room cleanup, the
 * published pair payload gated on a live room, strangers, and the HTTP
 * answers for the info, a refused pair post and an empty publication.
 */

import { done, eq } from "@lightstart/test/assert.ts";
import { fileURLToPath } from "node:url";
import { bodyOf, request } from "@lightstart/server/memory";
import { serve, type NodeServer } from "@lightstart/server/node";
import { createRelayHub, type RelayHub } from "../cli/relay-hub.ts";
import relayRoutes, { relayApp, relayHttp } from "../cli/routes/relay.ts";

type Client = { ws: WebSocket, inbox: Record<string, unknown>[] };

const until = async (predicate: () => boolean, label: string): Promise<void> => {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error(`timed out waiting for ${label}`);
};

let hub: RelayHub | null = null;
let server: NodeServer | null = null;
let port = 0;

const connect = (): Promise<Client> =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/_relay`);
    const inbox: Record<string, unknown>[] = [];
    ws.addEventListener("message", (event) => inbox.push(JSON.parse(String(event.data))));
    ws.addEventListener("open", () => resolve({ ws, inbox }));
    ws.addEventListener("error", () => reject(new Error("connect failed")));
  });

const ofType = (client: Client, t: string) => client.inbox.filter((m) => m.t === t);

const join = async (client: Client, roomId: string, peerId: string, auth = "secret") => {
  client.ws.send(JSON.stringify({ t: "join", roomId, peerId, auth }));
  await until(() => client.inbox.some((m) => m.t === "joined" || m.t === "error"), `join reply for ${peerId}`);
  return client.inbox.find((m) => m.t === "joined" || m.t === "error");
};

try {
  hub = createRelayHub();
  const activeHub = hub;
  server = await serve(relayApp(activeHub), { port: 0, host: "127.0.0.1", sockets: {} });
  port = server.port;

  {
    const alice = await connect();
    eq("the first join answers no peers", JSON.stringify(await join(alice, "room-a", "alice")), JSON.stringify({ t: "joined", peers: [] }));
    const bob = await connect();
    eq("the next join answers the peers already there", JSON.stringify(await join(bob, "room-a", "bob")), JSON.stringify({ t: "joined", peers: ["alice"] }));
    await until(() => ofType(alice, "peer-joined").length === 1, "alice hears peer-joined");
    eq("the peer-joined frame names bob", JSON.stringify(ofType(alice, "peer-joined")), JSON.stringify([{ t: "peer-joined", peerId: "bob" }]));
    alice.ws.close();
    bob.ws.close();
  }

  {
    const first = await connect();
    await join(first, "room-b", "one", "right");
    const wrong = await connect();
    eq("a wrong auth is refused", JSON.stringify(await join(wrong, "room-b", "two", "wrong")), JSON.stringify({ t: "error", code: "bad-auth" }));
    const dupe = await connect();
    eq("a duplicate peer id is refused", JSON.stringify(await join(dupe, "room-b", "one", "right")), JSON.stringify({ t: "error", code: "duplicate-peer" }));
    first.ws.close();
  }

  {
    const alice = await connect();
    const bob = await connect();
    const carol = await connect();
    await join(alice, "room-c", "alice");
    await join(bob, "room-c", "bob");
    await join(carol, "room-c", "carol");
    alice.ws.send(JSON.stringify({ t: "data", action: "rpc", payload: { x: 1 }, to: "bob" }));
    await until(() => ofType(bob, "data").length === 1, "targeted frame");
    eq("a targeted frame reaches only bob", JSON.stringify(ofType(bob, "data")), JSON.stringify([{ t: "data", action: "rpc", payload: { x: 1 }, from: "alice" }]));
    eq("carol never hears the targeted frame", JSON.stringify(ofType(carol, "data")), "[]");
    alice.ws.send(JSON.stringify({ t: "data", action: "rpc", payload: "all" }));
    await until(() => ofType(bob, "data").length === 2 && ofType(carol, "data").length === 1, "broadcast frames");
    eq("a broadcast reaches carol", JSON.stringify(ofType(carol, "data")), JSON.stringify([{ t: "data", action: "rpc", payload: "all", from: "alice" }]));
    eq("the sender never receives its own broadcast", JSON.stringify(ofType(alice, "data")), "[]");
    alice.ws.close();
    bob.ws.close();
    carol.ws.close();
  }

  {
    const alice = await connect();
    const bob = await connect();
    await join(alice, "room-d", "alice");
    await join(bob, "room-d", "bob");
    alice.ws.close();
    await until(() => ofType(bob, "peer-left").length === 1, "bob hears peer-left");
    eq("bob hears alice leave", JSON.stringify(ofType(bob, "peer-left")), JSON.stringify([{ t: "peer-left", peerId: "alice" }]));
    bob.ws.send(JSON.stringify({ t: "leave" }));
    await until(() => activeHub.roomCount() === 0, "all rooms garbage-collected");
    eq("no rooms are left", JSON.stringify(activeHub.roomIds()), "[]");
  }

  {
    eq("no pair payload is published at first", JSON.stringify(activeHub.getPair()), "null");
    activeHub.setPair({ payload: "encoded-payload", roomId: "room-pair", path: "/admin" });
    eq("no payload before the host joins its room", JSON.stringify(activeHub.getPair()), "null");
    const host = await connect();
    await join(host, "room-pair", "host-peer");
    eq("the live room publishes its payload", JSON.stringify(activeHub.getPair()), JSON.stringify({ payload: "encoded-payload", path: "/admin" }));
    host.ws.send(JSON.stringify({ t: "leave" }));
    await until(() => activeHub.getPair() === null, "payload gated off once the room empties");
  }

  {
    const alice = await connect();
    await join(alice, "room-e", "alice");
    const stranger = await connect();
    stranger.ws.send(JSON.stringify({ t: "data", action: "rpc", payload: "sneaky" }));
    const bob = await connect();
    await join(bob, "room-e", "bob");
    await until(() => ofType(alice, "peer-joined").length === 1, "alice hears the legit join");
    eq("a socket that never joined cannot send data", JSON.stringify(ofType(alice, "data")), "[]");
    alice.ws.close();
    bob.ws.close();
    stranger.ws.close();
  }

  {
    const app = relayHttp(activeHub);
    const info = JSON.parse(await bodyOf(await request(app, "GET", "/_relay/info", { headers: { host: "lan.local:1315" } })));
    eq("the info route names the relay and the local origin", JSON.stringify(info), JSON.stringify({ relay: true, origins: { local: "http://lan.local:1315" } }));
    const refused = await request(app, "POST", "/_relay/pair", { body: '{"payload":"p"}', headers: { "content-type": "application/json" } });
    eq("a pair post without every field is refused", String(refused.status), "400");
    eq("a pair post that is not JSON is refused", String((await request(app, "POST", "/_relay/pair", { body: "not json" })).status), "400");
    eq("an unpublished pair answers nulls", JSON.stringify(JSON.parse(await bodyOf(await request(app, "GET", "/_relay/pair")))), JSON.stringify({ payload: null, path: null }));
    const plain = await request(relayApp(activeHub), "GET", "/_relay");
    eq("a plain request to the socket is told to upgrade", String(plain.status), "426");
  }

  {
    const app = relayRoutes({ projectDir: "/nonexistent-project" });
    eq("a project that does not declare the package gets no relay route", String((await request(app, "GET", "/_relay/info")).status), "404");
    const declared = relayRoutes({ projectDir: fileURLToPath(new URL("./fixtures/project", import.meta.url)) });
    eq("a project that declares the package gets the socket route", String((await request(declared, "GET", "/_relay")).status), "426");
  }
} finally {
  hub?.close();
  if (server !== null) await server.close();
}

done();
