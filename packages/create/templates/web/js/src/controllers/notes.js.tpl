import { Controller } from "@lightstart/light/controller/class";
import { liveRows } from "@lightstart/light/model/binder";
import note from "../models/note.js";

/** @import { Note } from "../models/note.js" */

class Notes extends Controller {
  /** @type {import("@lightstart/light/model/binder").LiveRows<Note>} */
  rows = liveRows(this, note, () => ({ order: "text" }));

  constructor() {
    super("notes");
  }

  /**
   * @param {string} text
   * @returns {Promise<void>}
   */
  async add(text) {
    await note.add({ text });
  }
}

export default new Notes();
