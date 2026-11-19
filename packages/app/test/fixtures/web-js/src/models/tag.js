import T from "@lightstart/light/types";
import { defineModel } from "@lightstart/light/model";

export default defineModel("tag", {
  label: T.string({ required: true }),
});
