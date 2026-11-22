// node-only
/**
 * @file Room crypto: a value the same key opens with a fresh iv, a wrong
 * password answers null, the room digest is 20 stable bytes, and the base64
 * helpers round-trip binary of any length.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { base64ToBytes, bytesToBase64, bytesToHex, deriveRoomKey, hasSubtle, open, roomDigest, seal } from "../crypto.js";

ok("runs where WebCrypto is available", hasSubtle());

{
  const key = await deriveRoomKey("app", "secret");
  const a = await seal(key, { sdp: "v=0", n: 1 });
  const b = await seal(key, { sdp: "v=0", n: 1 });
  ok("seals a value with a fresh iv each time", a !== b);
  eq("the same key opens the first blob", JSON.stringify(await open(key, a)), JSON.stringify({ sdp: "v=0", n: 1 }));
  eq("the same key opens the second blob", JSON.stringify(await open(key, b)), JSON.stringify({ sdp: "v=0", n: 1 }));
}

{
  const key = await deriveRoomKey("app", "secret");
  const blob = await seal(key, "hello");
  eq("a different password answers null", JSON.stringify(await open(await deriveRoomKey("app", "other"), blob)), "null");
  eq("a different app answers null", JSON.stringify(await open(await deriveRoomKey("other-app", "secret"), blob)), "null");
  eq("a blob that is not base64 answers null", JSON.stringify(await open(key, "not base64 at all!")), "null");
  eq("an empty blob answers null", JSON.stringify(await open(key, "")), "null");
}

{
  const one = await roomDigest("app", "room");
  const two = await roomDigest("app", "room");
  eq("the room digest is 20 bytes", String(one.length), "20");
  eq("the room digest is stable", bytesToHex(one), bytesToHex(two));
  ok("another room has another digest", bytesToHex(one) !== bytesToHex(await roomDigest("app", "room2")));
}

for (const length of [0, 1, 2, 3, 100, 70000]) {
  const bytes = Uint8Array.from({ length }, (_, i) => (i * 7) % 256);
  eq(`base64 round-trips ${length} bytes`, JSON.stringify([...base64ToBytes(bytesToBase64(bytes))]), JSON.stringify([...bytes]));
}

done();
