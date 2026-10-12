/**
 * @bootstrapp/light/tdom/paint: a laid-out tree into a Screen, clipping
 * with a rectangle passed down the tree.
 */
import { TAnchor, TBox, TElement, TInput, TNode, TRun, TText } from "./node.js";
import { Screen } from "./screen.js";
import { ATTR_INVERSE, Style } from "./style.js";
import { graphemeWidth, graphemes } from "./width.js";
import { WrappedLine } from "./wrap.js";
import { textLayoutOf } from "./layout.js";

export class Clip {
  /**
   * @param {number} x0
   * @param {number} y0
   * @param {number} x1
   * @param {number} y1
   */
  constructor(x0, y0, x1, y1) {
    this.x0 = x0;
    this.y0 = y0;
    this.x1 = x1;
    this.y1 = y1;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   */
  intersect(x, y, w, h) {
    return new Clip(Math.max(this.x0, x), Math.max(this.y0, y), Math.min(this.x1, x + w), Math.min(this.y1, y + h));
  }

  /**
   * @param {number} x
   * @param {number} y
   */
  contains(x, y) {
    return x >= this.x0 && x < this.x1 && y >= this.y0 && y < this.y1;
  }

  get empty() {
    return this.x1 <= this.x0 || this.y1 <= this.y0;
  }
}

/** Where the caret shows after painting; (-1, -1) when it does not. */
export class Caret {
  constructor() {
    this.x = -1;
    this.y = -1;
  }

