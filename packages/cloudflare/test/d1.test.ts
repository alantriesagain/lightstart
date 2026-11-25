// node-only
/**
 * @file D1 over a fake Cloudflare API: a database is created only when it is
 * missing, the bind PATCH carries production and preview, the remote schema is
 * read from PRAGMA and sqlite_master rows, a migration sends exactly the
 * planned statements (none when current, none on a dry run), and an API error
 * becomes a thrown Error with Cloudflare's message and not the token.
 */

import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import type { ModelSchema } from "@lightstart/light/model/types.ts";
import { planMigration } from "@lightstart/api/node/migrate.ts";
import { cloudflareApi } from "../node/cloudflare-api.ts";
import type { FetchLike } from "../node/cloudflare-api.ts";
import { bindDatabase, databaseOf, ensureDatabase, migrateRemote, remoteSchema } from "../node/d1.ts";

type Request = { method: string; path: string; body: unknown };
type Answer = { status?: number; payload: unknown };

const fakeFetch = (answer: (request: Request) => Answer): { fetch: FetchLike; calls: Request[] } => {
  const calls: Request[] = [];
  const fetch: FetchLike = async (url, init) => {
    const method = init?.method ?? "GET";
    const body: unknown = init?.body === undefined ? undefined : (JSON.parse(init.body) as unknown);
    const parsed = new URL(url);
    const request: Request = { method, path: `${parsed.pathname}${parsed.search}`, body };
    calls.push(request);
    const { status, payload } = answer(request);
    const code = status ?? 200;
    return { ok: code >= 200 && code < 300, status: code, json: async () => payload };
  };
  return { fetch, calls };
};

const sqlOf = (call: Request): string => {
  const body = call.body;
  if (typeof body !== "object" || body === null || Array.isArray(body)) return "";
  const sql = (body as Record<string, unknown>)["sql"];
  return typeof sql === "string" ? sql : "";
};

const writes = (calls: Request[]): string[] =>
  calls.map(sqlOf).filter((sql) => /^(CREATE|ALTER)\b/i.test(sql));

const models = {
  todo: {
    title: { $type: "string", required: true, index: true },
    done: { $type: "boolean", defaultValue: false },
  },
} as unknown as Record<string, ModelSchema>;

const success = (result: unknown): Answer => ({ payload: { success: true, result } });
const query = (results: unknown[]): Answer => success([{ results }]);

