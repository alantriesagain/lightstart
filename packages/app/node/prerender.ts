/**
 * @file Prerendering a built app: the default renderer runs each concrete
 * route on light's markup host in node and writes its page; the browser
 * renderer serves the build's outputs from memory, opens every route in
 * headless Chromium through Playwright, and keeps its `outerHTML`. The build
 * calls it after the shell is written and before anything is written to disk;
 * `404.html` stays the unrendered shell.
 */

/// <reference lib="dom" />

import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { PrerenderRenderer } from "../index.ts";
import type { AppManifest } from "../manifest.ts";

/** The marker the web host reads to adopt the served DOM instead of replacing it. */
export const PRERENDER_SCRIPT = "<script>window.__PRERENDERED__ = true</script>";

/** What the renderer needs: where the project is, the build's outputs, the paths to render and how. */
export interface PrerenderOptions {
  /** The project folder, whose modules and Playwright are preferred over light's. */
  root: string;
  /** The build's outputs, path to contents; the rendered pages are added to it. */
  outputs: Map<string, Uint8Array | string>;
  /** The concrete paths to render. */
  paths: readonly string[];
  /** `"markup"` (the default) renders in node; `"browser"` through Playwright. */
  renderer?: PrerenderRenderer;
  /** Where a view's error goes while rendering; printed as a warning by the build. */
  warn?: (message: string) => void;
}

interface MarkupHostPrototype {
  reportError(error: unknown): void;
}

interface MarkupModule {
  MarkupHost?: { prototype: MarkupHostPrototype };
}

interface PlaywrightPage {
  on(event: "pageerror", handler: (error: unknown) => void): void;
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  evaluate<T>(run: () => T | Promise<T>): Promise<T>;
  addInitScript(script: string): Promise<void>;
  close(): Promise<void>;
}

interface PlaywrightBrowser {
  newPage(): Promise<PlaywrightPage>;
  close(): Promise<void>;
}

interface Chromium {
  launch(options?: { headless?: boolean }): Promise<PlaywrightBrowser>;
}

const CONTENT_TYPES: Record<string, string> = {
  css: "text/css; charset=utf-8",
  gif: "image/gif",
  html: "text/html; charset=utf-8",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  map: "application/json; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  png: "image/png",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  wasm: "application/wasm",
  webp: "image/webp",
  woff: "font/woff",
  woff2: "font/woff2",
  xml: "application/xml; charset=utf-8",
};

const contentTypeOf = (path: string): string => {
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
};

const isChromium = (value: unknown): value is Chromium => typeof value === "object" && value !== null && typeof (value as { launch?: unknown }).launch === "function";

/** Playwright's Chromium: the project's, else light's; fails naming what to install. */
export const chromiumFrom = async (root: string): Promise<Chromium> => {
  const bases: string[] = [join(root, "package.json")];
  try {
    bases.push(createRequire(import.meta.url).resolve("@lightstart/light"));
  } catch {
    // light is not resolvable from here; the project may still have Playwright.
  }
  for (const base of bases) {
    try {
      const resolved = createRequire(base).resolve("playwright");
      const module = (await import(pathToFileURL(resolved).href)) as { chromium?: unknown; default?: { chromium?: unknown } };
      const chromium = module.chromium ?? module.default?.chromium;
      if (isChromium(chromium)) return chromium;
    } catch {
      // Try the next base.
    }
  }
  throw new Error("Prerendering needs Playwright. Install it with `pnpm add -D playwright` and `npx playwright install chromium`.");
};

const fileFor = (pathname: string, outputs: Map<string, Uint8Array | string>): { content: Uint8Array | string; type: string } | null => {
  let path = pathname.replace(/^\/+/, "");
  try {
    path = decodeURIComponent(path);
  } catch {
    // Keep the undecoded path.
  }
  const candidates = path === "" ? ["index.html"] : [path, `${path}/index.html`, `${path}.html`];
  for (const candidate of candidates) {
    const content = outputs.get(candidate);
    if (content !== undefined) return { content, type: contentTypeOf(candidate) };
  }
  const shell = outputs.get("404.html");
  return shell === undefined ? null : { content: shell, type: "text/html; charset=utf-8" };
};

const outputPathOf = (path: string): string => {
  const clean = path.replace(/^\/+|\/+$/g, "");
  return clean === "" ? "index.html" : `${clean}/index.html`;
};

const markPrerendered = (html: string): string => (/<head[^>]*>/i.test(html) ? html.replace(/<head([^>]*)>/i, `<head$1>${PRERENDER_SCRIPT}`) : html);

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const textOf = (content: Uint8Array | string): string => (typeof content === "string" ? content : new TextDecoder().decode(content));

