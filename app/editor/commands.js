/**
 * Editing commands as pure functions of a state: each answers a transaction
 * spec (or null when it does nothing). Graphemes come from Intl.Segmenter,
 * word groups from the letter, number and underscore classes.
 */

/** @import { EditorState, CommandContext, TransactionSpec, Selection } from "./types.js" */
import { line, lineAt, sliceString } from "./document.js";

const segmenter =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

const WORD = /[\p{L}\p{N}_]/u;
const SPACE = /\s/;
const CLUSTER_WINDOW = 32;

/**
 * @param {string} text
 * @param {number} i
 * @returns {number} length of the grapheme starting at `i`
 */
export const graphemeAfter = (text, i) => {
  if (i >= text.length) return 0;
  if (!segmenter) return (text.codePointAt(i) ?? 0) > 0xffff ? 2 : 1;
  const it = segmenter.segment(text.slice(i, i + CLUSTER_WINDOW))[Symbol.iterator]().next();
  return it.done ? 1 : it.value.segment.length;
};

/**
 * @param {string} text
 * @param {number} i
 * @returns {number} length of the grapheme ending at `i`
 */
export const graphemeBefore = (text, i) => {
  if (i <= 0) return 0;
  if (!segmenter) return i >= 2 && (text.codePointAt(i - 2) ?? 0) > 0xffff ? 2 : 1;
  let last = 1;
  for (const s of segmenter.segment(text.slice(Math.max(0, i - CLUSTER_WINDOW), i))) last = s.segment.length;
  return last;
};

/**
 * @param {string} ch
 * @returns {0 | 1 | 2} 0 space, 1 word, 2 other
 */
const charClass = (ch) => (SPACE.test(ch) ? 0 : WORD.test(ch) ? 1 : 2);

/**
 * @param {EditorState} state
 * @param {number} pos
 * @returns {number}
 */
export const groupForward = (state, pos) => {
  const l = lineAt(state.doc, pos);
  if (pos >= l.to) return Math.min(state.doc.length, pos + 1);
  let i = pos - l.from;
  const text = l.text;
  while (i < text.length && charClass(text[i]) === 0) i++;
  if (i >= text.length) return l.from + i;
  const cls = charClass(text[i]);
  while (i < text.length && charClass(text[i]) === cls) i++;
  return l.from + i;
};

/**
 * @param {EditorState} state
 * @param {number} pos
 * @returns {number}
 */
export const groupBackward = (state, pos) => {
  const l = lineAt(state.doc, pos);
  if (pos <= l.from) return Math.max(0, pos - 1);
  let i = pos - l.from;
  const text = l.text;
  while (i > 0 && charClass(text[i - 1]) === 0) i--;
  if (i === 0) return l.from;
  const cls = charClass(text[i - 1]);
  while (i > 0 && charClass(text[i - 1]) === cls) i--;
  return l.from + i;
};

/**
 * @param {number} head
 * @returns {TransactionSpec}
 */
const moveTo = (head) => ({ selection: { anchor: head }, scrollIntoView: true, origin: "command" });

/** @type {(state: EditorState) => TransactionSpec} */
export const cursorLineStart = (state) => moveTo(lineAt(state.doc, state.selection.head).from);

/** @type {(state: EditorState) => TransactionSpec} */
export const cursorLineEnd = (state) => moveTo(lineAt(state.doc, state.selection.head).to);

/** @type {(state: EditorState) => TransactionSpec} */
export const cursorCharLeft = (state) => {
  const { head } = state.selection;
  const l = lineAt(state.doc, head);
  return moveTo(head === l.from ? Math.max(0, head - 1) : head - graphemeBefore(l.text, head - l.from));
};

/** @type {(state: EditorState) => TransactionSpec} */
export const cursorCharRight = (state) => {
  const { head } = state.selection;
  const l = lineAt(state.doc, head);
  return moveTo(head === l.to ? Math.min(state.doc.length, head + 1) : head + graphemeAfter(l.text, head - l.from));
};

