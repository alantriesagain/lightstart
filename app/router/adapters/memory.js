/**
 * @bootstrapp/router: Memory Adapter
 * Platform adapter maintaining location and history state in memory.
 * Useful for testing, SSR, and non-browser environments.
 */

/** @import { RouterAdapter, HistoryEntry } from "../types.js" */

/**
 * @param {string} [initialPath]
 * @returns {RouterAdapter}
 */
export function createMemoryAdapter(initialPath = "/") {
  const initialUrl = new URL(initialPath, "http://memory");

  const state = {
    pathname: initialUrl.pathname,
    search: initialUrl.search,
    hash: initialUrl.hash,
    origin: "http://memory",
  };

  /** @type {HistoryEntry[]} */
  const history = [];
  let historyIndex = -1;

  return {
    type: "memory",

    getLocation() {
      return {
        href: `${state.origin}${state.pathname}${state.search}${state.hash}`,
        origin: state.origin,
        pathname: state.pathname,
        search: state.search,
        hash: state.hash,
      };
    },

    isSamePath(path) {
      const url = new URL(path, state.origin);
      const currentHref = `${state.pathname}${state.search}${state.hash}`;
      const newHref = `${url.pathname}${url.search}${url.hash}`;
      return currentHref === newHref;
    },

    hardNavigate(path) {
      const url = new URL(path, state.origin);
      state.pathname = url.pathname;
      state.search = url.search;
      state.hash = url.hash;
    },

    pushState(stateData, path) {
      const url = new URL(path, state.origin);

      state.pathname = url.pathname;
      state.search = url.search;
      state.hash = url.hash;

      if (historyIndex < history.length - 1)
        history.splice(historyIndex + 1);

      history.push({
        pathname: state.pathname,
        search: state.search,
        hash: state.hash,
        state: stateData,
      });
      historyIndex = history.length - 1;
    },

    replaceState(stateData, path) {
      const url = new URL(path, state.origin);

      state.pathname = url.pathname;
      state.search = url.search;
      state.hash = url.hash;

      if (historyIndex >= 0)
        history[historyIndex] = {
          pathname: state.pathname,
          search: state.search,
          hash: state.hash,
          state: stateData,
        };
    },

    back() {
      if (historyIndex > 0) {
        historyIndex--;
        const entry = history[historyIndex];
        state.pathname = entry.pathname;
        state.search = entry.search;
        state.hash = entry.hash;
        return true;
      }
      return false;
    },

    forward() {
      if (historyIndex < history.length - 1) {
        historyIndex++;
        const entry = history[historyIndex];
        state.pathname = entry.pathname;
        state.search = entry.search;
        state.hash = entry.hash;
        return true;
      }
      return false;
    },

    /** @param {string} _title */
    setTitle(_title) {
    },

    getHistory() {
      return {
        entries: [...history],
        index: historyIndex,
      };
    },
  };
}

export default createMemoryAdapter;
