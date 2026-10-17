/**
 * @bootstrapp/light/signals/store: Store
 * The canonical declared reactive store: per-key subscribe, optional
 * flattened accessors (off for views, controllers and extensions, whose
 * instance is the accessor surface, so a declared key may share a store
 * method's name), pack/unpack serialization, and a `$sync` bridge so any store
 * is a valid View `sync:` target.
 */

import type { StateDef, Store } from "./types.ts";

import { Dep, getCurrentEffect } from "./index.ts";

const normalize = (def: unknown): StateDef =>
  def && typeof def === "object" && ("default" in def || "pack" in def || "unpack" in def)
    ? (def as StateDef)
    : { default: def };

const clone = (v: unknown): unknown =>
  typeof v === "function" ? (v as () => unknown)()
    : v && typeof v === "object" ? structuredClone(v)
      : v;

const RESERVED = new Set(["keys", "get", "set", "update", "reset", "resetAll", "subscribe", "observe", "snapshot", "restore", "$sync"]);

export const createStore = (defs: Record<string, unknown> = {}, { name = "store", accessors = true }: { name?: string, accessors?: boolean } = {}): Store => {
  const spec: Record<string, StateDef> = {};
  const values: Record<string, unknown> = {};
  const listeners: Map<string, Set<(v: unknown, oldValue?: unknown) => void>> = new Map();
  const observers: Set<(key: string, value: unknown, oldValue: unknown) => void> = new Set();
  const effectDeps: Map<string, Dep> = new Map();

  const seed = (key: string) => clone(spec[key].default);

  const trackRead = (key: string) => {
    if (getCurrentEffect() === null) return;
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

  const notify = (key: string, oldValue: unknown) => {
    const set = listeners.get(key);
    if (set) for (const cb of set) cb(values[key], oldValue);
    for (const cb of observers) cb(key, values[key], oldValue);
    const dep = effectDeps.get(key);
    if (dep) dep._notify();
  };

  const store = {
    keys: () => Object.keys(values),

    get: (key: string) => {
      trackRead(key);
      return values[key];
    },

    set(key: string, value: unknown) {
      if (!(key in spec)) throw new Error(`Unknown state field "${key}".`);
      const oldValue = values[key];
      if (oldValue === value) return value;
      values[key] = value;
      notify(key, oldValue);
      return value;
    },

    update(key: string, fn: (current: unknown) => unknown) {
      return store.set(key, fn(values[key]));
    },

    reset(key: string) {
      const oldValue = values[key];
      values[key] = seed(key);
      notify(key, oldValue);
      return values[key];
    },

    resetAll() {
      const olds: Record<string, unknown> = {};
      for (const key of Object.keys(spec)) {
        olds[key] = values[key];
        values[key] = seed(key);
      }
      for (const key of Object.keys(spec)) notify(key, olds[key]);
    },

    subscribe(key: string, cb: (v: unknown, oldValue?: unknown) => void) {
      if (!listeners.has(key)) listeners.set(key, new Set());
      (listeners.get(key) as Set<(v: unknown, oldValue?: unknown) => void>).add(cb);
      return () => listeners.get(key)?.delete(cb);
    },

    observe(cb: (key: string, value: unknown, oldValue: unknown) => void) {
      observers.add(cb);
      return () => observers.delete(cb);
    },

    snapshot: () =>
      Object.fromEntries(Object.entries(values).map(([k, v]) => [k, spec[k].pack ? spec[k].pack(v) : v])),

    restore(snap?: Record<string, unknown>) {
      const olds: Record<string, unknown> = {};
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

  const typed = store as unknown as Store;
  typed.$sync = { adapter: name, get: store.get, set: store.set, subscribe: store.subscribe };
  return typed;
};
