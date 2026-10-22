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

class Slot {
  initial: unknown;
  pack: ((value: unknown) => unknown) | null;
  unpack: ((packed: unknown) => unknown) | null;
  value: unknown;

  constructor(def: StateDef) {
    this.initial = def.default;
    this.pack = def.pack ?? null;
    this.unpack = def.unpack ?? null;
    this.value = clone(def.default);
  }
}

export const createStore = (defs: Record<string, unknown> = {}, { name = "store", accessors = true }: { name?: string, accessors?: boolean } = {}): StoreCore => {
  const slots: Map<string, Slot> = new Map();
  const listeners: Map<string, Listeners<KeyListener>> = new Map();
  const observers: Listeners<Observer> = new Listeners();
  const effectDeps: Map<string, Dep> = new Map();

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
    slots.set(key, new Slot(normalize(def)));
  }
  const keyList = [...slots.keys()];

  const slotOf = (key: string): Slot => {
    const slot = slots.get(key);
    if (slot === undefined) throw new Error(`Unknown state field "${key}".`);
    return slot;
  };

  const notify = (key: string, slot: Slot, oldValue: unknown) => {
    const keyed = listeners.get(key);
    if (keyed) keyed.forEach((cb) => cb(slot.value, oldValue));
    observers.forEach((cb) => cb(key, slot.value, oldValue));
    const dep = effectDeps.get(key);
    if (dep) dep._notify();
  };

  const keys = () => keyList.slice();

  const get = (key: string) => {
    trackRead(key);
    const slot = slots.get(key);
    return slot === undefined ? undefined : slot.value;
  };

  const set = (key: string, value: unknown) => {
    const slot = slotOf(key);
    const oldValue = slot.value;
    if (oldValue === value) return value;
    slot.value = value;
    notify(key, slot, oldValue);
    return value;
  };

  const update = (key: string, fn: (current: unknown) => unknown) => {
    const slot = slots.get(key);
    return set(key, fn(slot === undefined ? undefined : slot.value));
  };

  const reset = (key: string) => {
    const slot = slotOf(key);
    const oldValue = slot.value;
    slot.value = clone(slot.initial);
    notify(key, slot, oldValue);
    return slot.value;
  };

  const resetAll = () => {
    const olds: unknown[] = [];
    for (const slot of slots.values()) {
      olds.push(slot.value);
      slot.value = clone(slot.initial);
    }
    let i = 0;
    for (const [key, slot] of slots) notify(key, slot, olds[i++]);
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

  const snapshot = () => Object.fromEntries([...slots].map(([key, slot]) => [key, slot.pack ? slot.pack(slot.value) : slot.value]));

  const restore = (snap?: Record<string, unknown>) => {
    const olds: unknown[] = [];
    for (const [key, slot] of slots) {
      olds.push(slot.value);
      slot.value = snap && key in snap
        ? (slot.unpack ? slot.unpack(snap[key]) : snap[key])
        : clone(slot.initial);
    }
    let i = 0;
    for (const [key, slot] of slots) notify(key, slot, olds[i++]);
  };

  const store: Record<string, unknown> = { keys, get, set, update, reset, resetAll, subscribe, observe, snapshot, restore };

  if (accessors)
    for (const [key, slot] of slots)
      Object.defineProperty(store, key, {
        get: () => slot.value,
        set: (value: unknown) => set(key, value),
        enumerable: true,
        configurable: true,
      });

  store.$sync = { adapter: name, get, set, subscribe };
  return store as unknown as StoreCore;
};
