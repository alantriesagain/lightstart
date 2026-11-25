// node-only
/**
 * @file The page's `api` store against the real server: the adapter's
 * requests, through `toFetch`, reach `crudApp` over SQLite and `d1Of`, so the
 * query string one side writes is the one the other reads (a plain-string
 * `order` included), the bearer token names the caller, and an owner's rows
 * stay theirs.
 */

import { Database } from "@lightstart/sqlite/node";
import { d1Of } from "@lightstart/sqlite/d1";
import { applySchema } from "@lightstart/light/model/sql-builder";
import type { ModelSchema } from "@lightstart/light/model/types.ts";
import { toFetch } from "@lightstart/server/fetch";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { defineApp } from "@lightstart/app";
import { ApiAdapterType, configureApi } from "../page/adapter.ts";
import { crudApp, type Caller } from "../server/index.ts";

const models: Record<string, ModelSchema> = {
  task: {
    title: { $type: "string", required: true },
    rank: { $type: "number" },
    done: { $type: "boolean" },
    owner: { $type: "string" },
    $permissions: { read: "owner", create: "owner", write: "owner", delete: "owner", ownerField: "owner" },
  } as unknown as ModelSchema,
};

const rejection = async (work: () => Promise<unknown>): Promise<string> => {
  try {
    await work();
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

const main = async (): Promise<void> => {
  const db = Database.open(":memory:");
  applySchema(db, models);
  const binding = d1Of(db);
  const caller = (request: Request): Caller => {
    const auth = request.headers.get("authorization");
    return auth === null ? null : { id: auth.replace(/^Bearer\s+/, "") };
  };
  const handle = toFetch(crudApp({ models, db: () => binding, caller }));
  let token: string | null = "alice";
  configureApi({ token: () => token, fetch: (input, init) => handle(new Request(new URL(String(input), "http://app.test"), init)) });
  const store = await new ApiAdapterType().open(defineApp({ name: "e2e", host: "web" }), "main", "", models, true);

  const first = await store.insert("task", { title: "write", rank: 2, done: false });
  await store.insert("task", { title: "ship", rank: 1, done: true });
  eq("the owner is stamped from the token", String(first["owner"]), "alice");
  const page = await store.query("task", { order: "rank", total: true });
  eq("a plain-string order reaches the server", page.rows.map((row) => String(row["title"])).join(","), "ship,write");
  eqn("total comes back", page.total ?? -1, 2);
  const descending = await store.query("task", { order: "-rank", where: { done: false } });
  eq("a descending order and a where together", descending.rows.map((row) => String(row["title"])).join(","), "write");
  eq("booleans come back as booleans", typeof page.rows[0]?.["done"], "boolean");
  eqn("count with a where", await store.count("task", { done: true }), 1);
  const id = String(first["id"]);
  await store.update("task", { id, title: "write more" });
  eq("an update is read back", String((await store.get("task", id))?.["title"]), "write more");

  token = "bob";
  eqn("another caller sees none of alice's rows", (await store.query("task", {})).rows.length, 0);
  ok("and cannot change one", (await rejection(() => store.update("task", { id, title: "taken" }))) !== "");
  token = null;
  ok("no token is refused with its status", (await rejection(() => store.query("task", {}))).includes("401"));

  token = "alice";
  await store.delete("task", id);
  eqn("a delete removes the row", (await store.query("task", {})).rows.length, 1);
  done();
};

await main();
