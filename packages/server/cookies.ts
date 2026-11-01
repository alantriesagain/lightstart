/**
 * @file Cookies on the request and on the reply. `parseCookies` reads a `Cookie` header once,
 * following RFC 6265: names and values split on `;`, one pair of surrounding quotes stripped from
 * a value, percent-decoded when it decodes, the raw value kept when it does not, and the first
 * occurrence of a name winning. `setCookie` and `clearCookie` append a `set-cookie` value, so two
 * cookies on one reply stay two headers; `Context.cookie` and `Context.cookies` read with
 * `parseCookies`.
 *
 * The defaults are `Path=/`, `HttpOnly`, `SameSite=Lax`, and `Secure` only when the request came
 * over https (`secure: "auto"`). The reply does not know the request, so an auto cookie is left
 * for `App.finish` to settle, which appends `; Secure` when the context's protocol is https, before the reply hooks run (so a hook removing a header cannot shift which value is settled) and again after them, for cookies a hook set. A reply with no auto cookie keeps a null list and costs that one check. A
 * reply written without going through an `App` (an adapter calling `writeReply` directly) leaves
 * its auto cookies without `Secure`.
 */
import { Reply } from "./reply.ts";

/** The token characters RFC 6265 allows in a cookie name. */
const TOKEN = "!#$%&'*+-.^_`|~";

const isToken = (name: string): boolean => {
  if (name.length === 0) return false;
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);
    if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)) continue;
    if (TOKEN.indexOf(name[i]!) >= 0) continue;
    return false;
  }
  return true;
};

/** What `setCookie` and `clearCookie` write. */
export interface CookieOptions {
  /** Lifetime in seconds (written `Max-Age`). */
  maxAge?: number;
  /** The expiry instant (written `Expires`). */
  expires?: Date;
  /** The path the cookie covers; "/" by default. */
  path?: string;
  /** The domain the cookie covers; the request's host by default. */
  domain?: string;
  /** `HttpOnly` unless false. */
  httpOnly?: boolean;
  /** `Secure`; "auto" (the default) writes it only when the request is https. */
  secure?: boolean | "auto";
  /** `SameSite`; "Lax" by default. */
  sameSite?: "Strict" | "Lax" | "None";
  /** `Partitioned`, for a cookie in a partitioned (CHIPS) storage. */
  partitioned?: boolean;
}

/** The cookies of a `Cookie` header, the first occurrence of a name winning; empty and malformed pairs are skipped. */
export const parseCookies = (header: string | null): Map<string, string> => {
  const out = new Map<string, string>();
  if (header === null) return out;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (trimmed === "") continue;
    const eq = trimmed.indexOf("=");
    const name = (eq < 0 ? trimmed : trimmed.slice(0, eq)).trim();
    if (name === "") continue;
    if (out.has(name)) continue;
    let value = (eq < 0 ? "" : trimmed.slice(eq + 1)).trim();
    if (value.length >= 2 && value.startsWith("\"") && value.endsWith("\"")) value = value.slice(1, value.length - 1);
    try {
      out.set(name, decodeURIComponent(value));
    } catch {
      out.set(name, value);
    }
  }
  return out;
};

const writeCookie = (
  reply: Reply,
  name: string,
  value: string,
  maxAge: number | null,
  expires: Date | null,
  path: string | null,
  domain: string | null,
  httpOnly: boolean,
  secure: boolean | "auto",
  sameSite: "Strict" | "Lax" | "None",
  partitioned: boolean,
): Reply => {
  if (!isToken(name)) throw new Error("cookie name \"" + name + "\" is not an RFC 6265 token");
  const secureOn = secure !== false;
  if (name.startsWith("__Host-")) {
    const cover = path === null ? "/" : path;
    if (!secureOn || cover !== "/" || domain !== null) throw new Error("__Host- cookie \"" + name + "\" requires Secure, Path=/, and no Domain");
  } else if (name.startsWith("__Secure-")) {
    if (!secureOn) throw new Error("__Secure- cookie \"" + name + "\" requires Secure");
  }
  if (sameSite === "None" && !secureOn) throw new Error("a SameSite=None cookie \"" + name + "\" requires Secure");

  let line = name + "=" + encodeURIComponent(value);
  const cover = path === null ? "/" : path;
  if (cover !== "") line += "; Path=" + cover;
  if (domain !== null) line += "; Domain=" + domain;
  if (maxAge !== null) line += "; Max-Age=" + String(Math.floor(maxAge));
  if (expires !== null) line += "; Expires=" + expires.toUTCString();
  if (httpOnly) line += "; HttpOnly";
  if (secure === true) line += "; Secure";
  line += "; SameSite=" + sameSite;
  if (partitioned) line += "; Partitioned";
  const index = reply.headers.names.length;
  reply.headers.append("set-cookie", line);
  if (secure === "auto") {
    if (reply.autoSecure === null) reply.autoSecure = [];
    reply.autoSecure.push(index);
  }
  return reply;
};

/** Appends `name=value` to `reply`'s `set-cookie` headers, with the options given, and answers the reply. */
export const setCookie = (reply: Reply, name: string, value: string, options?: CookieOptions): Reply => {
  const o: CookieOptions = options === undefined ? {} : options;
  return writeCookie(
    reply,
    name,
    value,
    o.maxAge === undefined ? null : o.maxAge,
    o.expires === undefined ? null : o.expires,
    o.path === undefined ? null : o.path,
    o.domain === undefined ? null : o.domain,
    o.httpOnly === undefined ? true : o.httpOnly,
    o.secure === undefined ? "auto" : o.secure,
    o.sameSite === undefined ? "Lax" : o.sameSite,
    o.partitioned === undefined ? false : o.partitioned,
  );
};

/** Expires `name` on the client: an empty value, `Max-Age=0`, and the same path and domain. */
export const clearCookie = (reply: Reply, name: string, options?: CookieOptions): Reply => {
  const o: CookieOptions = options === undefined ? {} : options;
  return writeCookie(
    reply,
    name,
    "",
    0,
    null,
    o.path === undefined ? null : o.path,
    o.domain === undefined ? null : o.domain,
    o.httpOnly === undefined ? true : o.httpOnly,
    o.secure === undefined ? "auto" : o.secure,
    o.sameSite === undefined ? "Lax" : o.sameSite,
    o.partitioned === undefined ? false : o.partitioned,
  );
};
