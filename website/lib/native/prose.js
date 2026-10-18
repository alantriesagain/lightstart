/**
 * The inline marks the /native pages' words use: `code` in backticks,
 * [a link](/native/scriptc) in brackets, and **a term** in double asterisks
 * where it is defined. Pure: a string in, the runs a view draws out.
 */

/** @typedef {{ kind: "text", text: string } | { kind: "code", text: string } | { kind: "term", text: string } | { kind: "link", text: string, href: string }} Run */

const MARK = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;

/**
 * @param {string} text
 * @returns {Run[]}
 */
export const runsOf = (text) => {
  /** @type {Run[]} */
  const runs = [];
  let at = 0;
  for (const match of text.matchAll(MARK)) {
    const start = match.index ?? 0;
    if (start > at) runs.push({ kind: "text", text: text.slice(at, start) });
    if (match[1] !== undefined) runs.push({ kind: "code", text: match[1] });
    else if (match[4] !== undefined) runs.push({ kind: "term", text: match[4] });
    else runs.push({ kind: "link", text: match[2], href: match[3] });
    at = start + match[0].length;
  }
  if (at < text.length) runs.push({ kind: "text", text: text.slice(at) });
  return runs;
};
