/**
 * @file Probe AE: light's model as a TUI would hold it. A model from `defineModel`, the store
 * over an in-memory adapter registered through the storage SPI, the request configured over
 * `storeRequest`, a write the schema rejects, reads with a `where` and an `order`, an edit, a
 * removal and `onChange` on the model's own bus. Ids are random, so the output prints only what
 * is stable.
 */

import T from "../../types/index.js";
import { configureModel, defineModel, modelBus, onChange } from "../../model/index.ts";
import { createStore, storeRequest } from "../../model/store.ts";
import { buildQueryResult, createAdapter, registerStorageAdapter } from "../../model/adapter.ts";

/** @type {Map<string, Map<string, Record<string, unknown>>>} */
const tables = new Map();

/** @param {string} model */
const table = (model) => {
  let rows = tables.get(model);
  if (!rows) {
    rows = new Map();
    tables.set(model, rows);
  }
  return rows;
};

registerStorageAdapter("memory", {
  async init() {},
  /** @param {string} model @param {string | number} id */
  async get(model, id) {
    return table(model).get(String(id)) ?? null;
  },
  /** @param {string} model @param {Record<string, unknown>} opts */
  async query(model, opts) {
    const result = buildQueryResult([...table(model).values()], opts);
    return { rows: result.items, total: result.total };
  },
  /** @param {string} model @param {Record<string, unknown>} row */
  async insert(model, row) {
    table(model).set(String(row.id), row);
    return row;
  },
  /** @param {string} model @param {Record<string, unknown>} row */
  async update(model, row) {
    table(model).set(String(row.id), row);
    return row;
  },
  /** @param {string} model @param {string | number} id */
  async delete(model, id) {
    return table(model).delete(String(id));
  },
  /** @param {string} model */
  async count(model) {
    return table(model).size;
  },
  async close() {},
});

const todos = defineModel("todo", { title: T.string({ required: true }), done: T.boolean({ defaultValue: false }), rank: T.number({ defaultValue: 0 }) });
const db = createAdapter("memory", { name: "probe" });
await db.init();
const store = createStore({ models: { todo: todos.schema }, databases: { memory: db }, defaultAdapter: "memory", emit: (event, data) => modelBus().emit(event, data) });
configureModel({ request: storeRequest(store) });

/** @type {string[]} */
const heard = [];
onChange("todo", undefined, (event) => heard.push(event.action));

const first = await todos.add({ title: "write the probe", rank: 2 });
await todos.add({ title: "run it", rank: 1 });
const id = String(first.id);
console.log("added", typeof first.id, id.length, first.done, first.rank);

let rejected = "";
try {
  await todos.add({ rank: 3 });
} catch (error) {
  rejected = error instanceof Error ? error.name : "unknown";
}
console.log("rejected", rejected);

const all = await todos.getAll({ order: "rank" });
console.log("ordered", all.map((row) => row.title).join(" | "));

await todos.edit(id, { done: true });
const open = await todos.query({ where: { done: false } });
console.log("open", open.total, open.rows.map((row) => row.title).join(" | "));

console.log("count", await todos.count({}), "exists", await todos.exists({ title: "run it" }));
await todos.remove(id);
console.log("after remove", await todos.count({}), await todos.get(id));
console.log("heard", heard.join(","));
