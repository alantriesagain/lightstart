/**
 * @bootstrapp/light/controller: Keyed Listeners Mixin
 * Shared on/off/emit/hasListeners/signal pattern used by all adapters.
 */

import { signal, effect } from "../../signals/index.ts";

import type { ListenerFn, AdapterCore, Adapter } from "../types.ts";
import type { Signal } from "../../signals/index.ts";

/** Attach on/off/emit/signal methods to `target` and return it. */
export const withKeyedListeners = <T extends AdapterCore>(target: T): T & Adapter => {
  const listeners: Map<string, Set<ListenerFn>> = new Map();
  const signals: Map<string, Signal<unknown>> = new Map();

  const augmented = target as T & Adapter;

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
 */
export const createLazyAdapter = (name: string, getAdapter: () => Adapter): Adapter => {
  const methods: string[] = ["get", "set", "remove", "has", "keys", "entries", "on", "off", "emit", "hasListeners", "signal"];
  const proxy: Record<string, unknown> = { get name() { return name; } };
  for (const method of methods)
    proxy[method] = (...args: unknown[]) => {
      const target = getAdapter() as unknown as Record<string, (...a: unknown[]) => unknown>;
      return target[method](...args);
    };

  return proxy as unknown as Adapter;
};
