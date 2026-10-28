/**
 * @file Routes and how a request finds one. A pattern is `/`-separated segments: a literal, a
 * `:name` parameter (one non-empty segment), or a trailing `*` (the rest, which may be empty, so
 * `/files/*` also answers `/files`). Patterns with no parameter sit in one `Map` by their text, so
 * most requests are answered by one lookup; the others sit in a trie of segments. A literal segment
 * is tried before a parameter and a parameter before a wildcard, deeper wildcards before shallower
 * ones, and the walk backs up when a branch has nothing for the method, so a specific route that
 * lacks it never hides a broader one that has it. A path some route matches under another method
 * answers 405 with those methods; a path nothing matches answers null. HEAD falls back to GET,
 * and a route for `ALL` answers every method its pattern has no route of its own for.
 */
import { Context } from "./context.ts";
import { Reply } from "./reply.ts";

export type Handler = (c: Context) => Reply | Promise<Reply>;

/** Runs the rest of the chain (the later middleware, then the handler) and answers its reply. */
export type Next = () => Promise<Reply>;

/** Runs around the handler: may answer without calling `next`, or change what `next` answered. */
export type Middleware = (c: Context, next: Next) => Promise<Reply>;

/** The method a route registered with `all` is filed under. */
export const ALL = "ALL";

const METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", ALL];

export class Route {
  readonly method: string;
  readonly pattern: string;
  /** The parameter names in the order their segments appear, `*` last for a wildcard. */
  readonly names: string[];
  readonly handlerFn: Handler;
  /** The middleware this route runs, outermost first: the app's, then its own. Set when the app is built. */
  chain: Middleware[];

  constructor(method: string, pattern: string, handlerFn: Handler, chain: Middleware[]) {
    this.method = method;
    this.pattern = pattern;
    this.names = namesOf(pattern);
    this.handlerFn = handlerFn;
    this.chain = chain;
  }
}

/** The routes of one pattern shape, one per method. */
export class RouteSet {
  readonly routes: Route[] = [];

  add(route: Route): void {
    for (const r of this.routes)
      if (r.method === route.method) throw new Error("route " + route.method + " " + route.pattern + " is declared twice (the first is " + r.pattern + ")");
    this.routes.push(route);
  }

  /** The route answering `method`: its own, a GET for a HEAD, else the pattern's `ALL` route. */
  find(method: string): Route | null {
    let get: Route | null = null;
    let all: Route | null = null;
    for (const r of this.routes) {
      if (r.method === method) return r;
      if (r.method === "GET") get = r;
      else if (r.method === ALL) all = r;
    }
    if (method === "HEAD" && get !== null) return get;
    return all;
  }

  methods(): string[] {
    const out: string[] = [];
    for (const r of this.routes) {
      if (r.method === ALL) return METHODS.slice(0, METHODS.length - 1);
      out.push(r.method);
      if (r.method === "GET") out.push("HEAD");
    }
    return out;
  }
}

class TrieNode {
  readonly statics = new Map<string, TrieNode>();
  param: TrieNode | null = null;
  /** The routes whose pattern ends at this node. */
  set: RouteSet | null = null;
  /** The routes whose pattern ends in `/*` right below this node. */
  wildcard: RouteSet | null = null;
}

const namesOf = (pattern: string): string[] => {
  const names: string[] = [];
  for (const segment of pattern.slice(1).split("/")) {
    if (segment.startsWith(":")) names.push(segment.slice(1));
    else if (segment === "*") names.push("*");
  }
  return names;
};

/** Refuses a pattern that cannot match: the reason, or "" when it is well formed. */
export const patternProblem = (pattern: string): string => {
  if (!pattern.startsWith("/")) return "a pattern starts with /";
  if (pattern.indexOf("?") >= 0 || pattern.indexOf("#") >= 0) return "a pattern carries no query or fragment";
  const segments = pattern.slice(1).split("/");
  const seen: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    if (segment === "*") {
      if (i !== segments.length - 1) return "a wildcard is only ever the last segment";
      continue;
    }
    if (segment.indexOf("*") >= 0) return "a wildcard is a whole segment, \"*\"";
    if (segment.startsWith(":")) {
      const name = segment.slice(1);
      if (name === "" || name === "*") return "a parameter has a name";
      if (seen.indexOf(name) >= 0) return "the parameter :" + name + " appears twice";
      seen.push(name);
    } else if (segment.indexOf(":") >= 0) return "a parameter is a whole segment, \":" + segment.slice(segment.indexOf(":") + 1) + "\"";
  }
  return "";
};

