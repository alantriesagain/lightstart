/**
 * @file A native benchmark of elements made by tag against plain rows: 1k rows as keyed `<text>`
 * templates, as `<bench-row .row=${r}>` elements, and as keyed templates slotted into a
 * `<bench-card>`; each series created, laid out, updated every 10th, reversed and cleared, timed
 * with the frame flushed inside the step, since a defined element renders on the frame. A silent
 * pass over the three warms the templates and the allocator first. Run under node
 * (`node native/tui/elements-bench.js`) and as a binary (`$SCRIPTC build native/tui/elements-bench.js -o
 * native/out/elements-bench --strip && native/out/elements-bench`); each prints the same lines.
 */
import { DEFAULT_STYLE, TRoot, frames, html, key, layout, render } from "./index.ts";
import { BenchRecord } from "./test-views.ts";

const N = 1000;

/** @param {number} n */
const build = (n) => {
  /** @type {BenchRecord[]} */
  const rows = [];
  for (let i = 0; i < n; i++) rows.push(new BenchRecord(i + 1, "row " + String(i + 1)));
  return rows;
};

/** @param {BenchRecord[]} rows */
const plain = (rows) => html`<box>${rows.map((r) => key(r.id, html`<text>${r.id} ${r.label}</text>`))}</box>`;
/** @param {BenchRecord[]} rows */
const elements = (rows) => html`<box>${rows.map((r) => key(r.id, html`<bench-row .row=${r}></bench-row>`))}</box>`;
/** @param {BenchRecord[]} rows */
const slotted = (rows) => html`<bench-card>${rows.map((r) => key(r.id, html`<text>${r.id} ${r.label}</text>`))}</bench-card>`;

let printing = false;

/**
 * @param {string} name
 * @param {() => void} fn
 */
const time = (name, fn) => {
  const t0 = performance.now();
  fn();
  const ms = performance.now() - t0;
  if (printing) console.log(name + ": " + ms.toFixed(1) + " ms, " + ((ms * 1000) / N).toFixed(1) + " us per row");
};

/**
 * @param {string} label
 * @param {(rows: BenchRecord[]) => unknown} view
 */
const series = (label, view) => {
  const root = new TRoot();
  let rows = build(N);
  time(label + ": create 1k", () => {
    render(view(rows), root);
    frames.flush();
  });
  time(label + ": layout 1k", () => layout(root, 80, 24, DEFAULT_STYLE));
  rows = rows.map((r, i) => (i % 10 === 0 ? new BenchRecord(r.id, r.label + " !!!") : r));
  time(label + ": update every 10th", () => {
    render(view(rows), root);
    frames.flush();
  });
  rows = [...rows].reverse();
  time(label + ": reverse 1k", () => {
    render(view(rows), root);
    frames.flush();
  });
  time(label + ": clear", () => {
    render(null, root);
    frames.flush();
  });
};

series("plain rows", plain);
series("elements", elements);
series("slotted rows", slotted);
printing = true;
series("plain rows", plain);
series("elements", elements);
series("slotted rows", slotted);
