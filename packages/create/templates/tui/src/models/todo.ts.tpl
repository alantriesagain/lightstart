/**
 * @file The todo model: a title, whether it is done, and when it was added.
 */
import T from "@lightstart/light/types";
import { defineModel } from "@lightstart/light/model";

import type { ModelSchema } from "@lightstart/light/model";

const schema: ModelSchema = {
  title: T.string({ required: true }),
  done: T.boolean({ defaultValue: false }),
  addedAt: T.number({ required: true }),
};

export default defineModel("todo", schema);

/** A todo as the query answers it: dynamic data, read through unknown-typed fields. */
export interface Todo {
  id: unknown;
  title: unknown;
  done: unknown;
  addedAt: unknown;
}
