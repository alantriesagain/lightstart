import T from "@lightstart/light/types";
import { defineModel } from "@lightstart/light/model";

export default defineModel("archive", {
  text: T.string({ required: true }),
  ranInWorker: T.boolean(),
  $store: "archive",
  $hooks: {
    beforeAdd: (row) => ({ ...row, ranInWorker: typeof WorkerGlobalScope !== "undefined" }),
  },
});
