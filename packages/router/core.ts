/**
 * @lightstart/router/core: the platform-neutral router. It matches a
 * route, keeps the navigation stack, localizes paths, builds URLs, follows
 * redirects and actions, and tells every subscriber after a change. An
 * adapter supplies the location and history; the router itself touches no
 * browser global.
 */

import { interceptedPath } from "./click.ts";
import type { ClickEvent, ClickLocation } from "./click.ts";
import { localeOfPath, stripLocale, withLocale } from "./locale.ts";
import { Logger } from "./logger.ts";
import { MatchedRoute, compileRoutes, flattenRoutes } from "./matcher.ts";
import type { RouteEntry, RouteTable } from "./matcher.ts";
import { NavigationBridge } from "./navigation.ts";
import { normalizeBasePath, withBase, withQuery } from "./url.ts";
import type {
  RouteConfig, RouteSubscriber, RouterAdapter, RouterOptions, RouterPlugin,
  RoutesMap, StackEntry,
} from "./contracts.ts";

const nextFrame = (): Promise<void> => new Promise<void>((resolve) => {
  const scope = globalThis as unknown as { requestAnimationFrame?: (callback: () => void) => unknown };
  if (typeof scope.requestAnimationFrame === "function") scope.requestAnimationFrame(() => resolve());
  else setTimeout(resolve, 0);
});

const mediaMatches = (media: string): boolean => {
  const scope = globalThis as unknown as { matchMedia?: (query: string) => { matches: boolean } };
  if (typeof scope.matchMedia !== "function") return false;
  return scope.matchMedia(media).matches;
};

const resolveOptions = (options: RouterOptions): RouterOptions => {
  const resolved: RouterOptions = {
    appName: "",
    basePath: "",
    isProduction: false,
    navigation: "spa",
    locales: [],
    defaultLocale: "en",
    onRouteChange: null,
    onTitleChange: null,
    ...options,
  };
  return resolved;
};

const populate = (matched: MatchedRoute, url: URL): void => {
  matched.path = url.pathname;
  matched.querystring = url.search;
  matched.hash = url.hash;
  const queryParams = Object.fromEntries(url.searchParams.entries()) as Record<string, string>;
  matched.queryParams = queryParams;
  matched.params = { ...queryParams, ...matched.params };
};

/** The router core: one instance per app, over one adapter. */
export class RouterCore {
  stack: StackEntry[] = [];
  routes: RouteEntry[] = [];
  namedRoutes: Map<string, string> = new Map();
  currentRoute: MatchedRoute | null = null;
  defaultTitle = "";
  options: RouterOptions = resolveOptions({});
  adapter: RouterAdapter;
  plugins: RouterPlugin[] = [];
  readonly navigation: NavigationBridge;
  private table: RouteTable | null = null;
  private subscribers: RouteSubscriber[] = [];

  logger: Logger;

  constructor(adapter: RouterAdapter, options: { plugins?: RouterPlugin[]; logger?: Logger } = {}) {
    this.adapter = adapter;
    this.plugins = options.plugins ?? [];
    this.logger = options.logger ?? new Logger();
    this.navigation = new NavigationBridge(this);
  }

  /** Send the router's complaints to `logger`; answers the router. */
  logTo(logger: Logger): RouterCore {
    this.logger = logger;
    return this;
  }

