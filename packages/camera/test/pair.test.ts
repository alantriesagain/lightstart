// node-only
/**
 * @file The `#cam=` v1 pairing payload: round trip, refusals and freshness.
 */

import { done, eq as rawEq, ok } from "@lightstart/test/assert.ts";

const eq = (name: string, actual: unknown, expected: unknown) => rawEq(name, String(actual), String(expected));
import { decodePair, encodePair, isFresh, PAIR_VERSION } from "../lib/pair.js";

import type { CameraPair } from "../types.ts";

const PAIR: CameraPair = { v: PAIR_VERSION, a: "camera-link", r: "room-1", p: "secret", s: ["relay", "torrent"], u: "https://dev.example", exp: 2000 };
const deep = (name: string, actual: unknown, expected: unknown) => eq(name, JSON.stringify(actual), JSON.stringify(expected));

const hash = `#cam=${encodePair(PAIR)}`;
deep("a pair round-trips through the fragment", decodePair(hash), PAIR);
deep("a pair is found inside a full URL", decodePair(`https://x.test/any/page${hash}`), PAIR);

ok("a peer payload is not a camera link", decodePair("#peer=abc") === null);
ok("bad base64 is refused", decodePair("#cam=not-base64!") === null);
ok("a future version is refused", decodePair(`#cam=${encodePair({ ...PAIR, v: 99 })}`) === null);
ok("a pair missing fields is refused", decodePair(`#cam=${encodeURIComponent(btoa(JSON.stringify({ v: PAIR_VERSION, r: "x" })))}`) === null);

eq("a pair is fresh before it expires", String(isFresh(PAIR, 1999)), "true");
eq("a pair is stale at its expiry", String(isFresh(PAIR, 2000)), "false");

done();
