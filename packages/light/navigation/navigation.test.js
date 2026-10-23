import assert from "node:assert/strict";
import { test } from "node:test";
import { configureNavigation, navigation } from "./index.js";

test("without a router, a link is a plain anchor", () => {
  assert.equal(navigation.href("/docs"), "/docs");
  assert.equal(navigation.click(/** @type {MouseEvent} */ ({})), false);
});

test("a configured router answers, and what it leaves out stays plain", () => {
  /** @type {string[]} */
  const went = [];
  configureNavigation({ href: (path) => `/base${path}`, go: (path) => went.push(path), path: () => "/here" });
  assert.equal(navigation.href("/docs"), "/base/docs");
  navigation.go("/next");
  assert.deepEqual(went, ["/next"]);
  assert.equal(navigation.path(), "/here");
  assert.equal(navigation.click(/** @type {MouseEvent} */ ({})), false);
});
