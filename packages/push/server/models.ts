/**
 * @file The server model `@lightstart/push` contributes: `push_device`, one
 * row per install that turned pushes on. It is `none` for every operation, so
 * the CRUD routes never expose it; only `POST /api/push-device` and
 * `sendPush` read or write it.
 */

import type { ModelSchema } from "@lightstart/light/model/types.ts";

const NOBODY = { read: "none", create: "none", write: "none", delete: "none" };

/**
 * The push table a migration creates. `id` is the opaque id the device made
 * for itself, `userId` the account it is signed in to (empty while signed
 * out), `token` where FCM reaches it, `platform` the shape of its message,
 * and `locale` the language it reads.
 */
export const pushModels = {
  push_device: {
    id: { $type: "string", required: true },
    userId: { $type: "string", defaultValue: "", index: true },
    platform: { $type: "string", defaultValue: "android", enum: ["android", "ios"] },
    token: { $type: "string", defaultValue: "", index: true },
    locale: { $type: "string", defaultValue: "" },
    updatedAt: { $type: "string", defaultValue: "" },
    $permissions: NOBODY,
  },
} as unknown as Record<string, ModelSchema>;
