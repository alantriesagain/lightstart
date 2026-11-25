// node-only
/**
 * @file The CRUD server over a local SQLite file: a public model projected to
 * its public fields, auth refused anonymously and allowed for a caller, an
 * owner model scoped and stamped per caller, an admin unscoped, unknown
 * columns refused, the limit capped, JSON and boolean fields round-tripping,
 * counts, updates and deletes.
 */
import { Database } from "@lightstart/sqlite/node";
import { d1Of } from "@lightstart/sqlite/d1";
import { applySchema } from "@lightstart/light/model/sql-builder";
import { bodyOf, request } from "@lightstart/server/memory";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { crudApp } from "../server/index.ts";
import { check, permissionFor, publicFields, readPermissions, type Caller } from "../server/index.ts";
import type { ModelSchema } from "@lightstart/light/model/types.ts";

type JsonObject = Record<string, unknown>;

const schema = (value: Record<string, unknown>): ModelSchema => value as unknown as ModelSchema;

const models: Record<string, ModelSchema> = {
  article: schema({
    title: { $type: "string", required: true },
    secret: { $type: "string" },
    done: { $type: "boolean" },
    tags: { $type: "array" },
    meta: { $type: "object" },
    $permissions: { read: "public", create: "auth", public: ["id", "title"] },
  }),
  note: schema({
    title: { $type: "string", required: true },
    $permissions: { read: "auth", create: "auth" },
  }),
  task: schema({
    title: { $type: "string", required: true },
    owner: { $type: "string" },
    $permissions: { read: "owner", create: "owner", write: "owner", delete: "owner", ownerField: "owner" },
  }),
};

const body = async (response: Answer): Promise<JsonObject> => (await response.json()) as JsonObject;
const rowsIn = (value: JsonObject): JsonObject[] => value["rows"] as JsonObject[];

interface Answer {
  status: number;
  json(): Promise<unknown>;
}

