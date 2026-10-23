import assert from "node:assert/strict";
import test from "node:test";
import { formatBytes } from "./bytes.js";

test("a byte count reads in the largest whole unit", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(null), "0 B");
  assert.equal(formatBytes(512), "512.0 B");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(5 * 1024 ** 2), "5.0 MB");
});
