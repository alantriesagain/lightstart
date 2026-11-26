/**
 * @file The types `@lightstart/moderation` shares between its server and its
 * page: a submission and its statuses, the kinds a project accepts, the
 * pending marker a moderated model's row carries, and the storage a photo is
 * published into.
 */

import type { D1Like } from "@lightstart/api/server";
import type { ModelSchema } from "@lightstart/light/model/types.ts";
import type { SUBMISSION_STATUSES } from "./index.ts";

/** A model whose client writes are submissions: a write enqueues one and keeps the row in the model's `$shadow` on the device. */
export interface ModeratedOptions {
  /** Whether a client may edit a published row (an `edit` submission) as well as add one. */
  edit?: boolean;
  /** Keep one pending add per person: a new one replaces the older pending or rejected one. */
  single?: boolean;
}

declare module "@lightstart/light/model/types.ts" {
  interface ModelSchemaDirectives {
    /**
     * A model whose client writes are submissions: a write enqueues one and
     * keeps the row in the model's `$shadow` store on the device, where its
     * author alone reads it until a published row carries its provenance.
     */
    $moderated?: true | ModeratedOptions;
  }
}

/** The marker a pending row of a moderated model carries. */
export interface PendingMarker {
  /** The submission it waits as. */
  id: string;
  /** Whether it adds a row or edits a published one. */
  op: "add" | "edit";
  /** The user id of whoever sent it; the row is theirs alone. */
  by: string;
  /** The hash a published record carries for it (`provenanceOf`). */
  provenance: string;
}

/** A row as a moderated model answers it: a published row, or a pending one with its marker. */
export type Pending<R extends Record<string, unknown> = Record<string, unknown>> = R & { pending?: PendingMarker };

/** `moderation:published`: a pending row healed, because a published row carried its provenance. */
export interface ModerationPublished {
  model: string;
  /** The submission id. */
  id: string;
  /** The key the pending row had in the shadow. */
  key: string | number | undefined;
  /** The published row that carried the provenance. */
  row: Record<string, unknown> | undefined;
}

/** Where a submission is in review. */
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** A `submission` row as the queue and its sender read it. */
export interface SubmissionRow {
  id: string;
  kind: string;
  status: SubmissionStatus;
  payload: Record<string, unknown>;
  targetType: string;
  targetSlug: string;
  author: string;
  contributorName: string;
  contributorInstagram: string;
  userId: string;
  /** Where it went public, once a kind published at approval says so. */
  url: string;
  /** The stored file it put in storage, when it put one there. */
  objectKey: string;
  ua?: string;
  ipHash?: string;
  created?: string;
  updated?: string;
}

/** A stored submission with its payload read into an object. */
export interface SubmissionRecord extends SubmissionRow {}

/** A signed-in person as a policy sees them. */
export interface ModerationUser {
  id: string;
  admin?: boolean;
}

/** What a kind's `accept` answers: the payload to keep, or why it is refused. */
export type SubmissionVerdict = { payload: Record<string, unknown> } | { error: string; status?: number };

/** What a kind's `accept` is handed. */
export interface SubmissionAcceptContext {
  payload: Record<string, unknown>;
  user: ModerationUser;
  request: Request;
  db: D1Like;
  env: Record<string, unknown>;
}

/** What a kind's `publish` and `unpublish` are handed. */
export interface SubmissionPublishContext {
  submission: SubmissionRecord;
  db: D1Like;
  env: Record<string, unknown>;
  request: Request;
}

/** What a kind's `publish` answers once the submission is public. */
export interface SubmissionPublished {
  /** Where it is public now. */
  url?: string;
  /** The file it put in storage, so taking it down can delete it. */
  objectKey?: string;
  /** The payload to keep from now on; the one sent stays when absent. */
  payload?: Record<string, unknown>;
  /** A model row's published id, so taking it down can find it. */
  targetSlug?: string;
}

/** One kind of thing a project accepts, and what reviewing it involves. */
export interface SubmissionKind {
  /** Checks what was sent and answers the payload to keep. Absent, any object is kept as sent. */
  accept?(ctx: SubmissionAcceptContext): SubmissionVerdict | Promise<SubmissionVerdict>;
  /** One waiting submission of this kind per person: sending another replaces the older pending or rejected one. */
  single?: boolean;
  /** How many of this kind one person may send in an hour. */
  perHour?: number;
  /** The most characters its payload may take as JSON. Defaults to 32000. */
  maxPayload?: number;
  /**
   * Publishes it at approval, before the row changes. Absent, a kind that
   * names a server model publishes into that model's table, and any other
   * kind waits approved. A `Response` refuses the approval with that answer.
   */
  publish?(ctx: SubmissionPublishContext): Promise<SubmissionPublished | Response>;
  /** Takes a published submission down, when it is removed or replaced. A `Response` refuses. */
  unpublish?(ctx: SubmissionPublishContext): Promise<Response | void>;
  /** A kind that ends at its review (a report): approval settles it, and nothing is published. */
  terminal?: boolean;
}

