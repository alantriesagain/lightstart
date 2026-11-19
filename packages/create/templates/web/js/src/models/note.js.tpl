import T from "@lightstart/light/types";
import { defineModel } from "@lightstart/light/model";

const note = defineModel("note", {
  text: T.string({ required: true }),
});

/** A note as a query answers it, typed from the schema. @typedef {import("@lightstart/light/model").ModelRow<typeof note>} Note */

export default note;
