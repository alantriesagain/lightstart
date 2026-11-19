/**
 * @file A task: its title, whether it is done, the list it belongs to, and when it was added. In
 * the `main` store.
 */
import T from "@lightstart/light/types";
import { defineModel } from "@lightstart/light/model";

import type { ModelRow } from "@lightstart/light/model";

const task = defineModel("task", {
  title: T.string({ required: true }),
  done: T.boolean({ defaultValue: false }),
  list: T.string({ required: true }),
  addedAt: T.number({ required: true }),
});

export default task;

/** A task as a query answers it, typed from the schema. */
export type Task = ModelRow<typeof task>;
