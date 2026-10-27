/**
 * Diffing: Myers' O(ND) algorithm over lines (by interned id) or graphemes,
 * after common prefix and suffix trimming. Past `maxSteps` edit steps the
 * middle is answered as one replace hunk, which keeps huge rewrites cheap.
 */

/** @import { Hunk, DiffOptions, Change } from "./types.js" */

const DEFAULT_MAX_STEPS = 1000;
const CHAR_DIFF_LIMIT = 2000;

/**
 * @param {readonly string[]} a
 * @param {readonly string[]} b
 * @returns {{ a: Int32Array, b: Int32Array }}
 */
const intern = (a, b) => {
  const ids = new Map();
  const id = (/** @type {string} */ s) => {
    let v = ids.get(s);
    if (v === undefined) {
      v = ids.size;
      ids.set(s, v);
    }
    return v;
  };
  return { a: Int32Array.from(a, id), b: Int32Array.from(b, id) };
};

/**
 * Myers with a trace; answers the edit path as a list of [aIndex, bIndex] diagonal
 * end points, or null when the diff needs more than `maxSteps` steps.
 * @param {Int32Array} a
 * @param {Int32Array} b
 * @param {number} maxSteps
 * @returns {Array<[number, number]> | null}
 */
const shortestEdit = (a, b, maxSteps) => {
  const n = a.length;
  const m = b.length;
  const max = Math.min(n + m, maxSteps);
  const offset = max;
  const v = new Int32Array(2 * max + 2);
  const trace = [];
  for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) x = v[offset + k + 1];
      else x = v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) return backtrack(trace, n, m, offset);
    }
  }
  return null;
};

/**
 * @param {Int32Array[]} trace
 * @param {number} n
 * @param {number} m
 * @param {number} offset
 * @returns {Array<[number, number]>}
 */
const backtrack = (trace, n, m, offset) => {
  /** @type {Array<[number, number]>} */
  const points = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d];
    const k = x - y;
    const prevK = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? k + 1 : k - 1;
    const prevX = v[offset + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      points.push([x, y]);
      x--;
      y--;
    }
    if (d > 0) points.push([x, y]);
    x = prevX;
    y = prevY;
  }
  points.push([0, 0]);
  return points.reverse();
};

/**
 * @param {Hunk[]} hunks
 * @param {Hunk} hunk
 */
const push = (hunks, hunk) => {
  const last = hunks[hunks.length - 1];
  if (last && last.type !== "equal" && hunk.type !== "equal") {
    last.aTo = hunk.aTo;
    last.bTo = hunk.bTo;
    last.type = last.aTo > last.aFrom ? (last.bTo > last.bFrom ? "replace" : "delete") : "insert";
    return;
  }
  if (last && last.type === "equal" && hunk.type === "equal") {
    last.aTo = hunk.aTo;
    last.bTo = hunk.bTo;
    return;
  }
  hunks.push(hunk);
};

/**
 * @param {Array<[number, number]>} points
 * @param {number} aOffset
 * @param {number} bOffset
 * @returns {Hunk[]}
 */
const hunksFromPath = (points, aOffset, bOffset) => {
  /** @type {Hunk[]} */
  const hunks = [];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const type = x1 - x0 === y1 - y0 ? "equal" : x1 > x0 ? "delete" : "insert";
    push(hunks, { type, aFrom: aOffset + x0, aTo: aOffset + x1, bFrom: bOffset + y0, bTo: bOffset + y1 });
  }
  return hunks;
};

/**
 * @param {readonly string[]} a
 * @param {readonly string[]} b
 * @param {DiffOptions} [options]
 * @returns {Hunk[]} covering both inputs entirely, in order
 */
