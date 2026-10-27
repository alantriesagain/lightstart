/**
 * @bootstrapp/router: Core Implementation
 * Platform-agnostic router logic with plugin system.
 */

import { ROUTER_CHANGED } from "./events.js";
import {
  matchRoute as _matchRoute,
  compileRoutes,
  flattenRoutes,
} from "./matcher.js";
import { normalizeBasePath, siteOrigin, withBase, withQuery } from "/app/url/index.js";
import { localeOfPath, stripLocale, withLocale } from "./locale.js";
import $APP from "/app/base/app.js";

const nextFrame = () =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame !== "function") return void setTimeout(resolve, 0);
    requestAnimationFrame(() => resolve(undefined));
  });

/**
 * @import {
 *   RouterAdapter, RouterCore, RouterPlugin, RouterOptions,
 *   RouteSubscriber, RoutesMap, MatchedRoute, StackEntry,
 * } from "./types.js"
 */

/**
 * @param {MatchedRoute} matched
 * @param {URL} url
 */
function populateMatchedRoute(matched, url) {
  matched.path = url.pathname;
  matched.querystring = url.search;
  matched.hash = url.hash;
  matched.queryParams = Object.fromEntries(url.searchParams.entries());
  matched.params = { ...matched.queryParams, ...matched.params };
}

/**
 * @param {RouterAdapter} adapter
 * @param {{ plugins?: RouterPlugin[] }} [options]
 * @returns {RouterCore}
 */
