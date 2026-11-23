/**
 * @file Open GoPro BLE framing: commands, status maps, capabilities and reassembly.
 */

import { done, eq as rawEq, throws } from "@lightstart/test/assert.ts";
import {
  encodeCommand,
  createReassembler,
  parseTlv,
  parseStatuses,
  decodeStatus,
  SHUTTER_ON,
  SHUTTER_OFF,
  QUERY_STATUS,
  parseSettingLists,
  SET_SETTING,
} from "../lib/protocol.js";

const eq = (name: string, actual: unknown, expected: unknown) => rawEq(name, String(actual), String(expected));
const deep = (name: string, actual: unknown, expected: unknown) => eq(name, JSON.stringify(actual), JSON.stringify(expected));

deep("encodeCommand length-prefixes the payload", encodeCommand(SHUTTER_ON), [0x03, 0x01, 0x01, 0x01]);
deep("encodeCommand prefixes the shutter off", encodeCommand(SHUTTER_OFF), [0x03, 0x01, 0x01, 0x00]);
deep("encodeCommand prefixes an empty payload", encodeCommand([]), [0x00]);
throws("encodeCommand refuses extended framing", () => encodeCommand(Array.from({ length: 32 }, () => 1)), "payload-too-long");
eq("encodeCommand allows the largest single frame", encodeCommand(Array.from({ length: 31 }, () => 1)).length, 32);

deep("QUERY_STATUS builds a status request for the given ids", QUERY_STATUS([0x46, 0x08]), [0x13, 0x46, 0x08]);

{
  const r = createReassembler();
  deep("reassembler returns a single-packet payload whole", r.push([0x05, 1, 2, 3, 4, 5]), [1, 2, 3, 4, 5]);
  eq("reassembler ignores an empty packet", r.push([]), null);
}

{
  const r = createReassembler();
  eq("reassembler waits for a continuation", r.push([0x0a, 1, 2, 3, 4]), null);
  deep("reassembler joins a header and one continuation", r.push([0x80, 5, 6, 7, 8, 9, 10]), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
}

{
  const r = createReassembler();
  eq("reassembler waits on a long first packet", r.push([0x14, ...Array.from({ length: 4 }, () => 0xaa)]), null);
  let done20 = null;
  for (let c = 0x80; c <= 0x8f; c++) {
    const out = r.push([c, 0xbb]);
    if (out) {
      done20 = out;
      break;
    }
  }
  eq("reassembler accepts continuation counters in sequence", done20?.length ?? 0, 20);
}

{
  const r = createReassembler();
  const payload = Array.from({ length: 300 }, (_, i) => i % 256);
  let out = r.push([0x21, 0x2c, ...payload.slice(0, 18)]);
  eq("reassembler waits on an extended length", out, null);
  let sent = 18;
  while (sent < 300) {
    const slice = payload.slice(sent, sent + 19);
    out = r.push([0x80, ...slice]);
    sent += slice.length;
  }
  deep("reassembler handles a 13-bit extended length", out, payload);
}

{
  const r = createReassembler();
  eq("reassembler waits for the declared length", r.push([0x06, 1, 2, 3]), null);
  deep("reassembler truncates a continuation that overshoots", r.push([0x80, 4, 5, 6, 7, 8, 9]), [1, 2, 3, 4, 5, 6]);
}

{
  const r = createReassembler();
  eq("reassembler ignores a stray continuation", r.push([0x81, 9, 9, 9]), null);
  r.reset();
  deep("reassembler recovers after reset", r.push([0x02, 7, 8]), [7, 8]);
}

{
  const r = createReassembler();
  eq("reassembler drops an out-of-range header byte", r.push([0x40, 1, 2]), null);
  deep("reassembler reads the next frame", r.push([0x01, 5]), [5]);
}

deep("parseTlv splits requestId, status and body", parseTlv([0x02, 0x00, 0xaa, 0xbb]), { requestId: 0x02, status: 0x00, body: [0xaa, 0xbb] });
const error = parseTlv([0x02, 0x01, 0xde]);
eq("parseTlv keeps the body on an error status", error.status, 1);
deep("parseTlv keeps the error body", error.body, [0xde]);
deep("parseTlv tolerates a one-byte payload", parseTlv([0x02]), { requestId: 2, status: undefined, body: [] });
deep("parseTlv tolerates an empty payload", parseTlv([]), { requestId: undefined, status: undefined, body: [] });

deep("parseStatuses reads single-byte values", parseStatuses([0x46, 0x01, 0x64]), { 0x46: 100 });
deep("parseStatuses reads big-endian multi-byte values", parseStatuses([0x08, 0x01, 0x01, 0x0d, 0x04, 0x00, 0x00, 0x00, 0x2a]), { 0x08: 1, 0x0d: 42 });
const unknown = parseStatuses([0x99, 0x02, 0x01, 0x00, 0x46, 0x01, 0x50]);
eq("parseStatuses keeps unknown ids", unknown[0x99], 256);
eq("parseStatuses continues past an unknown id", unknown[0x46], 80);
deep("parseStatuses stops on a truncated trailing entry", parseStatuses([0x46, 0x01, 0x64, 0x0d, 0x04, 0x00]), { 0x46: 100 });
deep("parseStatuses handles an empty body", parseStatuses([]), {});

deep("decodeStatus names the fields it was given", decodeStatus({ 0x46: 73, 0x08: 1, 0x0d: 12 }), { battery: 73, recording: true, durationMs: 12000 });
const absent = decodeStatus({ 0x08: 0 });
eq("decodeStatus reads a false recording", absent.recording, false);
eq("decodeStatus leaves an absent battery absen", "battery" in absent, false);
deep("decodeStatus handles an empty map", decodeStatus({}), {});

deep("SET_SETTING writes one byte", SET_SETTING(121, 4), [121, 0x01, 0x04]);
throws("SET_SETTING refuses a wider value", () => SET_SETTING(2, 300), "setting-value-too-wide");

deep("parseSettingLists gathers every repeated option", parseSettingLists([2, 1, 9, 2, 1, 1, 121, 1, 0, 121, 1, 4]), { 2: [9, 1], 121: [0, 4] });
deep("parseSettingLists stops on a truncated trailing entry", parseSettingLists([2, 1, 9, 121, 4, 0]), { 2: [9] });
deep(
  "parseSettingLists reads past a setting with no options",
  parseSettingLists([0x02, 0x00, 0x03, 0x00, 0x79, 0x01, 0x00, 0x79, 0x01, 0x03, 0x79, 0x01, 0x04, 0x79, 0x01, 0x09, 0x79, 0x01, 0x0a, 0x7a, 0x00]),
  { 121: [0, 3, 4, 9, 10] },
);

done();
