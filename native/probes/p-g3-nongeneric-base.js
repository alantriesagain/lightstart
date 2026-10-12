/** @file P-G3: a non-generic base class (Dep) extended by a generic class (Signal), the M4 shape. */

/** @type {Watcher | null} */
let current = null;

class Dep {
  constructor() {
    /** @type {Set<Watcher>} */
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
    for (const w of Array.from(this._subscribers)) w.run();
  }
}

class Watcher {
  /** @param {() => void} fn */
  constructor(fn) {
    /** @type {Set<Dep>} */
    this._dependencies = new Set();
    this._fn = fn;
    this.run();
  }

  run() {
    for (const d of this._dependencies) d._subscribers.delete(this);
    this._dependencies.clear();
    const prev = current;
    current = this;
    try {
      this._fn();
    } finally {
      current = prev;
    }
  }
}

/**
 * @template T
 * @extends {Dep}
 */
class Sig extends Dep {
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
}

const a = new Sig(1);
const b = new Sig("x");
/** @type {string[]} */
const seen = [];
new Watcher(() => {
  seen.push(String(a.value) + b.value);
});
a.value = 2;
b.value = "y";
console.log(seen.join(","), a._subscribers.size, b._subscribers.size);

export {};
