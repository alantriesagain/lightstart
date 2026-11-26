/**
 * @file The tables `@lightstart/moderation` adds to an app's server: the
 * `submission` queue, and `moderation_avatars`, the photo a published avatar
 * submission left for its account. Both are `none` for every operation, so
 * `crudApp` never exposes them; only this package's endpoints read or write
 * them.
 */

import { SUBMISSION_STATUSES } from "../index.ts";

import type { ModelSchema } from "@lightstart/light/model/types.ts";

const NOBODY = { read: "none", create: "none", write: "none", delete: "none" };

/**
 * `submission`: one queue for everything people send that somebody reviews
 * before it goes public. `kind` says what it is and `payload` carries it; the
 * kinds a project accepts, and what publishing each one means, are the
 * policy's.
 *
 * A person sends submissions and never reads the queue through CRUD: what
 * they sent waits on their own device as a pending row of the model it was
 * sent to, and the submit endpoint answers the id alone. Only the admin reads,
 * changes or removes a row.
 */
export const moderationModels = {
  submission: {
    id: { $type: "string", required: true },
    kind: { $type: "string", index: true, required: true },
    status: { $type: "string", enum: [...SUBMISSION_STATUSES], defaultValue: "pending", index: true },
    payload: { $type: "object", defaultValue: {} },
    targetType: { $type: "string", defaultValue: "" },
    targetSlug: { $type: "string", defaultValue: "" },
    author: { $type: "string", defaultValue: "" },
    contributorName: { $type: "string", defaultValue: "" },
    contributorInstagram: { $type: "string", defaultValue: "" },
    userId: { $type: "string", defaultValue: "", index: true },
    url: { $type: "string", defaultValue: "" },
    objectKey: { $type: "string", defaultValue: "" },
    ua: { $type: "string", defaultValue: "" },
    ipHash: { $type: "string", defaultValue: "" },
    $permissions: NOBODY,
  },
  moderation_avatars: {
    id: { $type: "string", required: true },
    url: { $type: "string", defaultValue: "" },
    objectKey: { $type: "string", defaultValue: "" },
    $permissions: NOBODY,
  },
} as unknown as Record<string, ModelSchema>;
