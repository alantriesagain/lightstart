/**
 * @file The server models `@lightstart/whatsapp` keeps beside an app's own:
 * `whatsapp_account` (a person's connection), `whatsapp_code` (the codes
 * handed out) and `whatsapp_message` (the deliveries already seen). Only the
 * account row is readable, by its owner; the endpoints are the only way to the
 * other two.
 */

import type { ModelSchema } from "@lightstart/light/model/types.ts";

const NOBODY = { read: "none", create: "none", write: "none", delete: "none" };
const OWNER_READS = { read: "owner", create: "none", write: "none", delete: "none", ownerField: "userId" };

/**
 * `whatsapp_account`: the WhatsApp an account is connected to, one row per
 * account under the account's id. `sender` is how WhatsApp names the person to
 * this business (their business-scoped user id, or `+<waId>` when WhatsApp sent
 * none), and no two accounts hold the same one. `waId` is the number exactly as
 * WhatsApp sent it, empty while it withholds it. A person reads their own row;
 * only the webhook writes one.
 *
 * `whatsapp_code`: the six-digit codes a person is handed to send from their
 * WhatsApp, each good for ten minutes and used once. `purpose` is `connect` for
 * a signed-in account's code, under its `userId`, or `login` for a code a device
 * asked for to sign in with, which holds the digest of the device's nonce and
 * of the address it asked from, and is redeemed once (`redeemedAt`);
 * `deviceId` is the push id of the device that asked, when it sent one. The
 * sender a code came from is stamped on it when it arrives (`sender`, `waId`,
 * `username`, `country`).
 *
 * `whatsapp_message`: every message the webhook took, by its WhatsApp id, which
 * is how a repeat delivery is dropped and how a sender sending codes that match
 * nothing is stopped. Neither it nor the codes is readable through the model
 * router; the endpoints are the only way to them.
 */
export const whatsappModels = {
  whatsapp_account: {
    $indexes: [{ fields: ["sender"], unique: true }],
    id: { $type: "string", required: true },
    userId: { $type: "string", defaultValue: "", index: true },
    sender: { $type: "string", defaultValue: "" },
    waId: { $type: "string", defaultValue: "", index: true },
    username: { $type: "string", defaultValue: "" },
    country: { $type: "string", defaultValue: "" },
    connectedAt: { $type: "string", defaultValue: "" },
    $permissions: OWNER_READS,
  },

  whatsapp_code: {
    id: { $type: "string", required: true },
    userId: { $type: "string", defaultValue: "", index: true },
    code: { $type: "string", defaultValue: "", index: true },
    expiresAt: { $type: "string", defaultValue: "" },
    usedAt: { $type: "string", defaultValue: "" },
    sender: { $type: "string", defaultValue: "" },
    purpose: { $type: "string", defaultValue: "connect" },
    nonceHash: { $type: "string", defaultValue: "", index: true },
    ipHash: { $type: "string", defaultValue: "", index: true },
    redeemedAt: { $type: "string", defaultValue: "" },
    deviceId: { $type: "string", defaultValue: "" },
    waId: { $type: "string", defaultValue: "" },
    username: { $type: "string", defaultValue: "" },
    country: { $type: "string", defaultValue: "" },
    $permissions: NOBODY,
  },

  whatsapp_message: {
    id: { $type: "string", required: true },
    sender: { $type: "string", defaultValue: "", index: true },
    matched: { $type: "number", defaultValue: 0 },
    $permissions: NOBODY,
  },
} as unknown as Record<string, ModelSchema>;
