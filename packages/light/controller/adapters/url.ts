/**
 * @bootstrapp/light/controller/url: the URL hash adapter
 * Hash parameters as a sync adapter: `get(key)` reads `#key=value`, `set`
 * writes it, and every key a binding follows hears back navigation. It starts
 * listening to `popstate` when the first binding subscribes, so importing it
 * has no side effect. Query parameters are the router's.
 */

import { withKeyedListeners } from "./keyed-listeners.ts";

import type { Adapter } from "../types.ts";

declare const window: { location: { hash: string }, addEventListener(type: "popstate", listener: () => void): void } | undefined;

const getHashParams = () => {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.hash.substring(1));
};

const setHashParams = (params: URLSearchParams) => {
  if (typeof window === "undefined") return;
  window.location.hash = params.toString();
};

/** The URL hash as a sync adapter: one `#key=value` parameter per key. */
export const hash: Adapter = withKeyedListeners({
  name: "hash",

  get(key: string) {
    return getHashParams().get(key);
  },

  set(key: string, value: unknown) {
    const params = getHashParams();
    if (value === null || value === undefined) params.delete(key);
    else params.set(key, String(value));
    setHashParams(params);
    hash.emit(key, value);
    return { key };
  },

  remove(key: string) {
    return hash.set(key, null);
  },

  has(key: string) {
    return getHashParams().has(key);
  },

  keys() {
    return [...getHashParams().keys()];
  },

  entries(): Array<[string, unknown]> {
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
