/**
 * @file Probe AJ's controller: a `Controller` subclass in TypeScript over the
 * `tasks` model it imports, a `filter` signal and the live query it rebuilds,
 * methods that write through the model, the rows read through `LiveRows`.
 */
import { signal } from "../../signals/index.ts";
import { Controller } from "../../controller/class.ts";
import { liveRows } from "../../model/binder.ts";
import { tasks } from "./p-aj-ts-controller.model.js";

import type { ModelQueryOptions } from "../../model/types.ts";

/** A task's row as the query answers it: dynamic data, read through unknown-typed fields. */
export interface TaskRow {
  id: unknown;
  title: unknown;
  done: unknown;
}

const queryFor = (filter: string): ModelQueryOptions => (filter === "all" ? { order: "at" } : { where: { done: filter === "done" }, order: "at" });

export class Board extends Controller {
  readonly filter = signal("all");
  readonly rows = liveRows<TaskRow>(this, tasks, () => queryFor(this.filter.value));
  readonly hooks: string[] = [];
  private added = 0;

  constructor() {
    super("board");
  }

  override connected(): Promise<void> | null {
    this.hooks.push("connected");
    return this.warm();
  }

  async warm(): Promise<void> {
    this.hooks.push("warm");
  }

  override disconnected(): Promise<void> | null {
    this.hooks.push("disconnected");
    return null;
  }

  async add(title: string): Promise<void> {
    this.added++;
    await tasks.add({ title, at: this.added });
  }

  async toggle(task: TaskRow): Promise<void> {
    await tasks.edit(String(task.id), { done: task.done !== true });
  }

  titles(): string {
    return this.rows.value.map((row: TaskRow) => String(row.title)).join(" | ");
  }
}
