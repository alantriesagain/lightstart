/**
 * @file A list of tasks: its name and when it was made. In the `main` store.
 */
import T from "@lightstart/light/types";
import { defineModel } from "@lightstart/light/model";

import type { ModelSchema } from "@lightstart/light/model";

const schema: ModelSchema = {
  name: T.string({ required: true }),
  addedAt: T.number({ required: true }),
};

export default defineModel("list", schema);

/** A list as a query answers it. */
export interface List {
  id: unknown;
  name: unknown;
  addedAt: unknown;
}
