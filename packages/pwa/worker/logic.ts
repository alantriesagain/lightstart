/**
 * @file The service worker's decisions as pure functions: which build outputs
 * it precaches, the version its cache name carries, and which requests it
 * answers from the cache, from the network or not at all. `worker.ts` bundles
 * this module into the one file a service worker is served as.
 */

import { withBase } from "../base.ts";

/** The pages a worker always precaches: the shell it answers a navigation with when the network does not. */
export const SHELL_PAGES: ReadonlySet<string> = new Set(["index.html", "404.html"]);

const HASHED = /-[A-Za-z0-9_-]{6,}\.(?:js|css)$/;

/** The largest output the worker precaches, in bytes; a larger file is left to the network. */
export const MAX_PRECACHE_BYTES = 2 * 1024 * 1024;

/** The outputs a build holds until it writes them. */
export type OutputMap = ReadonlyMap<string, Uint8Array | string>;

const utf8Length = (text: string): number => {
  let length = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    length += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return length;
};

const bytesOf = (content: Uint8Array | string): number => (typeof content === "string" ? utf8Length(content) : content.byteLength);

const isPrecached = (path: string, extra: ReadonlySet<string>): boolean => SHELL_PAGES.has(path) || HASHED.test(path) || path === "worker.js" || path === "manifest.webmanifest" || extra.has(path);

const isEligible = (path: string, content: Uint8Array | string, extra: ReadonlySet<string>): boolean => isPrecached(path, extra) && bytesOf(content) <= MAX_PRECACHE_BYTES;

const eligible = (outputs: OutputMap, extra: readonly string[]): [string, Uint8Array | string][] => {
  const named = new Set(extra.map((path) => path.replace(/^\/+/, "")));
  return [...outputs.entries()].filter(([path, content]) => isEligible(path, content, named)).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
};

const addByte = (hash: number, byte: number): number => Math.imul(hash ^ byte, 16777619) >>> 0;

const addText = (hash: number, text: string): number => {
  let next = hash;
  for (let index = 0; index < text.length; index += 1) next = addByte(next, text.charCodeAt(index) & 255);
  return next;
};

const addContent = (hash: number, content: Uint8Array | string): number => {
  if (typeof content === "string") return addText(hash, content);
  let next = hash;
  for (let index = 0; index < content.length; index += 1) next = addByte(next, content[index] ?? 0);
  return next;
};

/**
 * The paths a build's worker precaches, sorted, each with the app's base
 * before it: the shell pages, the hashed bundles, the module worker, the
 * manifest and the files `extra` names (its icons). A page the build
 * prerenders, a content file and a public asset are cached when a reader
 * first opens them, not on install: a site of thousands of pages stays one
 * small install.
 */
export const precacheList = (outputs: OutputMap, base: string, extra: readonly string[] = []): string[] => eligible(outputs, extra).map(([path]) => withBase(base, `/${path}`));

/** A short hash of the precached outputs' paths and contents; unchanged builds keep the same version. */
export const cacheVersion = (outputs: OutputMap, extra: readonly string[] = []): string => {
  let hash = 2166136261;
  for (const [path, content] of eligible(outputs, extra)) {
    hash = addText(hash, path);
    hash = addByte(hash, 0);
    hash = addContent(hash, content);
    hash = addByte(hash, 0);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

/** The request fields a worker reads, apart from the browser's own types. */
export interface PwaRequest {
  method: string;
  url: string;
  mode: string;
}

/** What the worker does with a request: answer it from the cache, try the network, or leave it untouched. */
export type PwaRoute =
  | { kind: "cache"; url: string }
  | { kind: "network"; url: string; candidates: string[] }
  | { kind: "pass" };

const isHtml = (path: string): boolean => path.endsWith(".html") || path.endsWith("/");

const pageCandidates = (path: string, base: string): string[] => {
  const found: string[] = [path];
  found.push(path.endsWith("/") ? `${path}index.html` : `${path}/index.html`);
  const shell = `${base}/index.html`;
  if (!found.includes(shell)) found.push(shell);
  return found;
};

/** The decision for one request: same-origin GETs only, a navigation network-first, a precached non-HTML cache-first, the rest passed through. */
export const routeOf = (request: PwaRequest, origin: string, precache: readonly string[], base: string): PwaRoute => {
  if (request.method !== "GET") return { kind: "pass" };
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return { kind: "pass" };
  }
  if (url.origin !== origin) return { kind: "pass" };
  if (request.mode === "navigate") return { kind: "network", url: request.url, candidates: pageCandidates(url.pathname, base) };
  if (isHtml(url.pathname)) return { kind: "pass" };
  if (!precache.includes(url.pathname)) return { kind: "pass" };
  return { kind: "cache", url: `${url.origin}${url.pathname}` };
};
