// node-only
/**
 * @file `forgetUser`: an account's submission files go first, then its
 * submission rows and published photo.
 */

import { applySchema } from "@lightstart/light/model/sql-builder";
import { Database } from "@lightstart/sqlite/node";
import { d1Of } from "@lightstart/sqlite/d1";
import { done, eq, ok } from "@lightstart/test/assert.ts";
import { moderationModels } from "../server/models.ts";
import { forgetUser } from "../server/forget.ts";

import type { D1Like } from "@lightstart/api/server";
import type { StorageLike } from "../types.ts";

type Row = Record<string, unknown>;

const memoryStorage = () => {
  const files = new Map<string, Uint8Array>();
  const storage: StorageLike = {
    async put(key, value) {
      files.set(key, value);
    },
    async get(key) {
      const value = files.get(key);
      return value === undefined ? null : { body: value, etag: key, httpEtag: `"${key}"`, size: value.length, uploaded: new Date(0) };
    },
    async head(key) {
      const value = files.get(key);
      return value === undefined ? null : { etag: key, httpEtag: `"${key}"`, size: value.length, uploaded: new Date(0) };
    },
    async delete(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) files.delete(key);
    },
  };
  return { storage, files };
};

const main = async (): Promise<void> => {
  const database = Database.open(":memory:");
  applySchema(database, moderationModels);
  const db: D1Like = d1Of(database);
  const { storage, files } = memoryStorage();

  const rows: Array<[string, string, string, string]> = [
    ["a1", "gone", "published", "avatars/a1aaaaaaaaaaaaaaaaaa.webp"],
    ["a2", "gone", "pending", ""],
    ["a3", "gone", "published", ""],
    ["b1", "stays", "published", "avatars/b1bbbbbbbbbbbbbbbbbb.webp"],
  ];
  for (const [id, userId, status, objectKey] of rows) {
    await db.prepare("INSERT INTO submission (id, kind, userId, status, objectKey) VALUES (?, 'avatar', ?, ?, ?)").bind(id, userId, status, objectKey).run();
    if (objectKey !== "") await storage.put(objectKey, new Uint8Array([1]));
  }
  await db.prepare("INSERT INTO moderation_avatars (id, url, objectKey) VALUES (?, ?, ?)").bind("gone", "/x", "avatars/a1aaaaaaaaaaaaaaaaaa.webp").run();
  await db.prepare("INSERT INTO moderation_avatars (id, url, objectKey) VALUES (?, ?, ?)").bind("stays", "/y", "avatars/b1bbbbbbbbbbbbbbbbbb.webp").run();

  const ids = async (): Promise<string[]> => ((await db.prepare("SELECT id FROM submission ORDER BY id").all()).results ?? []).map((row: Row) => String(row["id"]));

  await forgetUser(db, "gone", storage);
  eq("the account's files go", [...files.keys()].sort().join(","), "avatars/b1bbbbbbbbbbbbbbbbbb.webp");
  eq("then its submission rows", (await ids()).join(","), "b1");
  eq("and its published photo", ((await db.prepare("SELECT id FROM moderation_avatars ORDER BY id").all()).results ?? []).map((row: Row) => String(row["id"])).join(","), "stays");

  await db.prepare("INSERT INTO submission (id, kind, userId, status, objectKey) VALUES ('c1', 'avatar', 'gone', 'published', 'avatars/c1cccccccccccccccccc.webp')").run();
  let refused = false;
  try {
    await forgetUser(db, "gone", undefined);
  } catch (error) {
    refused = String(error).includes("no storage");
  }
  ok("a file and no binding throws before a row is gone", refused && (await ids()).includes("c1"));

  await forgetUser(db, "gone", storage);
  ok("the retry finds the same file and finishes", !(await ids()).includes("c1"));

  await db.prepare("DELETE FROM submission WHERE userId = 'gone'").run();
  await forgetUser(db, "gone", undefined);
  eq("an account that stored nothing needs no bucket", (await ids()).join(","), "b1");
  await forgetUser(db, undefined, storage);
  eq("and no account does nothing", (await ids()).join(","), "b1");

  done();
};

await main();
