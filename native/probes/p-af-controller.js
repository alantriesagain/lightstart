/**
 * @file Probe AF: a controller over a model, as the tasks example holds it. A model from
 * `defineModel` over an in-memory store, a controller whose `rows` prop is bound to a live
 * query that its `filter` prop rebuilds, methods that write through the model, and the counts
 * the bound rows answer after each write.
 */

import T from "../../types/index.js";
import { configureModel, defineModel, modelBus } from "../../model/index.js";
import { createStore, storeRequest } from "../../model/store.js";
import { buildQueryResult, createAdapter, registerStorageAdapter } from "../../model/adapter.js";
import { modelBinder } from "../../model/binder.js";
import { defineController, registerSyncBinder } from "../../controller/index.ts";

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

const tasks = defineModel("tasks", { title: T.string({ required: true }), done: T.boolean({ defaultValue: false }), at: T.number({ defaultValue: 0 }) });
const db = createAdapter("memory", { name: "probe" });
await db.init();
const store = createStore({ models: { tasks: tasks.schema }, databases: { memory: db }, defaultAdapter: "memory", emit: (event, data) => modelBus().emit(event, data) });
configureModel({ request: storeRequest(store) });
registerSyncBinder(modelBinder);

const board = defineController({
  name: "board",
  props: { filter: "all", rows: /** @type {Array<Record<string, unknown>>} */ ([]) },
  sync: {
    rows: {
      to: tasks,
      query: (/** @type {{ filter: string }} */ self) => (self.filter === "all" ? { order: "at" } : { where: { done: self.filter === "done" }, order: "at" }),
      dependsOn: ["filter"],
    },
  },
  /** @param {string} title */
  async add(title) {
    await tasks.add({ title, at: rows.size + 1 });
  },
  /** @param {Record<string, unknown>} task */
  async toggle(task) {
    await tasks.edit(String(task.id), { done: !task.done });
  },
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const titles = () => board.rows.map((row) => String(row.title)).join(" | ");

await board.$ready;
await board.add("write the probe");
await board.add("run it");
await tick();
await board.$queries.rows.ensure();
console.log("all", titles());
await board.toggle(board.rows[0]);
board.filter = "open";
await tick();
await board.$queries.rows.ensure();
console.log("open", titles());
board.filter = "done";
await tick();
await board.$queries.rows.ensure();
console.log("done", titles());
board.dispose();
