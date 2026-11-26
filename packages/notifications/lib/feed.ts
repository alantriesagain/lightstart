/**
 * @file Reading a feed, whoever wrote it. Two shapes are accepted: the bare
 * list a baked file carries, and an envelope naming `notifications`, which is
 * what an endpoint answers alongside whatever else it was asked for.
 */

import type { NotificationRecord } from "../types.ts";

const isRow = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The rows of a feed. A row with no id names nothing, so a reader could never
 * decide whether it had seen it; those are dropped rather than shown once per
 * poll forever.
 */
export const parseFeed = (raw: unknown): NotificationRecord[] => {
  const list = Array.isArray(raw) ? raw : isRow(raw) && Array.isArray(raw["notifications"]) ? raw["notifications"] : [];
  return list.filter(
    (row): row is NotificationRecord =>
      isRow(row) && typeof row["id"] === "string" && row["id"] !== "",
  );
};

/** What a reader should be shown: nothing expired, and nothing from another community when the app runs as one. */
export const filterFeed = (
  rows: NotificationRecord[],
  options: { now?: number; inCommunity?: (row: NotificationRecord) => boolean } = {},
): NotificationRecord[] => {
  const now = options.now ?? Date.now();
  return rows.filter(
    (row) =>
      (row.expiresAt === undefined || Date.parse(row.expiresAt) > now) &&
      (options.inCommunity === undefined || options.inCommunity(row)),
  );
};
