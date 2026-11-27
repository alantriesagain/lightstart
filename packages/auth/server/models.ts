/**
 * @file The server models auth keeps beside an app's own: `users`,
 * `auth_codes`, the provider links in `oauth_accounts`, the short-lived
 * hand-offs in `auth_handoffs` and the per-IP `auth_code_requests` count. All
 * are `none` for every operation, so `crudApp` never answers them; only the
 * auth routes read and write them.
 */

import type { ModelSchema } from "@lightstart/light/model/types.ts";

const NOBODY = { read: "none", create: "none", write: "none", delete: "none" };

/**
 * The auth tables: a person (`users`, `email` unique and NULL for an account
 * an identity made), the live sign-in code for an address (`auth_codes`,
 * holding the code's hash, never the code), a provider account linked to a
 * person (`oauth_accounts`, one per provider and provider id) and the
 * one-minute hand-off a page redeems (`auth_handoffs`, holding its hash), and
 * the code requests one address made (`auth_code_requests`, keyed by the
 * salted address digest, its `created` column the window compares).
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
  oauth_accounts: {
    id: { $type: "string", required: true },
    provider: { $type: "string", required: true, index: true },
    provider_id: { $type: "string", required: true },
    user_id: { $type: "string", required: true, index: true },
    $indexes: [{ fields: ["provider", "provider_id"], unique: true }],
    $permissions: NOBODY,
  },
  auth_handoffs: {
    id: { $type: "string", required: true },
    code: { $type: "string", required: true, unique: true },
    user_id: { $type: "string", required: true, index: true },
    expires: { $type: "number", required: true },
    $permissions: NOBODY,
  },
  auth_code_requests: {
    id: { $type: "string", required: true },
    ipHash: { $type: "string", required: true, index: true },
    $permissions: NOBODY,
  },
} as unknown as Record<string, ModelSchema>;
