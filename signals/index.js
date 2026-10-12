/**
 * @bootstrapp/light/signals: the reactive primitives.
 * Preact Signals-compatible: signal, computed, effect, batch, untracked,
 * plus selector (keyed O(2) selection) and the dependency protocol
 * (getCurrentEffect / Reactive) external sources build on.
 */

/** @import { Reactive } from "./types.ts" */

/** @type {Reactive | null} */
let currentEffect = null;
let batchDepth = 0;
/** @type {Set<Reactive>} */
const pendingEffects = new Set();

/**
 * @template T
 */
class Signal {
  /** @param {T} value */
  constructor(value) {
    /** @type {T} */
    this._value = value;
    /** @type {Set<Reactive>} */
    this._subscribers = new Set();
  }

  /** @returns {T} */
  get value() {
    if (currentEffect) {
      this._subscribers.add(currentEffect);
      currentEffect._dependencies.add(/** @type {Signal<unknown>} */ (/** @type {unknown} */ (this)));
    }
    return this._value;
  }

  /** @param {T} newValue */
  set value(newValue) {
    if (this._value === newValue) return;
    this._value = newValue;
    this._notify();
  }

  /** @returns {T} */
  peek() {
    return this._value;
  }

  /**
   * Store a value without notifying: the one write path a subclass uses, so
   * the field stays declared here (a checker that sees `this._value = …` in
   * a subclass method would declare it twice).
   * @param {T} value
   */
  _assign(value) {
    this._value = value;
  }

  _notify() {
    for (const subscriber of [...this._subscribers])
      if (batchDepth > 0)
        pendingEffects.add(subscriber);
       else
        subscriber._execute();
  }

  /**
   * @param {(value: T) => void} callback
   * @returns {() => void}
   */
  subscribe(callback) {
    const effectFn = effect(() => {
      const value = this.value;
      untracked(() => callback(value));
    });
    return () => effectFn.dispose();
  }

  /**
   * Sync-source shim: makes any Signal a valid view/controller `sync:`
   * target via the `$sync` duck-type the binding layer already consumes.
   * The contract is keyed (get/set/subscribe take a key) but a signal has
   * one value, so the key is ignored. Conceptual coupling only; no
   * import of the controller package. A Computed bound this way is
   * read-only: a write through set() throws (no value setter).
   *
   * @returns {{ adapter: string, get: (key: string) => T, set: (key: string, value: T) => void, subscribe: (key: string, cb: (value: T) => void) => () => void }}
   */
  get $sync() {
    return {
      adapter: "signal",
      get: (_key) => this.peek(),
      set: (_key, value) => {
        this.value = value;
      },
      subscribe: (_key, cb) => this.subscribe(cb),
    };
  }

  /** @returns {T} */
  toJSON() {
    return this._value;
  }

  toString() {
    return String(this._value);
  }

  /** @returns {T} */
  valueOf() {
    return this._value;
  }
}

/**
 * @template T
 * @extends {Signal<T>}
 */
class Computed extends Signal {
  /** @param {() => T} fn */
  constructor(fn) {
    super(/** @type {T} */ (/** @type {unknown} */ (undefined)));
    /** @type {() => T} */
    this._fn = fn;
    this._stale = true;
    /** @type {Reactive | null} */
    this._effect = null;
    this._computing = false;
  }

  /** @returns {T} */
  get value() {
    if (this._stale && !this._computing) {
      this._computing = true;
      const prevEffect = currentEffect;
      const eff = this._effect || (this._effect = {
        _execute: () => {
          this._stale = true;
          this._notify();
        },
        _dependencies: new Set(),
        _cleanup: () => {
          if (!this._effect) return;
          for (const dep of this._effect._dependencies)
            dep._subscribers.delete(this._effect);

          this._effect._dependencies.clear();
        },
      });
      currentEffect = eff;
      eff._dependencies.forEach((dep) => dep._subscribers.delete(eff));
      eff._dependencies.clear();

      try {
        this._assign(this._fn());
      } finally {
        currentEffect = prevEffect;
        this._stale = false;
        this._computing = false;
      }
    }

    if (currentEffect) {
      this._subscribers.add(currentEffect);
      currentEffect._dependencies.add(/** @type {Signal<unknown>} */ (/** @type {unknown} */ (this)));
    }

    return this._value;
  }

}

