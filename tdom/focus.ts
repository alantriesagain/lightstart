/**
 * @bootstrapp/light/tdom/focus: where the pointer lands and where the
 * focus goes. A hit test walks the laid-out tree to the deepest visible
 * element under a cell, clipped by every box on the way; the focus order
 * is the document order of the focusable elements: inputs, buttons, and
 * any element with a `tabindex` attribute or a click handler, unless
 * disabled.
 */
import { TAnchor, TBox, TElement, TInput, TNode, TRun } from "./node.ts";

const contains = (el: TElement, x: number, y: number) => x >= el.x && x < el.x + el.w && y >= el.y && y < el.y + el.h;

/**
 * The deepest visible element under the cell (x, y), or null when nothing
 * laid out covers it. A box clips its children to its inner rectangle.
 */
export const hitTest = (node: TNode, x: number, y: number): TElement | null => {
  if (node instanceof TAnchor || node instanceof TRun) return null;
  if (!(node instanceof TElement)) return null;
  if (node.hidden || !contains(node, x, y)) return null;
  if (node instanceof TBox) {
    const pad = node.padding + (node.border ? 1 : 0);
    const inside = x >= node.x + pad && x < node.x + node.w - pad && y >= node.y + pad && y < node.y + node.h - pad;
    if (inside)
      for (let c = node.lastChild; c !== null; c = c.prev) {
        const hit = hitTest(c, x, y);
        if (hit !== null) return hit;
      }
  }
  return node;
};

export const isFocusable = (el: TElement) => {
  if (el.hidden || el.attrs.has("disabled")) return false;
  if (el instanceof TInput || el.tag === "button" || el.attrs.has("tabindex")) return true;
  for (const entry of el.handlers) if (entry.name === "click") return true;
  return false;
};

/**
 * The focusable elements under `node` in document order, hidden subtrees skipped.
 */
export const focusables = (node: TNode, out: TElement[]) => {
  if (!(node instanceof TElement) || node.hidden) return out;
  if (isFocusable(node)) out.push(node);
  for (let c = node.firstChild; c !== null; c = c.next) focusables(c, out);
  return out;
};

/**
 * The focusable element `delta` steps (1 or -1) after `current` in document
 * order, wrapping around; the first or last when nothing is focused.
 */
export const nextFocusable = (root: TElement, current: TElement | null, delta: number): TElement | null => {
  const list = focusables(root, []);
  if (list.length === 0) return null;
  const at = current === null ? -1 : list.indexOf(current);
  if (at < 0) return delta > 0 ? list[0] : list[list.length - 1];
  return list[(at + delta + list.length) % list.length];
};

/**
 * The nearest scrolling box at or above `el`, or null.
 */
export const scrollBoxOf = (el: TElement | null): TBox | null => {
  let n: TElement | null = el;
  while (n !== null) {
    if (n instanceof TBox && n.scroll) return n;
    n = n.parent;
  }
  return null;
};
