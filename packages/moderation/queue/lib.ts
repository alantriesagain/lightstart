/**
 * @file The queue as data: a submission as a row the queue lists, the rows
 * grouped under their headings, what a review may do to one, and a payload
 * read out as fields a person can judge.
 */

import { REVIEW_MOVES, payloadOf } from "../index.ts";

import type { QueueGroup, QueueItem, QueueKind, QueuePayloadField } from "../types.ts";

const IMAGE_KEY = /(^|[_-])(image|photo|avatar|logo|cover|thumb|picture)s?$/i;
const IMAGE_VALUE = /^(data:image\/|https?:\/\/\S+\.(png|jpe?g|webp|gif|avif)(\?\S*)?$)/i;

/**
 * A submission's title in the list: what its kind says, else the payload's
 * name or title, else what it points at, else its kind's label.
 */
export const titleOf = (record: Record<string, unknown>, kind: QueueKind | undefined): string => {
  const payload = payloadOf(record["payload"]);
  const own = kind?.title?.({ ...record, payload });
  if (own) return own;
  const named = payload["name"] ?? payload["title"];
  if (typeof named === "string" && named.trim()) return named.trim();
  const target = record["targetSlug"];
  if (typeof target === "string" && target) return target;
  return kind?.label ?? String(record["kind"] ?? "Submission");
};

/** A submission row as a queue item. */
export const submissionItem = (record: Record<string, unknown>, kinds: Map<string, QueueKind>): QueueItem => {
  const kind = String(record["kind"] ?? "");
  return {
    id: String(record["id"]),
    kind,
    status: String(record["status"] ?? "pending"),
    title: titleOf(record, kinds.get(kind)),
    created: String(record["created"] ?? ""),
    userId: String(record["userId"] ?? ""),
    record: { ...record, payload: payloadOf(record["payload"]) },
  };
};

/** The heading an item is listed under: its kind's group, or Other for a kind nothing describes. */
export const groupOf = (item: QueueItem, kinds: Map<string, QueueKind>): string => kinds.get(item.kind)?.group ?? "Other";

/**
 * The items under their headings, in the order the kinds were described and
 * Other last; newest first inside each.
 */
export const groupItems = (items: QueueItem[], kinds: Map<string, QueueKind>): QueueGroup[] => {
  const order = [...new Set([...kinds.values()].map((kind) => kind.group))];
  const byGroup = new Map<string, QueueItem[]>();
  for (const item of items) {
    const label = groupOf(item, kinds);
    byGroup.set(label, [...(byGroup.get(label) ?? []), item]);
  }
  const rank = (label: string): number => (order.includes(label) ? order.indexOf(label) : order.length);
  return [...byGroup.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([label, list]) => ({ label, items: [...list].sort((a, b) => b.created.localeCompare(a.created)) }));
};

/** Where a review may move a submission from where it is. */
export const movesOf = (status: string): readonly string[] => REVIEW_MOVES[status] ?? [];

/** A payload read out as fields: text as text, an image as an image, anything else as its JSON, and nothing empty. */
export const payloadFields = (payload: Record<string, unknown>): QueuePayloadField[] =>
  Object.entries(payload)
    .filter(([, value]) => value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && !value.length))
    .map(([key, value]) => {
      if (typeof value === "string" && (IMAGE_VALUE.test(value) || (IMAGE_KEY.test(key) && value.startsWith("/"))))
        return { key, kind: "image", value };
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
        return { key, kind: "text", value: String(value) };
      if (Array.isArray(value) && value.every((entry) => typeof entry === "string" || typeof entry === "number"))
        return { key, kind: "text", value: value.join(", ") };
      return { key, kind: "json", value: JSON.stringify(value, null, 2) };
    });

/** When something was sent, the way the queue writes it: `Sep 29, 10:41`. */
export const sentAt = (iso: string, timeZone?: string): string => {
  const ms = Date.parse(iso.includes("T") || iso.endsWith("Z") ? iso : `${iso.replace(" ", "T")}Z`);
  if (!Number.isFinite(ms)) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, ...(timeZone ? { timeZone } : {}) }).format(new Date(ms));
};
