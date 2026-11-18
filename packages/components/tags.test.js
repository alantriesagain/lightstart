import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildLoaders, buildTags } from "./scripts/tags.js";

const here = dirname(fileURLToPath(import.meta.url));

test("tags.json is what the sources say", () => {
  const written = JSON.parse(readFileSync(join(here, "tags.json"), "utf8"));
  assert.deepEqual(written, buildTags());
});

test("loaders.js is what the sources say", () => {
  const written = readFileSync(join(here, "loaders.js"), "utf8");
  assert.equal(written, buildLoaders());
});
