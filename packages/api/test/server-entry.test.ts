// node-only
/**
 * @file The generated `.light/server.ts`: a tiny project's server model and
 * endpoint become the entry's imports and exports, a second write changes
 * nothing, and the written entry's `createServer` answers an endpoint and a
 * CRUD route over an in-memory database.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { applySchema } from "@lightstart/light/model/sql-builder";
import type { ModelSchema } from "@lightstart/light/model/types.ts";
import type { App } from "@lightstart/server";
import { toFetch } from "@lightstart/server/fetch";
import { Database } from "@lightstart/sqlite/node";
import { d1Of, type D1Binding } from "@lightstart/sqlite/d1";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";

import type { Caller } from "../server/permissions.ts";
import { writeServerEntry } from "../node/server-entry.ts";

type JsonObject = Record<string, unknown>;

interface Entry {
  models: Record<string, ModelSchema>;
  createServer: (options: { db: D1Binding; caller: (request: Request) => Caller }) => App;
}

const json = async (response: Response): Promise<JsonObject> => (await response.json()) as JsonObject;

const main = async (): Promise<void> => {
  const project = mkdtempSync(join(import.meta.dirname, "tmp-entry-"));
  try {
    mkdirSync(join(project, "src", "models"), { recursive: true });
    mkdirSync(join(project, "src", "endpoints"), { recursive: true });
    writeFileSync(join(project, "package.json"), JSON.stringify({ name: "tiny", type: "module", dependencies: { "@lightstart/api": "workspace:*" } }));
    writeFileSync(join(project, "src", "app.js"), [
      'import { defineApp } from "@lightstart/app";',
      'export default defineApp({ name: "tiny", host: "web", stores: { server: { adapter: "api" } } });',
      "",
    ].join("\n"));
    writeFileSync(join(project, "src", "models", "todo.js"), [
      'import { defineModel } from "@lightstart/light/model";',
      "export default defineModel(\"todo\", {",
      '  title: { $type: "string", required: true },',
      '  $store: "server",',
      '  $permissions: { read: "public", create: "public" },',
      "});",
      "",
    ].join("\n"));
    writeFileSync(join(project, "src", "endpoints", "hello.js"), [
      'import { defineEndpoint } from "@lightstart/api/server";',
      'export default defineEndpoint({ path: "/api/hello", access: "public", handler: () => ({ hello: true }) });',
      "",
    ].join("\n"));

    const first = await writeServerEntry(project);
    ok("the first write changes the entry", first);
    const entryPath = join(project, ".light", "server.ts");
    const source = readFileSync(entryPath, "utf8");
    ok("it imports the model", source.includes('from "../src/models/todo.js"'));
    ok("it imports the endpoint", source.includes('from "../src/endpoints/hello.js"'));
    ok("it exports the models", source.includes("export const models"));
    ok("it exports the endpoints", source.includes("export const endpoints"));
    ok("it exports createServer", source.includes("export const createServer"));
    ok("it names the model", source.includes('"todo"'));

    const second = await writeServerEntry(project);
    ok("a second write changes nothing", !second);
    eq("and leaves the same file", readFileSync(entryPath, "utf8"), source);

    const entry = (await import(`${pathToFileURL(entryPath).href}?mtime=${String(Date.now())}`)) as Entry;
    const db = Database.open(":memory:");
    applySchema(db, entry.models);
    const handle = toFetch(entry.createServer({ db: d1Of(db), caller: () => null }));
    const send = (path: string, init?: RequestInit): Promise<Response> => handle(new Request(new URL(path, "http://app.test"), init));

    const hello = await send("/api/hello");
    eqn("the endpoint answers", hello.status, 200);
    ok("with its value", (await json(hello))["hello"] === true);

    const created = await send("/api/todo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "one" }) });
    eqn("the CRUD route creates", created.status, 201);
    const listed = await json(await send("/api/todo"));
    eqn("and lists the row", (listed["rows"] as JsonObject[]).length, 1);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }

  done();
};

await main();
