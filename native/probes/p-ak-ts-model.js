/**
 * @file Probe AK: a model defined in TypeScript (`defineModel` over `T.*` descriptors in a `.ts`
 * file) over an in-memory store: an add the schema fills, a read with `order`, an edit, a write
 * the schema rejects.
 */

import { configureModel, modelBus } from "../../model/index.ts";
import { createStore, storeRequest } from "../../model/store.ts";
import { buildQueryResult, createAdapter, registerStorageAdapter } from "../../model/adapter.ts";
import { notes } from "./p-ak-ts-model.schema.ts";

/** @type {Map<string, Record<string, unknown>>} */
const rows = new Map();

registerStorageAdapter("memory", {
  async init() {},
  /** @param {string} _model @param {string | number} id */
  async get(_model, id) {
    return rows.get(String(id)) ?? null;
  },
  /** @param {string} _model @param {Record<string, unknown>} opts */
  async query(_model, opts) {
    const result = buildQueryResult([...rows.values()], opts);
    return { rows: result.items, total: result.total };
  },
  /** @param {string} _model @param {Record<string, unknown>} row */
  async insert(_model, row) {
    rows.set(String(row.id), row);
    return row;
  },
  /** @param {string} _model @param {Record<string, unknown>} row */
  async update(_model, row) {
    rows.set(String(row.id), row);
    return row;
  },
  /** @param {string} _model @param {string | number} id */
  async delete(_model, id) {
    return rows.delete(String(id));
  },
  async count() {
    return rows.size;
  },
  async close() {},
});

const db = createAdapter("memory", { name: "probe" });
await db.init();
const store = createStore({ models: { notes: notes.schema }, databases: { memory: db }, defaultAdapter: "memory", emit: (event, data) => modelBus().emit(event, data) });
configureModel({ request: storeRequest(store) });

const first = await notes.add({ title: "first" });
console.log("added", String(first.title), "done", String(first.done), "at", String(first.at));
await notes.add({ title: "second", at: 2 });
await notes.edit(String(first.id), { done: true });
const all = await notes.getAll({ order: "at" });
console.log("all", all.map((row) => String(row.title) + ":" + String(row.done)).join(" | "));
try {
  await notes.add({ at: 3 });
  console.log("accepted a row without a title");
} catch (err) {
  console.log("rejected", err instanceof Error ? err.message.split("\n")[0] : "error");
}
console.log("count", await notes.count());
