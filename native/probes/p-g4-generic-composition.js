/** @file P-G4: a generic "computed" that does not extend the generic signal class (composition). */

/** @template T */
class Box {
  /** @param {T} value */
  constructor(value) {
    /** @type {T} */
    this._value = value;
  }

  /** @returns {T} */
  get value() {
    return this._value;
  }

  /** @param {T} value */
  _assign(value) {
    this._value = value;
  }
}

/** @template T */
class Lazy {
  /** @param {() => T} fn */
  constructor(fn) {
    this._fn = fn;
    this._stale = true;
    /** @type {Box<T>} */
    this._box = new Box(fn());
  }

  /** @returns {T} */
  get value() {
    if (this._stale) {
      this._box._assign(this._fn());
      this._stale = false;
    }
    return this._box.value;
  }
}

const n = new Lazy(() => 41 + 1);
const s = new Lazy(() => "a" + "b");
console.log(n.value, s.value, n instanceof Lazy);

export {};
