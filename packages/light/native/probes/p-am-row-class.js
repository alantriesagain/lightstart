/**
 * @file Probe AM: a generated row class from a model's schema. `TaskRow.of`
 * checks a plain record field by field (`typeof`), fills the field with a
 * default, answers null for a damaged row, and a converting list reads typed
 * rows (arithmetic and string work) with the skipped rows counted.
 */

import { TaskRow } from "./p-am-row-class.rows.ts";
import { LiveRows } from "../../model/binder.ts";
import { resource } from "../../controller/resource.ts";

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
const live = new LiveRows(TaskRow.of, "task");
live.use(resource(() => feed, { eager: true, ready: false }));
await live.loaded();
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
