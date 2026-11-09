/**
 * @lightstart/router/contracts: the route table, matcher, adapter, option and
 * router core shapes. The native graph imports this file.
 */

import type { RouterCore } from "./core.ts";
import type { MatchedRoute } from "./matcher.ts";

export type { MatchedRoute } from "./matcher.ts";

/** A page-load redirect taken while a media query matches. */
export interface MediaRedirect {
  media: string;
  to: string;
}

/** One route's configuration. Extra fields are kept untouched. */
export interface RouteConfig {
  /** Pattern path, set from the routes map key during flatten. */
  path?: string;
  /** Named-route key, used by `create(name, params)`. */
  name?: string;
  /** Page title; a function is read at navigation. */
  title?: string | (() => string);
  /** Hard-redirect target path on match. */
  redirect?: string;
  /** Fire-and-forget action invoked on match. */
  action?: (params: Record<string, string>) => unknown;
  /** Where a page that loads on this route goes while `media` matches. */
  mediaRedirect?: MediaRedirect | null;
  /** Render at static-site-generation time. */
  ssg?: boolean;
  /** Render at client time. */
  spa?: boolean;
  /** Locale tag stamped by localized route expansion. */
  locale?: string;
  /** Nested routes, joined relative to this route's path. */
  routes?: RoutesMap;
  /** Optional positional param suffix list. */
  namedParams?: string[];
  /** Back-reference to the parent route, set by flatten. */
  parent?: RouteConfig | null;
  /** Any field a framework keeps on the route, such as `component`. */
  [key: string]: unknown;
}

/** A route can also be a bare render function. */
export type RouteValue = RouteConfig | ((params: Record<string, string>) => unknown);

/** The route table an app declares. */
export type RoutesMap = Record<string, RouteValue>;

/** One navigation stack entry. */
export interface StackEntry {
  path: string;
  params: Record<string, string>;
  title: string;
}

/** Called after every route change. */
export type RouteSubscriber = (route: MatchedRoute) => void;

/** A browser or memory location. */
export interface AdapterLocation {
  href: string;
  origin: string;
  pathname: string;
  search: string;
  hash: string;
}

/** One memory-adapter history entry. */
export interface HistoryEntry {
  pathname: string;
  search: string;
  hash: string;
  state?: unknown;
}

/** The platform seam the router works through. */
export interface RouterAdapter {
  type: "browser" | "memory";
  getLocation(): AdapterLocation;
  isSamePath(path: string): boolean;
  hardNavigate(path: string): void;
  pushState(state: unknown, path: string): void;
  replaceState(state: unknown, path: string): void;
  back(): boolean | void;
  forward(): boolean | void;
  setTitle(title: string): void;
  /** Clears the app's prerender flag, when it has one. */
  clearPrerendered?(): void;
  /** Memory adapter only: exposes history for inspection. */
  getHistory?(): { entries: HistoryEntry[]; index: number };
}

/** The options `init` reads. */
export interface RouterOptions {
  appName?: string;
  basePath?: string;
  isProduction?: boolean;
  /** `"spa"` soft-navigates; `"mpa"` is a value a hook may read. */
  navigation?: string;
  /** The locales the app ships. */
  locales?: string[];
  /** The locale that carries no prefix. */
  defaultLocale?: string;
  /** Set by `init`: whether any route is a locale variant. */
  localized?: boolean;
  /** The origin `url()` builds on, falling back to the adapter's location. */
  origin?: string;
  /** Answers whether the page on screen is prerendered. */
  prerendered?: () => boolean;
  /** Clears the prerender flag before a client navigation. */
  clearPrerendered?: () => void;
  /** Counts the next-frame work of a route change under its label. */
  track?: (work: Promise<unknown>, label: string) => void;
  /** An early navigation hook: true means it handled the navigation. */
  beforeNavigate?: (path: string, matched: MatchedRoute) => boolean;
  onRouteChange?: ((route: MatchedRoute) => void) | null;
  onTitleChange?: ((fullTitle: string) => void) | null;
}

/** A plugin receives the router and may add members to it. */
export type RouterPlugin = (router: RouterCore) => Partial<Record<string, unknown>> | void;
