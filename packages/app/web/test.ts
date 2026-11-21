/// <reference lib="dom" />
/**
 * @file `@lightstart/app/web/test`: a web app opened in the page for a test.
 * `openPage` mounts the root view as the web host does (the theme applied,
 * `<app-container>` drawing the routes, links going through the router) over
 * stores in memory and a history in memory starting at a path, with the
 * arguments the test gives rather than the URL's. It answers an `OpenedPage`
 * with helpers to wait for an element or a text, go to a path and settle.
 * `openBuilt` serves a build folder as a static host does and opens a path in
 * a fresh headless Chromium context, for a test of the build itself.
 */

import { createMemoryAdapter } from "@lightstart/router/adapters/memory";
import { stripBase, withBase } from "@lightstart/router/url";
import { parseArgs } from "@lightstart/cli/argv.ts";
import type { RouterAdapter } from "@lightstart/router/contracts.ts";
import type { App } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { AppRun, currentView } from "../run.ts";
import type { NavigateOptions } from "../run.ts";
import { MemoryAdapterType, AdapterType } from "../stores.ts";
import { WebHost } from "./index.ts";
import { Transitions } from "./transitions.ts";
import { LocalStores } from "./local.ts";
import type { WebStoresFeature } from "./features.ts";

/** What a test opens a page with: where the routes start, the app's arguments (an argv list or a record over the defaults), and the store adapter types it runs (every store in memory when absent). */
export interface OpenPageOptions {
  /** The path the in-memory history starts at. */
  path?: string;
  args?: readonly string[] | Record<string, unknown>;
  /** The adapter types the stores open with, the first the default; `memory` is always available. None opens every store in memory. */
  adapters?: readonly AdapterType[];
  /** Whether the manifest's seeds load; `true` when absent. */
  seed?: boolean;
  /** Where the run's stores open: `new WorkerStores(spawn)` for a `worker: true` app; absent, every store opens on the page. */
  stores?: WebStoresFeature;
}

/** How long a helper waits before it throws. */
export interface WaitOptions {
  /** Milliseconds to wait (2 s by default). */
  timeout?: number;
}

const DEFAULT_TIMEOUT = 2000;

const frame = (): Promise<void> =>
  new Promise((resolve) => {
    const scope = globalThis as unknown as { requestAnimationFrame?: (callback: () => void) => unknown };
    if (typeof scope.requestAnimationFrame === "function") scope.requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });

const settlePage = async (): Promise<void> => {
  for (let i = 0; i < 4; i++) {
    await Promise.resolve();
    await frame();
  }
};

const waitUpdate = async (element: Element): Promise<void> => {
  const update = (element as unknown as { $requestUpdate?: () => Promise<void> }).$requestUpdate;
  if (typeof update === "function") await update.call(element);
};

/** A test's web host: memory stores, the given arguments and a history in memory; it removes the root element when it unmounts. */
class PageHost extends WebHost {
  private readonly path: string;
  private readonly given: readonly string[] | Record<string, unknown> | undefined;
  mountedRoot: HTMLElement | null = null;

  constructor(path: string, given: readonly string[] | Record<string, unknown> | undefined, adapters: readonly AdapterType[], stores: WebStoresFeature | undefined) {
    super({
      adapters: adapters.length > 0 ? adapters : [new MemoryAdapterType()],
      defaultAdapter: adapters[0]?.name ?? "memory",
      stores: stores ?? new LocalStores(),
      transitions: new Transitions(),
    });
    this.path = path;
    this.given = given;
  }

  args(app: App): Record<string, unknown> {
    const given = this.given;
    if (Array.isArray(given)) return parseArgs(app.argsSchema, given) as Record<string, unknown>;
    return { ...(parseArgs(app.argsSchema, []) as Record<string, unknown>), ...(given ?? {}) };
  }

  history(): RouterAdapter {
    return createMemoryAdapter(this.path, location.origin);
  }

  mount(run: AppRun): Promise<void> {
    return super.mount(run).then(() => {
      const found = document.querySelector(run.app.root ?? "app-root");
      this.mountedRoot = found instanceof HTMLElement ? found : null;
    });
  }

