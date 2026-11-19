/**
 * @file What the run did, one line each: kept in the `activity` store, in memory, so it lasts as
 * long as the run.
 */
import T from "@lightstart/light/types";
import { defineModel } from "@lightstart/light/model";

import type { ModelRow } from "@lightstart/light/model";

const event = defineModel("event", {
  $adapter: "activity",
  text: T.string({ required: true }),
  at: T.number({ required: true }),
});

export default event;

/** An entry of the run's activity as a query answers it, typed from the schema. */
export type EventRow = ModelRow<typeof event>;
