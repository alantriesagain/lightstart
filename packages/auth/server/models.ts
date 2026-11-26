/**
 * @file The server models auth keeps beside an app's own: `users` and
 * `auth_codes`. Both are `none` for every operation, so `crudApp` never
 * answers them; only the auth routes read and write them.
 */

import type { ModelSchema } from "@lightstart/light/model/types.ts";

const NOBODY = { read: "none", create: "none", write: "none", delete: "none" };

/**
 * The auth tables: a person (`users`, `email` unique and NULL for an account
 * an identity made) and the live sign-in code for an address (`auth_codes`,
 * holding the code's hash, never the code).
 */
export const authModels = {
  users: {
    id: { $type: "string", required: true },
    email: { $type: "string", unique: true, index: true },
    name: { $type: "string", defaultValue: "" },
    admin: { $type: "boolean", defaultValue: false },
    $permissions: NOBODY,
  },
  auth_codes: {
    id: { $type: "string", required: true },
    email: { $type: "string", required: true, index: true },
    code: { $type: "string", required: true },
    expires: { $type: "number", required: true },
    tries: { $type: "number", required: true, defaultValue: 0 },
    $permissions: NOBODY,
  },
} as unknown as Record<string, ModelSchema>;
