/**
 * @file The tasks model: a title, whether it is done, when it was added, and
 * the board it belongs to.
 */
import T from "@bootstrapp/light/types";
import { defineModel } from "@bootstrapp/light/model";

export default defineModel("tasks", {
  title: T.string({ required: true }),
  done: T.boolean({ defaultValue: false }),
  addedAt: T.number({ required: true }),
  boardId: T.string({ required: true }),
});
