/**
 * @file The fixture's item model: one of each field shape the generated row class reads.
 */
import T from "@lightstart/light/types";
import { defineModel } from "@lightstart/light/model";

import type { ModelSchema } from "@lightstart/light/model";

const schema: ModelSchema = {
  id: T.number({ required: true }),
  title: T.string({ required: true }),
  done: T.boolean({ defaultValue: false }),
  note: T.string(),
};

export default defineModel("item", schema);