/** @type {(state: EditorState) => TransactionSpec} */
export const cursorGroupForward = (state) => moveTo(groupForward(state, state.selection.head));

/** @type {(state: EditorState) => TransactionSpec} */
export const cursorGroupBackward = (state) => moveTo(groupBackward(state, state.selection.head));

/**
 * @param {EditorState} state
 * @param {number} delta
 * @returns {TransactionSpec | null}
 */
const cursorLineBy = (state, delta) => {
  const l = lineAt(state.doc, state.selection.head);
  const target = l.number + delta;
  if (target < 1) return l.from === state.selection.head ? null : moveTo(l.from);
  if (target > state.doc.lineCount) return l.to === state.selection.head ? null : moveTo(l.to);
  const t = line(state.doc, target);
  return moveTo(t.from + Math.min(state.selection.head - l.from, t.text.length));
};

/** @type {(state: EditorState) => TransactionSpec | null} */
export const cursorLineUp = (state) => cursorLineBy(state, -1);

/** @type {(state: EditorState) => TransactionSpec | null} */
export const cursorLineDown = (state) => cursorLineBy(state, 1);

/** @type {(state: EditorState) => TransactionSpec} */
export const selectAll = (state) => ({ selection: { anchor: 0, head: state.doc.length }, origin: "command" });

/**
 * @param {number} from
 * @param {number} to
 * @param {string} [insert]
 * @param {number} [cursor]
 * @returns {TransactionSpec}
 */
const replace = (from, to, insert = "", cursor = from + insert.length) => ({
  changes: { from, to, insert },
  selection: { anchor: cursor },
  scrollIntoView: true,
  origin: insert ? "input" : "delete",
});

/**
 * @param {EditorState} state
 * @param {(pos: number) => number} target
 * @returns {TransactionSpec | null}
 */
const deleteBy = (state, target) => {
  const sel = state.selection;
  if (!sel.empty) return replace(sel.from, sel.to);
  const other = target(sel.head);
  if (other === sel.head) return null;
  return replace(Math.min(other, sel.head), Math.max(other, sel.head));
};

/** @type {(state: EditorState) => TransactionSpec | null} */
export const deleteCharBackward = (state) =>
  deleteBy(state, (pos) => {
    const l = lineAt(state.doc, pos);
    return pos === l.from ? Math.max(0, pos - 1) : pos - graphemeBefore(l.text, pos - l.from);
  });

/** @type {(state: EditorState) => TransactionSpec | null} */
export const deleteCharForward = (state) =>
  deleteBy(state, (pos) => {
    const l = lineAt(state.doc, pos);
    return pos === l.to ? Math.min(state.doc.length, pos + 1) : pos + graphemeAfter(l.text, pos - l.from);
  });

/** @type {(state: EditorState) => TransactionSpec | null} */
export const deleteGroupBackward = (state) => deleteBy(state, (pos) => groupBackward(state, pos));

/** @type {(state: EditorState) => TransactionSpec | null} */
export const deleteGroupForward = (state) => deleteBy(state, (pos) => groupForward(state, pos));

/** @type {(state: EditorState) => TransactionSpec | null} */
export const transposeChars = (state) => {
  const { head } = state.selection;
  const l = lineAt(state.doc, head);
  if (l.text.length < 2) return null;
  const col = head - l.from;
  const at = col >= l.text.length ? l.text.length - 1 : col;
  if (at < 1) return null;
  const before = graphemeBefore(l.text, at);
  const after = graphemeAfter(l.text, at);
  const a = l.text.slice(at - before, at);
  const b = l.text.slice(at, at + after);
  return {
    changes: { from: l.from + at - before, to: l.from + at + after, insert: b + a },
    selection: { anchor: l.from + at + after },
    origin: "input",
  };
};

/**
 * @param {EditorState} state
 * @param {string} text
 * @returns {TransactionSpec}
 */
