/**
 * @bootstrapp/light/controller: Keyed Listeners Mixin
 * Shared on/off/emit/hasListeners/signal pattern used by all adapters.
 */

import { signal, effect } from "../../signals/index.ts";

/** @import { ListenerFn, AdapterCore, Adapter } from "../types.ts" */
/** @import { Signal } from "../../signals/index.ts" */

/**
 * Attach on/off/emit/signal methods to `target` and return it.
 *
 * @template {AdapterCore} T
 * @param {T} target
 * @returns {T & Adapter}
 */
export const withKeyedListeners = (target) => {
  /** @type {Map<string, Set<ListenerFn>>} */
  const listeners = new Map();
  /** @type {Map<string, Signal<unknown>>} */
  const signals = new Map();

  const augmented = /** @type {T & Adapter} */ (target);

  augmented.on = (key, callback) => {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key)?.add(callback);
    return () => { listeners.get(key)?.delete(callback); };
  };

  augmented.off = (key, callback) => {
    listeners.get(key)?.delete(callback);
  };

  augmented.emit = (key, value, opts) => {
    listeners.get(key)?.forEach((fn) => fn(value, opts));
  };

  augmented.hasListeners = (key) =>
    listeners.has(key) && (listeners.get(key)?.size ?? 0) > 0;

  augmented.signal = (key, defaultValue) => {
    const existing = signals.get(key);
    if (existing) return existing;

    const initialValue = augmented.get(key) ?? defaultValue;
    const sig = signal(initialValue);

    effect(() => {
      const value = sig.value;
      if (value !== augmented.get(key))
        augmented.set(key, value);
    });

    augmented.on(key, (value) => {
      if (value !== sig.peek())
        sig.value = value ?? defaultValue;
    });

    signals.set(key, sig);
    return sig;
  };

  augmented._listeners = listeners;
  augmented._signals = signals;

  return augmented;
};

/**
 * Lazy proxy that resolves the real adapter on each call (used for
 * `localStorage`/`sessionStorage` where `window` may not exist yet).
 *
 * @param {string} name
 * @param {() => Adapter} getAdapter
 * @returns {Adapter}
 */
export const createLazyAdapter = (name, getAdapter) => {
  /** @type {Array<string>} */
  const methods = ["get", "set", "remove", "has", "keys", "entries", "on", "off", "emit", "hasListeners", "signal"];
  /** @type {Record<string, unknown>} */
  const proxy = { get name() { return name; } };
  for (const method of methods)
    proxy[method] = (/** @type {unknown[]} */ ...args) => {
      const target = /** @type {Record<string, (...a: unknown[]) => unknown>} */ (/** @type {unknown} */ (getAdapter()));
      return target[method](...args);
    };

  return /** @type {Adapter} */ (/** @type {unknown} */ (proxy));
};