const main = async (): Promise<void> => {
  const db = Database.open(":memory:");
  applySchema(db, models);
  const binding = d1Of(db);
  const caller = (request: Request): Caller => {
    const id = request.headers.get("x-user");
    if (id === null) return null;
    return { id, admin: request.headers.get("x-admin") === "1" };
  };
  const handler = crudApp({ models, db: () => binding, caller, prefix: "/api", maxLimit: 2 });

  const call = async (method: string, path: string, options: { user?: string; admin?: boolean; body?: unknown } = {}): Promise<Answer> => {
    const headers: Record<string, string> = {};
    if (options.user !== undefined) headers["x-user"] = options.user;
    if (options.admin === true) headers["x-admin"] = "1";
    let text: string | undefined;
    if (options.body !== undefined) {
      headers["content-type"] = "application/json";
      text = JSON.stringify(options.body);
    }
    const reply = await request(handler, method, path, { headers, body: text });
    return { status: reply.status, json: async (): Promise<unknown> => JSON.parse(await bodyOf(reply)) as unknown };
  };

  const created = await call("POST", "/api/article", { user: "alice", body: { title: "hello", secret: "s", done: true, tags: ["a", "b"], meta: { n: 1 } } });
  eqn("create answers 201", created.status, 201);
  const createdRow = await body(created);
  ok("create generates an id", typeof createdRow["id"] === "string");

  const anon = await call("GET", "/api/article");
  eqn("public list reads anonymously", anon.status, 200);
  const anonRows = rowsIn(await body(anon));
  eqn("public list has the row", anonRows.length, 1);
  eq("public read is projected", JSON.stringify(Object.keys(anonRows[0] ?? {})), JSON.stringify(["id", "title"]));
  eq("public read keeps its title", String(anonRows[0]?.["title"]), "hello");

  const full = await call("GET", "/api/article", { user: "alice" });
  const fullRow = rowsIn(await body(full))[0] ?? {};
  eq("boolean field decodes", String(fullRow["done"]), "true");
  eq("array field decodes", JSON.stringify(fullRow["tags"]), JSON.stringify(["a", "b"]));
  eq("object field decodes", JSON.stringify(fullRow["meta"]), JSON.stringify({ n: 1 }));

  const countArticle = await call("GET", "/api/article/count");
  eqn("count answers the match", Number((await body(countArticle))["count"]), 1);

  const anonymousNote = await call("GET", "/api/note");
  eqn("auth model refuses anonymous", anonymousNote.status, 401);
  const allowedNote = await call("GET", "/api/note", { user: "alice" });
  eqn("auth model allows a caller", allowedNote.status, 200);

  for (let index = 0; index < 4; index++) await call("POST", "/api/note", { user: "alice", body: { title: "n" + String(index) } });
  const capped = await call("GET", "/api/note?limit=4", { user: "alice" });
  eqn("limit is capped", rowsIn(await body(capped)).length, 2);
  const adminNotes = await call("GET", "/api/note?limit=4", { user: "root", admin: true });
  eqn("admin is not capped", rowsIn(await body(adminNotes)).length, 4);
  const withTotal = await body(await call("GET", "/api/note?limit=2&total=1", { user: "alice" }));
  eqn("total counts the whole match", Number(withTotal["total"]), 4);

  const badWhere = await call("GET", "/api/note?where=" + encodeURIComponent('{"nope":1}'), { user: "alice" });
  eqn("unknown where column is refused", badWhere.status, 400);
  ok("unknown where column is named", String((await body(badWhere))["error"]).includes("nope"));
  const badBody = await call("POST", "/api/note", { user: "alice", body: { nope: 1 } });
  eqn("unknown body column is refused", badBody.status, 400);
  ok("unknown body column is named", String((await body(badBody))["error"]).includes("nope"));
  const badOrder = await call("GET", "/api/note?order=" + encodeURIComponent("-nope"), { user: "alice" });
  eqn("unknown order column is refused", badOrder.status, 400);

  const aliceTask = await body(await call("POST", "/api/task", { user: "alice", body: { title: "a" } }));
  eq("owner is stamped on create", String(aliceTask["owner"]), "alice");
  const bobTask = await body(await call("POST", "/api/task", { user: "bob", body: { title: "b" } }));

  const aliceList = rowsIn(await body(await call("GET", "/api/task", { user: "alice" })));
  eqn("owner list is scoped", aliceList.length, 1);
  eq("owner list holds only the caller's row", String(aliceList[0]?.["id"]), String(aliceTask["id"]));

  const peek = await call("GET", "/api/task/" + String(bobTask["id"]), { user: "alice" });
  eqn("another owner's row is 404", peek.status, 404);
  const hijack = await call("PATCH", "/api/task/" + String(bobTask["id"]), { user: "alice", body: { title: "hijack" } });
  eqn("another owner's write is 404", hijack.status, 404);
  const steal = await call("DELETE", "/api/task/" + String(bobTask["id"]), { user: "alice" });
  eqn("another owner's delete is 404", steal.status, 404);

  const adminTasks = rowsIn(await body(await call("GET", "/api/task", { user: "root", admin: true })));
  eqn("admin reads unscoped", adminTasks.length, 2);

  const own = await call("PATCH", "/api/task/" + String(aliceTask["id"]), { user: "alice", body: { title: "renamed" } });
  eqn("owner updates their row", own.status, 200);
  eq("owner update lands", String((await body(own))["title"]), "renamed");

  const removed = await body(await call("DELETE", "/api/task/" + String(aliceTask["id"]), { user: "alice" }));
  eq("delete answers the flag", String(removed["deleted"]), "true");
  const gone = await call("GET", "/api/task/" + String(aliceTask["id"]), { user: "alice" });
  eqn("the deleted row is gone", gone.status, 404);

  const missing = await call("GET", "/api/missing");
  eqn("unknown model is 404", missing.status, 404);

  eq("public read projects the listed fields", JSON.stringify(check({ read: "public", public: ["id"] }, "read", null).fields), JSON.stringify(["id"]));
  ok("a missing block means auth", !check(undefined, "read", null).allowed);
  ok("an admin passes none", check({ read: "none" }, "read", { id: "root", admin: true }).allowed);
  eq("an owner create stamps the caller", JSON.stringify(check({ create: "owner", ownerField: "owner" }, "create", { id: "alice" }).stamp), JSON.stringify({ owner: "alice" }));
  eq("an owner read is scoped", JSON.stringify(check({ read: "owner", ownerField: "owner" }, "read", { id: "alice" }).scope), JSON.stringify({ owner: "alice" }));
  eq("a missing key means auth", permissionFor(undefined, "write"), "auth");
  eq("public fields default to none", JSON.stringify(publicFields(undefined)), JSON.stringify([]));
  eq("readPermissions finds the block", JSON.stringify(readPermissions(models["task"])), JSON.stringify(models["task"]?.["$permissions"]));

  db.close();
  done();
};

await main();
