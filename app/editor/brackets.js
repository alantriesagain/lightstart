/**
 * Bracket matching and auto-closing over a document. `isCode(pos)` lets the
 * caller exclude strings and comments from the scan.
 */

/** @import { Doc, BracketMatch } from "./types.js" */
import { sliceString } from "./document.js";

/** @type {Record<string, string>} */
export const PAIRS = { "(": ")", "[": "]", "{": "}" };
/** @type {Record<string, string>} */
const CLOSERS = { ")": "(", "]": "[", "}": "{" };
const QUOTES = new Set(['"', "'", "`"]);
const WORD = /[\p{L}\p{N}_]/u;

/**
 * @param {Doc} doc
 * @param {number} pos
 * @returns {string}
 */
const charAt = (doc, pos) => (pos < 0 || pos >= doc.length ? "" : sliceString(doc, pos, pos + 1));

/**
 * @param {Doc} doc
 * @param {number} pos position of the bracket
 * @param {(pos: number) => boolean} isCode
 * @param {number} maxScan
 * @returns {BracketMatch}
 */
const scan = (doc, pos, isCode, maxScan) => {
  const ch = charAt(doc, pos);
  const forward = ch in PAIRS;
  const open = forward ? ch : CLOSERS[ch];
  const close = PAIRS[open];
  const step = forward ? 1 : -1;
  let depth = 0;
  for (let p = pos, n = 0; p >= 0 && p < doc.length && n < maxScan; p += step, n++) {
    if (!isCode(p)) continue;
    const c = charAt(doc, p);
    if (c === open) depth += forward ? 1 : -1;
    else if (c === close) depth += forward ? -1 : 1;
    if (depth === 0) return { from: pos, to: p, matched: true };
  }
  return { from: pos, to: pos, matched: false };
};

/**
 * The bracket at the cursor (after it, then before it) and its partner.
 * @param {Doc} doc
 * @param {number} pos
 * @param {(pos: number) => boolean} [isCode]
 * @param {number} [maxScan]
 * @returns {BracketMatch | null}
 */
export const matchBracket = (doc, pos, isCode = () => true, maxScan = 10000) => {
  const after = charAt(doc, pos);
  if ((after in PAIRS || after in CLOSERS) && isCode(pos)) return scan(doc, pos, isCode, maxScan);
  const before = charAt(doc, pos - 1);
  if ((before in PAIRS || before in CLOSERS) && isCode(pos - 1)) return scan(doc, pos - 1, isCode, maxScan);
  return null;
};

/**
 * @param {string} ch
 * @returns {string | null}
 */
export const closerFor = (ch) => PAIRS[ch] ?? (QUOTES.has(ch) ? ch : null);

/**
 * What to insert when `ch` is typed at `pos`: the pair, or null to insert nothing special.
 * @param {Doc} doc
 * @param {number} pos
 * @param {string} ch
 * @param {{ quotes?: boolean, isCode?: (pos: number) => boolean }} [options]
 * @returns {string | null}
 */
export const autoClosePair = (doc, pos, ch, { quotes = true, isCode = () => true } = {}) => {
  const closer = closerFor(ch);
  if (!closer || !isCode(pos)) return null;
  const next = charAt(doc, pos);
  const prev = charAt(doc, pos - 1);
  const room = next === "" || /\s/.test(next) || next in CLOSERS || next === "," || next === ";";
  if (!room) return null;
  if (QUOTES.has(ch)) {
    if (!quotes) return null;
    if (WORD.test(prev) || prev === ch) return null;
  }
  return ch + closer;
};

/**
 * True when typing `ch` should step over the same character already at `pos`.
 * @param {Doc} doc
 * @param {number} pos
 * @param {string} ch
 * @returns {boolean}
 */
export const typesOverCloser = (doc, pos, ch) => (ch in CLOSERS || QUOTES.has(ch)) && charAt(doc, pos) === ch;

/**
 * True when backspace at `pos` sits between an empty pair, so both go.
 * @param {Doc} doc
 * @param {number} pos
 * @returns {boolean}
 */
export const deletesPair = (doc, pos) => {
  const before = charAt(doc, pos - 1);
  const closer = closerFor(before);
  return closer !== null && charAt(doc, pos) === closer;
};
