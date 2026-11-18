/**
 * @file Prerendering a built app: serve the build's outputs from memory, open
 * every concrete route in headless Chromium through Playwright, wait for the
 * page to settle, and keep its `outerHTML` as that route's `index.html`. The
 * build calls it after the shell is written and before anything is written to
 * disk; `404.html` stays the unrendered shell.
 */

/// <reference lib="dom" />

import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** The marker the web host reads to adopt the served DOM instead of replacing it. */
export const PRERENDER_SCRIPT = "<script>window.__PRERENDERED__ = true</script>";

/** What the renderer needs: where the project's Playwright is, the build's outputs and the paths to render. */
export interface PrerenderOptions {
  /** The project folder, whose Playwright is preferred over light's. */
  root: string;
  /** The build's outputs, path to contents; the rendered pages are added to it. */
  outputs: Map<string, Uint8Array | string>;
  /** The concrete paths to render. */
  paths: readonly string[];
}

interface PlaywrightPage {
  on(event: "pageerror", handler: (error: unknown) => void): void;
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  evaluate<T>(run: () => T | Promise<T>): Promise<T>;
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

const chromiumFrom = async (root: string): Promise<Chromium> => {
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

/**
 * Render every path of a built app in headless Chromium and add its
 * `index.html` to `outputs`; answers how many pages it wrote. Fails naming the
 * path whose page threw.
 */
export const prerender = async (options: PrerenderOptions): Promise<number> => {
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
