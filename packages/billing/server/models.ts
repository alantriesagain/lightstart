/**
 * @file The tables `@lightstart/billing` adds to an app's server. `charge` is
 * every payment asked for, and `entitlement` is one paid period of one plan.
 * Both are readable by their owner alone; no client creates, changes or
 * deletes one through CRUD, since the package's calls and endpoints write
 * them.
 */

import { CHARGE_STATUSES, ENTITLEMENT_STATUSES } from "../types.ts";

import type { ModelSchema } from "@lightstart/light/model/types.ts";

const OWNER_READS = { read: "owner", create: "none", write: "none", delete: "none", ownerField: "userId" };

const billingModels = {
  charge: {
    id: { $type: "string", required: true },
    userId: { $type: "string", defaultValue: "", index: true },
    plan: { $type: "string", defaultValue: "", index: true },
    amount: { $type: "number", defaultValue: 0 },
    currency: { $type: "string", defaultValue: "" },
    provider: { $type: "string", defaultValue: "" },
    providerRef: { $type: "string", defaultValue: "", index: true },
    status: { $type: "string", enum: [...CHARGE_STATUSES], defaultValue: "pending", index: true },
    paidAt: { $type: "string", defaultValue: "" },
    context: { $type: "object", defaultValue: {} },
    data: { $type: "object", defaultValue: {} },
    $permissions: OWNER_READS,
  },
  entitlement: {
    id: { $type: "string", required: true },
    userId: { $type: "string", defaultValue: "", index: true },
    key: { $type: "string", defaultValue: "", index: true },
    source: { $type: "string", defaultValue: "" },
    ref: { $type: "string", defaultValue: "" },
    plan: { $type: "string", defaultValue: "" },
    startsAt: { $type: "string", defaultValue: "" },
    expiresAt: { $type: "string", defaultValue: "", index: true },
    status: { $type: "string", enum: [...ENTITLEMENT_STATUSES], defaultValue: "active", index: true },
    $permissions: OWNER_READS,
  },
} as unknown as Record<string, ModelSchema>;

export { billingModels };
