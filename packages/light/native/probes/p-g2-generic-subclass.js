/** @file P-G2: a generic JS subclass of a generic class (light's Computed extends Signal). */

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

/**
 * @template T
 * @extends {Box<T>}
 */
class Lazy extends Box {
  /** @param {() => T} fn */
  constructor(fn) {
    super(/** @type {T} */ (/** @type {unknown} */ (undefined)));
    this._fn = fn;
    this._stale = true;
  }

  /** @returns {T} */
  get value() {
    if (this._stale) {
      this._assign(this._fn());
      this._stale = false;
    }
    return this._value;
  }
}

const n = new Lazy(() => 41 + 1);
const s = new Lazy(() => "a" + "b");
/** @type {Box<number>} */
const asBase = n;
console.log(n.value, s.value, asBase.value, n instanceof Box);

export {};
