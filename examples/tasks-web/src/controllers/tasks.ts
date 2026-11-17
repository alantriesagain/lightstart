/**
 * @file The tasks controller: every task, the open list's, and the writes. It imports the lists
 * and activity controllers, so it starts after both.
 */
import { Controller } from "@lightstart/light/controller/class";
import { LiveRows, modelQuery } from "@lightstart/light/model/binder";
import task from "../models/task.ts";
import activity from "./activity.ts";
import lists from "./lists.ts";

import type { Task } from "../models/task.ts";

class Tasks extends Controller {
  readonly rows = new LiveRows<Task>();

  constructor() {
    super("tasks");
  }

  override connected(): Promise<void> | null {
    this.rows.use(modelQuery<Record<string, unknown>>(task, { order: "addedAt" }));
    return this.rows.loaded();
  }

  override disconnected(): Promise<void> | null {
    this.rows.dispose();
    return null;
  }

  /** The open list's tasks, in the order they were added. */
  open(): Task[] {
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
      if (row.done === true) done++;
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

  async toggle(row: Task): Promise<void> {
    const done = row.done !== true;
    await task.edit(String(row.id), { done });
    await activity.note((done ? "did " : "reopened ") + String(row.title));
  }

  async remove(row: Task): Promise<void> {
    await task.remove(String(row.id));
    await activity.note("removed " + String(row.title));
  }
}

export default new Tasks();
