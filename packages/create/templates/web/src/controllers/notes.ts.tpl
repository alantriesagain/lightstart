import { Controller } from "@lightstart/light/controller/class";
import { liveRows } from "@lightstart/light/model/binder";
import note from "../models/note.ts";

interface NoteRow {
  [key: string]: unknown;
  id: unknown;
  text: unknown;
}

class Notes extends Controller {
  readonly rows = liveRows<NoteRow>(this, note, () => ({ order: "text" }));

  constructor() {
    super("notes");
  }

  async add(text: string): Promise<void> {
    await note.add({ text });
  }
}

export default new Notes();
