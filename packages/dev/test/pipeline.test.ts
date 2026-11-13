// node-only
/**
 * @file The pipeline over a fixture project: routes first, then files (a `.js` request finding a
 * `.ts` source, TypeScript stripped and bare specifiers rewritten), the shell with its importmap,
 * asset 404s, and the reload client.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CommandContext } from "@lightstart/cli";
import { App, fail, json, pass } from "@lightstart/server";
import { bodyOf, request } from "@lightstart/server/memory";
import { importmapFromHtml, mergeImportMaps } from "../importmap.ts";
import { createPipeline } from "../pipeline.ts";
import { buildImportMap } from "../node/importmap.ts";
import { createModuleTransform } from "../node/transform.ts";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

const projectDir = resolve(join(process.cwd(), "test", "fixtures", "project"));
const log = { log() {}, warn() {}, error() {}, debug() {} };
const cli: CommandContext["cli"] = {
  runCommand: async () => 0,
  runHook: async () => ({ ran: 0, failed: 0, teardown: async () => {} }),
  listCommands: () => [],
  loadRoutes: async () => [],
};

const built = buildImportMap(projectDir);
eq("the fixture package's own export", built["fixture-app"] ?? "", "/app.js");
eq("and its subpath", built["fixture-app/types"] ?? "", "/types.ts");

const page = importmapFromHtml(readFileSync(join(projectDir, "index.html"), "utf8"));
const importmap = mergeImportMaps({ "fixture-lib": "/fixture-lib.js", "fixture-lib/": "/fixture-lib/", "@lightstart/light": "/light.js" }, page);
eq("the page's entry wins", importmap["@lightstart/light"] ?? "", "/page-light.js");

const pipeline = createPipeline({
  projectDir,
  log,
  cli,
  importmap,
  transform: createModuleTransform(importmap),
  watch: true,
  routes: [
    () => new App().get("/api/hit", () => json({ who: "first" })).get("/api/skip", () => pass()),
    () => new App().get("/api/skip", () => json({ who: "second" })),
  ],
});
const app = new App().all("/*", async (c) => (await pipeline.handle(c)) ?? fail("Not found: " + c.path, 404));

const main = async (): Promise<void> => {
  const css = await request(app, "GET", "/style.css");
  eq("a static file keeps its type", css.headers.get("content-type") ?? "", "text/css; charset=utf-8");
  eq("and its bytes", await bodyOf(css), "#app { color: red; }\n");
  eq("dev answers no-store", css.headers.get("cache-control") ?? "", "no-store");

  const ts = await request(app, "GET", "/types.ts");
  const tsBody = await bodyOf(ts);
  ok("a TypeScript module is served as JavaScript", (ts.headers.get("content-type") ?? "").startsWith("text/javascript"));
  ok("with its annotations blanked", !tsBody.includes(": number") && !tsBody.includes(": string"));
  ok("and its bare specifier rewritten", tsBody.includes('from "/fixture-lib.js"'));

  const js = await request(app, "GET", "/sub/mod.js");
  const jsBody = await bodyOf(js);
  eqn("a .js request finds the .ts source", js.status, 200);
  ok("served as JavaScript, rewritten", jsBody.includes("export const value") && jsBody.includes('from "/fixture-lib.js"'));

  const appJs = await bodyOf(await request(app, "GET", "/app.js"));
  ok("a JavaScript module's imports are rewritten too", appJs.includes('from "/fixture-lib.js"') && appJs.includes('import("/fixture-lib/lazy.js")'));
  ok("a string that is not an import is left", appJs.includes('"fixture-lib is not imported here"'));

  const shell = await request(app, "GET", "/posts/one");
  const shellBody = await bodyOf(shell);
  eqn("an unknown route is the shell", shell.status, 200);
  ok("with the merged importmap", shellBody.includes('<script type="importmap">') && shellBody.includes('"@lightstart/light":"/page-light.js"') && shellBody.includes('"page-only":"/page-only.js"'));
  ok("and the reload client", shellBody.includes("/__light/reload.js"));
  eq("the shell is never cached", shell.headers.get("cache-control") ?? "", "no-store");

  eqn("a missing asset is a 404", (await request(app, "GET", "/missing.css")).status, 404);

  const first = await request(app, "GET", "/api/hit");
  eq("the first route app answers", await bodyOf(first), '{"who":"first"}');
  eq("and its reply is no-store", first.headers.get("cache-control") ?? "", "no-store");
  const second = await request(app, "GET", "/api/skip");
  eq("a pass() lets the next route app answer", await bodyOf(second), '{"who":"second"}');

  const reload = await request(app, "GET", "/__light/reload.js");
  ok("the reload client is JavaScript", (reload.headers.get("content-type") ?? "").startsWith("text/javascript"));
  ok("and reconnects", (await bodyOf(reload)).includes("WebSocket"));

  done();
};

await main();