export const insertText = (state, text) => replace(state.selection.from, state.selection.to, text);

/**
 * @param {string} text
 * @returns {string}
 */
const leadingWhitespace = (text) => /^[ \t]*/.exec(text)?.[0] ?? "";

/** @type {Record<string, string>} */
const CLOSERS = { "}": "{", "]": "[", ")": "(" };

/**
 * @param {EditorState} state
 * @param {CommandContext} ctx
 * @returns {TransactionSpec}
 */
export const insertNewlineAndIndent = (state, ctx) => {
  const sel = state.selection;
  const l = lineAt(state.doc, sel.from);
  const before = l.text.slice(0, sel.from - l.from);
  const after = sliceString(state.doc, sel.to, lineAt(state.doc, sel.to).to);
  const base = leadingWhitespace(l.text);
  const extra = ctx.indentAfter ? ctx.indentAfter(before) : 0;
  const indent = base + ctx.indentUnit.repeat(Math.max(0, extra));
  const lastChar = before.trimEnd().slice(-1);
  const between = extra > 0 && after[0] in CLOSERS && CLOSERS[after[0]] === lastChar;
  const insert = between ? `\n${indent}\n${base}` : `\n${indent}`;
  const trimmedFrom = sel.from - (before.length - before.trimEnd().length);
  return {
    changes: { from: trimmedFrom, to: sel.to, insert },
    selection: { anchor: trimmedFrom + 1 + indent.length },
    scrollIntoView: true,
    origin: "input",
  };
};

/**
 * @param {EditorState} state
 * @returns {{ first: number, last: number }}
 */
const selectedLines = (state) => {
  const first = lineAt(state.doc, state.selection.from).number;
  const lastPos = state.selection.empty ? state.selection.to : Math.max(state.selection.from, state.selection.to - 1);
  return { first, last: lineAt(state.doc, lastPos).number };
};

/**
 * @param {EditorState} state
 * @param {CommandContext} ctx
 * @returns {TransactionSpec}
 */
export const indentMore = (state, ctx) => {
  const { first, last } = selectedLines(state);
  const changes = [];
  for (let n = first; n <= last; n++) changes.push({ from: line(state.doc, n).from, insert: ctx.indentUnit });
  const unit = ctx.indentUnit.length;
  const sel = state.selection;
  return {
    changes,
    selection: { anchor: sel.anchor + unit * (sel.anchor >= sel.head ? last - first + 1 : 1), head: sel.head + unit * (sel.head >= sel.anchor ? last - first + 1 : 1) },
    origin: "command",
  };
};

/**
 * @param {EditorState} state
 * @param {CommandContext} ctx
 * @returns {TransactionSpec | null}
 */
export const indentLess = (state, ctx) => {
  const { first, last } = selectedLines(state);
  const changes = [];
  for (let n = first; n <= last; n++) {
    const l = line(state.doc, n);
    const ws = leadingWhitespace(l.text);
    const remove = ws.startsWith("\t") ? 1 : Math.min(ws.length, ctx.indentUnit === "\t" ? ctx.tabSize : ctx.indentUnit.length);
    if (remove > 0) changes.push({ from: l.from, to: l.from + remove });
  }
  return changes.length ? { changes, origin: "command" } : null;
};

/**
 * Emacs kill-line: to the end of the line, or the line break when already there.
 * @param {EditorState} state
 * @returns {{ spec: TransactionSpec, text: string } | null}
 */
export const killLine = (state) => {
  const { head } = state.selection;
  const l = lineAt(state.doc, head);
  const to = head === l.to ? Math.min(state.doc.length, l.to + 1) : l.to;
  if (to === head) return null;
  return { spec: replace(head, to, "", head), text: sliceString(state.doc, head, to) };
};

/**
 * @param {Selection} sel
 * @returns {boolean}
 */
export const hasSelection = (sel) => !sel.empty;
