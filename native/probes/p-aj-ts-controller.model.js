/**
 * @file Probe AJ's model: the `tasks` model over an in-memory store, in JSDoc JavaScript as the
 * tasks example writes its models, imported by the TypeScript controller and the entry.
 */

import T from "../../types/index.js";
import { configureModel, defineModel, modelBus } from "../../model/index.ts";
import { createStore, storeRequest } from "../../model/store.ts";
import { buildQueryResult, createAdapter, registerStorageAdapter } from "../../model/adapter.ts";

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

export const tasks = defineModel("tasks", { title: T.string({ required: true }), done: T.boolean({ defaultValue: false }), at: T.number({ defaultValue: 0 }) });

/** Open the store over the model; the request every model call goes through from then on. */
export const openStore = async () => {
  const db = createAdapter("memory", { name: "probe" });
  await db.init();
  const store = createStore({ models: { tasks: tasks.schema }, databases: { memory: db }, defaultAdapter: "memory", emit: (event, data) => modelBus().emit(event, data) });
  configureModel({ request: storeRequest(store) });
};
