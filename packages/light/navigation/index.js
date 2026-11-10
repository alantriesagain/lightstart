/**
 * @file @lightstart/light/navigation
 * The host's router as components see it. A link asks for the URL a path is
 * served at, hands its click over, and follows route changes; without a
 * router configured, links are plain anchors and the location is the route.
 */

/** @import { Navigation } from "./types.ts" */

/** @type {Navigation} */
const plain = {
  href: (path) => path,
  go: (path) => globalThis.location.assign(path),
  click: () => false,
  path: () => globalThis.location?.pathname ?? "/",
  subscribe(fn) {
    globalThis.addEventListener("popstate", fn);
    return () => globalThis.removeEventListener("popstate", fn);
  },
};

let host = plain;

/**
 * Hand the engine the host's router, a plain object or a class instance whose
 * members live on its prototype. Missing members keep the plain behaviour.
 * @param {Partial<Navigation>} router
 */
export const configureNavigation = (router) => {
  const member = /** @type {<K extends keyof Navigation>(key: K) => Navigation[K]} */ ((key) => {
    const fn = router[key];
    return typeof fn === "function" ? /** @type {Navigation[typeof key]} */ (fn.bind(router)) : plain[key];
  });
  host = { href: member("href"), go: member("go"), click: member("click"), path: member("path"), subscribe: member("subscribe") };
};

/** @type {Navigation} */
export const navigation = {
  href: (path) => host.href(path),
  go: (path) => host.go(path),
  click: (event, options) => host.click(event, options),
  path: () => host.path(),
  subscribe: (fn) => host.subscribe(fn),
};

export default navigation;
