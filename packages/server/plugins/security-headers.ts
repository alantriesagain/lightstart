/**
 * @file Security headers on every reply: `app.plugin(new SecurityHeaders())`. The defaults are
 * `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy:
 * strict-origin-when-cross-origin` and `Cross-Origin-Opener-Policy: same-origin`, plus
 * `Strict-Transport-Security` on replies to https requests; `Content-Security-Policy` and
 * `Permissions-Policy` are off unless given (a default CSP breaks apps silently). Every header is
 * overridable, and `false` turns one off. The name/value lists are built once in `setup`, and the
 * reply hook writes them with `default`, so a header a reply set itself keeps its value. A route
 * opts out by listing `noSecurityHeaders` among its middleware.
 */
import type { App } from "../app.ts";
import type { Context } from "../context.ts";
import { Key } from "../key.ts";
import { Plugin } from "../plugin.ts";
import type { Reply } from "../reply.ts";
import type { Next } from "../router.ts";

export interface SecurityHeadersOptions {
  /** `X-Content-Type-Options`; `nosniff` unless changed, false to omit it. */
  contentTypeOptions?: string | false;
  /** `X-Frame-Options`; SAMEORIGIN unless changed, false to omit it. */
  frameOptions?: "DENY" | "SAMEORIGIN" | false;
  /** `Referrer-Policy`; `strict-origin-when-cross-origin` unless changed, false to omit it. */
  referrerPolicy?: string | false;
  /** `Cross-Origin-Opener-Policy`; `same-origin` unless changed, false to omit it. */
  openerPolicy?: string | false;
  /** `Strict-Transport-Security` on https replies; the default one year with subdomains, false to omit it. */
  hsts?: string | false;
  /** `Content-Security-Policy`; off unless given, false to leave it off. */
  csp?: string | false;
  /** `Permissions-Policy`; off unless given, false to leave it off. */
  permissionsPolicy?: string | false;
}

const DEFAULT_HSTS = "max-age=31536000; includeSubDomains";

const OPTED_OUT = new Key<boolean>("security headers opted out");

const add = (names: string[], values: string[], name: string, value: string | false): void => {
  if (value === false) return;
  names.push(name);
  values.push(value);
};

export class SecurityHeaders extends Plugin {
  readonly options: SecurityHeadersOptions;

  constructor(options: SecurityHeadersOptions = {}) {
    super("security-headers", []);
    this.options = options;
  }

  setup(app: App): void {
    const o = this.options;
    const alwaysNames: string[] = [];
    const alwaysValues: string[] = [];
    const secureNames: string[] = [];
    const secureValues: string[] = [];
    add(alwaysNames, alwaysValues, "x-content-type-options", o.contentTypeOptions ?? "nosniff");
    add(alwaysNames, alwaysValues, "x-frame-options", o.frameOptions ?? "SAMEORIGIN");
    add(alwaysNames, alwaysValues, "referrer-policy", o.referrerPolicy ?? "strict-origin-when-cross-origin");
    add(alwaysNames, alwaysValues, "cross-origin-opener-policy", o.openerPolicy ?? "same-origin");
    add(alwaysNames, alwaysValues, "content-security-policy", o.csp ?? false);
    add(alwaysNames, alwaysValues, "permissions-policy", o.permissionsPolicy ?? false);
    add(secureNames, secureValues, "strict-transport-security", o.hsts ?? DEFAULT_HSTS);
    app.onReply((c: Context, reply: Reply): void => {
      if (c.get(OPTED_OUT) === true) return;
      for (let i = 0; i < alwaysNames.length; i++) reply.headers.default(alwaysNames[i]!, alwaysValues[i]!);
      if (c.protocol === "https") for (let i = 0; i < secureNames.length; i++) reply.headers.default(secureNames[i]!, secureValues[i]!);
    });
  }
}

/**
 * A route's middleware opting it out of `SecurityHeaders`: `app.get("/embed", handler,
 * [noSecurityHeaders])`. It marks the request, which the reply hook reads once per reply.
 */
export const noSecurityHeaders = async (c: Context, next: Next): Promise<Reply> => {
  c.set(OPTED_OUT, true);
  return await next();
};
