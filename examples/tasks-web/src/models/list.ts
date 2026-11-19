/**
 * @file A list of tasks: its name and when it was made. In the `main` store.
 */
import T from "@lightstart/light/types";
import { defineModel } from "@lightstart/light/model";

import type { ModelRow } from "@lightstart/light/model";

const list = defineModel("list", {
  name: T.string({ required: true }),
  addedAt: T.number({ required: true }),
});

export default list;

/** A list as a query answers it, typed from the schema. */
export type List = ModelRow<typeof list>;
