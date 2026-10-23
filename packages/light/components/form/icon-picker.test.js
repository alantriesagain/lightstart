import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./icon-picker.js", import.meta.url), "utf-8");
const between = (from, to) => {
  const start = source.indexOf(from);
  return source.slice(start, source.indexOf(to, start + from.length));
};
const quoted = (text) => [...new Set(text.match(/"[a-z][a-z0-9-]*"/g) ?? [])].map((q) => q.slice(1, -1)).sort();

test("every icon the picker offers is declared, so the build ships it", () => {
  const offered = quoted(between("const ICONS = {", "const EMOJI"));
  const declared = quoted(between("\n  icons: [", "\n  ],"));

  assert.ok(offered.length > 100, "the categories are the picker's own curation");
  assert.deepEqual(declared, offered,
    "icons: mirrors the categories; a name only in the categories is drawn but never bundled, and paints nothing in production");
});
