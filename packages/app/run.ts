/**
 * @file One run of an app, the same on every host: its arguments filled from
 * the host's source, its stores opened, its controllers started in import
 * order, its routes followed (when `src/routes.ts` has some) over the host's
 * history, and its view put on the host's surface; then `stop`, `restart`
 * (the same run again with other arguments) and `quit`, which the run installs
 * on the app. `currentView` is the view tag the routes answer and
 * `currentParams` the parameters of its path, for the
 * host's `<app-container>`; `currentRoute` is the matched route itself, and
 * `href` and `url` build a path or an address from a path or a route name,
 * which `navigate` follows.
 */

import { signal } from "@lightstart/light/signals";
import { RouterCore } from "@lightstart/router/core";
import { appUrl, setAppBase } from "./base.ts";
import { createMemoryAdapter } from "@lightstart/router/adapters/memory";
import { stripBase, withQuery } from "@lightstart/router/url";
import type { MatchedRoute, RouteConfig, RouterAdapter, RouterOptions } from "@lightstart/router/contracts.ts";
import type { QueryOptions, Row, WriteOptions } from "@lightstart/light/model/types.ts";
import { startControllers, stopControllers } from "./controllers.ts";
import type { App } from "./index.ts";
import type { AppManifest } from "./manifest.ts";
import type { AdapterType, StoreHost } from "./stores.ts";
import { setAppHead, setRouteHead } from "./head.ts";
import { leafRoute, paramsOf, resolveOutlet, viewOf } from "./outlet.ts";
import type { Outlet, OutletPosition } from "./outlet.ts";

/** What a run needs of its store: open, count to tell an empty one, add the seeds, close; a host's engine store or a worker proxy answers it. */
export interface RunStore {
  count(model: string, options?: QueryOptions): Promise<number>;
  addMany(model: string, rows: Row[], options?: WriteOptions): Promise<Row[]>;
  close(): Promise<void>;
}

/** The element a navigation started from (usually the clicked link); a host that morphs reads it as the DOM element it is. */
export interface NavigationSource {
  readonly tagName: string;
}

/** What a host's transition may need: the path navigated to, the history entry it now shows, and where the navigation started. */
export interface RouteTransition {
  /** The route path the navigation lands on. */
  path: string;
  /** The history entry's `href` after the navigation, when the host's history has one. */
  href?: string;
  /** The element the navigation started from, for a host that morphs it into the next view. */
  from?: NavigationSource;
}

/** The view tag the routes answer now; null without routes or without a view for the path. */
export const currentView = signal<string | null>(null);

/** The parameters of the path the routes answer now (`/components/:category` gives `{ category }`), which the container sets on the view. */
export const currentParams = signal<Record<string, string>>({});

/** The route the router matched now, the chain `<app-container>` resolves its drawn levels from. */
export const currentMatch = signal<MatchedRoute | null>(null);

/** Where the running app's routes stand: the matched route's name, its app path, its path params, its query and its leaf config. */
export interface CurrentRoute {
  name: string | null;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  route: RouteConfig;
}

/** The matched route now, or null before a run, without routes, and after the run stops. */
export const currentRoute = signal<CurrentRoute | null>(null);

const pathParamNamesOf = (route: RouteConfig | null): string[] => {
  const names: string[] = [];
  if (route === null) return names;
  const pattern = typeof route.path === "string" ? route.path : "";
  for (const segment of pattern.split("/")) {
    if (segment === "*") names.push("*");
    else if (segment.startsWith(":")) names.push(segment.slice(1).replace(/\*$/, ""));
  }
  for (const name of route.namedParams ?? []) names.push(name);
  return names;
};

const pathParamsOf = (matched: MatchedRoute): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const name of pathParamNamesOf(leafRoute(matched))) {
    const value = matched.params[name];
    if (typeof value === "string") out[name] = value;
  }
  return out;
};

const queryOf = (matched: MatchedRoute): Record<string, string> => {
  const query = matched.queryParams;
  const out: Record<string, string> = {};
  if (query === undefined || query === null) return out;
  for (const key of Object.keys(query)) {
    const value = query[key];
    if (typeof value === "string") out[key] = value;
  }
  return out;
};

const appPathOf = (raw: string, base: string): string => {
  const path = raw.split("?")[0].split("#")[0];
  const stripped = stripBase(base, path);
  const trimmed = stripped.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
};

