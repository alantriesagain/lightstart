import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { effect } from "./index.ts";
import { createStore } from "./store.ts";

describe("signals/store createStore", () => {
  it("reads and writes declared keys, in the order they were declared", () => {
    const store = createStore({ count: 0, label: { default: "a" }, list: { default: () => [1] } }, { accessors: false });
    assert.deepEqual(store.keys(), ["count", "label", "list"]);
    assert.equal(store.get("count"), 0);
    assert.equal(store.set("count", 2), 2);
    assert.equal(store.get("count"), 2);
    assert.deepEqual(store.get("list"), [1]);
    assert.equal(store.update("count", (n) => /** @type {number} */ (n) + 1), 3);
    assert.equal(store.get("count"), 3);
  });

  it("answers undefined for an undeclared key and refuses to write one", () => {
    const store = createStore({ count: 0 });
    assert.equal(store.get("missing"), undefined);
    assert.throws(() => store.set("missing", 1), /Unknown state field "missing"/);
    assert.throws(() => store.update("missing", () => 1), /Unknown state field "missing"/);
  });

  it("gives each store its own copy of an object default, and calls a factory default", () => {
    const shared = { n: 1 };
    const a = createStore({ box: { default: shared }, made: { default: () => ({ fresh: true }) } });
    const b = createStore({ box: { default: shared }, made: { default: () => ({ fresh: true }) } });
    assert.notEqual(a.get("box"), shared);
    assert.notEqual(a.get("box"), b.get("box"));
    assert.deepEqual(a.get("made"), { fresh: true });
    assert.notEqual(a.get("made"), b.get("made"));
  });

  it("notifies the key's subscribers and every observer of a change, never of a same-value write", () => {
    const store = createStore({ count: 0, other: 0 });
    /** @type {string[]} */
    const seen = [];
    const off = store.subscribe("count", (value, old) => seen.push(`count:${String(old)}->${String(value)}`));
    store.observe((key, value, old) => seen.push(`observe ${key}:${String(old)}->${String(value)}`));
    store.set("count", 1);
    store.set("count", 1);
    store.set("other", 5);
    off();
    store.set("count", 2);
    assert.deepEqual(seen, ["count:0->1", "observe count:0->1", "observe other:0->5", "observe count:1->2"]);
  });

  it("re-runs an effect that read a key when that key changes, not another", () => {
    const store = createStore({ a: 0, b: 0 });
    let runs = 0;
    effect(() => {
      store.get("a");
      runs++;
    });
    store.set("b", 1);
    assert.equal(runs, 1);
    store.set("a", 1);
    assert.equal(runs, 2);
  });

  it("resets a key or every key to a fresh default, notifying after the reseed", () => {
    const store = createStore({ count: 3, list: { default: () => [] } });
    store.set("count", 9);
    /** @type {unknown[]} */
    const list = /** @type {unknown[]} */ (store.get("list"));
    /** @type {string[]} */
    const seen = [];
    store.observe((key, value) => seen.push(`${key}=${JSON.stringify(value)}`));
    assert.equal(store.reset("count"), 3);
    store.set("count", 7);
    seen.length = 0;
    store.resetAll();
    assert.deepEqual(seen, ["count=3", "list=[]"]);
    assert.notEqual(store.get("list"), list);
  });

  it("packs a snapshot and unpacks a restore, reseeding the keys a snapshot lacks", () => {
    const store = createStore({
      when: { default: 0, pack: (v) => `t${String(v)}`, unpack: (s) => Number(String(s).slice(1)) },
      name: "anon",
    });
    store.set("when", 5);
    store.set("name", "kai");
    assert.deepEqual(store.snapshot(), { when: "t5", name: "kai" });
    /** @type {string[]} */
    const seen = [];
    store.observe((key, value) => seen.push(`${key}=${String(value)}`));
    store.restore({ when: "t8" });
    assert.equal(store.get("when"), 8);
    assert.equal(store.get("name"), "anon");
    assert.deepEqual(seen, ["when=8", "name=anon"]);
  });

  it("carries each key as an accessor unless accessors are off, and refuses a key named like a store method", () => {
    const store = /** @type {import("./types.ts").StoreCore & { count: number }} */ (createStore({ count: 1 }));
    assert.equal(store.count, 1);
    store.count = 4;
    assert.equal(store.get("count"), 4);
    const plain = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (createStore({ count: 1 }, { accessors: false })));
    assert.equal(plain.count, undefined);
    assert.throws(() => createStore({ subscribe: 1 }), /collides with a store method/);
    assert.doesNotThrow(() => createStore({ subscribe: 1 }, { accessors: false }));
  });

  it("bridges get, set and subscribe through $sync under its name", () => {
    const store = createStore({ mode: "dark" }, { name: "theme" });
    assert.equal(store.$sync.adapter, "theme");
    /** @type {unknown[]} */
    const seen = [];
    store.$sync.subscribe("mode", (value) => seen.push(value));
    store.$sync.set("mode", "light");
    assert.equal(store.$sync.get("mode"), "light");
    assert.deepEqual(seen, ["light"]);
  });
});
