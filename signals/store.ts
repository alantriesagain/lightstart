/**
 * @bootstrapp/light/signals/store: Store
 * The canonical declared reactive store: per-key subscribe, optional
 * flattened accessors (off for views, controllers and extensions, whose
 * instance is the accessor surface, so a declared key may share a store
 * method's name), pack/unpack serialization, and a `$sync` bridge so any store
 * is a valid View `sync:` target.
 */

import type { StateDef, StoreCore } from "./types.ts";

import { Dep, getCurrentEffect } from "./index.ts";
import { Listeners } from "./listeners.ts";

type KeyListener = (v: unknown, oldValue: unknown) => void;
type Observer = (key: string, value: unknown, oldValue: unknown) => void;

const normalize = (def: unknown): StateDef =>
  def && typeof def === "object" && ("default" in def || "pack" in def || "unpack" in def)
    ? (def as StateDef)
    : { default: def };

const clone = (v: unknown): unknown =>
  typeof v === "function" ? (v as () => unknown)()
    : v && typeof v === "object" ? structuredClone(v)
      : v;

const RESERVED = new Set(["keys", "get", "set", "update", "reset", "resetAll", "subscribe", "observe", "snapshot", "restore", "$sync"]);

export const createStore = (defs: Record<string, unknown> = {}, { name = "store", accessors = true }: { name?: string, accessors?: boolean } = {}): StoreCore => {
  const spec: Record<string, StateDef> = {};
  const values: Record<string, unknown> = {};
  const listeners: Map<string, Listeners<KeyListener>> = new Map();
  const observers: Listeners<Observer> = new Listeners();
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
    const keyed = listeners.get(key);
    if (keyed) keyed.forEach((cb) => cb(values[key], oldValue));
    observers.forEach((cb) => cb(key, values[key], oldValue));
    const dep = effectDeps.get(key);
    if (dep) dep._notify();
  };

  const keys = () => Object.keys(values);

  const get = (key: string) => {
    trackRead(key);
    return values[key];
  };

  const set = (key: string, value: unknown) => {
    if (!(key in spec)) throw new Error(`Unknown state field "${key}".`);
    const oldValue = values[key];
    if (oldValue === value) return value;
    values[key] = value;
    notify(key, oldValue);
    return value;
  };

  const update = (key: string, fn: (current: unknown) => unknown) => set(key, fn(values[key]));

  const reset = (key: string) => {
    const oldValue = values[key];
    values[key] = seed(key);
    notify(key, oldValue);
    return values[key];
  };

  const resetAll = () => {
    const olds: Record<string, unknown> = {};
    for (const key of Object.keys(spec)) {
      olds[key] = values[key];
      values[key] = seed(key);
    }
    for (const key of Object.keys(spec)) notify(key, olds[key]);
  };

  const subscribe = (key: string, cb: KeyListener) => {
    let keyed = listeners.get(key);
    if (!keyed) {
      keyed = new Listeners();
      listeners.set(key, keyed);
    }
    keyed.add(cb);
    return () => listeners.get(key)?.delete(cb);
  };

  const observe = (cb: Observer) => {
    observers.add(cb);
    return () => observers.delete(cb);
  };

  const snapshot = () =>
    Object.fromEntries(Object.entries(values).map(([k, v]) => {
      const { pack } = spec[k];
      return [k, pack ? pack(v) : v];
    }));

  const restore = (snap?: Record<string, unknown>) => {
    const olds: Record<string, unknown> = {};
    for (const key of Object.keys(spec)) {
      olds[key] = values[key];
      const { unpack } = spec[key];
      values[key] = snap && key in snap
        ? (unpack ? unpack(snap[key]) : snap[key])
        : seed(key);
    }
    for (const key of Object.keys(spec)) notify(key, olds[key]);
  };

  const store: Record<string, unknown> = { keys, get, set, update, reset, resetAll, subscribe, observe, snapshot, restore };

  if (accessors)
    for (const key of Object.keys(spec))
      Object.defineProperty(store, key, {
        get: () => values[key],
        set: (value) => set(key, value),
        enumerable: true,
        configurable: true,
      });

  store.$sync = { adapter: name, get, set, subscribe };
  return store as unknown as StoreCore;
};
