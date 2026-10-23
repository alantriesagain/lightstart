import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import T from "../types/index.js";
import { configureModel, modelBus, newId } from "./config.ts";
import { createStore } from "./store.ts";

const memory = () => {
  /** @type {Map<string, Record<string, unknown>>} */
  const rows = new Map();
  return {
    async init() {},
    async get(_model, id) { return rows.get(String(id)) ?? null; },
    async query() { return { rows: [...rows.values()], total: rows.size }; },
    async insert(_model, row) { rows.set(String(row.id), row); return row; },
    async update(_model, row) { rows.set(String(row.id), row); return row; },
    async delete(_model, id) { return rows.delete(String(id)); },
    async count() { return rows.size; },
    async close() {},
  };
};

afterEach(() => configureModel());

describe("model config", () => {
  it("draws a 15-character base36 id when no source is configured", () => {
    assert.match(newId(), /^[a-z0-9]{15}$/);
    assert.notEqual(newId(), newId());
  });

  it("gives a new row the configured source's id, and keeps an id the caller sent", async () => {
    let n = 0;
    configureModel({ makeId: () => `row-${++n}` });
    const store = createStore({ models: { note: { text: T.string() } }, databases: { memory: memory() }, defaultAdapter: "memory" });
    assert.equal((await store.add("note", { text: "a" })).id, "row-1");
    assert.equal((await store.add("note", { id: "mine", text: "b" })).id, "mine");
  });

  it("keeps its own bus until a host hands it one, and the default again after", () => {
    const own = modelBus();
    const heard = [];
    configureModel({ events: { on: () => () => {}, emit: (key) => heard.push(key) } });
    modelBus().emit("model:changed", {});
    assert.deepEqual(heard, ["model:changed"]);
    configureModel();
    assert.equal(modelBus(), own);
  });
});
