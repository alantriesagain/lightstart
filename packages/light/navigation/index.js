/**
 * @file @bootstrapp/light/navigation
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
 * Hand the engine the host's router. Missing members keep the plain behaviour.
 * @param {Partial<Navigation>} router
 */
export const configureNavigation = (router) => {
  host = { ...plain, ...router };
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
