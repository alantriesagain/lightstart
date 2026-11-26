/**
 * @file @lightstart/moderation: what a person sends waits in one queue until
 * somebody reviews it, and a moderated model shows them their pending rows
 * meanwhile. The names every part of the package shares live here: the
 * statuses, the review moves, the submission id and payload helpers, the
 * pending marker, and the provenance a published row carries so the sender's
 * device can heal itself.
 */

import { event } from "@lightstart/light/signals";

import type { ModerationPublished, PendingMarker } from "./types.ts";

export type * from "./types.ts";

/** Where a submission is: waiting, approved and waiting to be published, published, refused, or replaced by a newer one from the same person. */
export const SUBMISSION_STATUSES = ["pending", "approved", "published", "rejected", "replaced"] as const;

/**
 * The moves a review makes: from where a submission is, to where the admin may
 * put it. `published` and `replaced` are where one ends.
 */
export const REVIEW_MOVES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  pending: ["approved", "rejected"],
  approved: ["pending", "rejected"],
  rejected: ["approved", "pending"],
});

/** A new submission's id: twenty characters, opaque, the key its files are stored under. */
export const mintSubmissionId = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(20)), (byte) => "abcdefghijklmnopqrstuvwxyz0123456789"[byte % 36]).join("");

/** The path a published submission's file is served under, on the site's own origin. */
export const FILES_PATH = "/api/files/";

/**
 * A submission's payload as an object: the row holds it as JSON text, and a
 * value that is not an object reads as empty.
 */
export const payloadOf = (raw: unknown): Record<string, unknown> => {
  let value: unknown = raw;
  if (typeof raw === "string")
    try {
      value = JSON.parse(raw || "{}");
    } catch {
      value = null;
    }
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
};

/**
 * Bytes as base64, in slices, so a photo's worth of bytes never meets the
 * limit on how many arguments one call may take.
 */
export const base64Of = (bytes: Uint8Array): string => {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
};

/**
 * A queue row for `kind` carrying `payload`: the credit and target fields the
 * payload names ride beside it as columns, each at most 200 characters once
 * the server trims them.
 */
export const submissionOf = (kind: string, payload: Record<string, unknown>): Record<string, unknown> => ({
  kind,
  payload,
  targetType: String(payload.targetType || ""),
  targetSlug: String(payload.targetSlug || ""),
  author: String(payload.author || ""),
  contributorName: String(payload.contributorName || ""),
  contributorInstagram: String(payload.contributorInstagram || ""),
});

/**
 * The marker a pending row of a moderated model carries, or null for a
 * published row: which submission it waits as, whether it adds or edits, who
 * sent it, and the provenance a published record will carry for it.
 */
export const pendingOf = (row: Record<string, unknown> | null | undefined): PendingMarker | null => {
  const marker = row?.["pending"];
  return marker !== null && typeof marker === "object" && typeof (marker as { id?: unknown }).id === "string" ? (marker as PendingMarker) : null;
};

/**
 * The mark a published record carries for the submission it came from: the
 * first 24 hex characters of SHA-256 over the submission id. A record names
 * no raw id, and the device that sent the submission knows the hash of its
 * own id, so a pending row heals when a published row carries it.
 */
export const provenanceOf = async (id: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(id)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
};

/** A pending row healed, because a published row carried its provenance. */
export const published = event<ModerationPublished>();
