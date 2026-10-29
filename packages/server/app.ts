/**
 * @file The server as declared: routes, the middleware every route runs, the hooks around every
 * request, plugins, and other apps mounted under a prefix. Nothing is composed per request: the
 * first request (or an explicit `build()`) sets the plugins up, files every route in the router and
 * fixes each route's chain, the app's middleware outermost and the route's own inside it, so a
 * route with none calls its handler directly.
 *
 * A request runs the `onRequest` hooks first (any may answer, which ends it: a CORS preflight, a
 * health check, a refusal), then its route's chain, then the `onReply` hooks over whatever
 * answered (headers a plugin adds to every reply, a log line). A thrown `HttpError` answers its
 * status; anything else thrown is logged and answers 500. `handle` answers null for a path no
 * route matches, or one whose route answered `pass()`, so a host can try what sits behind the
 * app; `dispatch` answers the not-found handler's reply instead, which is what an adapter calls.
 */
import { Context } from "./context.ts";
import { HttpError } from "./errors.ts";
import { Logger } from "./logger.ts";
import { Plugin, ordered } from "./plugin.ts";
import { Reply, fail } from "./reply.ts";
import { ALL, type Handler, type Middleware, Route, Router } from "./router.ts";

/** Runs before routing; a reply ends the request with it, null lets it go on. */
export type RequestHook = (c: Context) => Reply | null;

/** Runs over every reply the app gives, before the adapter writes it. */
export type ReplyHook = (c: Context, reply: Reply) => void;

/** Turns what a handler threw into the reply. */
export type ErrorHandler = (c: Context, error: unknown) => Reply;

class Declaration {
  readonly method: string;
  readonly pattern: string;
  readonly handlerFn: Handler;
  readonly own: Middleware[];

  constructor(method: string, pattern: string, handlerFn: Handler, own: Middleware[]) {
    this.method = method;
    this.pattern = pattern;
    this.handlerFn = handlerFn;
    this.own = own;
  }
}

class Mount {
  readonly prefix: string;
  readonly app: App;

  constructor(prefix: string, app: App) {
    this.prefix = prefix;
    this.app = app;
  }
}

const joined = (prefix: string, pattern: string): string => (prefix === "" ? pattern : pattern === "/" ? prefix : prefix + pattern);

const last = async (c: Context, route: Route): Promise<Reply> => await route.handlerFn(c);

const run = (c: Context, route: Route, i: number): Promise<Reply> => {
  if (i === route.chain.length) return last(c, route);
  const middleware = route.chain[i]!;
  return middleware(c, () => run(c, route, i + 1));
};

const defaultNotFound: Handler = (c: Context): Reply => fail("no route for " + c.method + " " + c.path, 404);

export class App {
  private readonly router = new Router();
  private readonly declarations: Declaration[] = [];
  private readonly middleware: Middleware[] = [];
  private readonly requestHooks: RequestHook[] = [];
  private readonly replyHooks: ReplyHook[] = [];
  private readonly plugins: Plugin[] = [];
  private readonly mounts: Mount[] = [];
  private errorFn: ErrorHandler | null = null;
  /** Where the app's own complaints go; `logTo` replaces it. */
  logger: Logger = new Logger();
  private notFoundFn: Handler = defaultNotFound;
  private prepared = false;
  private built = false;

  /** Declares the route for `method` and `pattern`, with middleware of its own run inside the app's. */
  on(method: string, pattern: string, handlerFn: Handler, middleware: Middleware[] = []): App {
    this.unbuilt("a route");
    this.declarations.push(new Declaration(method.toUpperCase(), pattern, handlerFn, middleware));
    return this;
  }

  get(pattern: string, handlerFn: Handler, middleware: Middleware[] = []): App {
    return this.on("GET", pattern, handlerFn, middleware);
  }

  post(pattern: string, handlerFn: Handler, middleware: Middleware[] = []): App {
    return this.on("POST", pattern, handlerFn, middleware);
  }

  put(pattern: string, handlerFn: Handler, middleware: Middleware[] = []): App {
    return this.on("PUT", pattern, handlerFn, middleware);
  }

  patch(pattern: string, handlerFn: Handler, middleware: Middleware[] = []): App {
    return this.on("PATCH", pattern, handlerFn, middleware);
  }

  delete(pattern: string, handlerFn: Handler, middleware: Middleware[] = []): App {
    return this.on("DELETE", pattern, handlerFn, middleware);
  }

  options(pattern: string, handlerFn: Handler, middleware: Middleware[] = []): App {
    return this.on("OPTIONS", pattern, handlerFn, middleware);
  }

  /** The route for every method the pattern has no route of its own for. */
  all(pattern: string, handlerFn: Handler, middleware: Middleware[] = []): App {
    return this.on(ALL, pattern, handlerFn, middleware);
  }

