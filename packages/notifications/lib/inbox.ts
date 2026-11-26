/**
 * @file What is new, and what the inbox shows.
 *
 * An id this device has never been shown is a thing that happened since it last
 * looked. That set is the whole comparison.
 */

import type { NotificationRecord } from "../types.ts";

/** Ids remembered per device. Enough to outlive any burst, small enough to store. */
export const SEEN_KEPT = 400;

/** How many found lines are held once their source stops answering them. */
export const NEWS_KEPT = 40;

/** How long one of those is held: two days, after which it is not news. */
export const NEWS_LIFE_MS = 48 * 3600e3;

/** The state a retaining source's seen ids and held lines live in. */
export interface SeenState {
  seenIds: string[];
  news: NotificationRecord[];
}

/** What `takeNew` answers: the next state, what this answer added, and whether anything changed. */
export interface TakenNew extends SeenState {
  fresh: NotificationRecord[];
  changed: boolean;
}

/**
 * The lines a retaining source has produced that this device has not been
 * shown, merged with the ones it found earlier and is still holding.
 *
 * What it finds is kept rather than re-derived, because such a source only
 * carries what is still live: the row would otherwise vanish out of the inbox
 * under somebody still reading it.
 *
 * `fresh` is what this answer added: the rows this device had never been shown
 * until now, which is what a heads-up about something arriving is drawn from.
 */
export const takeNew = ({ seenIds, news }: SeenState, rows: NotificationRecord[], now = Date.now()): TakenNew => {
  const seen = new Set(seenIds);
  const fresh = rows.filter((row) => row.id && !seen.has(row.id));
  const cutoff = now - NEWS_LIFE_MS;

  const byId = new Map<string, NotificationRecord>();
  for (const row of [...fresh, ...news])
    if (!byId.has(row.id) && Date.parse(row.createdAt) > cutoff) byId.set(row.id, row);
  const kept = [...byId.values()].slice(0, NEWS_KEPT);

  return {
    seenIds: fresh.length ? [...seenIds, ...fresh.map((row) => row.id)].slice(-SEEN_KEPT) : seenIds,
    news: kept,
    fresh,
    changed: fresh.length > 0 || kept.length !== news.length,
  };
};

/**
 * One list out of several, newest first, each line marked with whether this
 * device has read it. Two sources naming the same id are one line: the first
 * wins, so a source registered earlier owns its wording.
 */
export const mergeInbox = (groups: NotificationRecord[][], readIds: string[]): NotificationRecord[] => {
  const read = new Set(readIds);
  const byId = new Map<string, NotificationRecord>();
  for (const row of groups.flat())
    if (row?.id && !byId.has(row.id)) byId.set(row.id, { ...row, read: read.has(row.id) });
  return [...byId.values()].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
};

/** How many lines this device has not read. */
export const unreadCount = (inbox: NotificationRecord[]): number => inbox.filter((row) => !row.read).length;
