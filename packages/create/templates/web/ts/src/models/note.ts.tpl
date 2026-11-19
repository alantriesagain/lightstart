import T from "@lightstart/light/types";
import { defineModel } from "@lightstart/light/model";

export default defineModel("note", {
  text: T.string({ required: true }),
});
