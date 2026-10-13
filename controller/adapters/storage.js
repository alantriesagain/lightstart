/**
 * @bootstrapp/light/controller/storage: Storage Adapters
 * localStorage, sessionStorage, and memory storage with signal integration.
 */

import { withKeyedListeners, createLazyAdapter } from "./keyed-listeners.js";

/** @import { Adapter } from "../types.ts" */

/** @param {unknown} value */
const serialize = (value) => {
  if ((typeof value === "object" && value !== null) || Array.isArray(value))
    return JSON.stringify(value);

  return /** @type {string} */ (value);
};

/** @param {string | null} value */
const deserialize = (value) => {
  if (value === null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

/**
 * Every browser-Storage touch is guarded: private mode, quota, and disabled
 * storage throw where the hand-rolled try/catch wrappers this adapter
 * replaces returned a default. `get` takes that default as its second arg.
 *
 * @param {Storage} storage
 * @param {string} name
 * @returns {Adapter}
 */
export const createStorageAdapter = (storage, name) => {
  const adapter = withKeyedListeners({
    name,

    /** @param {string} key @param {unknown} [defaultValue] */
    get(key, defaultValue = null) {
      try {
        const value = storage.getItem(key);
        return value !== null ? deserialize(value) : defaultValue;
      } catch {
        return defaultValue;
      }
    },

    /** @param {string} key @param {unknown} value */
    set(key, value) {
      try {
        storage.setItem(key, serialize(value));
        adapter.emit(key, value);
      } catch { }
      return { key };
    },

    /** @param {string} key */
    remove(key) {
      try {
        storage.removeItem(key);
      } catch { }
      adapter.emit(key, undefined);
      return { key };
    },

    /** @param {string} key */
    has(key) {
      try {
        return storage.getItem(key) !== null;
      } catch {
        return false;
      }
    },

    keys() {
      try {
        return Object.keys(storage);
      } catch {
        return [];
      }
    },

    /** @returns {Array<[string, unknown]>} */
    entries() {
      return adapter.keys().map((key) => [key, adapter.get(key)]);
    },
  });

  return adapter;
};

/** @type {Map<string, unknown>} */
const memoryStore = new Map();

export const memoryStorage = withKeyedListeners({
  name: "memory",

  /** @param {string} key */
  get(key) {
    return memoryStore.get(key);
  },

  /** @param {string} key @param {unknown} value */
  set(key, value) {
    memoryStore.set(key, value);
    memoryStorage.emit(key, value);
    return { key };
  },

  /** @param {string} key */
  remove(key) {
    memoryStore.delete(key);
    memoryStorage.emit(key, undefined);
    return { key };
  },

  /** @param {string} key */
  has(key) {
    return memoryStore.has(key);
  },

  keys() {
    return [...memoryStore.keys()];
  },

  /** @returns {Array<[string, unknown]>} */
  entries() {
    return [...memoryStore.entries()];
  },

  clear() {
    memoryStore.clear();
    memoryStorage._listeners.clear();
    memoryStorage._signals.clear();
  },
});

/** @type {Adapter | null} */
let localStorageAdapter = null;
/** @type {Adapter | null} */
let sessionStorageAdapter = null;

function getLocalStorage() {
  if (!localStorageAdapter && typeof window !== "undefined")
    localStorageAdapter = createStorageAdapter(window.localStorage, "local");

  return localStorageAdapter || memoryStorage;
}

function getSessionStorage() {
  if (!sessionStorageAdapter && typeof window !== "undefined")
    sessionStorageAdapter = createStorageAdapter(window.sessionStorage, "session");

  return sessionStorageAdapter || memoryStorage;
}

export const localStorage = createLazyAdapter("local", getLocalStorage);
export const sessionStorage = createLazyAdapter("session", getSessionStorage);
