/**
 * @file Probe K: a string read out of a Map, passed to a method whose parameter is the prop
 * union `string | number | boolean | null`. Four forms: destructured in for-of, `entries()` with
 * an index, through a local const, and through `String(value)`.
 */

/** @typedef {string | number | boolean | null} PropValue */

class Element {
  constructor() {
    /** @type {string[]} */
    this.seen = [];
  }

  /**
   * @param {string} name
   * @param {PropValue} v
   */
  setProp(name, v) {
    this.seen.push(name + ":" + (v === null ? "null" : typeof v) + ":" + String(v));
  }
}

/** @type {Map<string, string>} */
const attrs = new Map();
attrs.set("border", "");
attrs.set("padding", "2");

const a = new Element();
for (const [name, value] of attrs)
  if (value === "") a.setProp(name, true);
  else a.setProp(name, value);
console.log("destructured:", a.seen.join(" "));

const b = new Element();
for (const entry of attrs.entries())
  if (entry[1] === "") b.setProp(entry[0], true);
  else b.setProp(entry[0], entry[1]);
console.log("entries:", b.seen.join(" "));

const c = new Element();
for (const [name, value] of attrs) {
  /** @type {string} */
  const text = value;
  if (text === "") c.setProp(name, true);
  else c.setProp(name, text);
}
console.log("local const:", c.seen.join(" "));

const d = new Element();
for (const [name, value] of attrs) {
  const text = String(value);
  if (text === "") d.setProp(name, true);
  else d.setProp(name, text);
}
console.log("String():", d.seen.join(" "));

const e = new Element();
for (const name of attrs.keys()) {
  const value = attrs.get(name) ?? "";
  if (value === "") e.setProp(name, true);
  else e.setProp(name, value);
}
console.log("keys+get:", e.seen.join(" "));

export {};
