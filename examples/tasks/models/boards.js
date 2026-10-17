/**
 * @file The boards model: a title, and a position among the boards.
 */
import T from "@bootstrapp/light/types";
import { defineModel } from "@bootstrapp/light/model";

export default defineModel("boards", {
  title: T.string({ required: true }),
  position: T.number({ required: true }),
});
