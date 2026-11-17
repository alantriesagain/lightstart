/**
 * @file One run of an app, the same on every host: its arguments filled from
 * the host's source, its stores opened, its controllers started in import
 * order, its routes followed (when `src/routes.ts` has some) over the host's
 * history, and its view put on the host's surface; then `stop`, `restart`
 * (the same run again with other arguments) and `quit`, which the run installs
 * on the app. `currentView` is the view tag the routes answer, for the
 * host's `<app-outlet>`; `navigate` goes to a path.
 */

import { signal } from "@lightstart/light/signals";
import { RouterCore } from "@lightstart/router/core";
import { createMemoryAdapter } from "@lightstart/router/adapters/memory";
import { parseArgs } from "@lightstart/cli/argv.ts";
import type { RouterAdapter } from "@lightstart/router/contracts.ts";
import type { Store } from "@lightstart/light/model/types.ts";
import { startControllers, stopControllers } from "./controllers.ts";
import type { App } from "./index.ts";
import type { AppManifest } from "./manifest.ts";
import { openStores } from "./stores.ts";
import type { StoreHost, StoreKind } from "./stores.ts";

/** The view tag the routes answer now; null without routes or without a view for the path. */
export const currentView = signal<string | null>(null);

/**
 * What runs an app on a surface: the store kinds it has and its default, where the arguments come
 * from, the history the routes follow, and how the view is put up and taken down. Each method has
 * what a host with no surface does (a test's): the app's argument defaults, a history in memory,
 * nothing to mount, nothing to leave; a host overrides what it changes. Its methods answer
 * promises rather than being `async` (scriptc dispatches no async override).
 */
export class AppHost implements StoreHost {
  readonly name: string = "none";
  readonly kinds: readonly StoreKind[] = [];
  readonly defaultKind: string = "memory";

  /** The app's argument values, from the host's source (argv, the URL); an error for arguments it cannot take. */
  args(app: App): Record<string, unknown> {
    return parseArgs(app.argsSchema, []) as Record<string, unknown>;
  }

  /** The history the routes follow. */
  history(): RouterAdapter {
    return createMemoryAdapter("/");
  }

  /** Put the run's view on the surface. */
  mount(_run: AppRun): Promise<void> {
    return Promise.resolve();
  }

  /** Take the view down (the run stops, or starts again). */
  unmount(_run: AppRun): void {
    return;
  }

  /** Leave once the run stopped: a terminal app exits with `code`. */
  exit(_code: number): void {
    return;
  }

  /** Open every store, the memory kind for each when `memoryOnly` (a test's run). */
  openStores(manifest: AppManifest, memoryOnly: boolean): Promise<Store> {
    return openStores(manifest, this, memoryOnly);
  }
}

const viewOf = (route: unknown): string | null => {
  if (typeof route !== "object" || route === null) return null;
  const view = (route as { view?: unknown }).view;
  return typeof view === "string" ? view : null;
};

let running: AppRun | null = null;

/** Go to `path` in the app running now; nothing without routes. */
export const navigate = (path: string): void => {
  const router = running !== null ? running.router : null;
  if (router !== null) router.go(path);
};

/** An app running on a host. */
export class AppRun {
  readonly manifest: AppManifest;
  readonly host: AppHost;
  /** Every store in a test is memory. */
  readonly memoryOnly: boolean;
  store: Store | null = null;
  controllers: readonly unknown[] = [];
  router: RouterCore | null = null;
  private following: (() => void) | null = null;

  constructor(manifest: AppManifest, host: AppHost, memoryOnly = false) {
    this.manifest = manifest;
    this.host = host;
    this.memoryOnly = memoryOnly;
  }

  get app(): App {
    return this.manifest.app;
  }

  /** Fill the arguments, open the stores, start the controllers and the routes, mount the view; the app's restart and quit reach this run. */
  async start(): Promise<void> {
    this.app.args.values = this.host.args(this.app);
    await this.open();
    this.app.lifecycle = {
      restart: (next?: Record<string, unknown>): Promise<void> => this.restart(next),
      quit: (code?: number): Promise<void> => this.quit(code),
    };
    running = this;
  }

  private async open(): Promise<void> {
    this.store = await this.host.openStores(this.manifest, this.memoryOnly);
    this.controllers = await startControllers(this.manifest);
    this.route();
    await this.host.mount(this);
  }

  private route(): void {
    const routes = this.manifest.routes;
    currentView.value = null;
    if (routes === null) return;
    const router = new RouterCore(this.host.history(), { plugins: [] });
    router.init(routes, {
      appName: this.app.name,
      onRouteChange: (matched) => {
        currentView.value = viewOf(matched.route);
      },
    });
    this.following = router.subscribe((matched) => {
      currentView.value = viewOf(matched.route);
    });
    currentView.value = router.currentRoute === null ? null : viewOf(router.currentRoute.route);
    this.router = router;
  }

  /** Take the view down, stop following the routes, dispose the controllers in reverse order and close the stores. */
  async stop(): Promise<void> {
    this.host.unmount(this);
    const following = this.following;
    this.following = null;
    if (following !== null) following();
    this.router = null;
    currentView.value = null;
    await stopControllers(this.controllers);
    this.controllers = [];
    const store = this.store;
    this.store = null;
    if (store !== null) await store.close();
  }

  /** Stop, merge `next` over the arguments, then open, start and mount again. */
  async restart(next?: Record<string, unknown>): Promise<void> {
    await this.stop();
    this.app.args.values = { ...this.app.args.values, ...(next ?? {}) };
    await this.open();
  }

  /** Stop, then leave as the host does. */
  async quit(code?: number): Promise<void> {
    await this.stop();
    if (running === this) running = null;
    this.host.exit(code ?? 0);
  }
}
