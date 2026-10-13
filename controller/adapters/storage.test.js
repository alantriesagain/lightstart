import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createStorageAdapter } from "./storage.js";

const fakeStorage = (backing = new Map()) => ({
  getItem: (k) => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => backing.set(k, String(v)),
  removeItem: (k) => backing.delete(k),
});

const throwingStorage = () => {
  const storage = {};
  for (const method of ["getItem", "setItem", "removeItem"])
    Object.defineProperty(storage, method, { value: () => { throw new Error("denied"); } });
  return storage;
};

describe("controller/adapters/storage createStorageAdapter", () => {
  it("round-trips objects and arrays through JSON", () => {
    const adapter = createStorageAdapter(/** @type {any} */ (fakeStorage()), "t");
    adapter.set("obj", { a: 1 });
    adapter.set("arr", [1, 2]);
    adapter.set("str", "plain");
    assert.deepEqual(adapter.get("obj"), { a: 1 });
    assert.deepEqual(adapter.get("arr"), [1, 2]);
    assert.equal(adapter.get("str"), "plain");
    assert.equal(adapter.has("obj"), true);
    adapter.remove("obj");
    assert.equal(adapter.get("obj"), null);
  });

  it("get answers the defaultValue for absent keys", () => {
    const adapter = createStorageAdapter(/** @type {any} */ (fakeStorage()), "t");
    assert.equal(adapter.get("missing"), null);
    assert.deepEqual(adapter.get("missing", []), []);
    assert.equal(adapter.get("missing", "anon"), "anon");
  });

  it("a throwing Storage never throws through the adapter", () => {
    const adapter = createStorageAdapter(/** @type {any} */ (throwingStorage()), "t");
    assert.deepEqual(adapter.get("k", "fallback"), "fallback");
    assert.deepEqual(adapter.set("k", 1), { key: "k" });
    assert.deepEqual(adapter.remove("k"), { key: "k" });
    assert.equal(adapter.has("k"), false);
    assert.deepEqual(adapter.keys(), []);
    assert.deepEqual(adapter.entries(), []);
  });

  it("set still notifies key listeners on success", () => {
    const adapter = createStorageAdapter(/** @type {any} */ (fakeStorage()), "t");
    const seen = [];
    adapter.on("k", (v) => seen.push(v));
    adapter.set("k", 7);
    assert.deepEqual(seen, [7]);
  });
});
