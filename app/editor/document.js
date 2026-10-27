/**
 * The document model: an immutable value of lines plus a line-start index.
 * A change touches only the lines it spans; the index is rebuilt from the
 * first changed line onward. No `$APP`, no DOM.
 */

/** @import { Doc, Line, Change, NormalizedChange, Selection } from "./types.js" */

const texts = new WeakMap();

/**
 * @param {readonly string[]} lines
 * @param {Int32Array | null} previous
 * @param {number} fromLine
 * @returns {Int32Array}
 */
const buildStarts = (lines, previous, fromLine) => {
  const starts = new Int32Array(lines.length + 1);
  if (previous && fromLine > 0) starts.set(previous.subarray(0, fromLine));
  let pos = fromLine > 0 ? starts[fromLine - 1] + lines[fromLine - 1].length + 1 : 0;
  for (let i = fromLine; i < lines.length; i++) {
    starts[i] = pos;
    pos += lines[i].length + 1;
  }
  starts[lines.length] = pos;
  return starts;
};

/**
 * @param {readonly string[]} lines
 * @param {Int32Array | null} [previous]
 * @param {number} [fromLine]
 * @returns {Doc}
 */
const fromLines = (lines, previous = null, fromLine = 0) => {
  const starts = buildStarts(lines, previous, fromLine);
  return { lines, starts, length: starts[lines.length] - 1, lineCount: lines.length };
};

/**
 * @param {string} [text]
 * @returns {Doc}
 */
export const createDoc = (text = "") => fromLines(text.split("\n"));

/**
 * @param {Doc} doc
 * @returns {string}
 */
export const docText = (doc) => {
  let text = texts.get(doc);
  if (text == null) {
    text = doc.lines.join("\n");
    texts.set(doc, text);
  }
  return text;
};

/**
 * @param {Doc} doc
 * @param {number} number 1-based
 * @returns {Line}
 */
export const line = (doc, number) => {
  if (number < 1 || number > doc.lineCount) throw new RangeError(`line ${number} out of range 1..${doc.lineCount}`);
  const text = doc.lines[number - 1];
  const from = doc.starts[number - 1];
  return { number, from, to: from + text.length, text };
};

/**
 * @param {Doc} doc
 * @param {number} pos
 * @returns {number} 1-based line number
 */
export const lineNumberAt = (doc, pos) => {
  const p = Math.min(Math.max(0, pos), doc.length);
  let lo = 0;
  let hi = doc.lineCount - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (doc.starts[mid] <= p) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
};

/**
 * @param {Doc} doc
 * @param {number} pos
 * @returns {Line}
 */
export const lineAt = (doc, pos) => line(doc, lineNumberAt(doc, pos));

/**
 * @param {Doc} doc
 * @param {number} number 1-based
 * @param {number} column 0-based
 * @returns {number}
 */
export const posOf = (doc, number, column) => {
  const l = line(doc, number);
  return l.from + Math.min(Math.max(0, column), l.text.length);
};

/**
 * @param {Doc} doc
 * @param {number} from
 * @param {number} [to]
 * @returns {string}
 */
export const sliceString = (doc, from, to = doc.length) => {
  const a = Math.max(0, from);
  const b = Math.min(doc.length, to);
  if (b <= a) return "";
  const first = lineNumberAt(doc, a);
  const last = lineNumberAt(doc, b);
  if (first === last) {
    const start = doc.starts[first - 1];
    return doc.lines[first - 1].slice(a - start, b - start);
  }
  const parts = [doc.lines[first - 1].slice(a - doc.starts[first - 1])];
  for (let i = first; i < last - 1; i++) parts.push(doc.lines[i]);
  parts.push(doc.lines[last - 1].slice(0, b - doc.starts[last - 1]));
  return parts.join("\n");
};

/**
 * @param {Change | Change[]} changes
 * @returns {NormalizedChange[]} ascending, non-overlapping
 */
export const normalizeChanges = (changes) => {
  const list = (Array.isArray(changes) ? changes : [changes]).map((c) => ({
    from: c.from,
    to: c.to ?? c.from,
    insert: c.insert ?? "",
  }));
  for (const c of list)
    if (c.to < c.from || c.from < 0) throw new RangeError(`invalid change ${c.from}..${c.to}`);
  list.sort((a, b) => a.from - b.from || a.to - b.to);
  for (let i = 1; i < list.length; i++)
    if (list[i].from < list[i - 1].to) throw new RangeError(`overlapping changes at ${list[i].from}`);
  return list;
};

/**
 * @param {Doc} doc
 * @param {Change | Change[]} input
 * @returns {{ doc: Doc, changes: NormalizedChange[], inverted: NormalizedChange[] }}
 */
export const applyChanges = (doc, input) => {
  const changes = normalizeChanges(input);
  if (changes.length === 0) return { doc, changes, inverted: [] };
  const last = changes[changes.length - 1];
  if (last.to > doc.length) throw new RangeError(`change ${last.from}..${last.to} past end ${doc.length}`);
  const inverted = [];
  let shift = 0;
  for (const c of changes) {
    inverted.push({ from: c.from + shift, to: c.from + shift + c.insert.length, insert: sliceString(doc, c.from, c.to) });
    shift += c.insert.length - (c.to - c.from);
  }
  const lines = doc.lines.slice();
  let firstChanged = doc.lineCount;
  for (let i = changes.length - 1; i >= 0; i--) {
    const c = changes[i];
    const a = lineNumberAt(doc, c.from) - 1;
    const b = lineNumberAt(doc, c.to) - 1;
    const head = lines[a].slice(0, c.from - doc.starts[a]);
    const tail = lines[b].slice(c.to - doc.starts[b]);
    lines.splice(a, b - a + 1, ...(head + c.insert + tail).split("\n"));
    firstChanged = a;
  }
  return { doc: fromLines(lines, doc.starts, firstChanged), changes, inverted };
};

/**
 * @param {NormalizedChange[]} changes ascending
 * @param {number} pos
 * @param {number} [assoc] -1 stays before an insertion at `pos`, 1 moves after it
 * @returns {number}
 */
export const mapPos = (changes, pos, assoc = -1) => {
  let mapped = pos;
  for (const c of changes) {
    if (pos < c.from) break;
    if (pos === c.from) {
      if (assoc > 0) mapped += c.insert.length;
      break;
    }
    if (pos < c.to) {
      mapped += (assoc < 0 ? 0 : c.insert.length) - (pos - c.from);
      break;
    }
    mapped += c.insert.length - (c.to - c.from);
  }
  return mapped;
};

/**
 * @param {number} anchor
 * @param {number} [head]
 * @returns {Selection}
 */
export const selection = (anchor, head = anchor) => ({
  anchor,
  head,
  from: Math.min(anchor, head),
  to: Math.max(anchor, head),
  empty: anchor === head,
});

/**
 * @param {NormalizedChange[]} changes
 * @param {Selection} sel
 * @returns {Selection}
 */
export const mapSelection = (changes, sel) => {
  if (sel.empty) return selection(mapPos(changes, sel.head, 1));
  const from = mapPos(changes, sel.from, 1);
  const to = Math.max(from, mapPos(changes, sel.to, -1));
  return sel.head >= sel.anchor ? selection(from, to) : selection(to, from);
};