const importFromProject = async (root: string, specifier: string): Promise<unknown> => {
  const resolved = createRequire(join(root, "package.json")).resolve(specifier);
  return import(pathToFileURL(resolved).href);
};

/**
 * Render every path on light's markup host in node and add its `index.html`
 * to `outputs`; answers how many pages it wrote. Imports light's markup host
 * from the project before its generated manifest, so the views register
 * there, then renders one path after another. A page that throws fails naming
 * its path; a view's error goes to `warn` with the path and the render goes on.
 */
const prerenderMarkup = async (options: PrerenderOptions): Promise<number> => {
  const { root, outputs, paths } = options;
  const warn = options.warn ?? ((message: string): void => console.warn(message));
  const built = outputs.get("index.html");
  if (built === undefined) throw new Error("Prerendering needs the build's index.html");

  const markup = (await importFromProject(root, "@lightstart/light/markup")) as MarkupModule;
  const appPath = existsSync(join(root, ".light", "app.js")) ? join(root, ".light", "app.js") : join(root, ".light", "app.ts");
  const module = (await import(`${pathToFileURL(appPath).href}?mtime=${String(Date.now())}`)) as { default?: AppManifest };
  if (module.default === undefined) throw new Error(`The generated app at ${appPath} has no default export`);
  const manifest = module.default;
  const { renderPage } = await import("../static/index.ts");

  const prototype = markup.MarkupHost?.prototype;
  const reportError = prototype?.reportError;
  const page = textOf(built);
  let written = 0;
  let rendering = "";
  const onUnhandled = (reason: unknown): void => {
    warn(`Prerendering ${rendering}: unhandled rejection: ${messageOf(reason)}`);
  };
  process.on("unhandledRejection", onUnhandled);
  try {
    for (const path of paths) {
      rendering = path;
      const errors: string[] = [];
      const capture = (error: unknown): void => {
        errors.push(messageOf(error));
      };
      if (prototype !== undefined && reportError !== undefined) prototype.reportError = capture;
      try {
        const html = await renderPage(manifest, page, { path });
        outputs.set(outputPathOf(path), html);
        written += 1;
      } catch (error) {
        throw new Error(`Prerendering ${path} failed: ${messageOf(error)}`);
      } finally {
        if (prototype !== undefined && reportError !== undefined) prototype.reportError = reportError;
      }
      for (const error of errors) warn(`Prerendering ${path}: ${error}`);
    }
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
  return written;
};

/**
 * Render every path of a built app in headless Chromium and add its
 * `index.html` to `outputs`; answers how many pages it wrote. Fails naming the
 * path whose page threw.
 */
const prerenderBrowser = async (options: PrerenderOptions): Promise<number> => {
  const { root, outputs, paths } = options;
  if (paths.length === 0) return 0;

  const chromium = await chromiumFrom(root);
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const found = fileFor(url.pathname, outputs);
    if (found === null) {
      response.statusCode = 404;
      response.end("Not found");
      return;
    }
    response.setHeader("content-type", found.type);
    response.end(found.content);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  const origin = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({ headless: true });
  let written = 0;
  try {
    const queue = [...paths];
    const renderOne = async (path: string): Promise<void> => {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error instanceof Error ? error.message : String(error)));
      try {
        await page.goto(`${origin}${path}`, { waitUntil: "networkidle", timeout: 30_000 });
        await page.evaluate(
          () =>
            new Promise<void>((resolve) => {
              requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 300)));
            }),
        );
        const html = await page.evaluate(() => document.documentElement.outerHTML);
        if (errors.length > 0) throw new Error(errors[0]);
        outputs.set(outputPathOf(path), `<!doctype html>\n${markPrerendered(html)}`);
        written += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Prerendering ${path} failed: ${message}`);
      } finally {
        await page.close();
      }
    };
    const workers = Array.from({ length: Math.min(4, paths.length) }, async () => {
      while (queue.length > 0) {
        const path = queue.shift();
        if (path !== undefined) await renderOne(path);
      }
    });
    await Promise.all(workers);
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  return written;
};

/**
 * Render every path of a built app with the chosen renderer and add its
 * `index.html` to `outputs`; answers how many pages it wrote. The markup
 * renderer is the default.
 */
export const prerender = async (options: PrerenderOptions): Promise<number> => {
  if (options.paths.length === 0) return 0;
  return (options.renderer ?? "markup") === "browser" ? prerenderBrowser(options) : prerenderMarkup(options);
};
