/**
 * @file Probe AM: a generated row class from a model's schema. `TaskRow.of`
 * checks a plain record field by field (`typeof`), fills the field with a
 * default, answers null for a damaged row, and a converting list reads typed
 * rows (arithmetic and string work) with the skipped rows counted.
 */

import { TaskRow } from "./p-am-row-class.rows.ts";
import { LiveRows, modelQuery } from "../../model/binder.ts";
import { configureModel, defineModel } from "../../model/index.ts";
import { createStore, storeRequest } from "../../model/store.ts";
import { buildQueryResult, createAdapter, registerStorageAdapter } from "../../model/adapter.ts";
import T from "../../types/index.js";

/** @type {Array<Record<string, unknown>>} */
const source = [
  { id: "1", title: "first", done: true, list: "inbox", addedAt: 1 },
  { id: "2", title: "second", list: "inbox", addedAt: 2 },
  { id: "3", done: false, list: "inbox", addedAt: 3 },
  { id: "4", title: "fourth", done: false, list: "inbox", addedAt: "4" },
];

/** @type {TaskRow[]} */
const rows = [];
let skipped = 0;
for (const record of source) {
  const row = TaskRow.of(record);
  if (row === null) {
    skipped++;
    continue;
  }
  rows.push(row);
  const list = row.list === null ? "(none)" : row.list;
  console.log("row", row.id, "title", row.title, "done", row.done, "list", list, "addedAt", row.addedAt);
}
console.log("converted", rows.length, "skipped", skipped);

/** @type {unknown[]} */
const incoming = [
  { id: "5", title: "fifth", done: true, addedAt: 5 },
  { id: "6", title: "sixth", done: false, addedAt: 6 },
  { id: "7", title: "seventh", done: true, addedAt: "7" },
  { id: "8", title: "eighth", done: false, list: "work", addedAt: 8 },
];

/** @type {TaskRow[]} */
const typed = [];
let dropped = 0;
for (const value of incoming) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    dropped++;
    continue;
  }
  const row = TaskRow.of(/** @type {Record<string, unknown>} */ (value));
  if (row === null) {
    dropped++;
    continue;
  }
  typed.push(row);
}
let total = 0;
let label = "";
let doneCount = 0;
for (const row of typed) {
  total += row.addedAt + 1;
  label += row.title.length + (row.done ? "x" : " ");
  if (row.done) doneCount++;
}
console.log("typed", typed.length, "dropped", dropped);
console.log("total", total, "label", label, "done", doneCount);

/** @type {Record<string, unknown>[]} */
const feed = [];
for (const value of incoming) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
  feed.push(/** @type {Record<string, unknown>} */ (value));
}
// The rows reach LiveRows through a real model query over a store in memory, as an app's do; the
// damaged ones are written into the adapter directly, as a file damaged on disk would hold them.
/** @type {Map<string, Record<string, unknown>>} */
const stored = new Map();
registerStorageAdapter("memory", {
  async init() {},
  /** @param {string} _model @param {string | number} id */
  async get(_model, id) {
    return stored.get(String(id)) ?? null;
  },
  /** @param {string} _model @param {Record<string, unknown>} opts */
  async query(_model, opts) {
    const result = buildQueryResult([...stored.values()], opts);
    return { rows: result.items, total: result.total };
  },
  /** @param {string} _model @param {Record<string, unknown>} row */
  async insert(_model, row) {
    stored.set(String(row.id), row);
    return row;
  },
  /** @param {string} _model @param {Record<string, unknown>} row */
  async update(_model, row) {
    stored.set(String(row.id), row);
    return row;
  },
  /** @param {string} _model @param {string | number} id */
  async delete(_model, id) {
    return stored.delete(String(id));
  },
  async count() {
    return stored.size;
  },
  async close() {},
});
const task = defineModel("task", { title: T.string({ required: true }), done: T.boolean({ defaultValue: false }), list: T.string(), addedAt: T.number({ required: true }) });
const db = createAdapter("memory", { name: "probe-am" });
await db.init();
const store = createStore({ models: { task: task.schema }, databases: { memory: db }, defaultAdapter: "memory" });
configureModel({ request: storeRequest(store) });
let n = 0;
for (const row of feed) stored.set(typeof row.id === "string" ? row.id : "row" + String(n++), row);
const live = new LiveRows(TaskRow.of, "task");
live.use(modelQuery(task, { order: "addedAt" }));
await live.loaded();
console.log("query total", live.total);
let liveTotal = 0;
let liveLabel = "";
for (const row of live.value) {
  liveTotal += row.addedAt;
  liveLabel += row.title.charAt(0);
}
console.log("live", live.value.length, "skipped", live.skipped, "total", liveTotal, "label", liveLabel);
const rich = TaskRow.of(/** @type {Record<string, unknown>} */ ({ id: "r", title: "rich", addedAt: 1, tags: ["a", "b"], meta: { k: 1 } }));
console.log("rich", rich === null ? "null" : String(rich.tags.length) + " " + String(rich.meta !== null ? Object.keys(rich.meta).length : -1));
const bad = TaskRow.of(/** @type {Record<string, unknown>} */ ({ id: "b", title: "bad", addedAt: 1, tags: "x" }));
console.log("bad tags", bad === null ? "null" : "kept");
