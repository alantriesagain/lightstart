/**
 * @file Probe AM's generated row class: a task read from a store, its fields
 * typed by the model's schema, and `of` checking a row from outside.
 */

export class TaskRow {
  id: string;
  title: string;
  done: boolean;
  list: string | null;
  addedAt: number;

  constructor(id: string, title: string, done: boolean, list: string | null, addedAt: number) {
    this.id = id;
    this.title = title;
    this.done = done;
    this.list = list;
    this.addedAt = addedAt;
  }

  static of(row: Record<string, unknown>): TaskRow | null {
    const id = row.id;
    const title = row.title;
    const done = row.done;
    const list = row.list;
    const addedAt = row.addedAt;

    if (typeof id !== "string") return null;
    if (typeof title !== "string") return null;
    let doneValue = false;
    if (done === undefined) doneValue = false;
    else if (typeof done === "boolean") doneValue = done;
    else return null;
    let listValue: string | null = null;
    if (list !== undefined) {
      if (typeof list !== "string") return null;
      listValue = list;
    }
    if (typeof addedAt !== "number") return null;

    return new TaskRow(id, title, doneValue, listValue, addedAt);
  }
}
