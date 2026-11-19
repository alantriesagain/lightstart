/**
 * @file The todos controller: the live list of todos and the writes the app makes.
 */
import { Controller } from "@lightstart/light/controller/class";
import { liveRows } from "@lightstart/light/model/binder";
import todo from "../models/todo.ts";

import { TodoRow } from "../../.light/models.ts";

class Todos extends Controller {
  readonly rows = liveRows<TodoRow>(this, todo, () => ({ order: "addedAt" }), TodoRow.of);

  constructor() {
    super("todos");
  }

  async add(title: string): Promise<void> {
    const text = title.trim();
    if (text.length > 0) await todo.add({ title: text, addedAt: Date.now() });
  }

  async toggle(row: TodoRow): Promise<void> {
    await todo.edit(row.id, { done: !row.done });
  }

  async remove(row: TodoRow): Promise<void> {
    await todo.remove(row.id);
  }
}

export default new Todos();
