import { Controller } from "@lightstart/light/controller/class";
import { LiveRows, modelQuery } from "@lightstart/light/model/binder";
import notes from "../models/note.ts";

interface NoteRow {
  [key: string]: unknown;
  id: unknown;
  text: unknown;
}

class Notes extends Controller {
  readonly rows = new LiveRows<NoteRow>();

  constructor() {
    super("notes");
  }

  override connected(): Promise<void> | null {
    this.rows.use(modelQuery<Record<string, unknown>>(notes, { order: "text" }));
    return this.rows.loaded();
  }

  override disconnected(): Promise<void> | null {
    this.rows.dispose();
    return null;
  }

  async add(text: string): Promise<void> {
    await notes.add({ text });
  }
}

export default new Notes();