  init(routesConfig: RoutesMap, options: RouterOptions = {}): RouterCore {
    if (!routesConfig || Object.keys(routesConfig).length === 0) {
      this.logger.error("No routes provided");
      return this;
    }
    this.options = resolveOptions(options);
    const flat = flattenRoutes(routesConfig, "", null, this.logger);
    this.namedRoutes = flat.namedRoutes;
    this.defaultTitle = this.options.appName ?? "";
    let localized = false;
    for (const entry of flat.flatRoutes) if (entry.route.locale) localized = true;
    this.options.localized = localized;
    this.table = compileRoutes(flat.flatRoutes);
    this.routes = this.table.entries;

    const location = this.adapter.getLocation();
    const url = new URL(location.href, location.origin);
    const landed = this.matchRoute(this.normalizePath(url.pathname), {});
    const rule = landed !== null ? landed.route.mediaRedirect : null;
    if (rule && mediaMatches(rule.media)) {
      const to = `${this.localize(rule.to, landed?.route.locale)}${url.search}${url.hash}`;
      this.adapter.replaceState({ path: to }, withBase(this.options.basePath, to));
      this.setCurrentRoute(to, false);
      return this;
    }
    this.setCurrentRoute(location.href, false);
    return this;
  }

  refreshRoutes(routesConfig: RoutesMap): void {
    const flat = flattenRoutes(routesConfig, "", null, this.logger);
    this.namedRoutes = flat.namedRoutes;
    this.table = compileRoutes(flat.flatRoutes);
    this.routes = this.table.entries;
  }

  flattenRoutes(routesConfig: RoutesMap, basePath = "", parentRoute: RouteConfig | null = null) {
    return flattenRoutes(routesConfig, basePath, parentRoute, this.logger);
  }

  matchRoute(pathname?: string, extraParams?: Record<string, string>): MatchedRoute | null {
    if (this.table === null) return null;
    if (!pathname) {
      const location = this.adapter.getLocation();
      const url = new URL(location.pathname + (location.search ?? ""), location.origin);
      return this.table.match(this.normalizePath(url.pathname), extraParams ?? Object.fromEntries(url.searchParams.entries()));
    }
    return this.table.match(pathname, extraParams ?? {});
  }

  setCurrentRoute(path: string, pushState = true): void {
    if (this.table === null || this.routes.length === 0) {
      this.logger.warn("setCurrentRoute called but routes not initialized yet");
      return;
    }
    const location = this.adapter.getLocation();
    const url = new URL(path, location.origin);
    const normalized = this.normalizePath(url.pathname);
    const matched = this.matchRoute(normalized, Object.fromEntries(url.searchParams.entries()));
    if (matched === null) {
      this.logger.warn(`Route not found: ${normalized}`);
      if (pushState) this.go("/");
      return;
    }

    populate(matched, url);

    const hook = this.options.beforeNavigate;
    if (typeof hook === "function" && hook(path, matched)) return;

    const action = matched.route.action;
    if (typeof action === "function") {
      action(matched.params);
      return;
    }
    const redirect = matched.route.redirect;
    if (typeof redirect === "string") {
      this.go(this.localize(redirect, matched.route.locale));
      return;
    }

    this.currentRoute = matched;
    const newTitle = this.titleOf(matched.route.title);
    if (!this.isPrerendered()) this.setTitle(newTitle);

    if (pushState) {
      this.pushToStack(path, matched.params, newTitle);
      this._pushState(path, { path });
    } else {
      if (this.stack.length === 0) this.pushToStack(path, matched.params, newTitle);
      this.updateCurrentRoute(this.currentRoute);
    }
  }

  handleHistoryNavigation(): void {
    this.markNotPrerendered();
    const location = this.adapter.getLocation();
    const currentPath = location.href;
    for (let i = 0; i < this.stack.length; i++) {
      if (this.normalizePath(this.stack[i].path) === this.normalizePath(currentPath)) {
        this.truncateStack(i);
        break;
      }
    }
    this.setCurrentRoute(currentPath, false);
  }

