/**
 * @file The lists controller: every list, the one open now, and the writes. It starts after the
 * activity controller, which it imports, so it can say what it did from its start: the list
 * `--list` names is made when it is not there yet, and opened.
 */
import { Controller } from "@lightstart/light/controller/class";
import { liveRows } from "@lightstart/light/model/binder";
import { signal } from "@lightstart/light/signals";
import app from "../app.ts";
import { ListRow } from "../../.light/models.ts";
import list from "../models/list.ts";
import activity from "./activity.ts";

class Lists extends Controller {
  readonly rows = liveRows<ListRow>(this, list, () => ({ order: "addedAt" }), ListRow.of);
  /** The id of the list open now. */
  readonly current = signal("");

  constructor() {
    super("lists");
  }

  override connected(): Promise<void> | null {
    return this.open();
  }

  private async open(): Promise<void> {
    await this.rows.loaded();
    const wanted = app.args.string("list") ?? "Inbox";
    const found = this.rows.peek().find((row) => row.name === wanted);
    this.current.value = found !== undefined ? found.id : await this.add(wanted);
  }

  /** The list open now, or null before the start settled. */
  currentList(): ListRow | null {
    const id = this.current.value;
    return this.rows.value.find((row) => row.id === id) ?? null;
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
