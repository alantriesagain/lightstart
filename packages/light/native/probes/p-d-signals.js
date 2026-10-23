/**
 * @file P-D: the signals graph as light's signals/index.js will have it after M4: a non-generic
 * Dep base (subscribers, track, notify) with generic Signal and Computed as sibling subclasses
 * (a generic subclass of a generic class is a compiler ICE, probe p-g2), a Reactive base class
 * instead of light's structural interface, and the wave-draining notify that makes diamonds
 * glitch-free.
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
      for (const r of wave) {
        r._queued = false;
        r._execute();
      }
    } finally {
      batchDepth--;
    }
  }
};

class Dep {
  constructor() {
    /** @type {Set<Reactive>} */
    this._subscribers = new Set();
  }

  _track() {
    const w = current;
    if (w === null) return;
    const self = /** @type {Dep} */ (this);
    this._subscribers.add(w);
    w._dependencies.add(self);
  }

  _notify() {
    batchDepth++;
    try {
      for (const r of Array.from(this._subscribers)) r._schedule();
    } finally {
      batchDepth--;
      if (batchDepth === 0) flushPending();
    }
  }
}

class Reactive {
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
    for (const d of this._dependencies) d._subscribers.delete(self);
    this._dependencies.clear();
  }

  dispose() {
    this._disposed = true;
    this._cleanup();
  }
}

/** @param {() => void} fn */
const batch = (fn) => {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) flushPending();
  }
};

class Effect extends Reactive {
  /** @param {() => void} fn */
  constructor(fn) {
    super();
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
class Signal extends Dep {
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

  /** @param {T} next */
  set value(next) {
    if (this._value === next) return;
    this._value = next;
    this._notify();
  }

  /** @returns {T} */
  peek() {
    return this._value;
  }

  /**
   * @param {(value: T) => void} callback
   * @returns {() => void}
   */
  subscribe(callback) {
    const e = new Effect(() => {
      const v = this.value;
      const prev = current;
      current = null;
      try {
        callback(v);
      } finally {
        current = prev;
      }
    });
    return () => e.dispose();
  }
}

class ComputedNode extends Reactive {
  /** @param {() => void} onInvalidate */
  constructor(onInvalidate) {
    super();
    this._onInvalidate = onInvalidate;
  }

  _run() {
    this._onInvalidate();
  }
}

/**
 * @template T
 * @extends {Dep}
 */
class Computed extends Dep {
  /** @param {() => T} fn */
  constructor(fn) {
    super();
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

  /** @param {T} _next */
  set value(_next) {
    throw new Error("Cannot set value of a computed signal; define a getter");
  }

  /** @returns {T} */
  peek() {
    return this.value;
  }
}

/**
 * @template T
 * @param {T} v
 * @returns {Signal<T>}
 */
const signal = (v) => new Signal(v);
/**
 * @template T
 * @param {() => T} fn
 * @returns {Computed<T>}
 */
const computed = (fn) => new Computed(fn);

/** @type {string[]} */
const out = [];
const a = signal(1);
const b = computed(() => a.value + 1);
const c = computed(() => a.value * 10);
/** @type {string[]} */
const seen = [];
const e = new Effect(() => {
  seen.push(String(b.value) + "/" + String(c.value));
});
a.value = 2;
out.push("diamond " + seen.join(" "));
batch(() => {
  a.value = 3;
  a.value = 4;
});
out.push("batch " + seen.join(" "));
e.dispose();
a.value = 5;
out.push("disposed " + String(seen.length) + " subs=" + String(b._subscribers.size));
out.push("peek " + String(c.peek()) + " lazy=" + String(c._stale));
const name = signal("x");
const upper = computed(() => name.value.toUpperCase());
out.push("string computed " + upper.value);
/** @type {string[]} */
const got = [];
const off = name.subscribe((v) => got.push(v));
name.value = "z";
off();
name.value = "w";
out.push("subscribe " + got.join(","));
let threw = "no";
try {
  upper.value = "Y";
} catch (err) {
  threw = err instanceof Error && /getter/.test(err.message) ? "getter" : "other";
}
out.push("readonly " + threw);
console.log(out.join(" | "));

export {};
