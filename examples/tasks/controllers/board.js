/**
 * @file The board controller: the boards in order and the focused one, the
 * filter, the rows the filter selects (`sync:` bindings to the models,
 * rebuilt when the filter changes), the open and done counts it recounts on
 * every change, the writes, and the editor's commands. On start it makes a
 * first board when there is none and gives the tasks from before boards to
 * the first one.
 */
import { defineController, registerSyncBinder } from "@bootstrapp/light/controller";
import { onChange } from "@bootstrapp/light/model";
import { modelBinder } from "@bootstrapp/light/model/binder";
import boards from "../models/boards.js";
import tasks from "../models/tasks.js";

/** @import { Board, Task } from "../models/types.ts" */

registerSyncBinder(modelBinder);

/** @typedef {"all" | "open" | "done"} Filter */
/** @type {Filter[]} */
const FILTERS = ["all", "open", "done"];

/** @param {Filter} filter */
const queryFor = (filter) => (filter === "all" ? { order: "addedAt" } : { where: { done: filter === "done" }, order: "addedAt" });

export default defineController({
  name: "board",
  props: {
    filter: /** @type {Filter} */ ("all"),
    rows: /** @type {Task[]} */ ([]),
    boards: /** @type {Board[]} */ ([]),
    current: "",
    open: 0,
    done: 0,
  },
  sync: {
    rows: { to: tasks, query: (/** @type {{ filter: Filter }} */ self) => queryFor(self.filter), dependsOn: ["filter"] },
    boards: { to: boards, query: { order: "position" } },
  },
  async connected() {
    this.$own(onChange("tasks", undefined, () => this.recount()));
    await this.adopt();
    await this.recount();
  },
  async adopt() {
    if ((await boards.count()) === 0) await boards.add({ title: "Tasks", position: 0 });
    const first = (await boards.getAll({ order: "position" }))[0];
    const id = String(first.id);
    for (const task of await tasks.getAll({ where: { boardId: { "is null": true } } })) await tasks.edit(String(task.id), { boardId: id });
    if (this.current === "") this.current = id;
  },
  async recount() {
    this.open = await tasks.count({ where: { done: false } });
    this.done = await tasks.count({ where: { done: true } });
  },
  /** @returns {number} the focused board's index among the boards, -1 when none */
  index() {
    for (let i = 0; i < this.boards.length; i++) if (String(this.boards[i].id) === this.current) return i;
    return -1;
  },
  /** @param {string} title */
  async add(title) {
    const text = title.trim();
    if (text && this.current !== "") await tasks.add({ title: text, addedAt: Date.now(), boardId: this.current });
  },
  /**
   * @param {string | number | undefined} id
   * @param {boolean | undefined} done
   */
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
  /** @param {string} id */
  focusBoard(id) {
    this.current = id;
  },
  /** @param {Board[]} ordered the boards in their new order; each whose position differs is edited */
  async reposition(ordered) {
    for (let i = 0; i < ordered.length; i++) {
      const b = ordered[i];
      if (b.position !== i) await boards.edit(String(b.id), { position: i });
    }
  },
  /** @param {string} title */
  async addBoard(title) {
    const text = title.trim();
    if (!text) return;
    const list = this.boards.slice();
    const at = this.index();
    const row = /** @type {Board} */ (await boards.add({ title: text, position: at + 1 }));
    list.splice(at + 1, 0, row);
    await this.reposition(list);
    this.current = String(row.id);
  },
  /** @param {string} title */
  async renameBoard(title) {
    const text = title.trim();
    if (text && this.current !== "") await boards.edit(this.current, { title: text });
  },
  /** @returns {Promise<boolean>} whether the focused board, empty and not the last, was removed */
  async deleteBoard() {
    if (this.boards.length <= 1 || this.current === "") return false;
    if ((await tasks.count({ where: { boardId: this.current } })) > 0) return false;
    const list = this.boards.slice();
    const at = this.index();
    await boards.remove(this.current);
    list.splice(at, 1);
    this.current = String(list[Math.max(0, at - 1)].id);
    await this.reposition(list);
    return true;
  },
  /**
   * @param {string | number | undefined} id
   * @param {number} delta -1 to the previous board, 1 to the next
   */
  async moveTask(id, delta) {
    if (id === undefined) return;
    let boardId = "";
    for (const task of this.rows) if (String(task.id) === String(id)) boardId = String(task.boardId);
    let from = -1;
    for (let i = 0; i < this.boards.length; i++) if (String(this.boards[i].id) === boardId) from = i;
    const to = from + delta;
    if (from < 0 || to < 0 || to >= this.boards.length) return;
    await tasks.edit(String(id), { boardId: String(this.boards[to].id) });
  },
  /** @param {number} delta -1 left, 1 right */
  async moveBoard(delta) {
    const list = this.boards.slice();
    const at = this.index();
    const to = at + delta;
    if (at < 0 || to < 0 || to >= list.length) return;
    const moved = list.splice(at, 1)[0];
    list.splice(to, 0, moved);
    await this.reposition(list);
  },
  /** @param {string} text a line from the editor: `/board Name`, `/rename Name`, `/delete`, or a task */
  async command(text) {
    const line = text.trim();
    if (!line.startsWith("/")) return this.add(line);
    const space = line.indexOf(" ");
    const name = space < 0 ? line.slice(1) : line.slice(1, space);
    const arg = space < 0 ? "" : line.slice(space + 1);
    if (name === "board") await this.addBoard(arg);
    else if (name === "rename") await this.renameBoard(arg);
    else if (name === "delete") await this.deleteBoard();
  },
});
