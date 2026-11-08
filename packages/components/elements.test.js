import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8"));
const map = /** @type {Record<string, string>} */ (pkg.bootstrapp.components.lc);
const table = readFileSync(join(HERE, "elements.ts"), "utf8");
const ROW = /^ {2}"(lc-[a-z0-9-]+)": /gm;
const tags = [...table.matchAll(ROW)].map(([, tag]) => tag);
const loaded = Object.keys(map).map((key) => `lc-${key}`);

test("the element table names every tag in the loader map, in its order, and no other", () => {
  const missing = loaded.filter((tag) => !tags.includes(tag));
  const extra = tags.filter((tag) => !loaded.includes(tag));
  assert.deepEqual(missing, [], `tags in the map with no element type: ${missing.join(", ")}`);
  assert.deepEqual(extra, [], `element types for tags the map does not load: ${extra.join(", ")}`);
  assert.deepEqual(tags, loaded);
});
