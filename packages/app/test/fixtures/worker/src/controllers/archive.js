import { Controller } from "@lightstart/light/controller/class";
import { LiveRows, modelQuery } from "@lightstart/light/model/binder";
import archive from "../models/archive.js";

class Archive extends Controller {
  rows = new LiveRows();

  constructor() {
    super("archive");
  }

  connected() {
    this.rows.use(modelQuery(archive, { order: "text" }));
    return this.rows.loaded();
  }

  disconnected() {
    this.rows.dispose();
    return null;
  }
}

export default new Archive();