const routeStateOf = (matched: MatchedRoute | null, base: string): CurrentRoute | null => {
  if (matched === null) return null;
  const leaf = leafRoute(matched);
  if (leaf === null) return null;
  const raw = typeof matched.path === "string" ? matched.path : "/";
  return {
    name: typeof matched.name === "string" ? matched.name : null,
    path: appPathOf(raw, base),
    params: pathParamsOf(matched),
    query: queryOf(matched),
    route: leaf,
  };
};

let appLayout: string | null = null;

/** What the container at `position` draws now, following the route and the app's default layout. */
export const outletAt = (position: OutletPosition): Outlet => resolveOutlet(currentMatch.value, position, appLayout);

/**
 * What runs an app on a surface: the adapter types it has and its default, where the arguments come
 * from, the history the routes follow, and how the view is put up and taken down. Each method has
 * what a host with no surface does (a test's): the app's argument defaults, a history in memory,
 * nothing to mount, nothing to leave; a host overrides what it changes. Its methods answer
 * promises rather than being `async` (scriptc dispatches no async override).
 */
export class AppHost implements StoreHost {
  readonly name: string = "none";
  adapters: readonly AdapterType[] = [];
  defaultAdapter: string = "memory";
  /** Open every store, the memory adapter type for each when `memoryOnly` (a test's run); a host that keeps rows sets its own in its constructor. */
  openStores: (manifest: AppManifest, memoryOnly: boolean) => Promise<RunStore>;

  constructor() {
    this.openStores = (_manifest: AppManifest, _memoryOnly: boolean) => Promise.reject(new Error(`The ${this.name} host opens no stores`));
  }
  /** The app's argument values, from the host's source (argv, the URL); a host with no source answers none. */
  args(_app: App): Record<string, unknown> {
    return {};
  }

  /** The history the routes follow. */
  history(): RouterAdapter {
    return createMemoryAdapter("/");
  }

  /** Whether the page on screen was rendered ahead of time; only a host with a page answers true. */
  prerendered(): boolean {
    return false;
  }

  /** What the host adds to the router's options (its locales, its origin, a tracker for a route change's work, a navigation hook); none by default. */
  routerOptions(): RouterOptions {
    return {};
  }

  /** The run's router exists and has its first route, before the root view mounts; nothing by default. */
  routed(_router: RouterCore): void {
    return;
  }

  /** Clear the prerender flag before a client navigation; nothing without one. */
  clearPrerendered(): void {
    return;
  }

  /** Run `apply` inside the host's transition, then wait for its surface to draw; by default it just runs `apply`. */
  transition(apply: () => Promise<void> | void, _route?: RouteTransition): Promise<void> {
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
}

let running: AppRun | null = null;

/** What a target may carry: the route's path params and the query to append. */
export interface TargetOptions {
  /** A route name's path params, each encoded into its `:name`; a missing one throws. */
  params?: Record<string, string | number>;
  /** The query to append to the path. */
  query?: Record<string, unknown>;
}

const filledPath = (name: string, pattern: string, params: Record<string, string | number>): string =>
  pattern.replace(/:([A-Za-z0-9_]+)\*?/g, (_match: string, paramName: string): string => {
    const value = params[paramName];
    if (value === undefined || value === null) throw new Error(`The route "${name}" needs the param "${paramName}"`);
    return encodeURIComponent(String(value));
  });

const pathOf = (target: string, options: TargetOptions): string => {
  if (target.startsWith("/")) return target;
  const run = running;
  if (run === null || run.router === null) throw new Error(`no route table yet: href(${target}) needs a running app`);
  const pattern = run.router.namedRoutes.get(target);
  if (pattern === undefined) throw new Error(`no route named "${target}"`);
  return filledPath(target, pattern, options.params ?? {});
};

/** The app path for `target` (a path, or a route name with its params) with the query appended and the app's base before it. */
export const href = (target: string, options: TargetOptions = {}): string => appUrl(withQuery(pathOf(target, options), options.query));

const originOf = (site: string | undefined): string => {
  let origin = "";
  if (site !== undefined && site !== "") {
    try {
      origin = new URL(site).origin;
    } catch {
      origin = "";
    }
  }
  if (origin === "") {
    const scope = globalThis as unknown as { location?: { origin?: string } };
    const located = scope.location?.origin;
    if (located !== undefined && located !== "") origin = located;
  }
  if (origin === "") throw new Error("url() needs the app's url or a browser location");
  return origin;
};

/** `href(target, options)` as an absolute URL: the app's origin from its `url`, else the browser's location. */
export const url = (target: string, options: TargetOptions = {}): string => {
  const run = running;
  return `${originOf(run === null ? undefined : run.app.url)}${href(target, options)}`;
};

/** What a one-call navigation may override. */
export interface NavigateOptions extends TargetOptions {
  /** Run this navigation inside the host's transition (`true`), or plainly (`false`), whatever the app chose. */
  transition?: boolean;
  /** The element the navigation starts from; the web host morphs it into the next view's `data-morph` element. */
  from?: NavigationSource;
}

/** Go to a path or a route name (with its params and query) in the app running now; nothing without routes. `options.transition` overrides the app's choice for this call. */
export const navigate = (target: string, options: NavigateOptions = {}): void => {
  const run = running;
  if (run === null || run.router === null) return;
  run.go(withQuery(pathOf(target, options), options.query), options.transition, options.from);
};

/** An app running on a host. */
export class AppRun {
  readonly manifest: AppManifest;
  readonly host: AppHost;
  /** Every store in a test is memory. */
  readonly memoryOnly: boolean;
  store: RunStore | null = null;
  controllers: readonly unknown[] = [];
  router: RouterCore | null = null;
  private following: (() => void) | null = null;
  private overrideTransition: boolean | undefined = undefined;
  private overrideFrom: NavigationSource | undefined = undefined;
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
    setAppBase(this.app.base);
    appLayout = this.app.layout ?? null;
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

