/**
 * @file A redirect to a target the request supplied (a `?next=` after sign-in), refused unless it
 * stays on this origin. A path (`/x`, `/x?y#z`) or an absolute `http(s)://` URL whose host and
 * port are `c.host`'s (what a trusted proxy forwarded included) is allowed and written as it
 * arrived; a protocol-relative target, a backslash, another scheme, a leading space, a control
 * character anywhere (a browser drops tabs and newlines, so `/<tab>/evil.example` would become
 * `//evil.example`), userinfo, another host and an empty target answer the fallback instead. A
 * scheme's default port is the same as no port (`https://shop.example` matches a host of
 * `shop.example:443`). The fallback passes the same check, so a caller handing it a value from the
 * request cannot reopen the redirect: a fallback that fails it answers `/`.
 */
import type { Context } from "./context.ts";
import { authorityOf } from "./origin.ts";
import { redirect } from "./reply.ts";
import type { Reply } from "./reply.ts";

/** `authority` without the default port of `scheme` (`:80` for http, `:443` for https). */
const withoutDefaultPort = (authority: string, scheme: string): string => {
  const port = scheme === "https" ? ":443" : scheme === "http" ? ":80" : "";
  return port !== "" && authority.endsWith(port) ? authority.slice(0, authority.length - port.length) : authority;
};

const absoluteAuthority = (target: string): string | null => {
  const split = target.indexOf("://");
  if (split <= 0) return null;
  const scheme = target.slice(0, split).toLowerCase();
  if (scheme !== "http" && scheme !== "https") return null;
  const rest = target.slice(split + 3);
  let end = rest.length;
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i]!;
    if (ch === "/" || ch === "?" || ch === "#") {
      end = i;
      break;
    }
  }
  const authority = rest.slice(0, end);
  if (authority === "") return null;
  const parsed = authorityOf(scheme + "://" + authority);
  return parsed === null ? null : withoutDefaultPort(parsed, scheme);
};

const safeTarget = (c: Context, target: string): boolean => {
  if (target === "" || target.charCodeAt(0) === 32) return false;
  for (let i = 0; i < target.length; i++) {
    const code = target.charCodeAt(i);
    if (code < 32 || code === 127 || code === 92) return false;
  }
  if (target.startsWith("/")) return !target.startsWith("//");
  const authority = absoluteAuthority(target);
  return authority !== null && authority === withoutDefaultPort(c.host.toLowerCase(), c.protocol);
};

/**
 * A redirect to `target` when it stays on this origin, else one to `fallback`: `safeRedirect(c,
 * c.query("next") ?? "/")` after sign-in. A same-origin path or an absolute `http(s)` URL to
 * `c.host` (a trusted proxy's word included) is allowed; anything else answers `fallback`, which
 * must pass the same check or `/` is used.
 */
export const safeRedirect = (c: Context, target: string, fallback = "/", status = 302): Reply =>
  redirect(safeTarget(c, target) ? target : safeTarget(c, fallback) ? fallback : "/", status);
