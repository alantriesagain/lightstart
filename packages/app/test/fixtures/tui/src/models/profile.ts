/**
 * @file The fixture's profile model: a name kept in the `user` database.
 */
import T from "@lightstart/light/types";
import { defineModel } from "@lightstart/light/model";

import type { ModelSchema } from "@lightstart/light/model";

const schema: ModelSchema = {
  $store: "user",
  name: T.string({ required: true }),
};

export default defineModel("profile", schema);
