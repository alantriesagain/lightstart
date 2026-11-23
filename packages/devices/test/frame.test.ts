/**
 * @file The hex codec and ATT chunking every driver shares.
 */

import { done, eq as rawEq, throws } from "@lightstart/test/assert.ts";
import { bytesToHex, hexToBytes, chunk } from "../lib/frame.js";

const eq = (name: string, actual: unknown, expected: unknown) => rawEq(name, String(actual), String(expected));
const deep = (name: string, actual: unknown, expected: unknown) => eq(name, JSON.stringify(actual), JSON.stringify(expected));

eq("bytesToHex pads and lowercases", bytesToHex([0x03, 0x01, 0x01, 0x01]), "03010101");
eq("bytesToHex keeps a leading zero", bytesToHex([0x00, 0xff, 0x0a]), "00ff0a");
eq("bytesToHex handles an empty array", bytesToHex([]), "");
eq("bytesToHex masks values to a byte", bytesToHex([0x1ff]), "ff");

const bytes = [0x00, 0x13, 0x46, 0xff];
deep("hexToBytes round-trips", hexToBytes(bytesToHex(bytes)), bytes);
throws("hexToBytes rejects an odd length", () => hexToBytes("abc"), "odd-length-hex");
throws("hexToBytes rejects a non-hex pair", () => hexToBytes("zz"), "invalid-hex");
deep("hexToBytes reads an empty string", hexToBytes(""), []);

{
  const all = Array.from({ length: 45 }, (_, i) => i);
  const chunks = chunk(all);
  eq("chunk splits at the 20-byte ATT default", chunks.length, 3);
  eq("chunk keeps a full first packet", chunks[0].length, 20);
  eq("chunk keeps a full second packet", chunks[1].length, 20);
  deep("chunk emits an exact final partial", chunks[2], [40, 41, 42, 43, 44]);
}

eq("chunk handles an exact multiple", chunk(Array.from({ length: 40 }, () => 1)).length, 2);
deep("chunk handles an empty payload", chunk([]), []);
throws("chunk refuses a zero size", () => chunk([1], 0), "chunk-size-must-be-positive");

done();