  unmount(_run: AppRun): void {
    this.stopListening();
    this.stopPage();
    const root = this.mountedRoot;
    this.mountedRoot = null;
    if (root !== null) root.remove();
  }
}

/** A web app opened in the page for a test. */
export class OpenedPage {
  readonly run: AppRun;
  /** The mounted root element. */
  readonly root: HTMLElement;
  private readonly restore: (() => void) | undefined;

  constructor(run: AppRun, root: HTMLElement, restore?: () => void) {
    this.run = run;
    this.root = root;
    this.restore = restore;
  }

  /** Wait until an element matches `selector`, wait for its pending update, then answer it. */
  async find(selector: string, options: WaitOptions = {}): Promise<HTMLElement> {
    const until = Date.now() + (options.timeout ?? DEFAULT_TIMEOUT);
    for (;;) {
      const found = document.querySelector(selector);
      if (found instanceof HTMLElement) {
        await waitUpdate(found);
        return found;
      }
      if (Date.now() >= until) throw new Error(`no ${selector} on the page: ${this.text()}`);
      await frame();
    }
  }

  /** The page's text now. */
  text(): string {
    return this.root.textContent ?? "";
  }

  /** Wait until the page's text includes `wanted`, then answer it. */
  async shows(wanted: string, options: WaitOptions = {}): Promise<string> {
    const until = Date.now() + (options.timeout ?? DEFAULT_TIMEOUT);
    for (;;) {
      const shown = this.text();
      if (shown.includes(wanted)) return shown;
      if (Date.now() >= until) throw new Error(`the page does not show "${wanted}": ${shown}`);
      await frame();
    }
  }

  /** Go to `path` and wait for the view it answers to render; `options.transition` overrides the app's choice for this call. */
  async navigate(path: string, options: NavigateOptions = {}): Promise<void> {
    if (this.run.router !== null) {
      this.run.go(path, options.transition, options.from);
      await settlePage();
      const tag = currentView.value;
      if (tag !== null) {
        const found = document.querySelector(tag);
        if (found !== null) await waitUpdate(found);
      }
    }
    await settlePage();
  }

  /** Wait for the pending updates and microtasks to run. */
  settle(): Promise<void> {
    return settlePage();
  }

  /** Stop the run, remove the root element and restore the page's scheme. */
  async stop(): Promise<void> {
    await this.run.stop();
    this.root.remove();
    this.restore?.();
  }
}

/** Open the manifest's app in the page over memory stores, a history in memory and the given arguments. */
export const openPage = async (manifest: AppManifest, options: OpenPageOptions = {}): Promise<OpenedPage> => {
  const adapters = options.adapters ?? [];
  const host = new PageHost(options.path ?? "/", options.args, adapters, options.stores);
  const run = new AppRun(manifest, host, adapters.length === 0, options.seed !== false);
  const root = document.documentElement;
  const previous = { dark: root.classList.contains("dark"), colorScheme: root.style.colorScheme };
  await run.start();
  await settlePage();
  if (host.mountedRoot === null) throw new Error("the page did not mount the app's root view");
  const restore = (): void => {
    root.classList.toggle("dark", previous.dark);
    root.style.colorScheme = previous.colorScheme;
  };
  return new OpenedPage(run, host.mountedRoot, restore);
};

/** What `openBuilt` takes: how long a page may take to settle (30 s by default). */
export interface OpenBuiltOptions {
  /** Milliseconds `goto` waits for the page to load and the network to go idle. */
  timeoutMs?: number;
  /** The path the build is deployed under; read from the project when the build sits under its `.deployed` folder. */
  base?: string;
}

