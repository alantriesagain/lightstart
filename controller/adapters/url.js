/**
 * @bootstrapp/light/controller/url: the URL hash adapter
 * Hash parameters as a sync adapter: `get(key)` reads `#key=value`, `set`
 * writes it, and every key a binding follows hears back navigation. It starts
 * listening to `popstate` when the first binding subscribes, so importing it
 * has no side effect. Query parameters are the router's.
 */

import { withKeyedListeners } from "./keyed-listeners.js";

/** @import { Adapter } from "../types.ts" */

const getHashParams = () => {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.hash.substring(1));
};

/** @param {URLSearchParams} params */
const setHashParams = (params) => {
  if (typeof window === "undefined") return;
  window.location.hash = params.toString();
};

/** @type {Adapter} */
export const hash = withKeyedListeners({
  name: "hash",

  /** @param {string} key */
  get(key) {
    return getHashParams().get(key);
  },

  /** @param {string} key @param {unknown} value */
  set(key, value) {
    const params = getHashParams();
    if (value === null || value === undefined) params.delete(key);
    else params.set(key, String(value));
    setHashParams(params);
    hash.emit(key, value);
    return { key };
  },

  /** @param {string} key */
  remove(key) {
    return hash.set(key, null);
  },

  /** @param {string} key */
  has(key) {
    return getHashParams().has(key);
  },

  keys() {
    return [...getHashParams().keys()];
  },

  /** @returns {Array<[string, unknown]>} */
  entries() {
    return [...getHashParams().entries()];
  },
});

const syncFromUrl = () => {
  const current = new Map(hash.entries());
  const followed = new Set(hash._listeners.keys());
  current.forEach((value, key) => {
    hash.emit(key, value);
    followed.delete(key);
  });
  followed.forEach((key) => hash.emit(key, undefined));
};

let listening = false;
const subscribe = hash.on;
hash.on = (key, callback) => {
  if (!listening && typeof window !== "undefined") {
    listening = true;
    window.addEventListener("popstate", syncFromUrl);
  }
  return subscribe(key, callback);
};
