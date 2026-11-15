/**
 * @file The todo controller: the filter and the live rows it selects, the counts of the whole list,
 * and the writes. `openTodos` opens the JSONL store over the model and starts the controller, in
 * that order, so the first query finds a store to read.
 */
import { Controller } from "@lightstart/light/controller/class";
import { liveRows } from "@lightstart/light/model/binder";
import { openJsonl } from "@lightstart/light/model/jsonl";
import { signal } from "@lightstart/light/signals";
import { todos as todoModel } from "../models/todos.ts";

import type { JsonlIO, ModelQueryOptions } from "@lightstart/light/model";
import type { Todo } from "../models/todos.ts";

const FILTERS = ["all", "open", "done"];

const queryFor = (filter: string): ModelQueryOptions => (filter === "all" ? { order: "addedAt" } : { where: { done: filter === "done" }, order: "addedAt" });

export class Todos extends Controller {
  readonly filter = signal("all");
  readonly rows = liveRows<Todo>(this, todoModel, () => queryFor(this.filter.value));
  readonly all = liveRows<Todo>(this, todoModel, () => ({ order: "addedAt" }));

  constructor() {
    super("todos");
  }

  async add(title: string): Promise<void> {
    const text = title.trim();
    if (text.length > 0) await todoModel.add({ title: text, addedAt: Date.now() });
  }

  async toggle(todo: Todo): Promise<void> {
    await todoModel.edit(String(todo.id), { done: todo.done !== true });
  }

  async remove(todo: Todo): Promise<void> {
    await todoModel.remove(String(todo.id));
  }

  async clearDone(): Promise<void> {
    await todoModel.removeAll({ done: true });
  }

  nextFilter(): void {
    const at = FILTERS.indexOf(this.filter.value);
    this.filter.value = FILTERS[(at + 1) % FILTERS.length] ?? "all";
  }
}

/** The app's controller, made by `openTodos`. */
export let todos: Todos;

/** Open the store over `dir` through `io`, then make and start the controller. */
export const openTodos = async (dir: string, io: JsonlIO): Promise<Todos> => {
  await openJsonl({ name: "todos", dir, io, models: [todoModel] });
  const instance = new Todos();
  await instance.start();
  todos = instance;
  return instance;
};
