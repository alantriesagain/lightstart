/**
 * @file The boards model: a title, and a position among the boards.
 */
import T from "@lightstart/light/types";
import { defineModel } from "@lightstart/light/model";

export default defineModel("boards", {
  title: T.string({ required: true }),
  position: T.number({ required: true }),
});