const main = async (): Promise<void> => {
  const token = "super-secret-token";
  const accountId = "acc";

  const missing = fakeFetch((request) =>
    request.method === "GET" ? success([]) : success({ uuid: "u-created", name: "tasks" }),
  );
  const created = cloudflareApi({ accountId, apiToken: token, fetch: missing.fetch });
  eq("a missing database is created and its uuid answered", await ensureDatabase(created, "tasks"), "u-created");
  eq("the create is a GET then a POST", missing.calls.map((call) => call.method).join(" "), "GET POST");
  ok("the list asks by name", (missing.calls[0]?.path ?? "").includes("/accounts/acc/d1/database?name=tasks"));
  eq("the create sends only the name", JSON.stringify(missing.calls[1]?.body), '{"name":"tasks"}');

  const found = fakeFetch(() => success([{ uuid: "u-existing", name: "tasks" }]));
  const existing = cloudflareApi({ accountId, apiToken: token, fetch: found.fetch });
  eq("an existing database is not created again", await ensureDatabase(existing, "tasks"), "u-existing");
  eq("only the lookup ran", found.calls.map((call) => call.method).join(" "), "GET");
  eq("databaseOf answers null when no row matches", String(await databaseOf(existing, "other")), "null");

  const bound = fakeFetch(() => success({}));
  const binder = cloudflareApi({ accountId, apiToken: token, fetch: bound.fetch });
  await bindDatabase(binder, "site", "u-1");
  eq("binding is a PATCH on the Pages project", bound.calls[0]?.method, "PATCH");
  ok("the PATCH names the project", (bound.calls[0]?.path ?? "").includes("/accounts/acc/pages/projects/site"));
  eq(
    "the PATCH binds DB in production and preview",
    JSON.stringify(bound.calls[0]?.body),
    JSON.stringify({
      deployment_configs: {
        production: { d1_databases: { DB: { id: "u-1" } } },
        preview: { d1_databases: { DB: { id: "u-1" } } },
      },
    }),
  );

  const schema = fakeFetch((request) => {
    const sql = sqlOf(request);
    if (sql.includes("type = 'table'")) return query([{ name: "todo" }, { name: "notes" }]);
    if (sql.includes("PRAGMA table_info")) {
      const table = /table_info\("([^"]+)"\)/.exec(sql)?.[1];
      return query(table === "todo" ? [{ name: "id" }, { name: "title" }] : [{ name: "id" }, { name: "body" }]);
    }
    if (sql.includes("type = 'index'")) return query([{ name: "idx_todo_title" }]);
    return query([]);
  });
  const reader = cloudflareApi({ accountId, apiToken: token, fetch: schema.fetch });
  const read = await remoteSchema(reader, "u-1");
  eq("remoteSchema reads each table's columns", JSON.stringify(read.columns), '{"todo":["id","title"],"notes":["id","body"]}');
  eq("remoteSchema reads the index names", JSON.stringify(read.indexes), '["idx_todo_title"]');

  const planned = fakeFetch((request) => {
    const sql = sqlOf(request);
    if (sql.includes("type = 'table'")) return query([]);
    if (sql.includes("type = 'index'")) return query([]);
    return query([]);
  });
  const planner = cloudflareApi({ accountId, apiToken: token, fetch: planned.fetch });
  const expected = planMigration({}, models);
  const sent = await migrateRemote(planner, "u-1", models);
  eq("a fresh database migrates with the planned statements", JSON.stringify(sent), JSON.stringify(expected));
  eq("exactly those statements are sent", JSON.stringify(writes(planned.calls)), JSON.stringify(expected));

  const current = fakeFetch((request) => {
    const sql = sqlOf(request);
    if (sql.includes("type = 'table'")) return query([{ name: "todo" }]);
    if (sql.includes("PRAGMA table_info")) return query([{ name: "id" }, { name: "title" }, { name: "done" }, { name: "created" }, { name: "updated" }]);
    if (sql.includes("type = 'index'")) return query([{ name: "idx_todo_title" }]);
    return query([]);
  });
  const upToDateApi = cloudflareApi({ accountId, apiToken: token, fetch: current.fetch });
  const none = await migrateRemote(upToDateApi, "u-1", models);
  eqn("an up-to-date database plans nothing", none.length, 0);
  eqn("an up-to-date database sends no statement", writes(current.calls).length, 0);

  const dry = fakeFetch((request) => {
    const sql = sqlOf(request);
    if (sql.includes("type = 'table'")) return query([]);
    if (sql.includes("type = 'index'")) return query([]);
    return query([]);
  });
  const dryApi = cloudflareApi({ accountId, apiToken: token, fetch: dry.fetch });
  const dryStatements = await migrateRemote(dryApi, "u-1", models, { dryRun: true });
  eq("a dry run answers the plan", JSON.stringify(dryStatements), JSON.stringify(expected));
  eqn("a dry run sends no statement", writes(dry.calls).length, 0);

  const failed = fakeFetch(() => ({ status: 403, payload: { success: false, errors: [{ code: 1000, message: "not allowed here" }] } }));
  const failing = cloudflareApi({ accountId, apiToken: token, fetch: failed.fetch });
  let said = "";
  try {
    await ensureDatabase(failing, "tasks");
  } catch (error) {
    said = error instanceof Error ? error.message : String(error);
  }
  ok("an API error carries Cloudflare's message", said.includes("not allowed here"));
  ok("an API error never carries the token", !said.includes(token));

  done();
};

await main();
