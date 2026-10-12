/**
 * @bootstrapp/light/signals: the reactive primitives.
 * Preact Signals-compatible: signal, computed, effect, batch, untracked,
 * plus selector (keyed O(2) selection) and the dependency protocol
 * (getCurrentEffect / Dep / Reactive) external sources build on. A write
 * notifies in waves: computed invalidations first, then the effects they
 * reach, each once, so a diamond never shows an effect a half-updated state.
 */

/** @type {Reactive | null} */
let current = null;
let batchDepth = 0;
/** @type {Reactive[]} */
const pending = [];

const flushPending = () => {
  while (pending.length > 0) {
    const wave = pending.splice(0, pending.length);
    batchDepth++;
    try {
      for (const reactive of wave) {
        reactive._queued = false;
        reactive._execute();
      }
    } finally {
      batchDepth--;
    }
  }
};

/**
 * The subscriber side of the protocol: what a signal, a store key or a
 * selector bucket exposes to the reactive reading it. `_track()` on a read
 * registers the running reactive; `_notify()` on a write schedules every
 * subscriber.
 */
export class Dep {
  constructor() {
    /** @type {Set<Reactive>} */
    this._subscribers = new Set();
  }

  _track() {
    const reactive = current;
    if (reactive === null) return;
    const self = /** @type {Dep} */ (this);
    this._subscribers.add(reactive);
    reactive._dependencies.add(self);
  }

  _notify() {
    batchDepth++;
    try {
      for (const reactive of Array.from(this._subscribers)) reactive._schedule();
    } finally {
      batchDepth--;
      if (batchDepth === 0) flushPending();
    }
  }
}

/**
 * The reader side: something that runs with itself as the current reactive,
 * collects the deps it read, and re-runs when one notifies. Effects, computed
 * invalidators and a view's render node extend it.
 */
export class Reactive {
  constructor() {
    /** @type {Set<Dep>} */
    this._dependencies = new Set();
    this._disposed = false;
    this._queued = false;
  }

  _run() {}

  _schedule() {
    if (this._disposed) return;
    if (batchDepth > 0) {
      if (!this._queued) {
        this._queued = true;
        pending.push(this);
      }
    } else this._execute();
  }

  _execute() {
    if (this._disposed) return;
    this._cleanup();
    const prev = current;
    current = this;
    try {
      this._run();
    } finally {
      current = prev;
    }
  }

  _cleanup() {
    const self = /** @type {Reactive} */ (this);
    for (const dep of this._dependencies) dep._subscribers.delete(self);
    this._dependencies.clear();
  }

  dispose() {
    this._disposed = true;
    this._cleanup();
  }
}

class Effect extends Reactive {
  /** @param {() => void} fn */
  constructor(fn) {
    super();
    /** @type {() => void} */
    this._fn = fn;
    this._execute();
  }

  _run() {
    this._fn();
  }
}

/**
 * @template T
 * @extends {Dep}
 */
export class Signal extends Dep {
  /** @param {T} value */
  constructor(value) {
    super();
    /** @type {T} */
    this._value = value;
  }

  /** @returns {T} */
  get value() {
    this._track();
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
   * the field stays declared here.
   * @param {T} value
   */
  _assign(value) {
    this._value = value;
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
   * one value, so the key is ignored.
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

class ComputedNode extends Reactive {
  /** @param {() => void} onInvalidate */
  constructor(onInvalidate) {
    super();
    /** @type {() => void} */
    this._onInvalidate = onInvalidate;
  }

  _run() {
    this._onInvalidate();
  }
}

/**
 * A derived value: computed lazily on read, cached until a dependency
 * changes, read-only. A sibling of Signal rather than a subclass (a native
 * build cannot specialise a generic subclass of a generic class), with the
 * same reading surface.
 *
 * @template T
 * @extends {Dep}
 */
export class Computed extends Dep {
  /** @param {() => T} fn */
  constructor(fn) {
    super();
    /** @type {() => T} */
    this._fn = fn;
    /** @type {T} */
    this._value = /** @type {T} */ (/** @type {unknown} */ (undefined));
    this._stale = true;
    this._computing = false;
    this._node = new ComputedNode(() => {
      if (this._stale) return;
      this._stale = true;
      this._notify();
    });
  }

  /** @returns {T} */
  get value() {
    if (this._stale && !this._computing) {
      this._computing = true;
      this._node._cleanup();
      const prev = current;
      current = this._node;
      try {
        this._value = this._fn();
      } finally {
        current = prev;
        this._stale = false;
        this._computing = false;
      }
    }
    this._track();
    return this._value;
  }

  /** @param {T} _newValue */
  set value(_newValue) {
    throw new Error("Cannot set value of a computed signal; define a getter");
  }

  /** @returns {T} the current value, recomputed if stale, without subscribing */
  peek() {
    return untracked(() => this.value);
  }

  dispose() {
    this._node.dispose();
    this._stale = true;
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
   * The read-only sync shim: a write through it throws like the setter.
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
    return this.peek();
  }

  toString() {
    return String(this.peek());
  }

  /** @returns {T} */
  valueOf() {
    return this.peek();
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
    if (batchDepth === 0) flushPending();
  }
}

/**
 * Run `fn` without subscribing the current reactive to any signals it reads.
 *
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
export function untracked(fn) {
  const prev = current;
  current = null;
  try {
    return fn();
  } finally {
    current = prev;
  }
}

/**
 * Run `fn` with `reactive` as the current reactive: what a view's render
 * node does to subscribe the view to the signals its render reads.
 *
 * @template T
 * @param {Reactive | null} reactive
 * @param {() => T} fn
 * @returns {T}
 */
export function withCurrent(reactive, fn) {
  const prev = current;
  current = reactive;
  try {
    return fn();
  } finally {
    current = prev;
  }
}

/**
 * The reactive currently executing, or null. Lets external
 * reactive sources (the store's per-key reads, renderer thunk parts)
 * register with the running effect using the same dependency protocol
 * signals use.
 *
 * @returns {Reactive | null}
 */
export const getCurrentEffect = () => current;

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
  /** @type {Map<unknown, Dep>} */
  const buckets = new Map();
  let currentKey = source.peek();

  /** @param {unknown} key */
  const notifyKey = (key) => {
    const dep = buckets.get(key);
    if (!dep) return;
    dep._notify();
    if (dep._subscribers.size === 0) buckets.delete(key);
  };

  source.subscribe((value) => {
    if (value === currentKey) return;
    const previous = currentKey;
    currentKey = value;
    notifyKey(previous);
    notifyKey(value);
  });

  return (key) => {
    if (current !== null) {
      let dep = buckets.get(key);
      if (!dep) {
        dep = new Dep();
        buckets.set(key, dep);
      }
      dep._track();
    }
    return key === currentKey;
  };
}
