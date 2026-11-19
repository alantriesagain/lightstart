import { Controller } from "@lightstart/light/controller/class";
import { LiveRows, modelQuery } from "@lightstart/light/model/binder";
import note from "../models/note.js";

class Notes extends Controller {
  rows = new LiveRows();

  constructor() {
    super("notes");
  }

  connected() {
    this.rows.use(modelQuery(note, { order: "text" }));
    return this.rows.loaded();
  }

  disconnected() {
    this.rows.dispose();
    return null;
  }
}

export default new Notes();
