/**
 * @file Probe J: Map entries natively. Destructuring in for-of over a Map, `entries()`,
 * `forEach`, and the tokenizer reading static attributes of a marked element, which the terminal
 * host turns into props in that order.
 */
import { tokenize, TplElement } from "../../html/tokenizer.js";

/** @type {Map<string, string>} */
const attrs = new Map();
attrs.set("border", "");
attrs.set("padding", "2");
attrs.set("direction", "row");
/** @type {string[]} */
const out = [];
for (const [name, value] of attrs) out.push(name + "=" + JSON.stringify(value));
console.log("for-of destructured:", out.join(" "));
out.length = 0;
for (const entry of attrs.entries()) out.push(entry[0] + "=" + JSON.stringify(entry[1]));
console.log("entries indexed:", out.join(" "));

const tree = tokenize("<box border padding=2 direction=\"row\" data-$$><text>x</text></box>", 1);
const box = tree[0];
if (box instanceof TplElement) {
  out.length = 0;
  for (const [name, value] of box.attrs) out.push(name + "=" + JSON.stringify(value) + ":" + typeof value);
  console.log("tokenized:", box.tag, box.marked, out.join(" "));
}

/** @typedef {string | number | boolean | null} PropValue */
/** @param {Map<string, string>} map */
const apply = (map) => {
  /** @type {string[]} */
  const kinds = [];
  for (const [name, value] of map) {
    /** @type {PropValue} */
    const v = value === "" ? true : value;
    kinds.push(name + ":" + (v === null ? "null" : typeof v));
  }
  return kinds.join(" ");
};
console.log("applied:", apply(attrs));

export {};
