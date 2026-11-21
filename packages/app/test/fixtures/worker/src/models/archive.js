import T from "@lightstart/light/types";
import { defineModel } from "@lightstart/light/model";

export default defineModel("archive", {
  text: T.string({ required: true }),
  $store: "archive",
});
