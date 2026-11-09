import assert from "node:assert/strict";
import test from "node:test";
import { isActivePath } from "./active-path.js";

test("a section is active on itself and on the pages under it", () => {
  assert.ok(isActivePath("/components", "/components"));
  assert.ok(isActivePath("/components/display/button", "/components"));
  assert.ok(!isActivePath("/componentsx", "/components"));
  assert.ok(!isActivePath("/theming", "/components"));
});

test("exact matches only itself, and so does the root", () => {
  assert.ok(!isActivePath("/components/display", "/components", true));
  assert.ok(isActivePath("/", "/"));
  assert.ok(!isActivePath("/components", "/"));
  assert.ok(!isActivePath("/components", ""));
});
