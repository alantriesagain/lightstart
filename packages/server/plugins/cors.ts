/**
 * @file Cross-origin access: `app.plugin(new Cors({ origins: ["https://app.example"] }))`. A
 * preflight (an OPTIONS with `access-control-request-method`) under the prefix is answered before
 * routing with a 204 naming the methods, the headers asked for (or the configured ones) and how
 * long to keep the answer, granting the origin only when it is allowed; every other reply under
 * the prefix to an allowed origin carries the grant and `Vary: Origin`. An origin is allowed when
 * it is in `origins`, when `origins` is "*", or when `allow(origin, c)` says so (an allowlist read
 * from a Worker's `env` per request). With `credentials`, the grant names the origin and allows
 * credentials; "*" is never sent then, since browsers refuse it with credentials.
 */
import type { App } from "../app.ts";
import { Context } from "../context.ts";
import { Plugin } from "../plugin.ts";
import { Reply } from "../reply.ts";

export interface CorsOptions {
  /** The origins allowed, or "*" for any. */
  origins: string[] | "*";
  /** Decides an origin `origins` does not list, per request. */
  allow?: (origin: string, c: Context) => boolean;
  /** Only paths under this prefix get CORS ("/api/"); every path by default. */
  prefix?: string;
  /** Narrows the covered paths further, per path (the routes a table declared CORS for); a preflight to another path is not answered here and routes as any request. */
  paths?: (path: string) => boolean;
  methods?: string[];
  /** The request headers a preflight allows; those the browser asked for by default. */
  headers?: string[];
  /** The response headers a script may read. */
  expose?: string[];
  credentials?: boolean;
  /** Seconds a browser may keep a preflight's answer, a day by default. */
  maxAge?: number;
}

const DEFAULT_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

export class Cors extends Plugin {
  readonly options: CorsOptions;

  constructor(options: CorsOptions) {
    super("cors", []);
    this.options = options;
  }

  /** The `access-control-allow-origin` for `c`, "" when its origin is absent or not allowed. */
  grant(c: Context): string {
    const origin = c.header("origin");
    if (origin === null || origin === "") return "";
    const o = this.options;
    const listed = o.origins === "*" || o.origins.indexOf(origin) >= 0;
    if (!listed && (o.allow === undefined || !o.allow(origin, c))) return "";
    return o.origins === "*" && o.credentials !== true ? "*" : origin;
  }

  private covers(c: Context): boolean {
    const prefix = this.options.prefix ?? "";
    if (prefix !== "" && !c.path.startsWith(prefix)) return false;
    const paths = this.options.paths;
    return paths === undefined || paths(c.path);
  }

  private granted(reply: Reply, origin: string): void {
    reply.headers.set("access-control-allow-origin", origin);
    if (origin !== "*") reply.headers.append("vary", "Origin");
    if (this.options.credentials === true) reply.headers.set("access-control-allow-credentials", "true");
  }

  setup(app: App): void {
    const o = this.options;
    const methods = (o.methods ?? DEFAULT_METHODS).join(", ");
    const allowed = o.headers === undefined ? "" : o.headers.join(", ");
    const maxAge = String(o.maxAge ?? 86400);
    const expose = o.expose === undefined ? "" : o.expose.join(", ");
    app.onRequest((c: Context): Reply | null => {
      if (c.method !== "OPTIONS" || c.header("access-control-request-method") === null || !this.covers(c)) return null;
      const reply = new Reply(204);
      const origin = this.grant(c);
      if (origin !== "") this.granted(reply, origin);
      reply.headers.set("access-control-allow-methods", methods);
      reply.headers.set("access-control-allow-headers", allowed !== "" ? allowed : (c.header("access-control-request-headers") ?? "content-type, authorization"));
      reply.headers.set("access-control-max-age", maxAge);
      reply.headers.append("vary", "Access-Control-Request-Headers");
      return reply;
    });
    app.onReply((c: Context, reply: Reply): void => {
      if (reply.status === 204 && reply.headers.has("access-control-allow-methods")) return;
      if (!this.covers(c)) return;
      const origin = this.grant(c);
      if (origin === "") return;
      this.granted(reply, origin);
      if (expose !== "") reply.headers.set("access-control-expose-headers", expose);
    });
  }
}
