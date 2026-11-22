import T from "@lightstart/light/types";
import { defineModel } from "@lightstart/light/model";

export default defineModel("note", {
  title: T.string({ required: true }),
  body: T.array(),
});
