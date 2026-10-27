/**
 * @lightstart/light/signals: the reactive primitives.
 * Preact Signals-compatible: signal, computed, effect, batch, untracked,
 * plus selector (keyed O(2) selection) and the dependency protocol
 * (getCurrentEffect / Dep / Reactive) external sources build on. A write
 * notifies in waves: computed invalidations first, then the effects they
 * reach, each once, so a diamond never shows an effect a half-updated state.
 */

let current                  = null;
let batchDepth = 0;
const pending             = [];

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
  _subscribers               ;

  constructor() {
    this._subscribers = new Set();
  }

  _track() {
    const reactive = current;
    if (reactive === null) return;
    const self = this       ;
    this._subscribers.add(reactive);
    reactive._dependencies.add(self);
  }

  _notify() {
    if (this._subscribers.size === 0) return;
    batchDepth++;
    try {
      for (const reactive of this._subscribers) reactive._schedule();
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
  _dependencies          ;
  _disposed         ;
  _queued         ;

  constructor() {
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
    const self = this            ;
    for (const dep of this._dependencies) dep._subscribers.delete(self);
    this._dependencies.clear();
  }

  dispose() {
    this._disposed = true;
    this._cleanup();
  }
}

class Effect extends Reactive {
  _fn            ;

  constructor(fn            ) {
    super();
    this._fn = fn;
    this._execute();
  }

  _run() {
    this._fn();
  }
}

export class Signal    extends Dep {
  _value   ;

  constructor(value   ) {
    super();
    this._value = value;
  }

  get value()    {
    this._track();
    return this._value;
  }

  set value(newValue   ) {
    if (this._value === newValue) return;
    this._value = newValue;
    this._notify();
  }

  peek()    {
    return this._value;
  }

  /**
   * Store a value without notifying: the one write path a subclass uses, so
   * the field stays declared here.
   */
  _assign(value   ) {
    this._value = value;
  }

  subscribe(callback                    )             {
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
   */
  get $sync()                                                                                                                                                     {
    return {
      adapter: "signal",
      get: (_key) => this.peek(),
      set: (_key, value) => {
        this.value = value;
      },
      subscribe: (_key, cb) => this.subscribe(cb),
    };
  }

  toJSON()    {
    return this._value;
  }

  toString() {
    const value          = this._value;
    if (typeof value === "string") return value;
    return String(value);
  }

  valueOf()    {
    return this._value;
  }
}

class ComputedNode extends Reactive {
  _onInvalidate            ;

  constructor(onInvalidate            ) {
    super();
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
 */
export class Computed    extends Dep {
  _fn         ;
  _value               ;
  _stale         ;
  _computing         ;
  _node              ;

  constructor(fn         ) {
    super();
    this._fn = fn;
    this._value = undefined;
    this._stale = true;
    this._computing = false;
    this._node = new ComputedNode(() => {
      if (this._stale) return;
      this._stale = true;
      this._notify();
    });
  }

  get value()    {
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
    return this._value     ;
  }

  set value(_newValue   ) {
    throw new Error("Cannot set value of a computed signal; define a getter");
  }

  /** @returns the current value, recomputed if stale, without subscribing */
  peek()    {
    return untracked(() => this.value);
  }

  dispose() {
    this._node.dispose();
    this._stale = true;
  }

  subscribe(callback                    )             {
    const effectFn = effect(() => {
      const value = this.value;
      untracked(() => callback(value));
    });
    return () => effectFn.dispose();
  }

  /**
   * The read-only sync shim: a write through it throws like the setter.
   */
  get $sync()                                                                                                                                                     {
    return {
      adapter: "signal",
      get: (_key) => this.peek(),
      set: (_key, value) => {
        this.value = value;
      },
      subscribe: (_key, cb) => this.subscribe(cb),
    };
  }

  toJSON()    {
    return this.peek();
  }

  toString() {
    const value          = this.peek();
    if (typeof value === "string") return value;
    return String(value);
  }

  valueOf()    {
    return this.peek();
  }
}

export function signal   (initialValue   )            {
  return new Signal(initialValue);
}

export function computed   (fn         )              {
  return new Computed(fn);
}

export function effect(fn            )         {
  return new Effect(fn);
}

/**
 * Batch multiple signal updates; subscribed effects run once at the
 * end instead of per-update.
 */
export function batch(fn            ) {
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
 */
export function untracked   (fn         )    {
  const prev = current;
  current = null;
  try {
    return fn();
  } finally {
    current = prev;
  }
}

/**
 * Make `reactive` the current reactive and answer the one it replaced, for
 * the caller to put back with another `swapCurrent` in a `finally`: what
 * `withCurrent` does, without a closure for the work.
 */
export function swapCurrent(reactive                 )                  {
  const prev = current;
  current = reactive;
  return prev;
}

/**
 * Run `fn` with `reactive` as the current reactive: what a view's render
 * node does to subscribe the view to the signals its render reads.
 */
export function withCurrent   (reactive                 , fn         )    {
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
 */
export const getCurrentEffect = ()                  => current;

/**
 * Keyed selection over a signal: the O(2) answer to selection fan-out.
 * `selector(sig)` returns `isSelected(key)`: called inside an effect it
 * registers that effect under the KEY it asked about (a plain Map keyed
 * by the value, so primitives are the natural case), not under the
 * signal. When the signal changes, only the effects registered under
 * the previous and the new value re-run. A thousand list items cost
 * two notifications per selection change instead of a thousand.
 */
export function selector   (source           )                      {
  const buckets                    = new Map();
  let currentKey = source.peek();

  const notifyKey = (key         ) => {
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