export function createRouterCore(adapter, options = {}) {
  const plugins = options.plugins || [];
  /** @type {Set<RouteSubscriber>} */
  const subscribers = new Set();

  /** @type {RouterCore} */
  const router = {
    stack: [],
    routes: [],
    namedRoutes: {},
    currentRoute: null,
    defaultTitle: "",
    options: {},
    adapter,
    plugins,

    flattenRoutes(routes, basePath = "", parentRoute = null) {
      return flattenRoutes(routes, basePath, parentRoute);
    },

    /** @param {RoutesMap} routes */
    refreshRoutes(routes) {
      const { flatRoutes, namedRoutes } = this.flattenRoutes(routes);
      this.routes = compileRoutes(flatRoutes);
      this.namedRoutes = namedRoutes;
    },

    init(routesConfig, options = {}) {
      if (!routesConfig || !Object.keys(routesConfig).length) {
        console.error("[router] No routes provided");
        return this;
      }

      this.options = {
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

      const { flatRoutes, namedRoutes } = this.flattenRoutes(routesConfig);
      this.namedRoutes = namedRoutes;
      this.defaultTitle = this.options.appName || "";
      this.options.localized = Object.values(flatRoutes).some((route) => !!route?.locale);

      this.routes = compileRoutes(flatRoutes, (err) => {
        console.error(`[router] Pattern error for ${err.path}:`, err.error);
      });

      const location = this.adapter.getLocation();
      const url = new URL(location.href, location.origin);
      const landed = this.matchRoute(this.normalizePath(url.pathname), {});
      const rule = landed?.route.mediaRedirect;
      if (rule && globalThis.matchMedia?.(rule.media).matches) {
        const to = `${this.localize(rule.to, landed.route.locale)}${url.search}${url.hash}`;
        this.adapter.replaceState({ path: to }, withBase(this.options.basePath, to));
        this.setCurrentRoute(to, false);
        return this;
      }

      this.setCurrentRoute(location.href, false);

      return this;
    },

    matchRoute(pathname, extraParams) {
      if (!pathname) {
        const location = this.adapter.getLocation();
        const url = new URL(location.pathname + (location.search ?? ""), location.origin);
        return _matchRoute(
          this.routes,
          this.normalizePath(url.pathname),
          extraParams ?? Object.fromEntries(url.searchParams.entries()),
        );
      }
      return _matchRoute(this.routes, pathname, extraParams);
    },

    setCurrentRoute(path, pushState = true) {
      if (!this.routes.length) {
        console.warn(
          "[router] setCurrentRoute called but routes not initialized yet",
        );
        return;
      }

      const location = this.adapter.getLocation();
      const url = new URL(path, location.origin);
      const normalizedPathname = this.normalizePath(url.pathname);
      const matched = this.matchRoute(normalizedPathname, Object.fromEntries(url.searchParams.entries()));
      if (!matched) {
        console.warn(`[router] Route not found: ${normalizedPathname}`);
        return pushState ? this.go("/") : null;
      }

      if (
        matched.route.ssg &&
        this.options.isProduction &&
        this.options.navigation === "mpa" &&
        this.adapter.type === "browser" &&
        !this.adapter.isSamePath(path)
      ) {
        this.adapter.hardNavigate(withBase(this.options.basePath, path));
        return;
      }

      populateMatchedRoute(matched, url);

      if (matched.route.action) return matched.route.action(matched.params);
      if (matched.route.redirect) return this.go(this.localize(matched.route.redirect, matched.route.locale));

      this.currentRoute = matched;
      const newTitle = this.titleOf(matched.route.title);

      if (!(typeof window !== "undefined" && window.__PRERENDERED__))
        this.setTitle(newTitle);

      if (pushState) {
        this.pushToStack(path, matched.params, newTitle);
        this._pushState(path, { path });
      } else {
        if (!this.stack.length) this.pushToStack(path, matched.params, newTitle);
        this.updateCurrentRoute(this.currentRoute);
      }
    },

    handleHistoryNavigation() {
      if (this.adapter.type === "browser" && typeof window !== "undefined")
        window.__PRERENDERED__ = false;

      const location = this.adapter.getLocation();
      const currentPath = location.href;
      const stackIndex = this.stack.findIndex(
        (item) =>
          this.normalizePath(item.path) === this.normalizePath(currentPath),
      );
      if (stackIndex !== -1)
        this.truncateStack(stackIndex);

      this.setCurrentRoute(currentPath, false);
    },

    create(routeName, params = {}) {
      if (!routeName) {
        console.error("[router] Route name required");
        return /** @type {never} */ (null);
      }

      const pathPattern = this.namedRoutes[routeName];
      if (!pathPattern) {
        console.error(`[router] Named route not found: ${routeName}`);
        return /** @type {never} */ (null);
      }

      let finalPath = pathPattern;
      const pathParams = { ...params };

      finalPath = finalPath.replace(/:(\w+)/g, (match, paramName) => {
        if (
          pathParams[paramName] !== undefined &&
          pathParams[paramName] !== null
        ) {
          const value = pathParams[paramName];
          delete pathParams[paramName];
          return String(value);
        }
        console.warn(
          `[router] Param not provided: ${paramName} for route ${routeName}`,
        );
        return match;
      });

      const queryParams = new URLSearchParams(
        /** @type {Record<string, string>} */ (
          Object.fromEntries(
            Object.entries(pathParams).map(([k, v]) => [k, String(v)]),
          )
        ),
      ).toString();
      const fullPath = queryParams ? `${finalPath}?${queryParams}` : finalPath;
      return fullPath;
    },

    go(routeNameOrPath, params, locale) {
      if (this.adapter.type === "browser" && typeof window !== "undefined")
        window.__PRERENDERED__ = false;

      const isNamedRoute = !!params || this.namedRoutes[routeNameOrPath];
      const path = isNamedRoute
        ? this.create(routeNameOrPath, params)
        : routeNameOrPath;
      if (path !== null)
        this.setCurrentRoute(this.localize(path, locale), true);

    },

    replace(routeNameOrPath, params, locale) {
      const isNamedRoute = !!params || this.namedRoutes[routeNameOrPath];
      const resolved = isNamedRoute
        ? this.create(routeNameOrPath, params)
        : routeNameOrPath;

      if (resolved === null) return;
      const path = this.localize(resolved, locale);

      const location = this.adapter.getLocation();
      const url = new URL(path, location.origin);
      const normalizedPathname = this.normalizePath(url.pathname);
      const matched = this.matchRoute(normalizedPathname, Object.fromEntries(url.searchParams.entries()));

      if (!matched) return void console.warn(`[router] Route not found: ${normalizedPathname}`);

      populateMatchedRoute(matched, url);

      this.currentRoute = matched;
      const newTitle = this.titleOf(matched.route.title);
      this.setTitle(newTitle);

      this.adapter.replaceState({ path }, withBase(this.options.basePath, path));
      this.updateCurrentRoute(this.currentRoute);
    },

    forward() {
      const didNavigate = this.adapter.forward();

      if (this.adapter.type === "memory" && didNavigate)
        this.handleHistoryNavigation();

    },

    home() {
      this.stack = [];
      this.go("/");
    },

    back() {
      if (this.stack.length <= 1) return this.home();
      this.stack = this.stack.slice(0, -1);
      const didNavigate = this.adapter.back();

      if (this.adapter.type === "memory" && didNavigate)
        this.handleHistoryNavigation();

    },

    _pushState(path, state = {}) {
      const location = this.adapter.getLocation();
      const pathWithBase = withBase(this.options.basePath, path);
      const fullUrl = new URL(pathWithBase, location.origin).href;
      if (!this.adapter.isSamePath(fullUrl))
        this.adapter.pushState(state, pathWithBase);

      if (this.currentRoute) this.updateCurrentRoute(this.currentRoute);
    },

    pushToStack(path, params = {}, title) {
      const newItem = { path, params, title: title ?? this.defaultTitle };
      if (this.normalizePath(path) === "/")
        this.stack = [newItem];
       else
        this.stack = [...this.stack, newItem];
    },

    setTitle(newTitle) {
      const fullTitle =
        newTitle && this.options.appName
          ? `${newTitle} | ${this.options.appName}`
          : newTitle || this.options.appName || "";

      this.adapter.setTitle(fullTitle);

      if (this.stack.length > 0) {
        const updated = [...this.stack];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          title: newTitle,
        };
        this.stack = updated;
      }

      if (this.currentRoute?.route) {
        const cur = this.currentRoute;
        this.currentRoute = {
          ...cur,
          route: { ...cur.route, title: newTitle },
        };
      }

      if (this.options.onTitleChange)
        this.options.onTitleChange(fullTitle);
    },

    subscribe(keyOrCallback, callback) {
      const fn = typeof keyOrCallback === "function" ? keyOrCallback : callback;
      if (!fn) return () => {};
      subscribers.add(fn);
      return () => { subscribers.delete(fn); };
    },

    get(key) {
      if (key === "currentRoute") return this.currentRoute;
      return undefined;
    },

    updateCurrentRoute(route) {
      const updated = { ...route, root: this.isRoot() };
      this.currentRoute = updated;
      $APP.settle.wrap(nextFrame(), `router:${updated.path}`);
      subscribers.forEach((fn) => {
        try {
          fn(updated);
        } catch (e) {
          console.error("[router] Subscriber error:", e);
        }
      });

      if (this.options.onRouteChange)
        this.options.onRouteChange(updated);
      $APP.events.emit(ROUTER_CHANGED, { path: updated.path, params: updated.params });
    },

    isRoot() {
      return this.stack.length <= 1;
    },

    truncateStack(index = 0) {
      this.stack = this.stack.slice(0, index + 1);
    },

    /**
     * The URL to put in an `<a href>` for an internal route path. On a root
     * deploy this is the identity; under a base path it is the only correct
     * spelling, since a bare `/route` would leave the deploy entirely.
     *
     * @param {string} path
     * @param {Record<string, unknown>} [query]
     * @param {string} [locale] The locale to read it in; the reader's when omitted.
     * @returns {string}
     */
    href(path, query, locale) {
      return withBase(this.options.basePath, withQuery(this.localize(path, locale), query));
    },

    /**
     * The absolute URL of an internal route path, for what leaves the page: a
     * share sheet, a message, a QR code. `href()` under the site's origin.
     *
     * @param {string} path
     * @param {Record<string, unknown>} [query]
     * @param {string} [locale]
     * @returns {string}
     */
    url(path, query, locale) {
      return `${siteOrigin()}${this.href(path, query, locale)}`;
    },

    /**
     * A route path read in a locale: the one given, else the current route's,
     * else the default. A path that already names a locale is kept, which is
     * how a language switch crosses from one locale to another; a bare path
     * stays in the reader's. Nothing happens in an app without localized routes.
     *
     * @param {string} path
     * @param {string} [locale]
     * @returns {string}
     */
    localize(path, locale) {
      const { localized, locales = [], defaultLocale = "en" } = this.options;
      if (!localized || !path.startsWith("/")) return path;
      if (!locale && localeOfPath(path, locales)) return path;
      return withLocale(path, locale ?? this.currentRoute?.route?.locale ?? defaultLocale, locales, defaultLocale);
    },

    /**
     * The locale a path is read in: the one it names, else the default; nothing
     * in an app without localized routes. `go(path, undefined, localeOf(path))`
     * navigates to a path exactly as spelled, whatever locale the reader is in,
     * which is what a crawler wants.
     * @param {string} path
     * @returns {string | undefined}
     */
    localeOf(path) {
      const { localized, locales = [], defaultLocale = "en" } = this.options;
      if (!localized) return undefined;
      return localeOfPath(path, locales) ?? defaultLocale;
    },

    /** @param {string | (() => string) | undefined} title */
    titleOf(title) {
      return (typeof title === "function" ? title() : title) || this.defaultTitle;
    },

    get path() {
      return this.normalizePath(this.adapter.getLocation().pathname);
    },

    get routePath() {
      return stripLocale(this.path, this.options.locales ?? []);
    },

    get query() {
      return Object.fromEntries(new URLSearchParams(this.adapter.getLocation().search ?? "").entries());
    },

    normalizePath(path = "/") {
      let normalized = path.split("?")[0].split("#")[0];
      const base = normalizeBasePath(this.options.basePath);
      if (base && (normalized === base || normalized.startsWith(`${base}/`)))
        normalized = normalized.slice(base.length) || "/";

      return (normalized || "/").replace(/\/+$/, "") || "/";
    },

    handleLinkClick(e, options = {}) {
      const { external = false } = options;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1)
        return false;

      const link = /** @type {HTMLAnchorElement | null} */ (e.currentTarget);
      if (!link?.href) return false;

      const location = this.adapter.getLocation();
      const isLocal = link.origin === location.origin && !external;

      if (isLocal) {
        e.preventDefault();
        const path = [link.pathname, link.search, link.hash].filter(Boolean).join("");
        this.go(path);
        return true;
      }

      return false;
    },
  };

  for (const plugin of plugins)
    if (typeof plugin === "function") {
      const result = plugin(router);
      if (result && typeof result === "object")
        Object.assign(router, result);

    }

  return router;
}

export default createRouterCore;
