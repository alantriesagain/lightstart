/**
 * @file A task: its title, whether it is done, the list it belongs to, and when it was added. In
 * the `main` store.
 */
import T from "@lightstart/light/types";
import { defineModel } from "@lightstart/light/model";

import type { ModelSchema } from "@lightstart/light/model";

const schema: ModelSchema = {
  title: T.string({ required: true }),
  done: T.boolean({ defaultValue: false }),
  list: T.string({ required: true }),
  addedAt: T.number({ required: true }),
};

export default defineModel("task", schema);

/** A task as a query answers it. */
export interface Task {
  id: unknown;
  title: unknown;
  done: unknown;
  list: unknown;
  addedAt: unknown;
}
