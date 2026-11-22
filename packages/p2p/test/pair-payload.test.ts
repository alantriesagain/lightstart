// node-only
/**
 * @file The `#peer=` pairing payload: a round trip through the fragment,
 * decoding beside other fragment params, the current version's shape and
 * expiry against a supplied clock.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { decodePairPayload, encodePairPayload, isCurrent, isExpired } from "../pair-payload.js";
import type { PairPayload } from "../types.ts";

const payload: PairPayload = { a: "centavo", r: "room123", p: "s3cret", s: ["relay", "torrent"], u: "http://192.168.0.2:3520", v: 3, exp: 1234567890 };
eq("roundtrips a payload through the URL fragment shape", JSON.stringify(decodePairPayload(`#peer=${encodePairPayload(payload)}`)), JSON.stringify(payload));

const encoded = encodePairPayload({ a: "x", r: "r", p: "p", s: ["torrent"], v: 3, exp: 1 });
eq("decodes from a hash carrying extra fragment params", JSON.stringify(decodePairPayload(`#foo=bar&peer=${encoded}&baz=1`)), JSON.stringify({ a: "x", r: "r", p: "p", s: ["torrent"], v: 3, exp: 1 }));

eq("answers null for a hash without a peer param", JSON.stringify(decodePairPayload("#other=1")), "null");
eq("answers null for an empty hash", JSON.stringify(decodePairPayload("")), "null");
eq("answers null for a malformed percent-encoding", JSON.stringify(decodePairPayload("#peer=%%%")), "null");
eq("answers null for a blob that is not JSON", JSON.stringify(decodePairPayload(`#peer=${encodeURIComponent(btoa("not json"))}`)), "null");
eq("answers null for JSON that is not an object", JSON.stringify(decodePairPayload(`#peer=${encodeURIComponent(btoa('"a string"'))}`)), "null");

ok("isCurrent accepts the v3 shape with a signaler list", isCurrent({ a: "x", r: "r", p: "p", s: ["relay"], v: 3, exp: 1 }));
ok("isCurrent rejects another version", !isCurrent({ a: "x", r: "r", p: "p", s: "relay", v: 2, exp: 1 } as unknown as PairPayload));
ok("isCurrent rejects null", !isCurrent(null));

ok("isExpired is false before exp", !isExpired({ exp: 1000 }, 999));
ok("isExpired is true after exp", isExpired({ exp: 1000 }, 1001));
ok("isExpired is false without exp", !isExpired({}, 1001));

done();