  create(routeName: string, params: Record<string, unknown> = {}): string | null {
    if (!routeName) {
      this.logger.error("Route name required");
      return null;
    }
    const pathPattern = this.namedRoutes.get(routeName);
    if (pathPattern === undefined) {
      this.logger.error(`Named route not found: ${routeName}`);
      return null;
    }
    const pathParams: Record<string, unknown> = { ...params };
    const used: string[] = [];
    const finalPath = pathPattern.replace(/:(\w+)/g, (match: string, paramName: string): string => {
      const value = pathParams[paramName];
      if (value !== undefined && value !== null) {
        used.push(paramName);
        return String(value);
      }
      this.logger.warn(`Param not provided: ${paramName} for route ${routeName}`);
      return match;
    });
    const pairs: Array<[string, string]> = [];
    for (const [key, value] of Object.entries(pathParams)) {
      if (used.indexOf(key) >= 0) continue;
      pairs.push([key, String(value)]);
    }
    const query = new URLSearchParams(pairs).toString();
    return query ? `${finalPath}?${query}` : finalPath;
  }

  go(routeNameOrPath: string, params?: Record<string, unknown>, locale?: string): void {
    this.markNotPrerendered();
    const isNamedRoute = !!params || this.namedRoutes.has(routeNameOrPath);
    const path = isNamedRoute ? this.create(routeNameOrPath, params) : routeNameOrPath;
    if (path !== null) this.setCurrentRoute(this.localize(path, locale), true);
  }

  replace(routeNameOrPath: string, params?: Record<string, unknown>, locale?: string): void {
    const isNamedRoute = !!params || this.namedRoutes.has(routeNameOrPath);
    const resolved = isNamedRoute ? this.create(routeNameOrPath, params) : routeNameOrPath;
    if (resolved === null) return;
    const path = this.localize(resolved, locale);
    const location = this.adapter.getLocation();
    const url = new URL(path, location.origin);
    const normalized = this.normalizePath(url.pathname);
    const matched = this.matchRoute(normalized, Object.fromEntries(url.searchParams.entries()));
    if (matched === null) {
      this.logger.warn(`Route not found: ${normalized}`);
      return;
    }
    populate(matched, url);
    this.currentRoute = matched;
    const newTitle = this.titleOf(matched.route.title);
    this.setTitle(newTitle);
    this.adapter.replaceState({ path }, withBase(this.options.basePath, path));
    this.updateCurrentRoute(this.currentRoute);
  }

  forward(): void {
    const navigated = this.adapter.forward();
    if (this.adapter.type === "memory" && navigated) this.handleHistoryNavigation();
  }

  back(): void {
    if (this.stack.length <= 1) {
      this.home();
      return;
    }
    this.stack = this.stack.slice(0, -1);
    const navigated = this.adapter.back();
    if (this.adapter.type === "memory" && navigated) this.handleHistoryNavigation();
  }

  home(): void {
    this.stack = [];
    this.go("/");
  }

  _pushState(path: string, state: unknown = {}): void {
    const location = this.adapter.getLocation();
    const pathWithBase = withBase(this.options.basePath, path);
    const fullUrl = new URL(pathWithBase, location.origin).href;
    if (!this.adapter.isSamePath(fullUrl)) this.adapter.pushState(state, pathWithBase);
    if (this.currentRoute !== null) this.updateCurrentRoute(this.currentRoute);
  }

  pushToStack(path: string, params: Record<string, string> = {}, title?: string): void {
    const entry: StackEntry = { path, params, title: title ?? this.defaultTitle };
    if (this.normalizePath(path) === "/") this.stack = [entry];
    else this.stack = [...this.stack, entry];
  }

  setTitle(newTitle: string): void {
    const fullTitle = newTitle && this.options.appName ? `${newTitle} | ${this.options.appName}` : newTitle || this.options.appName || "";
    this.adapter.setTitle(fullTitle);
    const last = this.stack[this.stack.length - 1];
    if (last !== undefined) this.stack = [...this.stack.slice(0, -1), { path: last.path, params: last.params, title: newTitle }];
    if (this.currentRoute !== null && this.currentRoute.route) this.currentRoute.route = { ...this.currentRoute.route, title: newTitle };
    const changed = this.options.onTitleChange;
    if (typeof changed === "function") changed(fullTitle);
  }

