/**
 * @file What the run did, one line each: kept in the `activity` store, in memory, so it lasts as
 * long as the run.
 */
import T from "@lightstart/light/types";
import { defineModel } from "@lightstart/light/model";

import type { ModelSchema } from "@lightstart/light/model";

const schema: ModelSchema = {
  $store: "activity",
  text: T.string({ required: true }),
  at: T.number({ required: true }),
};

export default defineModel("event", schema);

