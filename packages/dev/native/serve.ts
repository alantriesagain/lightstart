/**
 * @file The native dev server: a folder served with the core pipeline over the node adapter, its
 * bare specifiers rewritten through the importmap and no TypeScript stripping, no watcher, no
 * routes and no discovery. `light-serve [dir] [--port n]` prints the URL it listens on.
 */
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { createLogger, type CliApi, type HookRun } from "@lightstart/cli";
import { App, fail } from "@lightstart/server";
import { serve } from "@lightstart/server/node";
import { Transformed } from "@lightstart/server/static";
import { DEFAULT_PORT, portOf } from "../config.ts";
import { importmapFromHtml, mergeImportMaps, type ImportMap } from "../importmap.ts";
import { buildImportMap } from "../node/importmap.ts";
import { createPipeline } from "../pipeline.ts";
import { rewriteSpecifiers } from "../rewrite.ts";
import type { ModuleTransform } from "../types.ts";

class EmptyHookRun {
  ran = 0;
  failed = 0;

  teardown(): Promise<void> {
    return Promise.resolve();
  }
}

class EmptyCli implements CliApi {
  runCommand(_name: string, _args?: readonly string[]): Promise<number> {
    return Promise.resolve(1);
  }

  runHook(_name: string, _payload: unknown): Promise<HookRun> {
    return Promise.resolve(new EmptyHookRun());
  }

  listCommands(): readonly string[] {
    return [];
  }

  loadRoutes(): Promise<readonly unknown[]> {
    return Promise.resolve([]);
  }

  extend(): Promise<void> {
    return Promise.resolve();
  }
}

const MODULES = new Set([".js", ".mjs", ".mts", ".ts", ".tsx"]);

const extensionOf = (path: string): string => {
  const dot = path.lastIndexOf(".");
  return dot < 0 ? "" : path.slice(dot).toLowerCase();
};

/** The transform native work gets: bare specifiers rewritten, the module's bytes otherwise as they are. */
const identityTransform = (importmap: ImportMap): ModuleTransform => (path: string, body: Uint8Array): Transformed | null => {
  if (!MODULES.has(extensionOf(path))) return null;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  return new Transformed(encoder.encode(rewriteSpecifiers(decoder.decode(body), importmap)), "text/javascript; charset=utf-8");
};

/** The folder's importmap: its `package.json` and the packages it declares, plus its page's own. */
const projectImportMap = (projectDir: string): ImportMap => {
  const built = buildImportMap(projectDir);
  let html = "";
  try {
    html = readFileSync(projectDir + "/index.html", "utf8");
  } catch {
    html = "";
  }
  return mergeImportMaps(built, importmapFromHtml(html));
};

type Args = {
  dir: string;
  port: number;
};

/** The folder to serve and the port, from `[dir] [--port n]`. */
const parseArgs = (argv: readonly string[]): Args => {
  let dir = process.cwd();
  let port: unknown = undefined;
  let seen = false;
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--port") {
      port = argv[i + 1];
      i++;
    } else if (arg.startsWith("--port=")) {
      port = arg.slice("--port=".length);
    } else if (!arg.startsWith("--") && !seen) {
      dir = arg;
      seen = true;
    }
  }
  return { dir: resolvePath(process.cwd(), dir), port: portOf(port) ?? DEFAULT_PORT };
};

const args = parseArgs(process.argv);
const importmap = projectImportMap(args.dir);
const pipeline = createPipeline({
  projectDir: args.dir,
  log: createLogger("dev"),
  cli: new EmptyCli(),
  routes: [],
  importmap,
  transform: identityTransform(importmap),
  watch: false,
});
const app = new App().all("/*", async (c) => (await pipeline.handle(c)) ?? fail("Not found: " + c.path, 404));
const server = await serve(app, { port: args.port, host: "127.0.0.1", signals: true, grace: 1000 });
console.log("Dev server running at http://localhost:" + String(server.port));
