/** @file P-G1: one generic JS class (@template) instantiated with two type arguments. */

/** @template T */
class Box {
  /** @param {T} value */
  constructor(value) {
    /** @type {T} */
    this._value = value;
    this.reads = 0;
  }

  /** @returns {T} */
  get value() {
    this.reads++;
    return this._value;
  }

  /** @param {T} next */
  set value(next) {
    this._value = next;
  }

  /** @param {(v: T) => void} fn */
  each(fn) {
    fn(this._value);
  }
}

/**
 * @template T
 * @param {T} v
 * @returns {Box<T>}
 */
const box = (v) => new Box(v);

const n = box(1);
const s = box("a");
n.value = n.value + 1;
s.value = s.value + "b";
/** @type {string[]} */
const out = [];
n.each((v) => out.push("n" + String(v)));
s.each((v) => out.push("s" + v));
/** @type {Box<number>[]} */
const list = [n, box(5)];
console.log(out.join(","), list.map((b) => b.value).join("+"), n.reads);

export {};