  /** Middleware every route runs, outside the route's own, in the order added. */
  use(middleware: Middleware): App {
    this.unbuilt("middleware");
    this.middleware.push(middleware);
    return this;
  }

  onRequest(hook: RequestHook): App {
    this.unbuilt("a hook");
    this.requestHooks.push(hook);
    return this;
  }

  onReply(hook: ReplyHook): App {
    this.unbuilt("a hook");
    this.replyHooks.push(hook);
    return this;
  }

  /** Replaces the default error handler, under which an `HttpError` answers its status and message and anything else is logged and answers 500. */
  onError(errorFn: ErrorHandler): App {
    this.errorFn = errorFn;
    return this;
  }

  logTo(logger: Logger): App {
    this.logger = logger;
    return this;
  }

  /** What `dispatch` answers for a path no route matches. */
  notFound(notFoundFn: Handler): App {
    this.notFoundFn = notFoundFn;
    return this;
  }

  plugin(plugin: Plugin): App {
    this.unbuilt("a plugin");
    this.plugins.push(plugin);
    return this;
  }

  /**
   * Serves `app`'s routes under `prefix` ("/api"), each running `app`'s middleware inside this app's.
   * The mounted app's hooks would run for its routes alone, which the request pipeline has no place
   * for, so a mounted app with hooks is refused.
   */
  mount(prefix: string, app: App): App {
    this.unbuilt("a mount");
    if (!prefix.startsWith("/") || prefix.endsWith("/")) throw new Error("a mount prefix starts with / and does not end with one: \"" + prefix + "\"");
    this.mounts.push(new Mount(prefix, app));
    return this;
  }

  private unbuilt(what: string): void {
    if (this.built) throw new Error("the app is built: " + what + " cannot be added after its first request");
  }

  /** Sets the plugins up, once: a mounting app does it for the apps it mounts. */
  private prepare(): void {
    if (this.prepared) return;
    this.prepared = true;
    for (const plugin of ordered(this.plugins)) plugin.setup(this);
    for (const m of this.mounts) m.app.prepare();
  }

  /** The routes with their chains, under `prefix`, outermost middleware first. */
  private routes(prefix: string, outer: Middleware[]): Route[] {
    const around = outer.concat(this.middleware);
    const out: Route[] = [];
    for (const d of this.declarations) out.push(new Route(d.method, joined(prefix, d.pattern), d.handlerFn, around.concat(d.own)));
    for (const m of this.mounts) {
      if (m.app.requestHooks.length > 0 || m.app.replyHooks.length > 0) throw new Error("the app mounted at " + m.prefix + " has hooks, which a mounted app cannot run; add them to the app that mounts it");
      for (const r of m.app.routes(joined(prefix, m.prefix), around)) out.push(r);
    }
    return out;
  }

  /** Sets the plugins up and files the routes; the first request does it when nothing did before. */
  build(): App {
    if (this.built) return this;
    this.prepare();
    for (const route of this.routes("", [])) this.router.add(route);
    this.built = true;
    return this;
  }

  private fault(c: Context, error: unknown): Reply {
    if (this.errorFn !== null) return this.errorFn(c, error);
    if (error instanceof HttpError) return fail(error.message, error.status);
    this.logger.error(c.method + " " + c.path, error);
    return fail("internal error", 500);
  }

  private finish(c: Context, reply: Reply): Reply {
    for (const hook of this.replyHooks) hook(c, reply);
    return reply;
  }

  /** The reply for `c`, or null when no route matches its path (a 405 when one does under another method). */
  async handle(c: Context): Promise<Reply | null> {
    if (!this.built) this.build();
    c.logger = this.logger;
    try {
      for (const hook of this.requestHooks) {
        const early = hook(c);
        if (early !== null) return this.finish(c, early);
      }
      const route = this.router.find(c);
      if (route === null) {
        const allow = this.router.allowed(c.path);
        if (allow.length === 0) return null;
        return this.finish(c, fail("method " + c.method + " not allowed", 405).header("allow", allow.join(", ")));
      }
      const reply = await (route.chain.length === 0 ? route.handlerFn(c) : run(c, route, 0));
      if (reply.passed) return null;
      return this.finish(c, reply);
    } catch (error) {
      return this.finish(c, this.fault(c, error));
    }
  }

  /** The reply for `c`, the not-found handler's when no route matches. */
  async dispatch(c: Context): Promise<Reply> {
    const reply = await this.handle(c);
    if (reply !== null) return reply;
    try {
      return this.finish(c, await this.notFoundFn(c));
    } catch (error) {
      return this.finish(c, this.fault(c, error));
    }
  }
}
