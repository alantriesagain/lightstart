/// <reference lib="webworker" />
/**
 * @file The service worker a build serves as `sw.js`: it precaches the shell
 * and the hashed bundles into one versioned cache, answers a navigation
 * network-first with a three-second timeout, keeping each page the network
 * answers, and the cached page or shell behind it, answers a precached asset
 * from the cache, and leaves every other request untouched.
 * The build bundles this file into one script and bakes in the precache list,
 * the version and the app's base.
 */

import { routeOf, type PwaRoute } from "./logic.ts";

declare const __PWA_PRECACHE__: string[];
declare const __PWA_VERSION__: string;
declare const __PWA_BASE__: string;

const worker = self as unknown as ServiceWorkerGlobalScope;
const PRECACHE = __PWA_PRECACHE__;
const VERSION = __PWA_VERSION__;
const BASE = __PWA_BASE__;
const CACHE = `pwa-${VERSION}`;
const SHELL = `${BASE}/index.html`;
const TIMEOUT = 3000;

const fromCache = async (path: string): Promise<Response | null> => (await caches.match(path)) ?? null;

const networkFirst = async (request: Request, route: PwaRoute): Promise<Response> => {
  const network = fetch(request).catch(() => null);
  const timeout = new Promise<null>((settle) => setTimeout(() => settle(null), TIMEOUT));
  const response = await Promise.race([network, timeout]);
  if (response !== null) {
    if (response.ok && response.type === "basic") {
      const copy = response.clone();
      void caches.open(CACHE).then((cache) => cache.put(new URL(request.url).pathname, copy));
    }
    return response;
  }
  if (route.kind === "network") {
    for (const candidate of route.candidates) {
      const cached = await fromCache(candidate);
      if (cached !== null) return cached;
    }
  }
  return (await fromCache(SHELL)) ?? (await fetch(request));
};

worker.addEventListener("install", (event) => {
  const first = worker.registration.active === null;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(PRECACHE);
      if (first) await worker.skipWaiting();
    })(),
  );
});

worker.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("pwa-") && key !== CACHE).map((key) => caches.delete(key)));
      await worker.clients.claim();
    })(),
  );
});

worker.addEventListener("fetch", (event) => {
  const route = routeOf({ method: event.request.method, url: event.request.url, mode: event.request.mode }, worker.location.origin, PRECACHE, BASE);
  if (route.kind === "pass") return;
  if (route.kind === "cache") {
    event.respondWith(
      (async () => (await fromCache(route.url)) ?? (await fetch(event.request)))(),
    );
    return;
  }
  event.respondWith(networkFirst(event.request, route));
});

worker.addEventListener("message", (event) => {
  const data: unknown = event.data;
  if (typeof data === "object" && data !== null && (data as { type?: unknown }).type === "pwa:skip-waiting") void worker.skipWaiting();
});
