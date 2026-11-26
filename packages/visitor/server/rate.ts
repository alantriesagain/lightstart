/**
 * @file The per-address block a write policy puts before its row: how many rows
 * one hashed address wrote in the last window, against a cap.
 *
 * The counts live in the database, never in an isolate's memory, because a
 * Worker's isolates share nothing on Cloudflare. The package contributes a
 * `visits` table for a policy that has no row of its own to count; counting
 * that table records the visit, while counting a table of the policy's own
 * rows only reads it.
 */

import type { D1Like } from "@lightstart/api/server";
import { hashIp } from "./hash.ts";

/** The variables an install salts addresses with; the signing secret is the fallback. */
export interface RateEnv {
  RATE_SALT?: unknown;
  JWT_SECRET?: unknown;
}

/** What `perAddress` is asked: the address, the cap, the window and the table column. */
export interface PerAddressOptions {
  env: RateEnv;
  ip: string | null;
  max: number;
  /** The window in seconds; 60 by default. */
  seconds?: number;
  /** The column holding the address digest; `ipHash` by default. */
  column?: string;
  /** Write a visit row when the cap is not reached; on for the contributed `visits` table, off for a table of the policy's own rows. */
  record?: boolean;
}

/** What `perAddress` answers: the digest a row carries, and whether the cap is reached. */
export interface PerAddressVerdict {
  ipHash: string;
  limited: boolean;
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * The salt an install hashes addresses with: its own, else the signing secret.
 *
 * @param env the server's environment
 * @returns the salt, or an empty string when neither is set
 */
export const rateSalt = (env: RateEnv): string => String(env.RATE_SALT || env.JWT_SECRET || "");

/**
 * Counts what `ip` wrote to `table` in the last `seconds` and says whether
 * `max` is reached; the digest it counted by is answered for the row to carry.
 *
 * Table and column are identifiers, not values, so they are checked before
 * being put in the statement.
 *
 * @param db the D1-shaped database
 * @param table the table holding the counted rows
 * @param options the address, the cap, the window, the column and whether to record
 * @returns the digest and whether the address is at its cap
 */
export const perAddress = async (db: D1Like, table: string, options: PerAddressOptions): Promise<PerAddressVerdict> => {
  const column = options.column ?? "ipHash";
  if (!IDENTIFIER.test(table) || !IDENTIFIER.test(column)) throw new Error(`perAddress: "${table}" and "${column}" must be identifiers`);
  const seconds = options.seconds ?? 60;
  const record = options.record ?? table === "visits";
  const ipHash = await hashIp(rateSalt(options.env), options.ip);
  const row = await db.prepare(`SELECT count(*) AS n FROM ${table} WHERE ${column} = ? AND created > datetime('now', ?)`).bind(ipHash, `-${seconds} seconds`).first();
  const limited = Number(row?.["n"] || 0) >= options.max;
  if (record && !limited) await db.prepare(`INSERT INTO ${table} (id, ${column}) VALUES (?, ?)`).bind(crypto.randomUUID(), ipHash).run();
  return { ipHash, limited };
};
