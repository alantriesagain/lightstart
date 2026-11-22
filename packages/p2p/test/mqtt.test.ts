// node-only
/**
 * @file The MQTT signaler against a fake broker: the subprotocol, the room
 * and own-topic subscription, the offer pool on the room topic, answers on
 * the offerer's topic, dedupe, ignoring its own offers and the keepalive.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { App, Channel, upgrade, type Socket } from "@lightstart/server";
import { serve, type NodeServer } from "@lightstart/server/node";
import { decodePackets, encodeConnAck, encodePingResp, encodePublish, encodeSubAck } from "../signal/mqtt-packet.js";
import { createMqttSignaler } from "../signal/mqtt.js";

type Client = { socket: Socket | null, topics: Set<string>, id: string, protocol: string | null };

const clients = new Set<Client>();
const log: string[] = [];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (predicate: () => boolean, label = "condition") => {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await wait(20);
  }
  throw new Error(`timed out waiting for ${label}`);
};

class FakeBroker extends Channel {
  readonly client: Client;
  constructor(protocol: string | null) {
    super();
    this.client = { socket: null, topics: new Set(), id: "", protocol };
  }

  override open(socket: Socket): void {
    this.client.socket = socket;
    clients.add(this.client);
  }

  override binary(_socket: Socket, data: Uint8Array): void {
    const client = this.client;
    const { packets } = decodePackets(new Uint8Array(data));
    for (const packet of packets) {
      log.push(packet.type);
      if (packet.type === "connect") {
        client.id = packet.clientId;
        client.socket?.send(encodeConnAck());
      } else if (packet.type === "subscribe") {
        for (const topic of packet.topics) client.topics.add(topic);
        client.socket?.send(encodeSubAck(packet.packetId, packet.topics.map(() => 0)));
      } else if (packet.type === "publish") {
        for (const other of clients)
          if (other.topics.has(packet.topic)) other.socket?.send(encodePublish(packet.topic, packet.payload));
      } else if (packet.type === "pingreq") client.socket?.send(encodePingResp());
    }
  }

  override close(): void {
    clients.delete(this.client);
  }
}

const broker = new App().get("/mqtt", (c) => upgrade(c, new FakeBroker(c.header("sec-websocket-protocol"))).header("sec-websocket-protocol", "mqtt"));

let server: NodeServer | null = null;
let url = "";

const signaler = (selfId: string, extra: { brokers?: string[], roomHash?: string, announceInterval?: number, keepAlive?: number } = {}) =>
  createMqttSignaler({ brokers: [`${url}/mqtt`], roomHash: "abc123", selfId, announceInterval: 200, ...extra });

try {
  server = await serve(broker, { port: 0, sockets: {} });
  url = `ws://localhost:${server.port}`;

  {
    const a = signaler("aaaaaaaaaaaaaaaaaaaa");
    await a.ready;
    const me = [...clients].find((c) => c.id === "aaaaaaaaaaaaaaaaaaaa");
    ok("the broker knows the client", me !== undefined);
    if (me) {
      eq("it subscribes to the room and its own topic", JSON.stringify([...me.topics]), JSON.stringify(["lightstart/abc123", "lightstart/abc123/aaaaaaaaaaaaaaaaaaaa"]));
      eq("it asks with the mqtt subprotocol", String(me.protocol), "mqtt");
    }
    a.close();
  }

  {
    const a = signaler("bbbbbbbbbbbbbbbbbbbb");
    const b = signaler("cccccccccccccccccccc");
    await Promise.all([a.ready, b.ready]);
    const offers: unknown[] = [];
    const answers: unknown[] = [];
    b.onOffer((s) => offers.push(s));
    a.onAnswer((s) => answers.push(s));
    a.announce([{ offerId: "o1", payload: "sealed" }]);
    await until(() => offers.length === 1, "b receives the offer");
    eq("the offer lands with its sender and payload", JSON.stringify(offers[0]), JSON.stringify({ peerId: "bbbbbbbbbbbbbbbbbbbb", offerId: "o1", payload: "sealed" }));
    b.answer("bbbbbbbbbbbbbbbbbbbb", "o1", "sealed-answer");
    await until(() => answers.length === 1, "a receives the answer");
    eq("the answer lands with its sender and payload", JSON.stringify(answers[0]), JSON.stringify({ peerId: "cccccccccccccccccccc", offerId: "o1", payload: "sealed-answer" }));
    await wait(500);
    eq("re-published offers dedupe", String(offers.length), "1");
    a.close();
    b.close();
  }

  {
    const a = signaler("dddddddddddddddddddd", { keepAlive: 0.2 });
    await a.ready;
    const offers: unknown[] = [];
    a.onOffer((s) => offers.push(s));
    a.announce([{ offerId: "o2", payload: "mine" }]);
    const pingsBefore = log.filter((t) => t === "pingreq").length;
    await wait(500);
    eq("it ignores its own offers", JSON.stringify(offers), "[]");
    ok("it keeps the session alive with pings", log.filter((t) => t === "pingreq").length > pingsBefore);
    a.close();
  }
} finally {
  if (server !== null) await server.close();
}

done();