  subscribe(keyOrCallback: string | RouteSubscriber, callback?: RouteSubscriber): () => void {
    const listener: RouteSubscriber | undefined = typeof keyOrCallback === "function" ? keyOrCallback : callback;
    if (listener === undefined) return (): void => {};
    this.subscribers.push(listener);
    return (): void => {
      const at = this.subscribers.indexOf(listener);
      if (at >= 0) this.subscribers.splice(at, 1);
    };
  }

  get(key: string): unknown {
    if (key === "currentRoute") return this.currentRoute;
    return undefined;
  }

  updateCurrentRoute(route: MatchedRoute): void {
    route.root = this.isRoot();
    this.currentRoute = route;
    const track = this.options.track;
    if (typeof track === "function") track(nextFrame(), `router:${route.path ?? "/"}`);
    const listeners = this.subscribers.slice();
    for (const listener of listeners) {
      try {
        listener(route);
      } catch (error) {
        this.logger.error("Subscriber error", error);
      }
    }
    const changed = this.options.onRouteChange;
    if (typeof changed === "function") changed(route);
  }

  isRoot(): boolean {
    return this.stack.length <= 1;
  }

  truncateStack(index = 0): void {
    this.stack = this.stack.slice(0, index + 1);
  }

  href(path: string, query?: Record<string, unknown>, locale?: string): string {
    return withBase(this.options.basePath, withQuery(this.localize(path, locale), query));
  }

  url(path: string, query?: Record<string, unknown>, locale?: string): string {
    const origin = (this.options.origin ?? this.adapter.getLocation().origin).replace(/\/+$/, "");
    return `${origin}${this.href(path, query, locale)}`;
  }

  localize(path: string, locale?: string): string {
    const localized = this.options.localized;
    const locales = this.options.locales ?? [];
    const defaultLocale = this.options.defaultLocale ?? "en";
    if (!localized || !path.startsWith("/")) return path;
    if (!locale && localeOfPath(path, locales)) return path;
    return withLocale(path, locale ?? this.currentRoute?.route.locale ?? defaultLocale, locales, defaultLocale);
  }

  localeOf(path: string): string | undefined {
    const localized = this.options.localized;
    const locales = this.options.locales ?? [];
    const defaultLocale = this.options.defaultLocale ?? "en";
    if (!localized) return undefined;
    return localeOfPath(path, locales) ?? defaultLocale;
  }

  titleOf(title: string | (() => string) | undefined): string {
    return (typeof title === "function" ? title() : title) || this.defaultTitle;
  }

  get path(): string {
    return this.normalizePath(this.adapter.getLocation().pathname);
  }

  get routePath(): string {
    return stripLocale(this.path, this.options.locales ?? []);
  }

  get query(): Record<string, string> {
    return Object.fromEntries(new URLSearchParams(this.adapter.getLocation().search ?? "").entries()) as Record<string, string>;
  }

  normalizePath(path = "/"): string {
    let normalized = path.split("?")[0].split("#")[0];
    const base = normalizeBasePath(this.options.basePath);
    if (base && (normalized === base || normalized.startsWith(`${base}/`))) normalized = normalized.slice(base.length) || "/";
    return (normalized || "/").replace(/\/+$/, "") || "/";
  }

  click(event: ClickEvent, options: { external?: boolean } = {}): boolean {
    if (options.external) return false;
    const current = this.adapter.getLocation();
    const location: ClickLocation = { origin: current.origin, pathname: current.pathname };
    const path = interceptedPath(event, location);
    if (path === null) return false;
    if (typeof event.preventDefault === "function") event.preventDefault();
    this.go(path);
    return true;
  }

  private isPrerendered(): boolean {
    const check = this.options.prerendered;
    return typeof check === "function" && check();
  }

  private markNotPrerendered(): void {
    const clear = this.options.clearPrerendered;
    if (typeof clear === "function") {
      clear();
      return;
    }
    const adapterClear = this.adapter.clearPrerendered;
    if (typeof adapterClear === "function") adapterClear();
  }
}

export default RouterCore;
