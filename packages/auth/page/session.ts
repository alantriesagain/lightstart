/// <reference lib="dom" />
/**
 * @file The page's session: the bearer token kept in `localStorage`, and the
 * seams `configureAuth` gives a test (`fetch`, `storage`, `prefix`). A page
 * with no `localStorage` keeps the token in memory instead, so a sign-in still
 * works for the life of the document.
 */

/** The part of `localStorage` the session needs; a test supplies its own. */
export interface AuthStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** What `configureAuth` sets: the fetch to call, where the token lives, and a path prefix before `/api`. */
export interface AuthOptions {
  /** How auth requests are made; the global `fetch` when absent. */
  fetch?: typeof fetch;
  /** Where the token is kept; `localStorage` (or memory without it) when absent. */
  storage?: AuthStorage;
  /** A path placed before `/api`, such as `"/v1"`; empty when absent. */
  prefix?: string;
}

/** The `localStorage` key the bearer token lives under. */
export const TOKEN_KEY = "light-auth:token";

let configured: AuthOptions = {};
const memory = new Map<string, string>();

const memoryStorage: AuthStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value);
  },
  removeItem: (key) => {
    memory.delete(key);
  },
};

const fallbackStorage = (): AuthStorage => {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    // a browser that forbids localStorage gets the memory store
  }
  return memoryStorage;
};

const storage = (): AuthStorage => configured.storage ?? fallbackStorage();

/** The fetch auth calls use: the one a test set, else the page's. */
export const authFetch = (): typeof fetch => configured.fetch ?? fetch;

/** The prefix before `/api`, normalized to one leading `/` unless empty. */
export const authPrefix = (): string => {
  const raw = (configured.prefix ?? "").replace(/\/+$/, "");
  return raw === "" ? "" : raw.startsWith("/") ? raw : `/${raw}`;
};

/** The token the session holds, or null when signed out. */
export const readToken = (): string | null => {
  try {
    return storage().getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

/** Keep `token`, or clear the session when it is null. */
export const writeToken = (token: string | null): void => {
  try {
    if (token === null) storage().removeItem(TOKEN_KEY);
    else storage().setItem(TOKEN_KEY, token);
  } catch {
    // storage a page forbids is a session that does not persist
  }
};

/** Set the fetch, the storage or the prefix the session uses; a test's seam. */
export const configureAuth = (options: AuthOptions = {}): void => {
  configured = { ...configured, ...options };
};
