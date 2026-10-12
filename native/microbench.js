/**
 * @file Micro-benchmarks that time the operations behind native/bench.js one by one, under node
 * and natively (`npx scriptc build native/microbench.js -o native/probes/out/microbench --strip`),
 * so the ratio between the two shows where a native build spends its time.
 */
import { Dep, ElementSpec, Keyed, TAnchor, TBox, TElement, TRoot, TRun, TemplateResult, Unsafe, effect, graphemes, html, nothing, render, signal, stringWidth } from "./index.js";
import { getTemplate, TemplateInstance } from "../html/template.js";

/**
 * @param {string} name
 * @param {() => void} fn
 */
const time = (name, fn) => {
  const t0 = performance.now();
  fn();
  console.log(name + ": " + (performance.now() - t0).toFixed(1) + " ms");
};

const N = 10000;

/** @type {TNodeLike[]} */
const nodes = [];
/** @typedef {TRun} TNodeLike */
for (let i = 0; i < N; i++) nodes.push(new TRun("r" + String(i)));

time("indexOf 10k objects x 1k lookups", () => {
  let found = 0;
  for (let i = 0; i < 1000; i++) if (nodes.indexOf(nodes[N - 1 - i]) >= 0) found++;
  if (found !== 1000) throw new Error("indexOf");
});

time("push 10k then splice 1k", () => {
  /** @type {TRun[]} */
  const arr = [];
  for (let i = 0; i < N; i++) arr.push(nodes[i]);
  for (let i = 0; i < 1000; i++) arr.splice(i * 7 % arr.length, 1);
});

time("box.insertBefore append 10k runs", () => {
  const box = new TBox("box");
  for (let i = 0; i < N; i++) box.insertBefore(new TRun("x"), null);
});

time("box.insertBefore before ref 2k runs", () => {
  const box = new TBox("box");
  const last = new TRun("last");
  box.insertBefore(last, null);
  for (let i = 0; i < 2000; i++) box.insertBefore(new TRun("x"), last);
});

time("Map<object, object> set+get 10k", () => {
  /** @type {Map<TRun, TBox>} */
  const m = new Map();
  for (let i = 0; i < N; i++) m.set(nodes[i], new TBox("box"));
  let hits = 0;
  for (let i = 0; i < N; i++) if (m.get(nodes[i]) !== undefined) hits++;
  if (hits !== N) throw new Error("map");
});

time("Set<object> add+has+delete 10k", () => {
  /** @type {Set<TRun>} */
  const s = new Set();
  for (let i = 0; i < N; i++) s.add(nodes[i]);
  let hits = 0;
  for (let i = 0; i < N; i++) if (s.has(nodes[i])) hits++;
  for (let i = 0; i < N; i++) s.delete(nodes[i]);
  if (hits !== N) throw new Error("set");
});

/** @param {unknown} value */
const classify = (value) => {
  if (value === null || value === undefined || value === nothing) return 0;
  if (typeof value === "string") return 1;
  if (typeof value === "number") return 2;
  if (typeof value === "function") return 3;
  if (value instanceof TemplateResult) return 4;
  if (value instanceof Keyed) return 5;
  if (value instanceof ElementSpec) return 6;
  if (value instanceof Unsafe) return 7;
  if (Array.isArray(value)) return 8;
  return 9;
};

time("unknown dispatch 100k (typeof + instanceof chain)", () => {
  /** @type {unknown[]} */
  const values = ["s", 1, () => 0, html`<p>x</p>`, new Keyed(1, "k"), new ElementSpec("p", {}, null), new Unsafe("<i>"), [1, 2], nodes[0], null];
  let sum = 0;
  for (let i = 0; i < 100000; i++) sum += classify(values[i % values.length]);
  if (sum === 0) throw new Error("dispatch");
});

time("virtual method call 1M", () => {
  /** @type {TElement[]} */
  const els = [new TBox("box"), new TRun("x") instanceof TElement ? new TBox("b") : new TBox("c")];
  let n = 0;
  for (let i = 0; i < 1000000; i++) n += els[i & 1].propsSummary().length;
  if (n !== 0) throw new Error("virtual");
});

time("graphemes + stringWidth 10k x 40 chars", () => {
  const s = "the quick brown fox jumps over the lazy dog!";
  let w = 0;
  for (let i = 0; i < N; i++) w += graphemes(s).length + stringWidth(s);
  if (w === 0) throw new Error("width");
});

time("string concat 100k", () => {
  let s = "";
  for (let i = 0; i < 100000; i++) s += "ab";
  if (s.length !== 200000) throw new Error("concat");
});

time("template clone 2k (prepare once)", () => {
  const strings = html`<text class="row">${0} ${0}</text>`.strings;
  const template = getTemplate(strings, 1);
  for (let i = 0; i < 2000; i++) new TemplateInstance(template, undefined).clone();
});

time("render 2k rows (engine)", () => {
  const root = new TRoot();
  /** @type {number[]} */
  const ids = [];
  for (let i = 0; i < 2000; i++) ids.push(i);
  render(html`<box>${ids.map((id) => html`<text>${id}</text>`)}</box>`, root);
});

time("signal write with one effect 10k", () => {
  const s = signal(0);
  let seen = 0;
  const e = effect(() => {
    seen += s.value;
  });
  for (let i = 1; i <= N; i++) s.value = i;
  e.dispose();
  if (seen === 0) throw new Error("signal");
});

time("Dep track/notify 10k", () => {
  const d = new Dep();
  for (let i = 0; i < N; i++) d._notify();
});

time("new Promise + then 10k", () => {
  let n = 0;
  for (let i = 0; i < N; i++) new Promise((/** @type {(value: number) => void} */ resolve) => resolve(i)).then(() => n++);
});

time("anchor + run alloc 100k", () => {
  /** @type {TAnchor[]} */
  const keep = [];
  for (let i = 0; i < 100000; i++) keep.push(new TAnchor("$"));
  if (keep.length !== 100000) throw new Error("alloc");
});
