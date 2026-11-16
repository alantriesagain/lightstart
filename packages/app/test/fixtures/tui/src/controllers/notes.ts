/**
 * @file The fixture's notes controller: a live list of the notes and the one
 * write the app makes.
 */
import { Controller } from "@lightstart/light/controller/class";
import { LiveRows, modelQuery } from "@lightstart/light/model/binder";
import note from "../models/note.ts";

import type { Note } from "../models/note.ts";

class Notes extends Controller {
  readonly rows = new LiveRows<Note>();

  constructor() {
    super("notes");
  }

  override connected(): Promise<void> | null {
    this.rows.use(modelQuery<Record<string, unknown>>(note, { order: "text" }));
    return this.rows.loaded();
  }

  override disconnected(): Promise<void> | null {
    this.rows.dispose();
    return null;
  }

  async add(text: string): Promise<void> {
    await note.add({ text });
  }
}

export default new Notes();
