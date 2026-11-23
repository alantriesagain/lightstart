/**
 * @file The terminal renderer: two module rows per line in half-block
 * glyphs, the quiet zone, and an odd height ending top-only.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { encode } from "../encode.js";
import { toTerminal } from "../terminal.js";

const m = encode("term", { level: "L" });
const lines = toTerminal(m, { margin: 2 }).split("\n");
eq("two module rows per line", String(lines.length), String(Math.ceil((m.size + 4) / 2)));
for (const line of lines) eq("each line spans the quiet zone", String([...line].length), String(m.size + 4));

const bare = toTerminal(encode("term", { level: "L" }), { margin: 0 }).split("\n");
ok("the finder's top row is the expected glyphs", bare[0].startsWith("█▀▀▀▀▀█"));
ok("the finder's second row is the expected glyphs", bare[1].startsWith("█ ███ █"));
ok("the finder's fourth row is the expected glyphs", bare[3].startsWith("▀▀▀▀▀▀▀"));

const odd = toTerminal(encode("odd", { level: "L", mask: 0 }), { margin: 0 }).split("\n");
eq("an odd total height is eleven lines", String(odd.length), "11");
ok("the last line has no lower half", !odd[10].includes("▄") && !odd[10].includes("█"));

done();
