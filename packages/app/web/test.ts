/// <reference lib="dom" />
/**
 * @file `@lightstart/app/web/test`: a web app opened in the page for a test.
 * `openPage` mounts the root view as the web host does (the theme applied,
 * `<app-outlet>` drawing the routes, links going through the router) over
 * stores in memory and a history in memory starting at a path, with the
 * arguments the test gives rather than the URL's. It answers an `OpenedPage`
 * with helpers to wait for an element or a text, go to a path and settle.
 */

import { createMemoryAdapter } from "@lightstart/router/adapters/memory";
import { parseArgs } from "@lightstart/cli/argv.ts";
import type { RouterAdapter } from "@lightstart/router/contracts.ts";
import type { App } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { AppRun, currentView } from "../run.ts";
import { MemoryKind, StoreKind } from "../stores.ts";
import { WebHost } from "./index.ts";

/** What a test opens a page with: where the routes start, the app's arguments (an argv list or a record over the defaults), and the store kinds it runs (every store in memory when absent). */
export interface OpenPageOptions {
  /** The path the in-memory history starts at. */
  path?: string;
  args?: readonly string[] | Record<string, unknown>;
  /** The kinds the stores open with, the first the default; `memory` is always available. None opens every store in memory. */
  kinds?: readonly StoreKind[];
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

  constructor(path: string, given: readonly string[] | Record<string, unknown> | undefined, kinds: readonly StoreKind[]) {
    super({
      kinds: kinds.length > 0 ? kinds : [new MemoryKind()],
      defaultKind: kinds[0]?.name ?? "memory",
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
    return createMemoryAdapter(this.path);
  }

  mount(run: AppRun): Promise<void> {
    return super.mount(run).then(() => {
      const found = document.querySelector(run.app.root ?? "app-root");
      this.mountedRoot = found instanceof HTMLElement ? found : null;
    });
  }

  unmount(_run: AppRun): void {
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

  constructor(run: AppRun, root: HTMLElement) {
    this.run = run;
    this.root = root;
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

  /** Go to `path` and wait for the view it answers to render. */
  async navigate(path: string): Promise<void> {
    const router = this.run.router;
    if (router !== null) {
      router.go(path);
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

  /** Stop the run and remove the root element. */
  async stop(): Promise<void> {
    await this.run.stop();
    this.root.remove();
  }
}

/** Open the manifest's app in the page over memory stores, a history in memory and the given arguments. */
export const openPage = async (manifest: AppManifest, options: OpenPageOptions = {}): Promise<OpenedPage> => {
  const kinds = options.kinds ?? [];
  const host = new PageHost(options.path ?? "/", options.args, kinds);
  const run = new AppRun(manifest, host, kinds.length === 0);
  await run.start();
  await settlePage();
  if (host.mountedRoot === null) throw new Error("the page did not mount the app's root view");
  return new OpenedPage(run, host.mountedRoot);
};
