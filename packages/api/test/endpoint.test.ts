// node-only
/**
 * @file The server app's endpoints: their access rules, the parameters,
 * query and JSON body a handler reads, the three kinds of answer, an
 * `HttpError` keeping its status, an endpoint winning over a CRUD route, and
 * two endpoints of one method and path refused.
 */

import { applySchema } from "@lightstart/light/model/sql-builder";
import type { ModelSchema } from "@lightstart/light/model/types.ts";
import { HttpError } from "@lightstart/server";
import { toFetch } from "@lightstart/server/fetch";
import { Database } from "@lightstart/sqlite/node";
import { d1Of } from "@lightstart/sqlite/d1";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";

import { defineEndpoint, serverApp, type Caller } from "../server/index.ts";

type JsonObject = Record<string, unknown>;

const models = {
  thing: {
    title: { $type: "string", required: true },
    $permissions: { read: "public", create: "public" },
  },
} as unknown as Record<string, ModelSchema>;

const json = async (response: Response): Promise<JsonObject> => (await response.json()) as JsonObject;

const caller = (request: Request): Caller => {
  const id = request.headers.get("x-light-user");
  if (id === null) return null;
  return { id, admin: request.headers.get("x-light-admin") === "1" };
};

const main = async (): Promise<void> => {
  const db = Database.open(":memory:");
  applySchema(db, models);
  const binding = d1Of(db);

  const endpoints = [
    defineEndpoint({ path: "/api/public", access: "public", handler: () => ({ ok: true }) }),
    defineEndpoint({ path: "/api/me", handler: (r) => ({ caller: r.caller }) }),
    defineEndpoint({ path: "/api/admin", access: "admin", handler: () => ({ admin: true }) }),
    defineEndpoint({
      path: "/api/echo/:id",
      method: "POST",
      access: "public",
      handler: (r) => ({ params: r.params, query: r.query, body: r.body }),
    }),
    defineEndpoint({ path: "/api/text", access: "public", handler: () => "plain words" }),
    defineEndpoint({ path: "/api/response", access: "public", handler: () => new Response("made", { status: 201 }) }),
    defineEndpoint({
      path: "/api/fail",
      access: "public",
      handler: () => {
        throw new HttpError(418, "teapot");
      },
    }),
    defineEndpoint({ path: "/api/body", method: "POST", access: "public", handler: (r) => ({ body: r.body }) }),
    defineEndpoint({ path: "/api/thing", access: "public", handler: () => ({ shadow: true }) }),
  ];
  const handle = toFetch(serverApp({ models, endpoints, db: () => binding, caller }));
  const send = (path: string, init?: RequestInit): Promise<Response> => handle(new Request(new URL(path, "http://app.test"), init));

  eqn("a public endpoint answers anyone", (await send("/api/public")).status, 200);
  eqn("an auth endpoint refuses no caller with 401", (await send("/api/me")).status, 401);
  const me = await send("/api/me", { headers: { "x-light-user": "alice" } });
  eqn("an auth endpoint lets a caller in", me.status, 200);
  eq("and the handler reads the caller", String(((await json(me))["caller"] as JsonObject)["id"]), "alice");
  eqn("an admin endpoint refuses no caller with 401", (await send("/api/admin")).status, 401);
  eqn("an admin endpoint refuses a plain caller with 403", (await send("/api/admin", { headers: { "x-light-user": "alice" } })).status, 403);
  eqn("an admin endpoint lets an admin in", (await send("/api/admin", { headers: { "x-light-user": "alice", "x-light-admin": "1" } })).status, 200);

  const echo = await send("/api/echo/42?tag=a", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ value: 3 }),
  });
  const echoed = await json(echo);
  eq("the path parameters arrive", String((echoed["params"] as JsonObject)["id"]), "42");
  eq("the query arrives as a plain record", String((echoed["query"] as JsonObject)["tag"]), "a");
  eqn("the JSON body arrives", Number((echoed["body"] as JsonObject)["value"]), 3);
  const noBody = await send("/api/body", { method: "POST", headers: { "content-type": "text/plain" }, body: "hi" });
  ok("a non-JSON body is null", (await json(noBody))["body"] === null);

  const text = await send("/api/text");
  ok("a string answers text/plain", text.headers.get("content-type")?.startsWith("text/plain") === true);
  eq("and its exact body", await text.text(), "plain words");
  const response = await send("/api/response");
  eqn("a Response keeps its status", response.status, 201);
  eq("a Response keeps its body", await response.text(), "made");
  const value = await send("/api/public");
  ok("another value answers JSON", value.headers.get("content-type")?.includes("application/json") === true);

  const failure = await send("/api/fail");
  eqn("a thrown HttpError keeps its status", failure.status, 418);
  eq("and its message", String((await json(failure))["error"]), "teapot");

  const shadow = await json(await send("/api/thing"));
  ok("the endpoint answers over the CRUD route", shadow["shadow"] === true && shadow["rows"] === undefined);
  const created = await send("/api/thing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "one" }) });
  eqn("the CRUD routes still answer beside it", created.status, 201);
  eqn("and the row is there", Number((await json(await send("/api/thing/count")))["count"]), 1);

  let message = "";
  try {
    serverApp({
      models,
      endpoints: [
        defineEndpoint({ path: "/api/dup", access: "public", handler: () => null }),
        defineEndpoint({ path: "/api/dup", access: "public", handler: () => null }),
      ],
      db: () => binding,
      caller,
    });
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  ok("two endpoints of one method and path are refused", message.includes("GET /api/dup"));

  done();
};

await main();
