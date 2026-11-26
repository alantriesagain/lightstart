/**
 * @file What deleting an account does to its submissions: the files its
 * published ones put in storage go first, then every row. A failure throws
 * before any row is gone, so the account stays in place and the next attempt
 * finds the same files to delete.
 *
 * Wire it from the project's account-deletion hook, which runs before the
 * account rows go: see the README's `forgetUser` section.
 */

import { storageOf } from "./storage.ts";

import type { D1Like } from "@lightstart/api/server";
import type { StorageLike } from "../types.ts";

/**
 * Deletes the files an account's submissions stored, then every submission
 * row of theirs. `storage` may be passed explicitly; otherwise the caller
 * passes the binding itself, and a row that names a file with no binding is
 * refused before anything is deleted.
 */
export const forgetUser = async (db: D1Like, userId: string | undefined, storage?: StorageLike): Promise<void> => {
  if (userId === undefined || userId === "") return;
  const result = await db.prepare("SELECT objectKey FROM submission WHERE userId = ? AND objectKey != ''").bind(userId).all();
  const keys = (result.results ?? []).map((row) => String(row["objectKey"] || "")).filter((key) => key !== "");
  if (keys.length > 0) {
    const bucket = storage ?? null;
    if (bucket === null) throw new Error("no storage is bound here, so the files of this account cannot be deleted");
    await bucket.delete(keys);
  }
  await db.prepare("DELETE FROM submission WHERE userId = ?").bind(userId).run();
  await db.prepare("DELETE FROM moderation_avatars WHERE id = ?").bind(userId).run();
};

/** The environment's storage binding, for a caller that wires `forgetUser` from a hook that has only the env. */
export const forgetUserWith = (db: D1Like, userId: string | undefined, env: Record<string, unknown>): Promise<void> =>
  forgetUser(db, userId, storageOf(env) ?? undefined);
