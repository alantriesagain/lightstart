/**
 * Decorations: what a mixin adds on top of the text. `mark` styles a range,
 * `lineClass` a whole line, `replace` hides a range (optionally behind a
 * widget), `block` inserts a widget above or below a line. `bucketByLine`
 * sorts them per line and `segmentLine` merges them with the tokens into
 * the runs a line renders.
 */

/** @import { Doc, Decoration, MarkDecoration, LineDecoration, ReplaceDecoration, BlockDecoration, Widget, LineBucket, Segment, Token } from "./types.js" */
import { lineNumberAt } from "./document.js";

/**
 * @param {number} from
 * @param {number} to
 * @param {{ class: string, attrs?: Record<string, string> }} options
 * @returns {MarkDecoration}
 */
export const mark = (from, to, { class: cls, attrs }) => ({ kind: "mark", from, to, class: cls, attrs });

/**
 * @param {number} line 1-based
 * @param {string} cls
 * @returns {LineDecoration}
 */
export const lineClass = (line, cls) => ({ kind: "line", line, class: cls });

/**
 * @param {number} from
 * @param {number} to
 * @param {{ widget?: Widget, key?: string }} [options]
 * @returns {ReplaceDecoration}
 */
export const replace = (from, to, { widget, key } = {}) => ({ kind: "replace", from, to, widget, key });

/**
 * @param {number} line 1-based
 * @param {{ widget: Widget, side?: "above" | "below", key?: string }} options
 * @returns {BlockDecoration}
 */
export const block = (line, { widget, side = "above", key }) => ({ kind: "block", line, side, widget, key });

/** @returns {LineBucket} */
const emptyBucket = () => ({ classes: [], marks: [], replaces: [], above: [], below: [], hidden: false });

/**
 * @param {Map<number, LineBucket>} buckets
 * @param {number} n
 * @returns {LineBucket}
 */
const bucket = (buckets, n) => {
  let b = buckets.get(n);
  if (!b) {
    b = emptyBucket();
    buckets.set(n, b);
  }
  return b;
};

/**
 * Sort decorations per line. A replace spanning lines lands on its first line
 * and hides the continuation lines; a replace touching `headLine` is dropped so
 * the line under the cursor always shows its raw text.
 * @param {Doc} doc
 * @param {Decoration[]} decorations
 * @param {number} [headLine]
 * @returns {Map<number, LineBucket>}
 */
export const bucketByLine = (doc, decorations, headLine = 0) => {
  /** @type {Map<number, LineBucket>} */
  const buckets = new Map();
  for (const d of decorations) {
    if (d.kind === "line") {
      if (d.line >= 1 && d.line <= doc.lineCount) bucket(buckets, d.line).classes.push(d.class);
      continue;
    }
    if (d.kind === "block") {
      if (d.line >= 1 && d.line <= doc.lineCount) bucket(buckets, d.line)[d.side].push(d);
      continue;
    }
    if (d.to < d.from || d.from < 0 || d.to > doc.length) continue;
    const first = lineNumberAt(doc, d.from);
    const last = lineNumberAt(doc, d.to);
    if (d.kind === "mark") {
      for (let n = first; n <= last; n++) bucket(buckets, n).marks.push(d);
      continue;
    }
    if (headLine >= first && headLine <= last) continue;
    bucket(buckets, first).replaces.push(d);
    for (let n = first + 1; n <= last; n++) bucket(buckets, n).hidden = true;
  }
  for (const b of buckets.values()) {
    b.marks.sort((a, c) => a.from - c.from || a.to - c.to);
    b.replaces.sort((a, c) => a.from - c.from || a.to - c.to);
  }
  return buckets;
};

/**
 * @param {LineBucket | undefined} a
 * @param {LineBucket | undefined} b
 * @returns {boolean}
 */
