/**
 * @file One run of an app, the same on every host: its arguments filled from
 * the host's source, its stores opened, its controllers started in import
 * order, its routes followed (when `src/routes.ts` has some) over the host's
 * history, and its view put on the host's surface; then `stop`, `restart`
 * (the same run again with other arguments) and `quit`, which the run installs
 * on the app. `currentView` is the view tag the routes answer and
 * `currentParams` the parameters of its path, for the
 * host's `<app-container>`; `navigate` goes to a path.
 */

import { signal } from "@lightstart/light/signals";
import { RouterCore } from "@lightstart/router/core";
import { createMemoryAdapter } from "@lightstart/router/adapters/memory";
import { parseArgs } from "@lightstart/cli/argv.ts";
import type { RouterAdapter } from "@lightstart/router/contracts.ts";
import type { Row, Store } from "@lightstart/light/model/types.ts";
import { startControllers, stopControllers } from "./controllers.ts";
import type { App } from "./index.ts";
import type { AppManifest } from "./manifest.ts";
import { openStores } from "./stores.ts";
import type { StoreHost, StoreKind } from "./stores.ts";
import { setAppHead, setRouteHead } from "./head.ts";

/** The view tag the routes answer now; null without routes or without a view for the path. */
export const currentView = signal<string | null>(null);

/** The parameters of the path the routes answer now (`/components/:category` gives `{ category }`), which the container sets on the view. */
export const currentParams = signal<Record<string, string>>({});

const paramsOf = (matched: { params?: unknown } | null): Record<string, string> => {
  const params = matched !== null && typeof matched.params === "object" && matched.params !== null ? (matched.params as Record<string, unknown>) : {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) if (typeof value === "string") out[key] = value;
  return out;
};

/**
 * What runs an app on a surface: the store kinds it has and its default, where the arguments come
 * from, the history the routes follow, and how the view is put up and taken down. Each method has
 * what a host with no surface does (a test's): the app's argument defaults, a history in memory,
 * nothing to mount, nothing to leave; a host overrides what it changes. Its methods answer
 * promises rather than being `async` (scriptc dispatches no async override).
 */
export class AppHost implements StoreHost {
  readonly name: string = "none";
  kinds: readonly StoreKind[] = [];
  defaultKind: string = "memory";

  /** The app's argument values, from the host's source (argv, the URL); an error for arguments it cannot take. */
  args(app: App): Record<string, unknown> {
    return parseArgs(app.argsSchema, []) as Record<string, unknown>;
  }

  /** The history the routes follow. */
  history(): RouterAdapter {
    return createMemoryAdapter("/");
  }

  /** Whether the page on screen was rendered ahead of time; only a host with a page answers true. */
  prerendered(): boolean {
    return false;
  }

  /** Clear the prerender flag before a client navigation; nothing without one. */
  clearPrerendered(): void {
    return;
  }

  /** Run `apply` inside the host's transition, then wait for its surface to draw; by default it just runs `apply`. */
  transition(apply: () => Promise<void> | void): Promise<void> {
    return Promise.resolve(apply()).then(() => undefined);
  }

