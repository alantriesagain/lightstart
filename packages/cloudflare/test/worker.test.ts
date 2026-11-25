// node-only
/**
 * @file The app's server as a Pages Worker: a tiny project's endpoint and CRUD
 * model answer through the esbuild bundle's `fetch`, other paths go to
 * `env.ASSETS`, the bundle carries no `node:` import, staging adds `_worker.js`
 * and `_routes.json` without touching the build, and a project without
 * `@lightstart/api` plans no server.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { applySchema } from "@lightstart/light/model/sql-builder";
import type { ModelSchema } from "@lightstart/light/model/types.ts";
import { Database } from "@lightstart/sqlite/node";
import { d1Of } from "@lightstart/sqlite/d1";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { planDeploy, wranglerSteps } from "../node/deploy.ts";
import { bundleWorker, hasServer, stageDeploy } from "../node/worker.ts";

type JsonObject = Record<string, unknown>;

interface WorkerModule {
  default: { fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> };
}

const json = async (response: Response): Promise<JsonObject> => (await response.json()) as JsonObject;

const packagesDir = join(import.meta.dirname, "..", "..");

const project = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "light-cloudflare-worker-"));
  mkdirSync(join(dir, "src", "models"), { recursive: true });
  mkdirSync(join(dir, "src", "endpoints"), { recursive: true });
  mkdirSync(join(dir, "node_modules", "@lightstart"), { recursive: true });
  for (const name of readdirSync(packagesDir)) {
    const source = join(packagesDir, name);
    if (!statSync(source).isDirectory()) continue;
    symlinkSync(source, join(dir, "node_modules", "@lightstart", name), "dir");
  }
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "server-app", type: "module", dependencies: { "@lightstart/api": "workspace:*" } }));
  writeFileSync(join(dir, "src", "app.js"), [
    'import { defineApp } from "@lightstart/app";',
    'export default defineApp({ name: "server-app", host: "web", stores: { server: { adapter: "api" } } });',
    "",
  ].join("\n"));
  writeFileSync(join(dir, "src", "models", "todo.js"), [
    'import { defineModel } from "@lightstart/light/model";',
    'export default defineModel("todo", {',
    '  title: { $type: "string", required: true },',
    '  $store: "server",',
    '  $permissions: { read: "public", create: "public" },',
    "});",
    "",
  ].join("\n"));
  writeFileSync(join(dir, "src", "endpoints", "hello.js"), [
    'import { defineEndpoint } from "@lightstart/api/server";',
    'export default defineEndpoint({ path: "/api/hello", access: "public", handler: () => ({ hello: true }) });',
    "",
  ].join("\n"));
  mkdirSync(join(dir, ".deployed", "builds", "test-build"), { recursive: true });
  writeFileSync(join(dir, ".deployed", "builds", "test-build", "index.html"), "<!doctype html>");
  return dir;
};

const plain = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "light-cloudflare-plain-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "plain", type: "module" }));
  mkdirSync(join(dir, ".deployed", "builds", "b1"), { recursive: true });
  writeFileSync(join(dir, ".deployed", "builds", "b1", "index.html"), "<!doctype html>");
  return dir;
};

const main = async (): Promise<void> => {
  const dir = project();
  const staticDir = plain();
  try {
    ok("a project declaring @lightstart/api has a server", hasServer(dir));
    ok("a project without it has none", !hasServer(staticDir));

    const workerFile = join(dir, ".deployed", "worker.mjs");
    await bundleWorker(dir, workerFile);
    const source = readFileSync(workerFile, "utf8");
    ok("the bundle has no node: import", !/from\s*["']node:|import\s*\(\s*["']node:|require\(\s*["']node:/.test(source));

    const entry = (await import(`${pathToFileURL(join(dir, ".light", "server.ts")).href}?mtime=${String(Date.now())}`)) as { models: Record<string, ModelSchema> };
    const db = Database.open(":memory:");
    applySchema(db, entry.models);

    let assets = 0;
    const env = {
      DB: d1Of(db),
      ASSETS: {
        fetch: async (): Promise<Response> => {
          assets += 1;
          return new Response("asset", { status: 200 });
        },
      },
    };
    const worker = (await import(`${pathToFileURL(workerFile).href}?mtime=${String(Date.now())}`)) as WorkerModule;
    const send = (path: string, init?: RequestInit): Promise<Response> => worker.default.fetch(new Request(new URL(path, "http://app.test"), init), env, { waitUntil() {} });

    const hello = await send("/api/hello");
    eqn("the endpoint answers", hello.status, 200);
    ok("with its value", (await json(hello))["hello"] === true);

    const created = await send("/api/todo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "one" }) });
    eqn("the CRUD route creates", created.status, 201);
    const listed = await json(await send("/api/todo"));
    eqn("and lists the row", (listed["rows"] as JsonObject[]).length, 1);
    eqn("nothing outside /api reached the assets", assets, 0);

    const asset = await send("/index.html");
    eqn("a page is answered by env.ASSETS", asset.status, 200);
    eq("with its body", await asset.text(), "asset");
    eqn("and env.ASSETS was called once", assets, 1);

    const buildDir = join(dir, ".deployed", "builds", "test-build");
    const before = readFileSync(join(buildDir, "index.html"), "utf8");
    const staged = await stageDeploy(buildDir, dir);
    ok("staging puts the Worker beside the build copy", staged.endsWith(join(".deployed", "staged", "test-build")));
    ok("the staged folder has _worker.js", existsSync(join(staged, "_worker.js")));
    eq("_routes.json limits the Worker to /api/*", readFileSync(join(staged, "_routes.json"), "utf8"), JSON.stringify({ version: 1, include: ["/api/*"], exclude: [] }));
    ok("the original build gained no Worker", !existsSync(join(buildDir, "_worker.js")));
    eq("and its page is unchanged", readFileSync(join(buildDir, "index.html"), "utf8"), before);

    const planned = await planDeploy(staticDir, { build: "b1", environment: { CF_ACCOUNT_ID: "a", CF_API_TOKEN: "t" } });
    ok("a project without @lightstart/api plans no server", !planned.server);
    eq("and uploads the build itself", (wranglerSteps(planned)[1] ?? [])[2], planned.buildDir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(staticDir, { recursive: true, force: true });
  }

  done();
};

await main();
