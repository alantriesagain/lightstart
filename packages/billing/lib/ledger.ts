/**
 * @file The arithmetic of the entitlement ledger, pure and shared by the
 * server's calls and the page's checks. Every date is SQLite's `datetime()`
 * form, `YYYY-MM-DD HH:MM:SS` in UTC, the form every row is written in.
 */

import type { BillingPlan, EntitlementRow } from "../types.ts";

const DAY_MS = 86_400_000;

/** A moment as SQLite writes it. */
export const sqlDate = (ms: number): string => new Date(ms).toISOString().slice(0, 19).replace("T", " ");

/** A stored date as milliseconds, read as UTC whichever form it came in: SQLite's or an ISO string. */
export const msOf = (text: unknown): number => {
  const value = String(text ?? "").trim();
  if (value === "") return Number.NaN;
  return Date.parse(/[zZ]$|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(" ", "T")}Z`);
};

/** The period a payment buys: `days` from the later of now and the end of what is already paid. */
export const nextPeriod = (latest: unknown, now: number, days: number): { startsAt: string; expiresAt: string } => {
  const end = msOf(latest);
  const start = Number.isFinite(end) && end > now ? end : now;
  return { startsAt: sqlDate(start), expiresAt: sqlDate(start + days * DAY_MS) };
};

/** The keys the held keys come to, with what each plan `implies` added. */
export const withImplied = (keys: Iterable<string>, plans: Record<string, BillingPlan> = {}): string[] => {
  const out = new Set<string>();
  for (const key of keys) {
    out.add(key);
    for (const more of plans[key]?.implies ?? []) out.add(more);
  }
  return [...out];
};

/**
 * What a person holds, each key with the moment it runs out: the furthest end
 * of their active periods for that key, as long as one of them is on now. A
 * key a held plan implies runs out with it.
 */
export const heldUntil = (
  rows: Array<Pick<EntitlementRow, "key" | "status" | "startsAt" | "expiresAt">>,
  now: number,
  plans: Record<string, BillingPlan> = {},
): Record<string, string> => {
  const byKey = new Map<string, { on: boolean; until: number }>();
  for (const row of rows) {
    if (row.status !== "active") continue;
    const start = msOf(row.startsAt);
    const end = msOf(row.expiresAt);
    if (!Number.isFinite(end) || end <= now) continue;
    const seen = byKey.get(row.key) ?? { on: false, until: 0 };
    byKey.set(row.key, { on: seen.on || start <= now, until: Math.max(seen.until, end) });
  }
  const held: Record<string, number> = {};
  for (const [key, { on, until }] of byKey) {
    if (!on) continue;
    for (const got of withImplied([key], plans)) held[got] = Math.max(held[got] ?? 0, until);
  }
  return Object.fromEntries(Object.entries(held).map(([key, until]) => [key, sqlDate(until)]));
};
