/**
 * @file The todos controller: the live list of todos and the writes the app makes.
 */
import { Controller } from "@lightstart/light/controller/class";
import { LiveRows, modelQuery } from "@lightstart/light/model/binder";
import todo from "../models/todo.ts";

import type { Todo } from "../models/todo.ts";

class Todos extends Controller {
  readonly rows = new LiveRows<Todo>();

  constructor() {
    super("todos");
  }

  override connected(): Promise<void> | null {
    this.rows.use(modelQuery<Record<string, unknown>>(todo, { order: "addedAt" }));
    return this.rows.loaded();
  }

  override disconnected(): Promise<void> | null {
    this.rows.dispose();
    return null;
  }

  async add(title: string): Promise<void> {
    const text = title.trim();
    if (text.length > 0) await todo.add({ title: text, addedAt: Date.now() });
  }

  async toggle(row: Todo): Promise<void> {
    await todo.edit(String(row.id), { done: row.done !== true });
  }

  async remove(row: Todo): Promise<void> {
    await todo.remove(String(row.id));
  }
}

export default new Todos();
