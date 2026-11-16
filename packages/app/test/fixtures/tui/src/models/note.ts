/**
 * @file The fixture's note model: a line of text.
 */
import T from "@lightstart/light/types";
import { defineModel } from "@lightstart/light/model";

import type { ModelSchema } from "@lightstart/light/model";

const schema: ModelSchema = {
  text: T.string({ required: true }),
};

export default defineModel("note", schema);

/** A note as the query answers it: dynamic data, read through unknown-typed fields. */
export interface Note {
  id: unknown;
  text: unknown;
}
