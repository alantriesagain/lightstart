/**
 * @bootstrapp/light/controller: Store-as-Adapter Facade
 * Wraps anything store-shaped (a bare store, a controller instance via its
 * `$sync`) in the Adapter interface, so a controller can be registered as a
 * named sync target and bound with the same code as localStorage.
 */

/** @import { Adapter, ListenerFn } from "../types.ts" */
/** @import { Signal } from "../../signals/index.ts" */

import { effect, signal } from "../../signals/index.ts";

/**
 * @param {string} name
 * @param {{ $sync?: { get: Function, set: Function, subscribe: Function }, get?: Function, set?: Function, subscribe?: Function, $state?: { keys?: () => string[] }, keys?: () => string[] }} target
 * @returns {Adapter}
 */
export const adapterFor = (name, target) => {
  const surface = /** @type {{ get: (k: string) => unknown, set: (k: string, v: unknown) => unknown, subscribe: (k: string, cb: (v: unknown) => void) => () => void }} */ (
    target.$sync ?? target
  );
  const keysOf = () => target.$state?.keys?.() ?? target.keys?.() ?? [];
  /** @type {Map<ListenerFn, () => void>} */
  const unsubs = new Map();
  /** @type {Map<string, Set<ListenerFn>>} */
  const listeners = new Map();
  /** @type {Map<string, Signal<unknown>>} */
  const signals = new Map();

  return /** @type {Adapter} */ ({
    name,
    get: (/** @type {string} */ key) => surface.get(key),
    set: (/** @type {string} */ key, /** @type {unknown} */ value) => surface.set(key, value),
    remove: (/** @type {string} */ key) => surface.set(key, undefined),
    has: (/** @type {string} */ key) => keysOf().includes(key),
    keys: keysOf,
    entries: () => keysOf().map((key) => [key, surface.get(key)]),
    /**
     * @this {Adapter}
     * @param {string} key
     * @param {ListenerFn} callback
     */
    on(key, callback) {
      const off = surface.subscribe(key, /** @type {(v: unknown) => void} */ (callback));
      unsubs.set(callback, off);
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key)?.add(callback);
      return () => this.off(key, callback);
    },
    /**
     * @param {string} key
     * @param {ListenerFn} callback
     */
    off(key, callback) {
      unsubs.get(callback)?.();
      unsubs.delete(callback);
      listeners.get(key)?.delete(callback);
    },
    /**
     * The store is the source of truth for its own subscribers, so an inbound
     * value is propagated by writing it; the store then notifies everyone
     * bound to that key, including listeners registered through `on`.
     *
     * @param {string} key
     * @param {unknown} value
     */
    emit(key, value) {
      surface.set(key, value);
    },
    /** @param {string} key */
    hasListeners: (key) => (listeners.get(key)?.size ?? 0) > 0,
    /**
     * @this {Adapter}
     * @param {string} key
     * @param {unknown} [defaultValue]
     */
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
  });
};