  /** Write the matched route into `currentMatch`, `currentRoute`, `currentView` and `currentParams`, and reset the page head from its leaf. */
  private applyRoute(matched: MatchedRoute): void {
    const params = paramsOf(matched);
    const leaf = leafRoute(matched);
    const path = typeof matched.path === "string" ? matched.path : "/";
    setRouteHead(this.app, leaf, params, path);
    currentMatch.value = matched;
    currentRoute.value = routeStateOf(matched, this.app.base);
    currentParams.value = params;
    currentView.value = viewOf(leaf);
  }

  /** Apply a route change, through the host's transition when the app asks for one or this call overrides it; then let the host move focus. */
  private followRoute(matched: MatchedRoute): void {
    const apply = (): void => this.applyRoute(matched);
    const after = (): Promise<void> => this.host.routeChanged(this, false);
    const transition = this.overrideTransition ?? this.app.transitions;
    const route: RouteTransition = {
      path: typeof matched.path === "string" ? matched.path : "/",
      from: this.overrideFrom,
      href: this.router?.adapter.getLocation().href,
    };
    if (transition) void this.host.transition(apply, route).then(after);
    else {
      apply();
      void after();
    }
  }

  private route(): void {
    const routes = this.manifest.routes;
    currentMatch.value = null;
    currentRoute.value = null;
    currentView.value = null;
    currentParams.value = {};
    if (routes === null) {
      setAppHead(this.app);
      return;
    }
    const router = new RouterCore(this.host.history(), { plugins: [] });
    // The first match happens inside `init`; every later one reaches the subscriber.
    let initial = true;
    const extra = this.host.routerOptions();
    router.init(routes, {
      isProduction: extra.isProduction,
      navigation: extra.navigation,
      locales: extra.locales,
      defaultLocale: extra.defaultLocale,
      origin: extra.origin,
      track: extra.track,
      beforeNavigate: extra.beforeNavigate,
      appName: this.app.name,
      basePath: this.app.base,
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
    currentMatch.value = router.currentRoute;
    currentRoute.value = routeStateOf(router.currentRoute, this.app.base);
    currentParams.value = paramsOf(router.currentRoute);
    currentView.value = viewOf(leafRoute(router.currentRoute));
    this.router = router;
    this.host.routed(router);
  }

  /** Go to `path`, choosing whether this one navigation uses the host's transition and where it starts from. */
  go(path: string, transition?: boolean, from?: NavigationSource): void {
    const router = this.router;
    if (router === null) return;
    this.overrideTransition = transition;
    this.overrideFrom = from;
    try {
      router.go(path);
    } finally {
      this.overrideTransition = undefined;
      this.overrideFrom = undefined;
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
    currentRoute.value = null;
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
