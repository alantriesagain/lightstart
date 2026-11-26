/**
 * @file The storage binding a publish writes files into, read from the
 * server's environment (`STORAGE`), narrowed to what this package uses. R2's
 * bucket satisfies it; a test passes a small memory object.
 */

import type { StorageLike } from "../types.ts";

const isStorage = (value: unknown): value is StorageLike =>
  value !== null &&
  typeof value === "object" &&
  typeof (value as StorageLike).put === "function" &&
  typeof (value as StorageLike).get === "function" &&
  typeof (value as StorageLike).head === "function" &&
  typeof (value as StorageLike).delete === "function";

/** The environment's `STORAGE` binding, or null when none is bound. */
export const storageOf = (env: Record<string, unknown>): StorageLike | null => {
  const storage = env["STORAGE"];
  return isStorage(storage) ? storage : null;
};
