/**
 * @lightstart/router/matcher: a segment matcher with no URLPattern. A
 * pattern is `/`-separated segments: a literal, a `:name` parameter (one
 * non-empty segment), optional trailing `name/:name` pairs from
 * `namedParams`, or a trailing wildcard spelled `:rest*` or `*`. Literal
 * segments are tried before parameters and parameters before wildcards,
 * deeper matches before shallower ones; a pattern with no dynamic part is
 * answered by one `Map` lookup and the rest by a segment trie.
 */

import type { RouteConfig, RoutesMap } from "./contracts.ts";
import { Logger } from "./logger.ts";

/** One flattened route: its config and the full path it was declared under. */
export class FlatRoute {
  readonly route: RouteConfig;
  readonly path: string;

  constructor(route: RouteConfig, path: string) {
    this.route = route;
    this.path = path;
  }
}

/** The product of flattening a nested table. */
export class FlattenedRoutes {
  readonly flatRoutes: FlatRoute[] = [];
  readonly namedRoutes: Map<string, string> = new Map();
}

const canonical = (pathname: string): string => {
  const bare = pathname.split("?")[0].split("#")[0];
  const trimmed = bare.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
};

/** The URLPattern spelling of a route, optional named-param pairs included. */
export const createPatternString = (route: RouteConfig): string => {
  let path = route.path ?? "";
  if (route.namedParams && route.namedParams.length > 0) {
    const optional = route.namedParams.map((name: string): string => `/${name}/:${name}`).join("");
    path += `(${optional})?`;
  }
  return path;
};

/** One compiled route pattern. */
export class RouteEntry {
  readonly route: RouteConfig;
  readonly pattern: string;
  readonly segments: string[] = [];
  readonly wildcard: string | null;
  readonly optional: string[] = [];
  readonly exact: boolean;

  constructor(route: RouteConfig, pattern: string) {
    this.route = route;
    this.pattern = pattern;
    const raw = pattern === "/" || pattern === "" ? [] : pattern.replace(/^\/+/, "").split("/");
    let wildcard: string | null = null;
    let dynamic = false;
    for (let i = 0; i < raw.length; i++) {
      const segment = raw[i];
      if (i === raw.length - 1 && (segment === "*" || (segment.startsWith(":") && segment.endsWith("*")))) {
        wildcard = segment === "*" ? "*" : segment.slice(1, -1);
        dynamic = true;
        continue;
      }
      this.segments.push(segment);
      if (segment.startsWith(":")) dynamic = true;
    }
    this.wildcard = wildcard;
    const named = route.namedParams ?? [];
    for (const name of named) this.optional.push(name);
    this.exact = !dynamic && this.optional.length === 0;
  }
}

class TrieNode {
  readonly statics = new Map<string, TrieNode>();
  param: TrieNode | null = null;
  readonly entries: RouteEntry[] = [];
  readonly wildcards: RouteEntry[] = [];
}

const namesOf = (entry: RouteEntry, optionalNames: readonly string[]): string[] => {
  const names: string[] = [];
  for (const segment of entry.segments) if (segment.startsWith(":")) names.push(segment.slice(1));
  if (entry.wildcard !== null) names.push(entry.wildcard);
  for (const name of optionalNames) names.push(name);
  return names;
};

const buildMatched = (entry: RouteEntry, values: readonly string[], optionalNames: readonly string[], extraParams: Record<string, string>): MatchedRoute => {
  const names = namesOf(entry, optionalNames);
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < names.length; i++) pairs.push([names[i], values[i] ?? ""]);
  const pathParams = Object.fromEntries(pairs) as Record<string, string>;
  const params: Record<string, string> = { ...extraParams, ...pathParams };
  const name = entry.route.name;
  if (entry.route.parent) {
    const inner = new MatchedRoute(entry.route, params, name);
    inner.path = entry.route.path;
    const outer = new MatchedRoute(entry.route.parent, params, name);
    outer.matched = inner;
    return outer;
  }
  return new MatchedRoute(entry.route, params, name);
};

/** A matched route returned by the matcher. */
export class MatchedRoute {
  route: RouteConfig;
  params: Record<string, string>;
  name?: string;
  matched?: MatchedRoute | null;
  path?: string;
  querystring?: string;
  hash?: string;
  queryParams?: Record<string, string>;
  root?: boolean;

  constructor(route: RouteConfig, params: Record<string, string>, name: string | undefined) {
    this.route = route;
    this.params = params;
    this.name = name;
    this.matched = null;
  }
}

/** The compiled route table: one `Map` for static patterns, a trie for the rest. */
export class RouteTable {
  readonly entries: RouteEntry[] = [];
  private readonly exact: Map<string, RouteEntry> = new Map();
  private readonly root: TrieNode = new TrieNode();

  constructor(entries: readonly RouteEntry[]) {
    for (const entry of entries) this.add(entry);
  }

