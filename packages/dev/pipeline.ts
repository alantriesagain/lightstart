/**
 * @file The dev request pipeline, in order: the project's route apps, files under its root, the
 * reload client, a 404 for an asset nothing answered, then the app shell. TypeScript is stripped
 * and bare specifiers are rewritten by the transform the node layer injects.
 */
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { CliApi, Logger } from "@lightstart/cli";
import { App, type Context, type Reply, fail, html, text } from "@lightstart/server";
import { Static } from "@lightstart/server/static";
import type { ImportMap } from "./importmap.ts";
import { RELOAD_CLIENT, renderShell } from "./shell.ts";
import type { ModuleTransform, RouteFactory } from "./types.ts";

/** What the pipeline needs: the project, its routes, the map, and the transform files go through. */
export type PipelineOptions = {
  projectDir: string;
  log: Logger;
  cli: CliApi;
  routes: readonly RouteFactory[];
  importmap: ImportMap;
  transform?: ModuleTransform;
  watch: boolean;
};

/** The pipeline: answers a request, and holds the route apps an upgrade is offered to first. */
export type Pipeline = {
  apps: readonly App[];
  handle(c: Context): Promise<Reply | null>;
};

const RELOAD_PATH = "/__light/reload.js";

const noStore = (reply: Reply): Reply => reply.header("cache-control", "no-store");

/** Whether a URL path names a file (`/style.css`) rather than a route (`/posts/one`). */
const hasExtension = (pathname: string): boolean => extname(pathname) !== "";

/** The candidate paths a request may name, probing `.ts` and `.tsx` when a `.js` file is asked for. */
const candidatesFor = (rest: string): string[] => {
  if (!rest.endsWith(".js")) return [rest];
  const stem = rest.slice(0, -3);
  return [rest, stem + ".ts", stem + ".tsx"];
};

/** The pipeline over `options`, with every route file's app built once. */
export const createPipeline = (options: PipelineOptions): Pipeline => {
  const apps = options.routes.map((route) => route({ projectDir: options.projectDir, log: options.log, cli: options.cli }));
  const files = new Static({
    root: options.projectDir,
    dotfiles: true,
    precompressed: false,
    cacheControl: "no-store",
    transform: options.transform,
    transformable: options.transform === undefined ? undefined : (path: string) => [".js", ".mjs", ".ts", ".tsx", ".mts"].includes(extname(path).toLowerCase()),
    transformVersion: JSON.stringify(options.importmap),
  });

  const shell = async (): Promise<Reply> => {
    let raw: string;
    try {
      raw = await readFile(join(options.projectDir, "index.html"), "utf8");
    } catch {
      return text("404 Not Found", 404).header("cache-control", "no-store");
    }
    return noStore(html(renderShell(raw, options.importmap, { reload: options.watch })));
  };

  const file = async (c: Context, rest: string): Promise<Reply | null> => {
    for (const candidate of candidatesFor(rest)) {
      const found = await files.find(candidate);
      if (found !== null) return await files.reply(c, found);
    }
    return null;
  };

  const handle = async (c: Context): Promise<Reply | null> => {
    for (const app of apps) {
      const reply = await app.handle(c);
      if (reply !== null) return noStore(reply);
    }
    if (c.path === RELOAD_PATH) return noStore(text(RELOAD_CLIENT).header("content-type", "text/javascript; charset=utf-8"));
    if (c.path !== "/") {
      const reply = await file(c, c.path.replace(/^\/+/, ""));
      if (reply !== null) return noStore(reply);
    }
    if (c.path === "/" || !hasExtension(c.path)) return await shell();
    return fail("Not found: " + c.path, 404);
  };

  return { apps, handle };
};
