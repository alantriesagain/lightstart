/**
 * @bootstrapp/router: Browser Adapter
 * Platform adapter using window.location, window.history, and document APIs.
 */

/** @import { RouterAdapter } from "../types.js" */

/** @returns {RouterAdapter} */
export function createBrowserAdapter() {
  return {
    type: "browser",

    getLocation() {
      return {
        href: window.location.href,
        origin: window.location.origin,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      };
    },

    isSamePath(path) {
      return new URL(path, window.location.origin).href === window.location.href;
    },

    hardNavigate(path) {
      window.location.href = path;
    },

    pushState(state, path) {
      const url = new URL(path, window.location.origin);
      if (url.href !== window.location.href)
        window.history.pushState(state, "", path);
    },

    replaceState(state, path) {
      window.history.replaceState(state, "", path);
    },

    back() {
      window.history.back();
    },

    forward() {
      window.history.forward();
    },

    setTitle(title) {
      document.title = title;
    },
  };
}

export default createBrowserAdapter;