export const bucketEqual = (a, b) => {
  if (!a || !b) return !a && !b;
  if (a.hidden !== b.hidden || a.classes.join(" ") !== b.classes.join(" ")) return false;
  if (a.marks.length !== b.marks.length || a.replaces.length !== b.replaces.length) return false;
  if (a.above.length !== b.above.length || a.below.length !== b.below.length) return false;
  for (let i = 0; i < a.marks.length; i++) {
    const x = a.marks[i];
    const y = b.marks[i];
    if (x.from !== y.from || x.to !== y.to || x.class !== y.class || !attrsEqual(x.attrs, y.attrs)) return false;
  }
  for (let i = 0; i < a.replaces.length; i++) {
    const x = a.replaces[i];
    const y = b.replaces[i];
    if (x.from !== y.from || x.to !== y.to || x.key !== y.key || (x.key === undefined && x.widget !== y.widget)) return false;
  }
  const sameBlocks = (/** @type {BlockDecoration[]} */ xs, /** @type {BlockDecoration[]} */ ys) =>
    xs.every((x, i) => x.key === ys[i].key && (x.key !== undefined || x.widget === ys[i].widget));
  return sameBlocks(a.above, b.above) && sameBlocks(a.below, b.below);
};

/**
 * @param {Record<string, string> | undefined} a
 * @param {Record<string, string> | undefined} b
 * @returns {boolean}
 */
const attrsEqual = (a, b) => {
  if (!a || !b) return !a && !b;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
};

/**
 * Merge tokens, marks and replaces into non-overlapping runs. Offsets in the
 * result are columns within the line. A replace with no widget yields nothing
 * for its range; one with a widget yields a widget segment.
 * @param {{ from: number, to: number, text: string }} line
 * @param {Token[]} tokens columns within the line
 * @param {LineBucket | undefined} bucket
 * @returns {Segment[]}
 */
export const segmentLine = (line, tokens, bucket) => {
  const length = line.text.length;
  const marks = bucket ? bucket.marks : [];
  const replaces = bucket ? bucket.replaces : [];
  const cuts = new Set([0, length]);
  for (const t of tokens) {
    cuts.add(Math.min(t.from, length));
    cuts.add(Math.min(t.to, length));
  }
  for (const m of marks) {
    cuts.add(clamp(m.from - line.from, length));
    cuts.add(clamp(m.to - line.from, length));
  }
  for (const r of replaces) {
    cuts.add(clamp(r.from - line.from, length));
    cuts.add(clamp(r.to - line.from, length));
  }
  const points = [...cuts].sort((a, b) => a - b);
  /** @type {Segment[]} */
  const segments = [];
  let ti = 0;
  for (let i = 0; i < points.length - 1 || (i === 0 && points.length === 1); i++) {
    const from = points[i];
    const to = points[i + 1] ?? from;
    const replacing = replaces.find((r) => clamp(r.from - line.from, length) <= from && clamp(r.to - line.from, length) >= to && (r.to > r.from || from === to));
    if (replacing) {
      if (replacing.widget && clamp(replacing.from - line.from, length) === from) segments.push({ from, to, widget: replacing.widget, key: replacing.key });
      else if (segments.length && "widget" in segments[segments.length - 1] && replacing.widget) segments[segments.length - 1].to = to;
      continue;
    }
    if (from === to) continue;
    while (ti < tokens.length && tokens[ti].to <= from) ti++;
    const classes = [];
    const token = tokens[ti];
    if (token && token.from <= from && token.to >= to) {
      classes.push(`tok-${token.type}`);
      if (token.mark) classes.push("tok-mark");
    }
    /** @type {Record<string, string> | undefined} */
    let attrs;
    for (const m of marks)
      if (m.from - line.from <= from && m.to - line.from >= to) {
        classes.push(m.class);
        if (m.attrs) attrs = { ...attrs, ...m.attrs };
      }
    const last = segments[segments.length - 1];
    if (last && !("widget" in last) && last.to === from && last.classes.join(" ") === classes.join(" ") && attrsEqual(last.attrs, attrs)) last.to = to;
    else segments.push(attrs ? { from, to, classes, attrs } : { from, to, classes });
  }
  for (const r of replaces)
    if (r.widget && r.from === r.to && !segments.some((s) => "widget" in s && s.from === r.from - line.from && s.to === s.from)) {
      const at = clamp(r.from - line.from, length);
      const index = segments.findIndex((s) => s.from >= at);
      segments.splice(index === -1 ? segments.length : index, 0, { from: at, to: at, widget: r.widget, key: r.key });
    }
  return segments;
};

/**
 * @param {number} v
 * @param {number} max
 * @returns {number}
 */
const clamp = (v, max) => Math.min(Math.max(0, v), max);