  /** After a route change that is not the first load, once the next view has drawn; a host with a page moves focus, scrolls and announces the title. */
  routeChanged(_run: AppRun, _first: boolean): Promise<void> {
    return Promise.resolve();
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

/** What a one-call navigation may override. */
export interface NavigateOptions {
  /** Run this navigation inside the host's transition (`true`), or plainly (`false`), whatever the app chose. */
  transition?: boolean;
}

/** Go to `path` in the app running now; nothing without routes. `options.transition` overrides the app's choice for this call. */
export const navigate = (path: string, options: NavigateOptions = {}): void => {
  const run = running;
  if (run !== null) run.go(path, options.transition);
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
  private overrideTransition: boolean | undefined = undefined;
  private readonly seed: boolean;

  constructor(manifest: AppManifest, host: AppHost, memoryOnly = false, seed = true) {
    this.manifest = manifest;
    this.host = host;
    this.memoryOnly = memoryOnly;
    this.seed = seed;
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
    if (this.seed) await this.seedStores();
    this.controllers = await startControllers(this.manifest);
    this.route();
    await this.host.mount(this);
  }

  /** Add each seed's rows once, into a model whose store is still empty; an error names the model and a bad row's index. */
  private async seedStores(): Promise<void> {
    const store = this.store;
    if (store === null) return;
    const models = new Set(this.manifest.models.map((entry) => entry.name));
    // Whether each model's store was empty before any seed ran: the dev seed's rows join the seed's on a fresh store.
    const empty = new Map<string, boolean>();
    for (const group of this.manifest.seeds ?? []) {
      for (const [name, rows] of Object.entries(group)) {
        if (!models.has(name)) throw new Error(`A seed names the model "${name}", which the app does not have`);
        if (!Array.isArray(rows)) throw new Error(`The seed for model "${name}" is not a list of rows`);
        if (!empty.has(name)) empty.set(name, (await store.count(name)) === 0);
      }
    }
    for (const group of this.manifest.seeds ?? []) {
      for (const [name, rows] of Object.entries(group)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;
        if (empty.get(name) !== true) continue;
        try {
          await store.addMany(name, rows.map((row) => row as Row), { importing: true });
        } catch (error) {
          const index = typeof error === "object" && error !== null && "index" in error && typeof (error as { index?: unknown }).index === "number" ? (error as { index: number }).index : null;
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(index === null ? `The seed for model "${name}" failed: ${reason}` : `The seed for model "${name}" failed at row ${String(index)}: ${reason}`);
        }
      }
    }
  }

  /** Write the matched route into `currentView` and `currentParams`, and reset the page head from it. */
  private applyRoute(matched: { params?: unknown; route?: unknown; path?: unknown }): void {
    const params = paramsOf(matched);
    const path = typeof matched.path === "string" ? matched.path : "/";
    setRouteHead(this.app, matched.route, params, path);
    currentParams.value = params;
    currentView.value = viewOf(matched.route);
  }

  /** Apply a route change, through the host's transition when the app asks for one or this call overrides it; then let the host move focus. */
  private followRoute(matched: { params?: unknown; route?: unknown; path?: unknown }): void {
    const apply = (): void => this.applyRoute(matched);
    const after = (): Promise<void> => this.host.routeChanged(this, false);
    const transition = this.overrideTransition ?? this.app.transitions;
    if (transition) void this.host.transition(apply).then(after);
    else {
      apply();
      void after();
    }
  }

  private route(): void {
    const routes = this.manifest.routes;
    currentView.value = null;
    currentParams.value = {};
    if (routes === null) {
      setAppHead(this.app);
      return;
    }
    const router = new RouterCore(this.host.history(), { plugins: [] });
    // The first match happens inside `init`; every later one reaches the subscriber.
    let initial = true;
    router.init(routes, {
      appName: this.app.name,
      prerendered: () => this.host.prerendered(),
      clearPrerendered: () => this.host.clearPrerendered(),
      onRouteChange: (matched) => {
        if (initial) this.applyRoute(matched);
      },
    });
    initial = false;
    this.following = router.subscribe((matched) => {
      this.followRoute(matched);
    });
    currentParams.value = paramsOf(router.currentRoute);
    currentView.value = router.currentRoute === null ? null : viewOf(router.currentRoute.route);
    this.router = router;
  }

  /** Go to `path`, choosing whether this one navigation uses the host's transition. */
  go(path: string, transition?: boolean): void {
    const router = this.router;
    if (router === null) return;
    this.overrideTransition = transition;
    try {
      router.go(path);
    } finally {
      this.overrideTransition = undefined;
    }
  }

  /** Take the view down, stop following the routes, dispose the controllers in reverse order and close the stores. */
  async stop(): Promise<void> {
    this.host.unmount(this);
    const following = this.following;
    this.following = null;
    if (following !== null) following();
    this.router = null;
    currentView.value = null;
    currentParams.value = {};
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
