/**
 * @file The server model `@lightstart/visitor` contributes: `visits`, the row
 * a per-address limit counts when the write being limited has no row of its
 * own. It is `none` for every operation, so the CRUD routes never expose it;
 * only the policy reads or writes it.
 */

import type { ModelSchema } from "@lightstart/light/model/types.ts";

const NOBODY = { read: "none", create: "none", write: "none", delete: "none" };

/**
 * The visitor tables a migration creates. `visits` holds one row per counted
 * request, keyed by the salted address digest (`ipHash`); its `created` column
 * is the one the window compares.
 */
export const visitorModels = {
  visits: {
    id: { $type: "string", required: true },
    ipHash: { $type: "string", required: true, index: true },
    $permissions: NOBODY,
  },
} as unknown as Record<string, ModelSchema>;
