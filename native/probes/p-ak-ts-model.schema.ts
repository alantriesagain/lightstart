/**
 * @file Probe AK's model: `defineModel` over `T` descriptors written in
 * TypeScript, which the tasks example avoids (its models are JSDoc JavaScript
 * because the descriptors did not lower from TypeScript).
 */
import T from "../../types/index.js";
import { defineModel } from "../../model/index.ts";

import type { ModelSchema } from "../../model/types.ts";

const schema: ModelSchema = {
  title: T.string({ required: true }),
  done: T.boolean({ defaultValue: false }),
  at: T.number(0),
};

export const notes = defineModel("notes", schema);