/** What `submissionPolicy` is built from. */
export interface SubmissionPolicyOptions {
  /** The kinds the project accepts, by name, beyond its moderated models. */
  kinds: Record<string, SubmissionKind>;
  /** The server models that declare `$moderated`, each with whether an edit of a published row may be submitted: the only tables a submission is published into or taken down from. */
  moderated?: Record<string, { edit: boolean }>;
  /** The most submissions one address may send a minute; 8 by default. */
  perAddress?: number;
}

/** What a policy phase is handed when a submission is written. */
export interface SubmissionCreateContext {
  data: Record<string, unknown>;
  user: ModerationUser | null;
  request: Request;
  db: D1Like;
  env: Record<string, unknown>;
  ip?: string | null;
}

/** What a policy phase is handed when a submission is reviewed or removed. */
export interface SubmissionReviewContext {
  data: Record<string, unknown>;
  record: SubmissionRecord | null;
  user: ModerationUser | null;
  request: Request;
  db: D1Like;
  env: Record<string, unknown>;
}

/** The policy `submissionPolicy` builds: its phases, called by the package's endpoints. */
export interface SubmissionPolicy {
  beforeCreate(ctx: SubmissionCreateContext): Promise<Record<string, unknown> | Response>;
  beforeUpdate(ctx: SubmissionReviewContext): Promise<Record<string, unknown> | Response>;
  beforeRemove(ctx: Omit<SubmissionReviewContext, "data">): Promise<Response | void>;
}

/** The image formats a photo may carry, as `imageSize` names them. */
export type ImageType = "webp" | "jpeg" | "png";

/** What `readImageDataUrl` accepts. */
export interface ImageLimits {
  /** The most bytes the decoded image may have. */
  maxBytes: number;
  /** The shortest side it may have, in pixels. */
  minSide: number;
  /** The longest side it may have, in pixels. */
  maxSide: number;
  /** How far from square it may be, as a fraction of its longest side. */
  squareTolerance: number;
}

/** What `readImageDataUrl` answers: the decoded image, or why it was refused. */
export type ReadImage =
  | {
      ok: true;
      type: ImageType;
      ext: "webp" | "jpg" | "png";
      contentType: string;
      bytes: Uint8Array;
      width: number;
      height: number;
      dataUrl: string;
    }
  | { ok: false; error: string };

/** What a storage binding a photo is published into must answer: R2's shape, narrowed. */
export interface StorageLike {
  put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }): Promise<unknown>;
  get(key: string): Promise<StorageObject | null>;
  head(key: string): Promise<StorageHead | null>;
  delete(key: string | string[]): Promise<unknown>;
}

/** What `StorageLike.head` answers. */
export interface StorageHead {
  etag: string;
  size: number;
  uploaded: Date;
  httpEtag: string;
}

/** What `StorageLike.get` answers: the head and a body. */
export interface StorageObject extends StorageHead {
  body: ReadableStream | Uint8Array;
}

/** The photo you sent from this device, as drawing it needs. */
export interface OwnPhoto {
  id: string;
  status: SubmissionStatus;
  /** The image as it was sent. */
  image: string;
  /** Where it is served from, when that is known. */
  url: string;
}

/** The photo a device keeps until the account carries the published one. */
export interface PendingPhoto {
  /** The submission id. */
  id: string;
  userId: string;
  /** The image as it was sent, a data URL. */
  image: string;
  created: string;
}

/** A schema the contribution adds, as a table. */
export type SubmissionSchema = ModelSchema;

/** One kind of thing the review queue lists, filled into the `queue.kinds` slot. */
export interface QueueKind {
  /** The submission kind, such as `avatar` or `place`. */
  kind: string;
  /** What the kind is called in the list. */
  label: string;
  /** The heading its items are grouped under. */
  group: string;
  /** The icon its rows draw. */
  icon: string;
  /** The tag drawn as its detail, with `.item` set; the payload is read as fields without one. */
  detail?: string;
  /** A row's title, from its record; the payload's name or title when absent. */
  title?(record: Record<string, unknown>): string;
  /** A kind its review settles: approval ends it and nothing is published. */
  terminal?: boolean;
}

/** A submission as the review queue lists it. */
export interface QueueItem {
  id: string;
  kind: string;
  status: string;
  title: string;
  created: string;
  userId: string;
  /** The submission row, with its payload read into an object. */
  record: Record<string, unknown>;
}

/** One payload field as the queue draws it: text, an image or JSON. */
export interface QueuePayloadField {
  key: string;
  kind: "text" | "image" | "json";
  value: string;
}

/** One heading of the queue and the items under it, newest first. */
export interface QueueGroup {
  label: string;
  items: QueueItem[];
}
