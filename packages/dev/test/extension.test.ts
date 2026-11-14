// node-only
/**
 * @file The serve extension api over the pipeline: the root app, handled apps, extra file roots,
 * a mutable importmap, the page renderer and page file, base paths, watched folders, preview
 * ports and the payload serve hooks receive.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { CommandContext } from "@lightstart/cli";
import { App, fail, pass, text } from "@lightstart/server";
import { bodyOf, request } from "@lightstart/server/memory";
import { ServeExtension, withBasePaths } from "../extension.ts";
import type { ServeBeforePayload } from "../hooks.ts";
import { createPipeline } from "../pipeline.ts";
import { createModuleTransform } from "../node/transform.ts";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

declare module "../hooks.ts" {
  interface ServeBeforePayload {
    greeting: string;
  }
}

const projectDir = resolve(join(process.cwd(), "test", "fixtures", "project"));
const log = { log() {}, warn() {}, error() {}, debug() {} };
const cli: CommandContext["cli"] = {
  runCommand: async () => 0,
  runHook: async () => ({ ran: 0, failed: 0, teardown: async () => {} }),
  listCommands: () => [],
  loadRoutes: async () => [],
  extend: async () => {},
};

const root = mkdtempSync(join(tmpdir(), "dev-extension-"));
const pageDir = mkdtempSync(join(tmpdir(), "dev-extension-page-"));
writeFileSync(join(root, "mod.ts"), 'import { dep } from "dep";\nimport { extra } from "extra";\nexport const answer: number = 42;\nexport const both: string = dep + extra;\n');
writeFileSync(join(pageDir, "page.html"), "<html><body>the named page</body></html>");

const extension = new ServeExtension("/project", { dep: "/dep.js" });
extension.importmap["extra"] = "/extra.js";
extension.handle(new App().get("/skip", () => pass()));
extension.handle(new App().get("/skip", () => text("second-app")).get("/handled", () => text("handled")));
extension.app.get("/root-route", () => text("root-route"));
extension.root("/vendor/", root);
extension.page((_c, html) => "CUSTOM:" + html);
extension.watch(root, "vendor-x");
extension.basePath("/base/");
extension.preview(4100);
eq("a base path loses its trailing slash", extension.basePaths[0] ?? "", "/base");
eqn("a watch folder is kept", extension.watches.length, 1);
eq("with its label", extension.watches[0]?.label ?? "", "vendor-x");
eqn("a preview port is kept", extension.previews[0] ?? 0, 4100);

const pipeline = createPipeline({
  projectDir,
  log,
  cli,
  routes: [],
  importmap: extension.importmap,
  transform: createModuleTransform(extension.importmap),
  watch: true,
  extension,
});
extension.app.all("/*", async (c) => (await pipeline.handle(c)) ?? fail("Not found: " + c.path, 404));
const app = withBasePaths(extension.app, extension.basePaths);

const main = async (): Promise<void> => {
  eq("the root app answers first", await bodyOf(await request(app, "GET", "/root-route")), "root-route");

  eq("a passing handled app falls to the next", await bodyOf(await request(app, "GET", "/skip")), "second-app");
  eq("a handled app answers before the shell", await bodyOf(await request(app, "GET", "/handled")), "handled");

  const module = await request(app, "GET", "/vendor/mod.js");
  const moduleBody = await bodyOf(module);
  eqn("a .js request finds the extra root's .ts", module.status, 200);
  ok("TypeScript is stripped", !moduleBody.includes(": number"));
  ok("and both imports are rewritten through the map", moduleBody.includes('from "/dep.js"') && moduleBody.includes('from "/extra.js"'));

  const shell = await request(app, "GET", "/any/route");
  ok("the page renderer answers the shell", (await bodyOf(shell)).startsWith("CUSTOM:"));
  ok("with the project page under it", (await bodyOf(shell)).includes("Fixture"));

  const bare = await request(app, "GET", "/base");
  eqn("the bare base path answers the app's root", bare.status, 200);
  ok("with the shell", (await bodyOf(bare)).startsWith("CUSTOM:"));
  eq("the base path serves the app", await bodyOf(await request(app, "GET", "/base/root-route")), "root-route");
  eq("and its handled apps", await bodyOf(await request(app, "GET", "/base/handled")), "handled");
  ok("and its files with rewritten specifiers", (await bodyOf(await request(app, "GET", "/base/vendor/mod.js"))).includes('from "/dep.js"'));

  const named = new ServeExtension("/project", {});
  named.pageFile("page.html");
  const namedPipeline = createPipeline({ projectDir: pageDir, log, cli, routes: [], importmap: named.importmap, watch: false, extension: named });
  named.app.all("/*", async (c) => (await namedPipeline.handle(c)) ?? fail("Not found: " + c.path, 404));
  eq("pageFile names the page when there is no index.html", await bodyOf(await request(named.app, "GET", "/")), "<html><body>the named page</body></html>");

  extension.payload.greeting = "hi-from-ext";
  let seen = "";
  const before = (_ctx: CommandContext, payload: ServeBeforePayload): void => {
    seen = payload.greeting;
  };
  const payload: ServeBeforePayload = { projectDir: "/p", port: 3000, watch: false, greeting: String(extension.payload.greeting) };
  before({} as CommandContext, payload);
  eq("a serve hook reads an extension's field typed", seen, "hi-from-ext");

  done();
};

try {
  await main();
} finally {
  rmSync(root, { recursive: true, force: true });
  rmSync(pageDir, { recursive: true, force: true });
}
