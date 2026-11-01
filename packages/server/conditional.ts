/**
 * @file RFC 9110 conditional replies, applied by the app where it finishes a reply: a GET or HEAD
 * with a 2xx answer carrying an `etag` becomes a bodiless 304 when the request's `If-None-Match`
 * matches it under weak comparison (a comma list, `*` included); with no `If-None-Match`, a
 * `last-modified` not later than the request's `If-Modified-Since` does the same. A 304 keeps the
 * validators and cache headers (`etag`, `cache-control`, `content-location`, `date`, `expires`,
 * `vary`, `set-cookie`) and drops the body, so a stream it would have sent is never started. The
 * method and status are checked before any header is read, and a reply with neither validator
 * costs only two header lookups.
 */
import type { Context } from "./context.ts";
import type { Reply } from "./reply.ts";

const KEPT = ["etag", "cache-control", "content-location", "date", "expires", "vary", "set-cookie"];

const weak = (tag: string): string => (tag.startsWith("W/") ? tag.slice(2) : tag);

const matches = (header: string, etag: string): boolean => {
  const target = weak(etag);
  for (const item of header.split(",")) {
    const tag = item.trim();
    if (tag === "*") return true;
    if (tag !== "" && weak(tag) === target) return true;
  }
  return false;
};

const keep = (reply: Reply): void => {
  const names = reply.headers.names;
  const values = reply.headers.values;
  for (let i = names.length - 1; i >= 0; i--) {
    if (KEPT.indexOf(names[i]!) < 0) {
      names.splice(i, 1);
      values.splice(i, 1);
    }
  }
};

const notModified = (reply: Reply): Reply => {
  reply.status = 304;
  reply.text = null;
  reply.bytes = null;
  reply.stream = null;
  reply.response = null;
  keep(reply);
  return reply;
};

/** Turns `reply` into a 304 when the request's validators say the client's copy is current, else answers it as it is. */
export const conditional = (c: Context, reply: Reply): Reply => {
  if (c.method !== "GET" && c.method !== "HEAD") return reply;
  if (reply.status < 200 || reply.status >= 300) return reply;

  const names = reply.headers.names;
  let etagAt = -1;
  let modifiedAt = -1;
  for (let i = 0; i < names.length; i++) {
    const name = names[i]!;
    if (name === "etag") {
      if (etagAt < 0) etagAt = i;
    } else if (name === "last-modified" && modifiedAt < 0) modifiedAt = i;
  }
  if (etagAt < 0 && modifiedAt < 0) return reply;

  if (etagAt >= 0) {
    const etag = reply.headers.values[etagAt]!;
    const match = c.header("if-none-match");
    if (match !== null) return matches(match, etag) ? notModified(reply) : reply;
  }

  if (modifiedAt >= 0) {
    const modified = reply.headers.values[modifiedAt]!;
    const since = c.header("if-modified-since");
    if (since !== null) {
      const at = Date.parse(since);
      const last = Date.parse(modified);
      if (!Number.isNaN(at) && !Number.isNaN(last) && last <= at) return notModified(reply);
    }
  }
  return reply;
};
