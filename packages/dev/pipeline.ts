/**
 * @file The dev request pipeline, in order: the project's route apps, the apps an extension adds,
 * files under the project root (and under an extension's extra roots), the reload client, a 404
 * for an asset nothing answered, then the app shell. TypeScript is stripped and bare specifiers
 * are rewritten by the transform the node layer injects.
 */
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, join } from "node:path";
import type { CliApi, Logger } from "@lightstart/cli";
import { App, type Context, type Reply, fail, html, text } from "@lightstart/server";
import { Static } from "@lightstart/server/static";
import type { ServeExtension } from "./extension.ts";
import type { ImportMap } from "./importmap.ts";
import { settledContext } from "./settle.ts";
import { RELOAD_CLIENT, renderShell } from "./shell.ts";
import type { ModuleTransform, RouteFactory } from "./types.ts";

/** What the pipeline needs: the project, its routes, the map, the transform files go through, and the extension. */
export type PipelineOptions = {
  projectDir: string;
  log: Logger;
  cli: CliApi;
  routes: readonly RouteFactory[];
  importmap: ImportMap;
  transform?: ModuleTransform;
  watch: boolean;
  extension?: ServeExtension;
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

const moduleFile = (path: string): boolean => [".js", ".mjs", ".ts", ".tsx", ".mts"].includes(extname(path).toLowerCase());

/** The pipeline over `options`, with every route file's app built once. */
export const createPipeline = (options: PipelineOptions): Pipeline => {
  const extension = options.extension;
  const apps = options.routes.map((route) => route({ projectDir: options.projectDir, log: options.log, cli: options.cli }));
  const handled = extension === undefined ? [] : extension.handled;
  const transform = options.transform;
  const staticOptions = {
    dotfiles: true,
    precompressed: false,
    cacheControl: "no-store",
    transform,
    transformable: transform === undefined ? undefined : moduleFile,
    transformVersion: JSON.stringify(options.importmap),
  };
  const files = new Static({ root: options.projectDir, ...staticOptions });
  const roots = (extension === undefined ? [] : extension.roots).map((root) => {
    const prefix = root.prefix.endsWith("/") ? root.prefix.slice(0, -1) : root.prefix;
    return { prefix, files: new Static({ root: root.dir, ...staticOptions }) };
  });

  const shell = async (c: Context): Promise<Reply> => {
    let raw: string | null = null;
    try {
      raw = await readFile(join(options.projectDir, "index.html"), "utf8");
    } catch {
      raw = null;
    }
    if (raw === null && extension !== undefined) {
      const page = extension.pageFilePath();
      if (page !== null) {
        const path = isAbsolute(page) ? page : join(options.projectDir, page);
        raw = await readFile(path, "utf8").catch(() => null);
      }
    }
    if (raw === null) return text("404 Not Found", 404).header("cache-control", "no-store");
    const body = extension === undefined ? renderShell(raw, options.importmap, { reload: options.watch }) : extension.renderPage(c, raw, options.watch);
    return noStore(html(body));
  };

  const file = async (c: Context, rest: string): Promise<Reply | null> => {
    for (const candidate of candidatesFor(rest)) {
      const found = await files.find(candidate);
      if (found !== null) return await files.reply(c, found);
    }
    return null;
  };

  const rootFile = async (c: Context): Promise<Reply | null> => {
    for (const root of roots) {
      if (c.path !== root.prefix && !c.path.startsWith(root.prefix + "/")) continue;
      const rest = c.path.slice(root.prefix.length).replace(/^\/+/, "");
      for (const candidate of candidatesFor(rest)) {
        const found = await root.files.find(candidate);
        if (found !== null) return await root.files.reply(c, found);
      }
    }
    return null;
  };

  const handle = async (c: Context): Promise<Reply | null> => {
    const { context, incoming } = settledContext(c);
    for (const app of [...apps, ...handled]) {
      const reply = await app.handle(context);
      if (reply === null) continue;
      await Promise.all(incoming.work);
      return noStore(reply);
    }
    if (c.path === RELOAD_PATH) return noStore(text(RELOAD_CLIENT).header("content-type", "text/javascript; charset=utf-8"));
    if (c.path !== "/") {
      const reply = (await file(c, c.path.replace(/^\/+/, ""))) ?? (await rootFile(c));
      if (reply !== null) return noStore(reply);
    }
    if (c.path === "/" || !hasExtension(c.path)) return await shell(c);
    return fail("Not found: " + c.path, 404);
  };

  return { apps, handle };
};
