/**
 * @bootstrapp/light/native/tui/dump: a tree as indented text, for tests and the
 * dump flag.
 */
import { TAnchor, TElement, TNode, TRun } from "./node.ts";

const walk = (node: TNode, depth: number, showAnchors: boolean, lines: string[]) => {
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
 */
export const dumpTree = (node: TNode, showAnchors: boolean) => {
  const lines: string[] = [];
  walk(node, 0, showAnchors, lines);
  return lines.join("\n");
};

/**
 * The text of every run under `node`, in document order.
 */
export const textOf = (node: TNode): string => {
  if (node instanceof TRun) return node.text;
  if (node instanceof TElement) {
    let s = "";
    for (let c = node.firstChild; c !== null; c = c.next) s += textOf(c);
    return s;
  }
  return "";
};
