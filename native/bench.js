/**
 * @file A native benchmark: 10k keyed rows rendered into a terminal root, then every 10th
 * relabelled and the tree re-rendered, timed. Run under node (`node native/bench.js`) and as a
 * binary (`npx scriptc build native/bench.js -o native/out/bench --strip && native/out/bench`);
 * each prints the same lines, so the two compare directly.
 */
import { TRoot, frames, html, key, layout, render, DEFAULT_STYLE } from "./index.js";

class Row {
  /**
   * @param {number} id
   * @param {string} label
   */
  constructor(id, label) {
    this.id = id;
    this.label = label;
  }
}

/** @param {number} n */
const build = (n) => {
  /** @type {Row[]} */
  const rows = [];
  for (let i = 0; i < n; i++) rows.push(new Row(i + 1, "row " + String(i + 1)));
  return rows;
};

/** @param {Row[]} rows */
const view = (rows) => html`<box>${rows.map((r) => key(r.id, html`<text>${r.id} ${r.label}</text>`))}</box>`;

/**
 * @param {string} name
 * @param {() => void} fn
 */
const time = (name, fn) => {
  const t0 = performance.now();
  fn();
  const ms = performance.now() - t0;
  console.log(name + ": " + ms.toFixed(1) + " ms");
  return ms;
};

const root = new TRoot();
let rows = build(10000);
time("create 10k keyed rows", () => render(view(rows), root));
time("layout 10k rows", () => layout(root, 80, 24, DEFAULT_STYLE));
rows = rows.map((r, i) => (i % 10 === 0 ? new Row(r.id, r.label + " !!!") : r));
time("update every 10th row", () => render(view(rows), root));
rows = [...rows].reverse();
time("reverse 10k keyed rows", () => render(view(rows), root));
time("clear", () => render(null, root));
frames.flush();