  add(entry: RouteEntry): void {
    this.entries.push(entry);
    if (entry.exact) {
      this.exact.set(canonical(entry.pattern), entry);
      return;
    }
    let node = this.root;
    for (const segment of entry.segments) {
      if (segment.startsWith(":")) {
        if (node.param === null) node.param = new TrieNode();
        node = node.param;
      } else {
        let next = node.statics.get(segment);
        if (next === undefined) {
          next = new TrieNode();
          node.statics.set(segment, next);
        }
        node = next;
      }
    }
    if (entry.wildcard !== null) node.wildcards.push(entry);
    else node.entries.push(entry);
  }

  match(pathname: string, extraParams: Record<string, string> = {}): MatchedRoute | null {
    const path = canonical(pathname);
    const exact = this.exact.get(path);
    if (exact !== undefined) return buildMatched(exact, [], [], extraParams);
    const values: string[] = [];
    const optionalNames: string[] = [];
    const entry = this.walk(this.root, path, path === "/" ? -1 : 1, values, optionalNames);
    if (entry === null) return null;
    return buildMatched(entry, values, optionalNames, extraParams);
  }

  private walk(node: TrieNode, path: string, pos: number, values: string[], optionalNames: string[]): RouteEntry | null {
    if (pos < 0) {
      for (const entry of node.entries) if (entry.optional.length === 0) return entry;
      for (const entry of node.entries) if (entry.optional.length > 0) return entry;
      for (const entry of node.wildcards) {
        values.push("");
        return entry;
      }
      return null;
    }
    const end = path.indexOf("/", pos);
    const segment = end < 0 ? path.slice(pos) : path.slice(pos, end);
    const next = end < 0 ? -1 : end + 1;
    const child = node.statics.get(segment);
    if (child !== undefined) {
      const matched = this.walk(child, path, next, values, optionalNames);
      if (matched !== null) return matched;
    }
    if (node.param !== null && segment !== "") {
      values.push(segment);
      const matched = this.walk(node.param, path, next, values, optionalNames);
      if (matched !== null) return matched;
      values.pop();
    }
    for (const entry of node.entries) {
      if (entry.optional.length > 0 && this.consumeOptional(entry, path, pos, values, optionalNames, 0)) return entry;
    }
    for (const entry of node.wildcards) {
      values.push(path.slice(pos));
      return entry;
    }
    return null;
  }

  private consumeOptional(entry: RouteEntry, path: string, pos: number, values: string[], optionalNames: string[], index: number): boolean {
    if (pos < 0) return true;
    if (index >= entry.optional.length) return false;
    if (this.consumeOptional(entry, path, pos, values, optionalNames, index + 1)) return true;
    const name = entry.optional[index];
    const end = path.indexOf("/", pos);
    const segment = end < 0 ? path.slice(pos) : path.slice(pos, end);
    if (segment !== name) return false;
    const valuePos = end < 0 ? -1 : end + 1;
    if (valuePos < 0) return false;
    const valueEnd = path.indexOf("/", valuePos);
    const value = valueEnd < 0 ? path.slice(valuePos) : path.slice(valuePos, valueEnd);
    if (value === "") return false;
    const after = valueEnd < 0 ? -1 : valueEnd + 1;
    values.push(value);
    optionalNames.push(name);
    if (this.consumeOptional(entry, path, after, values, optionalNames, index + 1)) return true;
    values.pop();
    optionalNames.pop();
    return false;
  }
}

const flattenInto = (out: FlattenedRoutes, routes: RoutesMap, basePath: string, parentRoute: RouteConfig | null, logger: Logger): void => {
  for (const key of Object.keys(routes)) {
    const raw = routes[key];
    let route: RouteConfig;
    if (typeof raw === "function") route = { component: raw };
    else {
      const config = raw as RouteConfig;
      route = { ...config };
    }
    const fullPath = (basePath + key).replace(/\/+/g, "/");
    route.path = fullPath || "/";
    route.parent = parentRoute;
    out.flatRoutes.push(new FlatRoute(route, route.path));
    if (route.name) {
      if (out.namedRoutes.has(route.name)) logger.warn(`Duplicate route name: ${route.name}`);
      out.namedRoutes.set(route.name, route.path);
    }
    if (route.routes) flattenInto(out, route.routes, fullPath, route, logger);
  }
};

/** Walk nested route maps into a flat list and a name-to-path lookup. */
export const flattenRoutes = (routes: RoutesMap, basePath = "", parentRoute: RouteConfig | null = null, logger: Logger = new Logger()): FlattenedRoutes => {
  const out = new FlattenedRoutes();
  flattenInto(out, routes, basePath, parentRoute, logger);
  return out;
};

/** Compile flattened routes into a matching table. */
export const compileRoutes = (flatRoutes: readonly FlatRoute[]): RouteTable => {
  const entries: RouteEntry[] = [];
  for (const flat of flatRoutes) entries.push(new RouteEntry(flat.route, flat.route.path ?? flat.path));
  return new RouteTable(entries);
};

/** Find the first route matching `pathname`, with `extraParams` merged under path params. */
export const matchRoute = (table: RouteTable, pathname: string, extraParams: Record<string, string> = {}): MatchedRoute | null => table.match(pathname, extraParams);
