// node-only
/**
 * @file The MQTT 3.1.1 packet codec: CONNECT, PUBLISH (text and bytes),
 * SUBSCRIBE, CONNACK, SUBACK, the pings, DISCONNECT, the remaining-length
 * varint, a partial tail and an unknown type.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import {
  decodePackets, encodeConnAck, encodeConnect, encodeDisconnect, encodePingReq, encodePingResp,
  encodePublish, encodeSubAck, encodeSubscribe,
} from "../signal/mqtt-packet.js";

type Packet = ReturnType<typeof decodePackets>["packets"][number];

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
};

const first = (bytes: Uint8Array): Packet => {
  const packet = decodePackets(bytes).packets[0];
  if (packet === undefined) throw new Error("no packet decoded");
  return packet;
};

{
  const bytes = encodeConnect({ clientId: "peer-1", keepAlive: 45 });
  eq("CONNECT starts as 0x10", String(bytes[0]), String(0x10));
  eq("CONNECT carries the protocol name", JSON.stringify([...bytes.subarray(2, 8)]), JSON.stringify([0, 4, 77, 81, 84, 84]));
  eq("CONNECT carries protocol level 4", String(bytes[8]), "4");
  eq("CONNECT sets the clean-session flag", String(bytes[9]), String(0x02));
  eq("CONNECT decodes its client id and keepalive", JSON.stringify(first(bytes)), JSON.stringify({ type: "connect", clientId: "peer-1", keepAlive: 45 }));
}

{
  const text = first(encodePublish("rooms/abc", "hello"));
  ok("PUBLISH decodes as a publish", text.type === "publish");
  if (text.type === "publish") {
    eq("PUBLISH keeps its topic", text.topic, "rooms/abc");
    eq("PUBLISH keeps its text payload", text.text, "hello");
  }
  const binary = first(encodePublish("rooms/abc", Uint8Array.from([0, 255, 7])));
  ok("a byte PUBLISH decodes as a publish", binary.type === "publish");
  if (binary.type === "publish") eq("a byte PUBLISH keeps its payload", JSON.stringify([...binary.payload]), JSON.stringify([0, 255, 7]));
}

{
  const bytes = encodeSubscribe(7, ["a/b", "c"]);
  eq("SUBSCRIBE sets the reserved flag bit", String(bytes[0]), String(0x82));
  eq("SUBSCRIBE decodes its id and topics", JSON.stringify(first(bytes)), JSON.stringify({ type: "subscribe", packetId: 7, topics: ["a/b", "c"] }));
}

{
  const stream = concat(encodeConnAck(), encodeSubAck(7, [0, 0]), encodePingReq(), encodePingResp(), encodeDisconnect());
  const { packets, rest } = decodePackets(stream);
  eq("the packet stream decodes in order", JSON.stringify(packets.map((p) => p.type)), JSON.stringify(["connack", "suback", "pingreq", "pingresp", "disconnect"]));
  eq("SUBACK keeps its id and codes", JSON.stringify(packets[1]), JSON.stringify({ type: "suback", packetId: 7, codes: [0, 0] }));
  eq("no tail is left", String(rest.length), "0");
}

eq("a rejected CONNACK keeps its code", JSON.stringify(first(encodeConnAck({ code: 5 }))), JSON.stringify({ type: "connack", sessionPresent: false, code: 5 }));

{
  const payload = "x".repeat(300);
  const bytes = encodePublish("t", payload);
  eq("a long remaining length sets the continuation bit", String(bytes[1] & 0x80), String(0x80));
  const packet = first(bytes);
  ok("a long PUBLISH decodes as a publish", packet.type === "publish");
  if (packet.type === "publish") eq("a long PUBLISH decodes its payload", packet.text, payload);
}

{
  const whole = concat(encodePingResp(), encodePublish("t", "abcdef"));
  const cut = whole.subarray(0, whole.length - 3);
  const { packets, rest } = decodePackets(cut);
  eq("a partial tail leaves the complete packets", JSON.stringify(packets.map((p) => p.type)), JSON.stringify(["pingresp"]));
  eq("the partial tail is kept", String(rest.length), String(cut.length - 2));
  const resumed = first(concat(rest, whole.subarray(whole.length - 3)));
  ok("the resumed packet is a publish", resumed.type === "publish");
  if (resumed.type === "publish") eq("the partial packet completes", resumed.text, "abcdef");
}

eq("an unknown packet type surfaces its code", JSON.stringify(decodePackets(Uint8Array.from([0xf0, 0])).packets), JSON.stringify([{ type: "unknown", code: 15 }]));

done();
