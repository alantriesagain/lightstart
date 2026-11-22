import T from "@lightstart/light/types";
import { defineModel } from "@lightstart/light/model";

export default defineModel("guide", {
  $store: "catalogue",
  $heavy: ["setup", "cues", "mistakes"],
  title: T.string({ required: true }),
  areas: T.array(),
  setup: T.array(),
  cues: T.array(),
  mistakes: T.array(),
  body: T.array(),
});
