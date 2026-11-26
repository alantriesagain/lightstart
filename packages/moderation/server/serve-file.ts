/**
 * @file Answering a request for a published submission's file from the site's
 * own origin. Only a key a publish could have written is looked up (a folder, a
 * submission's minted id, an image extension), so nothing else in storage is
 * reachable through here, and what is sent goes out as an image that cannot
 * run: its type from its key, no sniffing, a sandboxing policy, and readable
 * from any origin so a native shell can draw it. A key never changes its
 * bytes, so browsers keep a file for a year.
 */

import { FILES_PATH } from "../index.ts";

import type { StorageHead, StorageLike, StorageObject } from "../types.ts";

const IMMUTABLE = "public, max-age=31536000, immutable";
const MEDIA_KEY = /^[a-z][a-z-]*\/[a-z0-9]{20}\.(webp|jpg|png)$/;

const TYPES: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", png: "image/png" };

/** Whether a key is one a published submission could have written. */
export const isMediaKey = (key: string): boolean => MEDIA_KEY.test(key);

const notFound = (): Response =>
  new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const matches = (header: string | null, etag: string): boolean =>
  header !== null &&
  String(header)
    .split(",")
    .some((tag) => {
      const bare = tag.trim().replace(/^W\//, "");
      return bare === "*" || bare === `"${etag}"`;
    });

const headersOf = (key: string, object: StorageHead): Headers =>
  new Headers({
    "content-type": TYPES[String(MEDIA_KEY.exec(key)?.[1])] ?? "application/octet-stream",
    "cache-control": IMMUTABLE,
    etag: object.httpEtag,
    "last-modified": object.uploaded.toUTCString(),
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; sandbox",
    "cross-origin-resource-policy": "cross-origin",
  });

/**
 * The file a request under `FILES_PATH` names, as a response.
 */
export const serveFile = async ({ storage, request }: { storage: StorageLike; request: Request }): Promise<Response> => {
  const key = new URL(request.url).pathname.slice(FILES_PATH.length);
  if (!isMediaKey(key)) return notFound();
  const conditional = request.headers.get("if-none-match");
  if (request.method === "HEAD" || conditional !== null) {
    const head = await storage.head(key);
    if (head === null) return notFound();
    if (matches(conditional, head.etag)) return new Response(null, { status: 304, headers: headersOf(key, head) });
    if (request.method === "HEAD") {
      const headers = headersOf(key, head);
      headers.set("content-length", String(head.size));
      return new Response(null, { status: 200, headers });
    }
  }
  const object: StorageObject | null = await storage.get(key);
  if (object === null) return notFound();
  return new Response(object.body as unknown as BodyInit, { status: 200, headers: headersOf(key, object) });
};
