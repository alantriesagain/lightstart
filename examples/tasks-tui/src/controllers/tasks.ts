/**
 * @file The tasks controller: every task, the open list's, and the writes. It imports the lists
 * and activity controllers, so it starts after both.
 */
import { Controller } from "@lightstart/light/controller/class";
import { liveRows } from "@lightstart/light/model/binder";
import { TaskRow } from "../../.light/models.ts";
import task from "../models/task.ts";
import activity from "./activity.ts";
import lists from "./lists.ts";

class Tasks extends Controller {
  readonly rows = liveRows<TaskRow>(this, task, () => ({ order: "addedAt" }), TaskRow.of);

  constructor() {
    super("tasks");
  }

  /** The open list's tasks, in the order they were added. */
  open(): TaskRow[] {
    const id = lists.current.value;
    return this.rows.value.filter((row) => row.list === id);
  }

  /** How many tasks list `id` has, and how many are done. */
  countOf(id: string): { all: number; done: number } {
    let all = 0;
    let done = 0;
    for (const row of this.rows.value) {
      if (row.list !== id) continue;
      all++;
      if (row.done) done++;
    }
    return { all, done };
  }

  /** Add a task to the open list. */
  async add(title: string): Promise<void> {
    const text = title.trim();
    if (text.length === 0) return;
    await task.add({ title: text, list: lists.current.peek(), addedAt: Date.now() });
    await activity.note("added " + text);
  }

  async toggle(row: TaskRow): Promise<void> {
    const done = !row.done;
    await task.edit(row.id, { done });
    await activity.note((done ? "did " : "reopened ") + row.title);
  }

  async remove(row: TaskRow): Promise<void> {
    await task.remove(row.id);
    await activity.note("removed " + row.title);
  }
}

export default new Tasks();
