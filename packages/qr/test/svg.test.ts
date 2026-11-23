/**
 * @file The SVG renderer: one path of horizontal runs, the viewBox quiet
 * zone, size and colour, and the escaped data URL.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { encode } from "../encode.js";
import { toDataUrl, toPath, toSvg } from "../svg.js";

const m = encode("svg", { level: "L", mask: 0 });
const path = toPath(m, { margin: 4 });
ok("the path starts with the top-left run offset by the margin", path.startsWith("M4 4h7v1h-7z"));
let covered = 0;
for (const [, w] of path.matchAll(/h(\d+)v1/g)) covered += Number(w);
eq("the runs cover every dark module", String(covered), String(m.modules.reduce((n, v) => n + v, 0)));

const symbol = encode("svg", { level: "L" });
const drawn = toSvg(symbol, { margin: 2, size: 120, color: "#123" });
ok("the viewBox carries the quiet zone", /viewBox="0 0 25 25"/.test(drawn));
ok("the svg honours size", /width="120" height="120"/.test(drawn));
ok("the svg honours colour", /fill="#123"/.test(drawn));
ok("the default fill is currentColor", /fill="currentColor"/.test(toSvg(symbol)));
ok("no size means no width", !/width=/.test(toSvg(symbol)));

const url = toDataUrl(encode("svg", { level: "L" }));
ok("the data URL is an escaped svg", url.startsWith("data:image/svg+xml;utf8,%3Csvg"));
ok("the data URL has a black fill", url.includes("fill='%23000'"));
ok("the data URL has no raw angle bracket", !url.includes("<"));

done();
