/**
 * @bootstrapp/light/controller/storage: Storage Adapters
 * localStorage, sessionStorage, and memory storage with signal integration.
 */

import { withKeyedListeners, createLazyAdapter } from "./keyed-listeners.ts";

import type { Adapter, StorageArea } from "../types.ts";

declare const window: { localStorage: StorageArea, sessionStorage: StorageArea } | undefined;

const serialize = (value: unknown) => {
  if ((typeof value === "object" && value !== null) || Array.isArray(value))
    return JSON.stringify(value);

  return value as string;
};

const deserialize = (value: string | null): unknown => {
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
 */
export const createStorageAdapter = (storage: StorageArea, name: string): Adapter => {
  const adapter = withKeyedListeners({
    name,

    get(key: string, defaultValue: unknown = null) {
      try {
        const value = storage.getItem(key);
        return value !== null ? deserialize(value) : defaultValue;
      } catch {
        return defaultValue;
      }
    },

    set(key: string, value: unknown) {
      try {
        storage.setItem(key, serialize(value));
        adapter.emit(key, value);
      } catch { }
      return { key };
    },

    remove(key: string) {
      try {
        storage.removeItem(key);
      } catch { }
      adapter.emit(key, undefined);
      return { key };
    },

    has(key: string) {
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

    entries(): Array<[string, unknown]> {
      return adapter.keys().map((key) => [key, adapter.get(key)]);
    },
  });

  return adapter;
};

const memoryStore: Map<string, unknown> = new Map();

/** A sync adapter over one in-memory map, shared by every binding that names it. */
export const memoryStorage = withKeyedListeners({
  name: "memory",

  get(key: string) {
    return memoryStore.get(key);
  },

  set(key: string, value: unknown) {
    memoryStore.set(key, value);
    memoryStorage.emit(key, value);
    return { key };
  },

  remove(key: string) {
    memoryStore.delete(key);
    memoryStorage.emit(key, undefined);
    return { key };
  },

  has(key: string) {
    return memoryStore.has(key);
  },

  keys() {
    return [...memoryStore.keys()];
  },

  entries(): Array<[string, unknown]> {
    return [...memoryStore.entries()];
  },

  clear() {
    memoryStore.clear();
    memoryStorage._listeners.clear();
    memoryStorage._signals.clear();
  },
});

let localStorageAdapter: Adapter | null = null;
let sessionStorageAdapter: Adapter | null = null;

const getLocalStorage = () => {
  if (!localStorageAdapter && typeof window !== "undefined")
    localStorageAdapter = createStorageAdapter(window.localStorage, "local");

  return localStorageAdapter || memoryStorage;
};

const getSessionStorage = () => {
  if (!sessionStorageAdapter && typeof window !== "undefined")
    sessionStorageAdapter = createStorageAdapter(window.sessionStorage, "session");

  return sessionStorageAdapter || memoryStorage;
};

/** The browser's `localStorage` as a sync adapter, resolved on use; memory where there is no window. */
export const localStorage = createLazyAdapter("local", getLocalStorage);
/** The browser's `sessionStorage` as a sync adapter, resolved on use; memory where there is no window. */
export const sessionStorage = createLazyAdapter("session", getSessionStorage);
