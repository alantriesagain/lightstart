/**
 * @bootstrapp/light/tdom/dump: a tree as indented text, for tests and the
 * dump flag.
 */
import { TAnchor, TElement, TNode, TRun } from "./node.js";

/**
 * @param {TNode} node
 * @param {number} depth
 * @param {boolean} showAnchors
 * @param {string[]} lines
 */
const walk = (node, depth, showAnchors, lines) => {
  const pad = "  ".repeat(depth);
  if (node instanceof TAnchor) {
    if (showAnchors) lines.push(pad + "|");
    return;
  }
  if (node instanceof TRun) {
    lines.push(pad + JSON.stringify(node.text));
    return;
  }
  if (node instanceof TElement) {
    lines.push(pad + node.describe());
    for (let c = node.firstChild; c !== null; c = c.next) walk(c, depth + 1, showAnchors, lines);
  }
};

/**
 * An indented rendering of a subtree: `box[border]`, `"run text"`, `|` for an anchor.
 * @param {TNode} node
 * @param {boolean} showAnchors
 */
export const dumpTree = (node, showAnchors) => {
  /** @type {string[]} */
  const lines = [];
  walk(node, 0, showAnchors, lines);
  return lines.join("\n");
};

/**
 * The text of every run under `node`, in document order.
 * @param {TNode} node
 * @returns {string}
 */
export const textOf = (node) => {
  if (node instanceof TRun) return node.text;
  if (node instanceof TElement) {
    let s = "";
    for (let c = node.firstChild; c !== null; c = c.next) s += textOf(c);
    return s;
  }
  return "";
};
