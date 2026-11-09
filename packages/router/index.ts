/**
 * @lightstart/router: a client router. It matches `/`-separated route
 * patterns without URLPattern, keeps a navigation stack over a browser or
 * memory adapter, localizes paths, and exposes light's `Navigation` contract
 * through `router.navigation`.
 */

export { RouterCore, RouterCore as default } from "./core.ts";
export { Logger, MemoryLogger } from "./logger.ts";
export { applyPlugins, createMemoryRouter, createPlatformRouter, createRouter } from "./app.ts";
export {
  FlatRoute, FlattenedRoutes, MatchedRoute, RouteEntry, RouteTable,
  compileRoutes, createPatternString, flattenRoutes, matchRoute,
} from "./matcher.ts";
export { createBrowserAdapter, BrowserAdapter } from "./adapters/browser.ts";
export { createMemoryAdapter, MemoryAdapter } from "./adapters/memory.ts";
export { NavigationBridge } from "./navigation.ts";
export { interceptedPath } from "./click.ts";
export type { ClickEvent, ClickLocation } from "./click.ts";
export { listen } from "./listen.ts";
export { localeOfPath, stripLocale, withLocale } from "./locale.ts";
export { normalizeBasePath, stripBase, withBase, withQuery } from "./url.ts";
export type {
  AdapterLocation, HistoryEntry, MediaRedirect, RouteConfig, RouteSubscriber,
  RouteValue, RouterAdapter, RouterOptions, RouterPlugin, RoutesMap, StackEntry,
} from "./contracts.ts";
