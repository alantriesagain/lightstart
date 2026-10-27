/**
 * Find over a document: plain or regex, case-sensitive or not, whole words
 * or not. An invalid regex answers no matches.
 */

/** @import { Doc, SearchOptions, SearchMatch } from "./types.js" */
import { docText } from "./document.js";

const WORD = "[\\p{L}\\p{N}_]";

/**
 * @param {string} text
 * @returns {string}
 */
export const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * @param {string} query
 * @param {SearchOptions} [options]
 * @returns {RegExp | null}
 */
export const searchRegExp = (query, { matchCase = false, useRegex = false, wholeWord = false } = {}) => {
  if (!query) return null;
  const body = useRegex ? query : escapeRegExp(query);
  const source = wholeWord ? `(?<!${WORD})(?:${body})(?!${WORD})` : body;
  try {
    return new RegExp(source, matchCase ? "gu" : "giu");
  } catch (_e) {
    return null;
  }
};

/**
 * @param {Doc} doc
 * @param {string} query
 * @param {SearchOptions} [options]
 * @returns {SearchMatch[]}
 */
export const findMatches = (doc, query, options = {}) => {
  const re = searchRegExp(query, options);
  if (!re) return [];
  const text = docText(doc);
  const matches = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    matches.push({ from: m.index, to: m.index + m[0].length });
  }
  return matches;
};

/**
 * The first match starting at or after `pos`, wrapping to the first match.
 * @param {SearchMatch[]} matches
 * @param {number} pos
 * @returns {number} index into `matches`, -1 when empty
 */
export const nextMatchFrom = (matches, pos) => {
  if (matches.length === 0) return -1;
  const i = matches.findIndex((m) => m.from >= pos);
  return i === -1 ? 0 : i;
};

/**
 * The match closest to `pos` by start offset.
 * @param {SearchMatch[]} matches
 * @param {number} pos
 * @returns {number}
 */
export const nearestMatch = (matches, pos) => {
  let best = -1;
  let distance = Number.POSITIVE_INFINITY;
  matches.forEach((m, i) => {
    const d = Math.abs(m.from - pos);
    if (d < distance) {
      distance = d;
      best = i;
    }
  });
  return best;
};
