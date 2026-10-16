/**
 * @file The board: the tasks the list shows, under a filter, the counts the
 * footer shows, and the writes the views dispatch.
 */
import { defineController, registerSyncBinder } from "@bootstrapp/light/controller";
import { onChange } from "@bootstrapp/light/model";
import { modelBinder } from "@bootstrapp/light/model/binder";
import tasks from "../models/tasks.js";

registerSyncBinder(modelBinder);

/** @typedef {"all" | "open" | "done"} Filter */

/** @type {Filter[]} */
const FILTERS = ["all", "open", "done"];

/**
 * @param {Filter} filter
 * @returns {{ where?: { done: boolean }, order: string }}
 */
const queryFor = (filter) => (filter === "all" ? { order: "addedAt" } : { where: { done: filter === "done" }, order: "addedAt" });

export default defineController({
  name: "board",
  props: {
    filter: /** @type {Filter} */ ("all"),
    rows: /** @type {Array<{ id?: string | number, title?: string, done?: boolean }>} */ ([]),
    open: 0,
    done: 0,
  },
  sync: {
    rows: { to: tasks, query: (/** @type {{ filter: Filter }} */ self) => queryFor(self.filter), dependsOn: ["filter"] },
  },
  connected() {
    this.$own(onChange("tasks", undefined, () => this.recount()));
    return this.recount();
  },
  async recount() {
    this.open = await tasks.count({ where: { done: false } });
    this.done = await tasks.count({ where: { done: true } });
  },
  /** @param {string} title */
  async add(title) {
    const text = title.trim();
    if (text) await tasks.add({ title: text, addedAt: Date.now() });
  },
  /** @param {string | number | undefined} id @param {boolean | undefined} done */
  async toggle(id, done) {
    if (id !== undefined) await tasks.edit(String(id), { done: !done });
  },
  /** @param {string | number | undefined} id */
  async remove(id) {
    if (id !== undefined) await tasks.remove(String(id));
  },
  async clearDone() {
    await tasks.removeAll({ done: true });
  },
  nextFilter() {
    this.filter = FILTERS[(FILTERS.indexOf(this.filter) + 1) % FILTERS.length];
  },
});
