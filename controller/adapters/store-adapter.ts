/**
 * @bootstrapp/light/controller: Store-as-Adapter Facade
 * Wraps anything store-shaped (a bare store, a controller instance via its
 * `$sync`) in the Adapter interface, so a controller can be registered as a
 * named sync target and bound with the same code as localStorage. The store
 * is the source of truth for its own subscribers, so `emit` propagates an
 * inbound value by writing it; the store then notifies everyone bound to that
 * key, including listeners registered through `on`.
 */

import type { Adapter, ListenerFn, StoreShaped, SyncObj } from "../types.ts";
import type { Signal } from "../../signals/index.ts";

import { effect, signal } from "../../signals/index.ts";

/** The adapter over `target`'s `$sync` (or `target` itself, when it is the surface), registered as `name`. */
export const adapterFor = (name: string, target: StoreShaped): Adapter => {
  const surface = (target.$sync ?? target) as SyncObj;
  const keysOf = () => target.$state?.keys?.() ?? target.keys?.() ?? [];
  const unsubs: Array<{ callback: ListenerFn, off: () => void }> = [];
  const listeners: Map<string, Set<ListenerFn>> = new Map();
  const signals: Map<string, Signal<unknown>> = new Map();

  const adapter: Adapter = {
    name,
    get: (key) => surface.get(key),
    set: (key, value) => surface.set(key, value),
    remove: (key) => surface.set(key, undefined),
    has: (key) => keysOf().includes(key),
    keys: keysOf,
    entries: () => keysOf().map((key): [string, unknown] => [key, surface.get(key)]),
    on(key, callback) {
      const off = surface.subscribe(key, callback);
      const known = unsubs.find((entry) => entry.callback === callback);
      if (known) known.off = off;
      else unsubs.push({ callback, off });
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key)?.add(callback);
      return () => this.off(key, callback);
    },
    off(key, callback) {
      const at = unsubs.findIndex((entry) => entry.callback === callback);
      if (at !== -1) {
        unsubs[at].off();
        unsubs.splice(at, 1);
      }
      listeners.get(key)?.delete(callback);
    },
    emit(key, value) {
      surface.set(key, value);
    },
    hasListeners: (key) => (listeners.get(key)?.size ?? 0) > 0,
    signal(key, defaultValue) {
      const existing = signals.get(key);
      if (existing) return existing;

      const sig = signal(surface.get(key) ?? defaultValue);
      effect(() => {
        const value = sig.value;
        if (value !== surface.get(key)) surface.set(key, value);
      });
      surface.subscribe(key, (value) => {
        if (value !== sig.peek()) sig.value = value ?? defaultValue;
      });
      signals.set(key, sig);
      return sig;
    },
    _listeners: listeners,
    _signals: signals,
  };
  return adapter;
};