export const diffLines = (a, b, { maxSteps = DEFAULT_MAX_STEPS } = {}) => {
  let prefix = 0;
  const limit = Math.min(a.length, b.length);
  while (prefix < limit && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (suffix < limit - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix++;
  /** @type {Hunk[]} */
  const hunks = [];
  if (prefix) hunks.push({ type: "equal", aFrom: 0, aTo: prefix, bFrom: 0, bTo: prefix });
  const aMid = a.slice(prefix, a.length - suffix);
  const bMid = b.slice(prefix, b.length - suffix);
  if (aMid.length || bMid.length) {
    const ids = intern(aMid, bMid);
    const path = aMid.length && bMid.length ? shortestEdit(ids.a, ids.b, maxSteps) : null;
    const middle = path
      ? hunksFromPath(path, prefix, prefix)
      : [
          {
            type: /** @type {Hunk["type"]} */ (!aMid.length ? "insert" : !bMid.length ? "delete" : "replace"),
            aFrom: prefix,
            aTo: prefix + aMid.length,
            bFrom: prefix,
            bTo: prefix + bMid.length,
          },
        ];
    for (const h of middle) push(hunks, h);
  }
  if (suffix)
    push(hunks, { type: "equal", aFrom: a.length - suffix, aTo: a.length, bFrom: b.length - suffix, bTo: b.length });
  return hunks;
};

const segmenter =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/**
 * @param {string} text
 * @returns {string[]}
 */
export const graphemes = (text) => (segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text));

/**
 * Hunks in string offsets. Inputs longer than the limit together answer one replace hunk.
 * @param {string} a
 * @param {string} b
 * @param {DiffOptions & { limit?: number }} [options]
 * @returns {Hunk[]}
 */
export const diffChars = (a, b, { limit = CHAR_DIFF_LIMIT, maxSteps = DEFAULT_MAX_STEPS } = {}) => {
  if (a === b) return a.length ? [{ type: "equal", aFrom: 0, aTo: a.length, bFrom: 0, bTo: b.length }] : [];
  if (a.length + b.length > limit) return [{ type: "replace", aFrom: 0, aTo: a.length, bFrom: 0, bTo: b.length }];
  const ga = graphemes(a);
  const gb = graphemes(b);
  const aStarts = offsets(ga);
  const bStarts = offsets(gb);
  return diffLines(ga, gb, { maxSteps }).map((h) => ({
    type: h.type,
    aFrom: aStarts[h.aFrom],
    aTo: aStarts[h.aTo],
    bFrom: bStarts[h.bFrom],
    bTo: bStarts[h.bTo],
  }));
};

/**
 * @param {string[]} parts
 * @returns {number[]} start offset of each part, plus the total
 */
const offsets = (parts) => {
  const out = [0];
  for (const p of parts) out.push(out[out.length - 1] + p.length);
  return out;
};

/**
 * @param {string} a
 * @param {string} b
 * @returns {{ prefix: number, suffix: number }}
 */
const commonEnds = (a, b) => {
  const limit = Math.min(a.length, b.length);
  let prefix = 0;
  while (prefix < limit && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (suffix < limit - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix++;
  return { prefix, suffix };
};

/**
 * Minimal changes that turn `a` into `b`: line hunks, each trimmed to the characters that differ.
 * @param {string} a
 * @param {string} b
 * @param {DiffOptions} [options]
 * @returns {Change[]}
 */
export const diffText = (a, b, options) => {
  if (a === b) return [];
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const aStarts = offsets(aLines.map((l) => `${l}\n`));
  const changes = [];
  for (const h of diffLines(aLines, bLines, options)) {
    if (h.type === "equal") continue;
    const joined = bLines.slice(h.bFrom, h.bTo).join("\n");
    let from;
    let to;
    let insert = joined;
    if (h.type === "insert") {
      const appending = h.aFrom >= aLines.length;
      from = appending ? a.length : aStarts[h.aFrom];
      to = from;
      insert = appending ? `\n${joined}` : `${joined}\n`;
    } else if (h.type === "delete") {
      const throughEnd = h.aTo >= aLines.length;
      from = throughEnd ? (h.aFrom > 0 ? aStarts[h.aFrom] - 1 : 0) : aStarts[h.aFrom];
      to = throughEnd ? a.length : aStarts[h.aTo];
      insert = "";
    } else {
      from = aStarts[h.aFrom];
      to = aStarts[h.aTo - 1] + aLines[h.aTo - 1].length;
    }
    const removed = a.slice(from, to);
    const { prefix, suffix } = commonEnds(removed, insert);
    changes.push({ from: from + prefix, to: to - suffix, insert: insert.slice(prefix, insert.length - suffix) });
  }
  return changes;
};
