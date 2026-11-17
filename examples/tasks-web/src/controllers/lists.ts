/**
 * @file The lists controller: every list, the one open now, and the writes. It starts after the
 * activity controller, which it imports, so it can say what it did from its start: the list
 * the `list` argument names is made when it is not there yet, and opened.
 */
import { Controller } from "@lightstart/light/controller/class";
import { LiveRows, modelQuery } from "@lightstart/light/model/binder";
import { signal } from "@lightstart/light/signals";
import app from "../app.ts";
import list from "../models/list.ts";
import activity from "./activity.ts";

import type { List } from "../models/list.ts";

class Lists extends Controller {
  readonly rows = new LiveRows<List>();
  /** The id of the list open now. */
  readonly current = signal("");

  constructor() {
    super("lists");
  }

  override connected(): Promise<void> | null {
    return this.open();
  }

  private async open(): Promise<void> {
    this.rows.use(modelQuery<Record<string, unknown>>(list, { order: "addedAt" }));
    await this.rows.loaded();
    const wanted = app.args.string("list") ?? "Inbox";
    const found = this.rows.peek().find((row) => row.name === wanted);
    this.current.value = found !== undefined ? String(found.id) : await this.add(wanted);
  }

  override disconnected(): Promise<void> | null {
    this.rows.dispose();
    return null;
  }

  /** The list open now, or null before the start settled. */
  currentList(): List | null {
    const id = this.current.value;
    return this.rows.value.find((row) => String(row.id) === id) ?? null;
  }

  /** Make a list named `name`; answers its id. */
  async add(name: string): Promise<string> {
    const made = await list.add({ name: name.trim(), addedAt: Date.now() });
    await activity.note("made the list " + name.trim());
    return String(made.id);
  }

  /** Open list `id`. */
  select(id: string): void {
    this.current.value = id;
  }
}

export default new Lists();