  get visible() {
    return this.x >= 0;
  }
}

/**
 * @param {Screen} screen
 * @param {Clip} clip
 * @param {number} x
 * @param {number} y
 * @param {string} g
 * @param {number} w
 * @param {Style} style
 */
const putClipped = (screen, clip, x, y, g, w, style) => {
  if (!clip.contains(x, y)) return;
  if (w === 2 && !clip.contains(x + 1, y)) {
    screen.put(x, y, " ", 1, style);
    return;
  }
  screen.put(x, y, g, w, style);
};

/**
 * @param {Screen} screen
 * @param {Clip} clip
 * @param {WrappedLine[]} lines
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 */
const paintLines = (screen, clip, lines, x, y, w, h) => {
  const rows = Math.min(lines.length, h);
  for (let r = 0; r < rows; r++) {
    let cx = x;
    for (const cell of lines[r].cells) {
      if (cx - x + cell.w > w) break;
      putClipped(screen, clip, cx, y + r, cell.g, cell.w, cell.style);
      cx += cell.w;
    }
  }
};

/**
 * @param {Screen} screen
 * @param {Clip} clip
 * @param {TBox} box
 * @param {Style} style
 */
const drawBorder = (screen, clip, box, style) => {
  const x = box.x;
  const y = box.y;
  const w = box.w;
  const h = box.h;
  if (w < 2 || h < 2) return;
  putClipped(screen, clip, x, y, "┌", 1, style);
  putClipped(screen, clip, x + w - 1, y, "┐", 1, style);
  putClipped(screen, clip, x, y + h - 1, "└", 1, style);
  putClipped(screen, clip, x + w - 1, y + h - 1, "┘", 1, style);
  for (let i = 1; i < w - 1; i++) {
    putClipped(screen, clip, x + i, y, "─", 1, style);
    putClipped(screen, clip, x + i, y + h - 1, "─", 1, style);
  }
  for (let j = 1; j < h - 1; j++) {
    putClipped(screen, clip, x, y + j, "│", 1, style);
    putClipped(screen, clip, x + w - 1, y + j, "│", 1, style);
  }
  const title = box.title;
  if (title !== null && title.length > 0 && w > 4) {
    let cx = x + 2;
    const limit = x + w - 2;
    for (const g of graphemes(" " + title + " ")) {
      const gw = graphemeWidth(g);
      if (cx + gw > limit) break;
      putClipped(screen, clip, cx, y, g, gw, style);
      cx += gw;
    }
  }
};

/**
 * @param {TNode} node
 * @param {Screen} screen
 * @param {Clip} clip
 * @param {Style} inherited
 * @param {Caret} caret
 * @param {TElement | null} focus the focused element: an input shows its caret, anything else shows inverse
 */
export const paint = (node, screen, clip, inherited, caret, focus) => {
  if (node instanceof TAnchor) return;
  if (clip.empty) return;
  if (node instanceof TRun) {
    paintLines(screen, clip, textLayoutOf(node).lines, node.x, node.y, node.w, node.h);
    return;
  }
  if (!(node instanceof TElement)) return;
  if (node.hidden) return;
  const focused = focus === node && !(node instanceof TInput);
  const style = node.style.inherit(inherited);
  if (node instanceof TText) {
    paintLines(screen, clip, textLayoutOf(node).lines, node.x, node.y, node.w, node.h);
    if (focused) invert(screen, clip, node);
    return;
  }
  if (node instanceof TInput) {
    paintInput(node, screen, clip, style, caret, focus === node);
    return;
  }
  if (node instanceof TBox) {
    if (node.style.bg !== -1 || node.style.attrs !== 0) {
      const c = clip.intersect(node.x, node.y, node.w, node.h);
      screen.fill(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0, style);
    }
    if (node.rule) {
      for (let i = 0; i < node.w; i++) putClipped(screen, clip, node.x + i, node.y, "─", 1, style);
      return;
    }
    if (node.border) drawBorder(screen, clip, node, style);
    const pad = node.padding + (node.border ? 1 : 0);
    const inner = clip.intersect(node.x + pad, node.y + pad, node.w - pad * 2, node.h - pad * 2);
    for (const c of node.children) paint(c, screen, inner, style, caret, focus);
    if (focused) invert(screen, clip, node);
  }
};

/**
 * The focus ring: every cell of the element shown inverse, over what it painted.
 * @param {Screen} screen
 * @param {Clip} clip
 * @param {TElement} node
 */
const invert = (screen, clip, node) => {
  const c = clip.intersect(node.x, node.y, node.w, node.h);
  if (!c.empty) screen.addAttr(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0, ATTR_INVERSE);
};

/**
 * The visual rows of an input at width `w`: each logical line split by character width.
 * @param {TInput} input
 * @param {number} w
 * @returns {string[][]}
 */
export const inputVisualRows = (input, w) => {
  const width = w < 1 ? 1 : w;
  /** @type {string[][]} */
  const rows = [];
  for (const line of input.lines) {
    /** @type {string[]} */
    let row = [];
    let rw = 0;
    for (const g of graphemes(line)) {
      const gw = graphemeWidth(g);
      if (rw + gw > width && row.length > 0) {
        rows.push(row);
        row = [];
        rw = 0;
      }
      row.push(g);
      rw += gw;
    }
    rows.push(row);
  }
  return rows;
};

/**
 * The visual row and column of the logical caret.
 * @param {TInput} input
 * @param {number} w
 * @returns {[number, number]}
 */
export const inputCaretCell = (input, w) => {
  const width = w < 1 ? 1 : w;
  let vrow = 0;
  for (let r = 0; r < input.lines.length; r++) {
    const gs = graphemes(input.lines[r]);
    if (r === input.row) {
      let rw = 0;
      let rowsHere = 0;
      const col = Math.min(input.col, gs.length);
      for (let i = 0; i < col; i++) {
        const gw = graphemeWidth(gs[i]);
        if (rw + gw > width) {
          rowsHere++;
          rw = 0;
        }
        rw += gw;
      }
      if (rw >= width && col < gs.length) {
        rowsHere++;
        rw = 0;
      }
      return [vrow + rowsHere, rw];
    }
    let rw = 0;
    let rowsHere = 1;
    for (const g of gs) {
      const gw = graphemeWidth(g);
      if (rw + gw > width && rw > 0) {
        rowsHere++;
        rw = 0;
      }
      rw += gw;
    }
    vrow += rowsHere;
  }
  return [vrow, 0];
};

/**
 * @param {TInput} input
 * @param {Screen} screen
 * @param {Clip} clip
 * @param {Style} style
 * @param {Caret} caret
 * @param {boolean} focused
 */
const paintInput = (input, screen, clip, style, caret, focused) => {
  const c = clip.intersect(input.x, input.y, input.w, input.h);
  if (c.empty) return;
  const empty = input.lines.length === 1 && input.lines[0].length === 0;
  if (empty && input.placeholder.length > 0) {
    let cx = input.x;
    const dim = style.withAttr(2, true);
    for (const g of graphemes(input.placeholder)) {
      const gw = graphemeWidth(g);
      if (cx + gw > input.x + input.w) break;
      putClipped(screen, c, cx, input.y, g, gw, dim);
      cx += gw;
    }
    if (focused && c.contains(input.x, input.y)) {
      caret.x = input.x;
      caret.y = input.y;
    }
  } else {
    const rows = inputVisualRows(input, input.w);
    const [crow] = inputCaretCell(input, input.w);
    let first = 0;
    if (crow >= input.h) first = crow - input.h + 1;
    for (let r = 0; r < input.h && first + r < rows.length; r++) {
      let cx = input.x;
      for (const g of rows[first + r]) {
        const gw = graphemeWidth(g);
        putClipped(screen, c, cx, input.y + r, g, gw, style);
        cx += gw;
      }
    }
    if (focused) {
      const [cr, cc] = inputCaretCell(input, input.w);
      const vy = input.y + cr - first;
      const vx = input.x + cc;
      if (c.contains(vx, vy) || (vx === c.x1 && vy >= c.y0 && vy < c.y1)) {
        caret.x = vx;
        caret.y = vy;
      }
    }
  }
};
