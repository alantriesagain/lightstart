/**
 * @lightstart/light/signals/store: Store
 * The canonical declared reactive store: per-key subscribe, optional
 * flattened accessors (off for views, controllers and extensions, whose
 * instance is the accessor surface, so a declared key may share a store
 * method's name), pack/unpack serialization, and a `$sync` bridge so any store
 * is a valid View `sync:` target.
 */

                                                      

import { Dep, getCurrentEffect } from "./index.js";
import { Listeners } from "./listeners.js";

                                                           
                                                                         

const normalize = (def         )           =>
  def && typeof def === "object" && ("default" in def || "pack" in def || "unpack" in def)
    ? (def            )
    : { default: def };

const clone = (v         )          =>
  typeof v === "function" ? (v                 )()
    : v && typeof v === "object" ? structuredClone(v)
      : v;

const RESERVED = new Set(["keys", "get", "set", "update", "reset", "resetAll", "subscribe", "observe", "snapshot", "restore", "$sync"]);

class Slot {
  initial         ;
  pack                                      ;
  unpack                                       ;
  value         ;

  constructor(def          ) {
    this.initial = def.default;
    this.pack = def.pack ?? null;
    this.unpack = def.unpack ?? null;
    this.value = clone(def.default);
  }
}

export const createStore = (defs                          = {}, { name = "store", accessors = true }                                         = {})            => {
  const slots                    = new Map();
  const listeners                                      = new Map();
  const observers                      = new Listeners();
  const effectDeps                   = new Map();

  const trackRead = (key        ) => {
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

  const slotOf = (key        )       => {
    const slot = slots.get(key);
    if (slot === undefined) throw new Error(`Unknown state field "${key}".`);
    return slot;
  };

  const notify = (key        , slot      , oldValue         ) => {
    const keyed = listeners.get(key);
    if (keyed) keyed.forEach((cb) => cb(slot.value, oldValue));
    observers.forEach((cb) => cb(key, slot.value, oldValue));
    const dep = effectDeps.get(key);
    if (dep) dep._notify();
  };

  const keys = () => keyList.slice();

  const get = (key        ) => {
    trackRead(key);
    const slot = slots.get(key);
    return slot === undefined ? undefined : slot.value;
  };

  const set = (key        , value         ) => {
    const slot = slotOf(key);
    const oldValue = slot.value;
    if (oldValue === value) return value;
    slot.value = value;
    notify(key, slot, oldValue);
    return value;
  };

  const update = (key        , fn                               ) => {
    const slot = slots.get(key);
    return set(key, fn(slot === undefined ? undefined : slot.value));
  };

  const reset = (key        ) => {
    const slot = slotOf(key);
    const oldValue = slot.value;
    slot.value = clone(slot.initial);
    notify(key, slot, oldValue);
    return slot.value;
  };

  const resetAll = () => {
    const olds            = [];
    for (const slot of slots.values()) {
      olds.push(slot.value);
      slot.value = clone(slot.initial);
    }
    let i = 0;
    for (const [key, slot] of slots) notify(key, slot, olds[i++]);
  };

  const subscribe = (key        , cb             ) => {
    let keyed = listeners.get(key);
    if (!keyed) {
      keyed = new Listeners();
      listeners.set(key, keyed);
    }
    keyed.add(cb);
    return () => listeners.get(key)?.delete(cb);
  };

  const observe = (cb          ) => {
    observers.add(cb);
    return () => observers.delete(cb);
  };

  const snapshot = () => Object.fromEntries([...slots].map(([key, slot]) => [key, slot.pack ? slot.pack(slot.value) : slot.value]));

  const restore = (snap                          ) => {
    const olds            = [];
    for (const [key, slot] of slots) {
      olds.push(slot.value);
      slot.value = snap && key in snap
        ? (slot.unpack ? slot.unpack(snap[key]) : snap[key])
        : clone(slot.initial);
    }
    let i = 0;
    for (const [key, slot] of slots) notify(key, slot, olds[i++]);
  };

  const store                          = { keys, get, set, update, reset, resetAll, subscribe, observe, snapshot, restore };

  if (accessors)
    for (const [key, slot] of slots)
      Object.defineProperty(store, key, {
        get: () => slot.value,
        set: (value         ) => set(key, value),
        enumerable: true,
        configurable: true,
      });

  store.$sync = { adapter: name, get, set, subscribe };
  return store                        ;
};