interface BuiltPageLike {
  on(event: "pageerror", handler: (error: unknown) => void): void;
  on(event: "console", handler: (message: { type(): string; text(): string; location(): { url: string } }) => void): void;
  on(event: "response", handler: (response: { status(): number; url(): string; request(): { resourceType(): string } }) => void): void;
  on(event: "requestfailed", handler: (request: { url(): string }) => void): void;
  goto(url: string, options: { waitUntil: string; timeout: number }): Promise<unknown>;
  goBack(options: { timeout: number }): Promise<unknown>;
  goForward(options: { timeout: number }): Promise<unknown>;
  click(selector: string, options: { timeout: number }): Promise<void>;
  waitForFunction<A>(run: (arg: A) => unknown, arg: A, options: { timeout: number }): Promise<unknown>;
  evaluate<T>(run: () => T | Promise<T>): Promise<T>;
  close(): Promise<void>;
}

interface BuiltBrowserLike {
  newPage(): Promise<BuiltPageLike>;
  close(): Promise<void>;
}

interface ChromiumLike {
  launch(options?: { headless?: boolean }): Promise<BuiltBrowserLike>;
}

const BUILT_TYPES: Record<string, string> = {
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

const builtTypeOf = (path: string): string => BUILT_TYPES[path.slice(path.lastIndexOf(".") + 1).toLowerCase()] ?? "application/octet-stream";

const builtMessageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** A built app opened in headless Chromium. */
export class OpenedBuiltPage {
  /** The page errors and the console errors it raised. */
  readonly errors: string[];
  /** The same-origin requests that failed or answered 4xx or 5xx, with their paths. */
  readonly failed: string[];
  private readonly page: BuiltPageLike;
  private readonly browser: BuiltBrowserLike;
  private readonly server: { close(callback: () => void): unknown };
  private closed = false;

  constructor(errors: string[], failed: string[], page: BuiltPageLike, browser: BuiltBrowserLike, server: { close(callback: () => void): unknown }) {
    this.errors = errors;
    this.failed = failed;
    this.page = page;
    this.browser = browser;
    this.server = server;
  }

  /** The page's text now. */
  text(): Promise<string> {
    return this.page.evaluate(() => document.body?.innerText ?? "");
  }

  /** The page's path now. */
  path(): Promise<string> {
    return this.page.evaluate(() => location.pathname);
  }

  /** Wait until the page's text includes `wanted`, then answer the text; throws after `timeout` ms (2 s by default) naming what it wanted. */
  async shows(wanted: string, options: { timeout?: number } = {}): Promise<string> {
    const timeout = options.timeout ?? 2000;
    try {
      await this.page.waitForFunction((text: string) => (document.body?.innerText ?? "").includes(text), wanted, { timeout });
    } catch {
      throw new Error(`the page does not show "${wanted}": ${await this.text()}`);
    }
    return this.text();
  }

  /** Click the element `selector` matches, as a reader does (a link goes through the app's router). */
  click(selector: string): Promise<void> {
    return this.page.click(selector, { timeout: 2000 });
  }

  /** Run `script` in the page and answer what it returns. */
  evaluate<T>(script: () => T | Promise<T>): Promise<T> {
    return this.page.evaluate(script) as Promise<T>;
  }

  /** The browser's back button. */
  async back(): Promise<void> {
    await this.page.goBack({ timeout: 2000 });
  }

  /** The browser's forward button. */
  async forward(): Promise<void> {
    await this.page.goForward({ timeout: 2000 });
  }

  /** Close the page, the browser and the server. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.page.close();
    await this.browser.close();
    await new Promise<void>((resolve) => {
      this.server.close(() => resolve());
    });
  }
}

/**
 * Serve the build folder `dir` as a static host does (the file, else
 * `<path>/index.html`, else `404.html` with status 404), open `path` in a
 * fresh headless Chromium context, and wait until it loads with the network
 * idle (Playwright's `networkidle`: 500 ms with no request) plus two animation
 * frames. A path answered by `404.html` is the expected SPA fallback, so the
 * document's own 404 is not reported; any other same-origin 4xx/5xx, a failed
 * request, a page error or a console error is.
 */
export const openBuilt = async (dir: string, path = "/", options: OpenBuiltOptions = {}): Promise<OpenedBuiltPage> => {
  const { createServer } = await import("node:http");
  const { createReadStream } = await import("node:fs");
  const { stat } = await import("node:fs/promises");
  const { extname, join, normalize, resolve, sep } = await import("node:path");
  const { chromiumFrom } = await import("../node/prerender.ts");

  const root = resolve(dir);
  let base = options.base ?? "";
  if (options.base === undefined) {
    const marker = `${sep}.deployed${sep}`;
    const at = root.indexOf(marker);
    if (at >= 0) {
      const { appOf, infoOf } = await import("../node/generate.ts");
      const app = appOf(root.slice(0, at));
      if (app !== null) base = (await infoOf(app.path)).base;
    }
  }
  const fallbacks = new Set<string>();
  const answer = async (pathname: string, send: (status: number, file: string | null) => void): Promise<void> => {
    let relative = stripBase(base, pathname).replace(/^\/+/, "");
    try {
      relative = decodeURIComponent(relative);
    } catch {
      // Keep the undecoded path.
    }
    const candidates = relative === "" ? ["index.html"] : [relative, join(relative, "index.html")];
    for (const candidate of candidates) {
      const file = normalize(join(root, candidate));
      if (file !== root && !file.startsWith(root + sep)) continue;
      try {
        if ((await stat(file)).isFile()) {
          send(200, file);
          return;
        }
      } catch {
        // Try the next candidate.
      }
    }
    const shell = join(root, "404.html");
    try {
      if ((await stat(shell)).isFile()) {
        fallbacks.add(pathname);
        send(404, shell);
        return;
      }
    } catch {
      // No SPA fallback.
    }
    send(404, null);
  };

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    void answer(url.pathname, (status, file) => {
      response.statusCode = status;
      if (file === null) {
        response.setHeader("content-type", "text/plain; charset=utf-8");
        response.end("Not found");
        return;
      }
      response.setHeader("content-type", builtTypeOf(extname(file)));
      createReadStream(file).pipe(response);
    });
  });
  await new Promise<void>((settle, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", settle);
  });
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  const origin = `http://127.0.0.1:${String(port)}`;

  const chromium = (await chromiumFrom(process.cwd())) as unknown as ChromiumLike;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors: string[] = [];
  const failed: string[] = [];
  page.on("pageerror", (error) => errors.push(builtMessageOf(error)));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    try {
      const url = new URL(message.location().url);
      if (url.origin === origin && fallbacks.has(url.pathname)) return;
    } catch {
      // A console message with no URL is the page's own.
    }
    errors.push(message.text());
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin !== origin || response.status() < 400) return;
    if (response.status() === 404 && response.request().resourceType() === "document" && fallbacks.has(url.pathname)) return;
    failed.push(`${String(response.status())} ${url.pathname}`);
  });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.origin === origin) failed.push(`failed ${url.pathname}`);
  });
  try {
    await page.goto(`${origin}${withBase(base, path)}`, { waitUntil: "networkidle", timeout: options.timeoutMs ?? 30_000 });
    await page.evaluate(
      () =>
        new Promise<void>((settle) => {
          requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(settle, 50)));
        }),
    );
  } catch (error) {
    errors.push(builtMessageOf(error));
  }
  return new OpenedBuiltPage(errors, failed, page, browser, server);
};

/** The newest build folder in `projectDir`: `.deployed/current` when the build wrote it, else `.deployed/builds/<id>` by name. */
export const latestBuild = async (projectDir: string): Promise<string> => {
  const { existsSync } = await import("node:fs");
  const { promises: fs } = await import("node:fs");
  const { join } = await import("node:path");
  const out = join(projectDir, ".deployed");
  const current = join(out, "current");
  if (existsSync(current)) return current;
  const builds = join(out, "builds");
  let entries: { name: string; isDirectory(): boolean }[];
  try {
    entries = await fs.readdir(builds, { withFileTypes: true });
  } catch {
    throw new Error(`no build in ${out}`);
  }
  const ids = entries.filter((entry) => entry.isDirectory() && entry.name !== "current").map((entry) => entry.name).sort().reverse();
  const newest = ids[0];
  if (newest === undefined) throw new Error(`no build in ${out}`);
  return join(builds, newest);
};
