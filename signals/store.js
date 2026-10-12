/**
 * @bootstrapp/light/signals/store.js: Store
 * The canonical declared reactive store: per-key subscribe, optional
 * flattened accessors (off for views, controllers and extensions, whose
 * instance is the accessor surface, so a declared key may share a store
 * method's name), pack/unpack serialization, and a `$sync` bridge so any store
 * is a valid View `sync:` target.
 */

/** @import { StateDef, Store } from "./types.ts" */

import { Dep } from "./index.js";

/** @param {any} def @returns {StateDef} */
const normalize = (def) =>
  def && typeof def === "object" && ("default" in def || "pack" in def || "unpack" in def)
    ? def
    : { default: def };

/** @param {any} v */
const clone = (v) =>
  typeof v === "function" ? v()
    : v && typeof v === "object" ? structuredClone(v)
      : v;

const RESERVED = new Set(["keys", "get", "set", "update", "reset", "resetAll", "subscribe", "observe", "snapshot", "restore", "$sync"]);

/**
 * @param {Record<string, any>} [defs]
 * @param {{ name?: string, accessors?: boolean }} [options]
 * @returns {Store}
 */
export const createStore = (defs = {}, { name = "store", accessors = true } = {}) => {
  /** @type {Record<string, StateDef>} */
  const spec = {};
  /** @type {Record<string, any>} */
  const values = {};
  /** @type {Map<string, Set<(v: any, oldValue?: any) => void>>} */
  const listeners = new Map();
  /** @type {Set<(key: string, value: any, oldValue: any) => void>} */
  const observers = new Set();
  /** @type {Map<string, Dep>} */
  const effectDeps = new Map();

  /** @param {string} key */
  const seed = (key) => clone(spec[key].default);

  /** @param {string} key */
  const trackRead = (key) => {
    let dep = effectDeps.get(key);
    if (!dep) {
      dep = new Dep();
      effectDeps.set(key, dep);
    }
    dep._track();
  };

  for (const [key, def] of Object.entries(defs)) {
    if (accessors && RESERVED.has(key)) throw new Error(`State field "${key}" collides with a store method.`);
    spec[key] = normalize(def);
    values[key] = seed(key);
  }

  /**
   * @param {string} key
   * @param {unknown} oldValue
   */
  const notify = (key, oldValue) => {
    const set = listeners.get(key);
    if (set) for (const cb of set) cb(values[key], oldValue);
    for (const cb of observers) cb(key, values[key], oldValue);
    const dep = effectDeps.get(key);
    if (dep) dep._notify();
  };

  const store = {
    keys: () => Object.keys(values),

    /** @param {string} key */
    get: (key) => {
      trackRead(key);
      return values[key];
    },

    /** @param {string} key @param {any} value */
    set(key, value) {
      if (!(key in spec)) throw new Error(`Unknown state field "${key}".`);
      const oldValue = values[key];
      if (oldValue === value) return value;
      values[key] = value;
      notify(key, oldValue);
      return value;
    },

    /** @param {string} key @param {(current: any) => any} fn */
    update(key, fn) {
      return store.set(key, fn(values[key]));
    },

    /** @param {string} key */
    reset(key) {
      const oldValue = values[key];
      values[key] = seed(key);
      notify(key, oldValue);
      return values[key];
    },

    resetAll() {
      /** @type {Record<string, any>} */
      const olds = {};
      for (const key of Object.keys(spec)) {
        olds[key] = values[key];
        values[key] = seed(key);
      }
      for (const key of Object.keys(spec)) notify(key, olds[key]);
    },

    /** @param {string} key @param {(v: any, oldValue?: any) => void} cb */
    subscribe(key, cb) {
      if (!listeners.has(key)) listeners.set(key, new Set());
      /** @type {Set<(v: any, oldValue?: any) => void>} */ (listeners.get(key)).add(cb);
      return () => listeners.get(key)?.delete(cb);
    },

    /** @param {(key: string, value: any, oldValue: any) => void} cb */
    observe(cb) {
      observers.add(cb);
      return () => observers.delete(cb);
    },

    snapshot: () =>
      Object.fromEntries(Object.entries(values).map(([k, v]) => [k, spec[k].pack ? spec[k].pack(v) : v])),

    /** @param {Record<string, any>} [snap] */
    restore(snap) {
      /** @type {Record<string, any>} */
      const olds = {};
      for (const key of Object.keys(spec)) {
        olds[key] = values[key];
        values[key] = snap && key in snap
          ? (spec[key].unpack ? spec[key].unpack(snap[key]) : snap[key])
          : seed(key);
      }
      for (const key of Object.keys(spec)) notify(key, olds[key]);
    },
  };

  if (accessors)
    for (const key of Object.keys(spec))
      Object.defineProperty(store, key, {
        get: () => values[key],
        set: (value) => store.set(key, value),
        enumerable: true,
        configurable: true,
      });

  /** @type {any} */ (store).$sync = { adapter: name, get: store.get, set: store.set, subscribe: store.subscribe };
  return /** @type {Store} */ (/** @type {unknown} */ (store));
};
