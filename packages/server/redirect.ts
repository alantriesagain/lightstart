/**
 * @file A redirect to a target the request supplied (a `?next=` after sign-in), refused unless it
 * stays on this origin. A path (`/x`, `/x?y#z`) or an absolute `http(s)://` URL whose host and
 * port are `c.host`'s (what a trusted proxy forwarded included) is allowed and written as it
 * arrived; a protocol-relative target, a backslash, another scheme, leading whitespace or a control
 * character, userinfo, another host and an empty target answer the fallback instead.
 */
import type { Context } from "./context.ts";
import { authorityOf } from "./origin.ts";
import { redirect } from "./reply.ts";
import type { Reply } from "./reply.ts";

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
  return authorityOf(scheme + "://" + authority);
};

const safeTarget = (c: Context, target: string): boolean => {
  if (target === "") return false;
  const first = target.charCodeAt(0);
  if (first <= 32 || first === 127) return false;
  if (target.indexOf("\\") >= 0) return false;
  if (target.startsWith("/")) return !target.startsWith("//");
  const authority = absoluteAuthority(target);
  return authority !== null && authority === c.host.toLowerCase();
};

/**
 * A redirect to `target` when it stays on this origin, else one to `fallback`: `safeRedirect(c,
 * c.query("next") ?? "/")` after sign-in. A same-origin path or an absolute `http(s)` URL to
 * `c.host` (a trusted proxy's word included) is allowed; anything else answers `fallback`.
 */
export const safeRedirect = (c: Context, target: string, fallback = "/", status = 302): Reply =>
  redirect(safeTarget(c, target) ? target : fallback, status);
