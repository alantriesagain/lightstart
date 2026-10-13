import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createStore } from "../signals/store.js";
import { defineController } from "./define.js";
import { configureControllers } from "./config.js";
import { bindProperty, registerSyncBinder } from "./sync.js";
import { resource } from "./resource.js";

const QUERIED = Symbol("queried source");

/** @param {Record<string, unknown>} rows */
const source = (rows) => ({ [QUERIED]: true, rows });

/** @type {Array<{ key: string, query: unknown }>} */
const bound = [];

registerSyncBinder({
  test: (target) => Boolean(target) && typeof target === "object" && QUERIED in /** @type {object} */ (target),
  options: ["query", "dependsOn"],
  bind: ({ store, key, prop, host, target }) => {
    const query = typeof prop.query === "function" ? prop.query(host) : prop.query;
    bound.push({ key, query });
    const rows = /** @type {{ rows: Record<string, unknown> }} */ (target).rows;
    store.set(key, rows[/** @type {string} */ (/** @type {{ id: string }} */ (query).id)] ?? null);
    return { unbind: () => bound.push({ key, query: "unbound" }), loaded: Promise.resolve() };
  },
});

const bus = () => {
  /** @type {Map<string, Set<(payload: unknown) => unknown>>} */
  const listeners = new Map();
  return {
    listeners,
    /** @param {string} key @param {(payload: unknown) => unknown} cb */
    on(key, cb) {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key)?.add(cb);
      return () => listeners.get(key)?.delete(cb);
    },
    /** @param {string} key @param {unknown} payload */
    emit(key, payload) {
      return Promise.all([...(listeners.get(key) ?? [])].map((cb) => cb(payload)));
    },
  };
};

describe("@bootstrapp/light/controller: the binder seam", () => {
  it("hands a target a binder claims to that binder, with the query and the host", async () => {
    const rows = source({ a: { id: "a", title: "Alpha" } });
    const ctrl = defineController({
      name: "binderHost",
      props: { pick: "a", row: null },
      sync: { row: { to: rows, query: (/** @type {{ pick: string }} */ self) => ({ id: self.pick }) } },
    });
    await ctrl.$ready;
    assert.deepEqual(ctrl.row, { id: "a", title: "Alpha" });
    assert.deepEqual(bound.at(-1), { key: "row", query: { id: "a" } });
    ctrl.dispose();
    assert.deepEqual(bound.at(-1), { key: "row", query: "unbound" }, "the binder's unbind rides the instance's teardowns");
  });

  it("opens a thunk at bind time, for a binder's target and for a store alike", () => {
    const rows = source({ b: { id: "b" } });
    const shared = createStore({ mode: "dark" });
    const ctrl = defineController({
      name: "thunkHost",
      props: { row: null, mode: "light" },
      sync: { row: { to: () => rows, query: { id: "b" } }, mode: () => shared },
    });
    assert.deepEqual(ctrl.row, { id: "b" });
    assert.equal(ctrl.mode, "dark");
    shared.set("mode", "dim");
    assert.equal(ctrl.mode, "dim");
    ctrl.dispose();
  });

  it("lets query and dependsOn through only for a target whose binder reads them", () => {
    assert.doesNotThrow(() => defineController({ name: "okQuery", props: { row: null }, sync: { row: { to: source({}), query: { id: "x" } } } }));
    assert.throws(
      () => defineController({ name: "badQuery", props: { row: null }, sync: { row: { to: createStore({ row: null }), query: { id: "x" } } } }),
      /declares query: for a target that takes none/,
    );
  });

  it("binds a plain property through the store binding when no binder claims it", () => {
    const store = createStore({ level: "easy" });
    const owner = createStore({ level: "hard" });
    const { unbind, loaded } = bindProperty({ store, key: "level", prop: /** @type {any} */ ({ $type: "string", attribute: false, sync: owner }), host: {} });
    assert.equal(store.get("level"), "hard");
    assert.equal(loaded, undefined);
    unbind();
  });
});

describe("@bootstrapp/light/controller: the host's hooks", () => {
  it("a resource waits for the host's ready gate unless told not to", async () => {
    let open = () => {};
    const gate = new Promise((resolve) => { open = () => resolve(undefined); });
    configureControllers({ ready: () => gate });
    try {
      let fetched = 0;
      const gated = resource(async () => ++fetched, { name: "gated" });
      const loading = gated.ensure();
      await Promise.resolve();
      assert.equal(fetched, 0, "the first fetch waits for the host");
      open();
      assert.equal(await loading, 1);
      const free = resource(async () => "now", { name: "free", ready: false });
      assert.equal(await free.ensure(), "now");
    } finally {
      configureControllers({ ready: () => undefined });
    }
  });

  it("listens for invalidateOn on the host's bus from its first fetch, so a resource made before the host configures still hears it", async () => {
    let n = 0;
    const early = resource(async () => ++n, { name: "early", ready: false, invalidateOn: "thing:changed" });
    const events = bus();
    configureControllers({ events });
    try {
      assert.equal(events.listeners.size, 0, "nothing listens before the first fetch");
      assert.equal(await early.ensure(), 1);
      await events.emit("thing:changed", {});
      assert.equal(early.peek(), 2, "the event refreshed the loaded value");
      early.dispose();
      await events.emit("thing:changed", {});
      assert.equal(early.peek(), 2, "a disposed resource stops listening");
    } finally {
      configureControllers({ events: null });
    }
  });

  it("counts a resource's fetch with the host's track", async () => {
    const labels = [];
    configureControllers({ track: (label) => { labels.push(label); return undefined; } });
    try {
      await resource(async () => 1, { name: "counted", ready: false }).ensure();
    } finally {
      configureControllers({ track: () => undefined });
    }
    assert.deepEqual(labels, ["resource:counted"]);
  });
});