class Effect {
  /** @param {() => void} fn */
  constructor(fn) {
    /** @type {() => void} */
    this._fn = fn;
    /** @type {Set<Signal<unknown>>} */
    this._dependencies = new Set();
    this._disposed = false;
    this._execute();
  }

  _execute() {
    if (this._disposed) return;

    this._cleanup();

    const prevEffect = currentEffect;
    currentEffect = /** @type {Reactive} */ (/** @type {unknown} */ (this));

    try {
      this._fn();
    } finally {
      currentEffect = prevEffect;
    }
  }

  _cleanup() {
    for (const dep of this._dependencies)
      dep._subscribers.delete(/** @type {Reactive} */ (/** @type {unknown} */ (this)));

    this._dependencies.clear();
  }

  dispose() {
    this._disposed = true;
    this._cleanup();
  }
}

/**
 * @template T
 * @param {T} initialValue
 * @returns {Signal<T>}
 */
export function signal(initialValue) {
  return new Signal(initialValue);
}

/**
 * @template T
 * @param {() => T} fn
 * @returns {Computed<T>}
 */
export function computed(fn) {
  return new Computed(fn);
}

/**
 * @param {() => void} fn
 * @returns {Effect}
 */
export function effect(fn) {
  return new Effect(fn);
}

/**
 * Batch multiple signal updates; subscribed effects run once at the
 * end instead of per-update.
 *
 * @param {() => void} fn
 */
export function batch(fn) {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      const effects = [...pendingEffects];
      pendingEffects.clear();
      for (const effect of effects)
        effect._execute();
    }
  }
}

/**
 * Run `fn` without subscribing the current effect to any signals it reads.
 *
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
export function untracked(fn) {
  const prevEffect = currentEffect;
  currentEffect = null;
  try {
    return fn();
  } finally {
    currentEffect = prevEffect;
  }
}

/**
 * The reactive effect currently executing, or null. Lets external
 * reactive sources (the store's per-key reads, renderer thunk parts)
 * register with the running effect using the same dependency protocol
 * signals use.
 *
 * @returns {Reactive | null}
 */
export const getCurrentEffect = () => currentEffect;

/**
 * Keyed selection over a signal: the O(2) answer to selection fan-out.
 * `selector(sig)` returns `isSelected(key)`: called inside an effect it
 * registers that effect under the KEY it asked about (a plain Map keyed
 * by the value, so primitives are the natural case), not under the
 * signal. When the signal changes, only the effects registered under
 * the previous and the new value re-run. A thousand list items cost
 * two notifications per selection change instead of a thousand.
 *
 * @template T
 * @param {Signal<T>} source
 * @returns {(key: T) => boolean}
 */
export function selector(source) {
  /** @type {Map<unknown, { _subscribers: Set<Reactive> }>} */
  const buckets = new Map();
  let current = source.peek();

  const notifyKey = (/** @type {unknown} */ key) => {
    const dep = buckets.get(key);
    if (!dep) return;
    for (const eff of [...dep._subscribers]) eff._execute();
    if (dep._subscribers.size === 0) buckets.delete(key);
  };

  source.subscribe((value) => {
    if (value === current) return;
    const previous = current;
    current = value;
    notifyKey(previous);
    notifyKey(value);
  });

  return (key) => {
    if (currentEffect) {
      let dep = buckets.get(key);
      if (!dep) {
        dep = { _subscribers: new Set() };
        buckets.set(key, dep);
      }
      dep._subscribers.add(currentEffect);
      currentEffect._dependencies.add(/** @type {Signal<unknown>} */ (/** @type {unknown} */ (dep)));
    }
    return key === current;
  };
}

export { Signal };