export class Router {
  private readonly exact = new Map<string, RouteSet>();
  private readonly root = new TrieNode();

  add(route: Route): void {
    const problem = patternProblem(route.pattern);
    if (problem !== "") throw new Error("route " + route.method + " " + route.pattern + ": " + problem);
    if (METHODS.indexOf(route.method) < 0) throw new Error("route " + route.method + " " + route.pattern + ": " + route.method + " is not a method this router answers");
    if (route.names.length === 0) {
      let set = this.exact.get(route.pattern);
      if (set === undefined) {
        set = new RouteSet();
        this.exact.set(route.pattern, set);
      }
      set.add(route);
      return;
    }
    const segments = route.pattern.slice(1).split("/");
    let node = this.root;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      if (segment === "*") {
        if (node.wildcard === null) node.wildcard = new RouteSet();
        node.wildcard.add(route);
        return;
      }
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
    if (node.set === null) node.set = new RouteSet();
    node.set.add(route);
  }

  /** The route for the context's method and path, with its parameters written onto the context; null when none answers. */
  find(c: Context): Route | null {
    const path = c.path;
    const set = this.exact.get(path);
    if (set !== undefined) {
      const route = set.find(c.method);
      if (route !== null) {
        c.route = route.pattern;
        return route;
      }
    }
    const values: string[] = [];
    const route = this.walk(this.root, path, 1, c.method, values);
    if (route !== null) {
      c.route = route.pattern;
      c.paramNames = route.names;
      c.paramValues = values;
    }
    return route;
  }

  /** The methods some route answers for `path`: empty when nothing matches it (a 404), else the 405's `Allow`. */
  allowed(path: string): string[] {
    const sets: RouteSet[] = [];
    const set = this.exact.get(path);
    if (set !== undefined) sets.push(set);
    this.collect(this.root, path, 1, sets);
    const out: string[] = [];
    for (const s of sets) for (const m of s.methods()) if (out.indexOf(m) < 0) out.push(m);
    return out;
  }

  /** `pos` is where the next segment starts, -1 once the path is used up exactly at `node`. */
  private walk(node: TrieNode, path: string, pos: number, method: string, values: string[]): Route | null {
    if (pos < 0) {
      if (node.set !== null) {
        const route = node.set.find(method);
        if (route !== null) return route;
      }
      if (node.wildcard !== null) {
        const route = node.wildcard.find(method);
        if (route !== null) {
          values.push("");
          return route;
        }
      }
      return null;
    }
    const end = path.indexOf("/", pos);
    const segment = end < 0 ? path.slice(pos) : path.slice(pos, end);
    const nextPos = end < 0 ? -1 : end + 1;
    const child = node.statics.get(segment);
    if (child !== undefined) {
      const route = this.walk(child, path, nextPos, method, values);
      if (route !== null) return route;
    }
    if (node.param !== null && segment !== "") {
      values.push(segment);
      const route = this.walk(node.param, path, nextPos, method, values);
      if (route !== null) return route;
      values.pop();
    }
    if (node.wildcard !== null) {
      const route = node.wildcard.find(method);
      if (route !== null) {
        values.push(path.slice(pos));
        return route;
      }
    }
    return null;
  }

  private collect(node: TrieNode, path: string, pos: number, sets: RouteSet[]): void {
    if (pos < 0) {
      if (node.set !== null) sets.push(node.set);
      if (node.wildcard !== null) sets.push(node.wildcard);
      return;
    }
    const end = path.indexOf("/", pos);
    const segment = end < 0 ? path.slice(pos) : path.slice(pos, end);
    const nextPos = end < 0 ? -1 : end + 1;
    const child = node.statics.get(segment);
    if (child !== undefined) this.collect(child, path, nextPos, sets);
    if (node.param !== null && segment !== "") this.collect(node.param, path, nextPos, sets);
    if (node.wildcard !== null) sets.push(node.wildcard);
  }
}
