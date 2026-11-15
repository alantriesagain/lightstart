/**
 * @lightstart/light/native/tui/paint: a laid-out tree into a Screen, clipping
 * with a rectangle passed down the tree.
 */
import { TAnchor, TBox, TElement, TInput, TNode, TRun, TText, tabRowOf } from "./node.ts";
import { Screen } from "./screen.ts";
import { ATTR_BOLD, ATTR_INVERSE, DEFAULT_STYLE, Style } from "./style.ts";
import { graphemeWidth, graphemes } from "./width.ts";
import { WrappedLine } from "./wrap.ts";
import { collectLayers, textLayoutOf } from "./layout.ts";

export class Clip {
  x0: number;
  y0: number;
  x1: number;
  y1: number;

  constructor(x0: number, y0: number, x1: number, y1: number) {
    this.x0 = x0;
    this.y0 = y0;
    this.x1 = x1;
    this.y1 = y1;
  }

  intersect(x: number, y: number, w: number, h: number) {
    return new Clip(Math.max(this.x0, x), Math.max(this.y0, y), Math.min(this.x1, x + w), Math.min(this.y1, y + h));
  }

  contains(x: number, y: number) {
    return x >= this.x0 && x < this.x1 && y >= this.y0 && y < this.y1;
  }

  get empty() {
    return this.x1 <= this.x0 || this.y1 <= this.y0;
  }
}

/** Where the caret shows after painting; (-1, -1) when it does not. */
export class Caret {
  x: number;
  y: number;

  constructor() {
    this.x = -1;
    this.y = -1;
  }

  get visible() {
    return this.x >= 0;
  }
}

const putClipped = (screen: Screen, clip: Clip, x: number, y: number, g: string, w: number, style: Style) => {
  if (!clip.contains(x, y)) return;
  if (w === 2 && !clip.contains(x + 1, y)) {
    screen.put(x, y, " ", 1, style);
    return;
  }
  screen.put(x, y, g, w, style);
};

const paintLines = (screen: Screen, clip: Clip, lines: WrappedLine[], x: number, y: number, w: number, h: number) => {
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

const drawBorder = (screen: Screen, clip: Clip, box: TBox, style: Style) => {
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

const tabLabels = (box: TBox): string[] => {
  const out: string[] = [];
  if (box.tabs !== "") {
    const parts = box.tabs.split("\n");
    for (let i = 0; i < parts.length; i++) if (parts[i].length > 0) out.push(parts[i]);
  }
  if (out.length === 0 && box.title !== null) out.push(box.title);
  return out;
};

const tabActive = (box: TBox): number => {
  if (box.tabs !== "") {
    const parts = box.tabs.split("\n");
    for (let i = 0; i < parts.length; i++) if (parts[i].length > 0) return box.activeTab;
  }
  return box.title !== null ? 0 : -1;
};

type TabSpans = { start: number[]; end: number[]; index: number[] };

/** The tabs that fit on the top edge, from the first; when the active one would not fit, from the first tab that lets it. */
const tabSpans = (box: TBox): TabSpans => {
  const labels = tabLabels(box);
  const widths: number[] = [];
  for (let i = 0; i < labels.length; i++) {
    let width = 2;
    for (const g of graphemes(labels[i])) width += graphemeWidth(g);
    widths.push(width);
  }
  const room = box.w;
  const active = tabActive(box);
  let first = 0;
  if (active >= 0 && active < labels.length) {
    let used = widths[active];
    first = active;
    while (first > 0 && used + widths[first - 1] <= room) {
      first--;
      used += widths[first];
    }
    // From the first tab when the active one fits that way too.
    let fromStart = 0;
    for (let i = 0; i <= active; i++) fromStart += widths[i];
    if (fromStart <= room) first = 0;
  }
  const start: number[] = [];
  const end: number[] = [];
  const index: number[] = [];
  const limit = box.x + box.w;
  let cx = box.x;
  for (let i = first; i < labels.length; i++) {
    if (cx + widths[i] > limit) break;
    start.push(cx);
    end.push(cx + widths[i]);
    index.push(i);
    cx += widths[i];
  }
  return { start: start, end: end, index: index };
};

/**
 * The tab index under screen column `x` on the box's top row, or -1.
 */
export const tabAt = (box: TBox, x: number): number => {
  const spans = tabSpans(box);
  for (let i = 0; i < spans.start.length; i++) {
    if (x >= spans.start[i] && x < spans.end[i]) return spans.index[i];
  }
  return -1;
};

const drawCellBorder = (screen: Screen, clip: Clip, box: TBox, style: Style, inherited: Style) => {
  const x = box.x;
  const y = box.y;
  const w = box.w;
  const h = box.h;
  if (w < 2 || h < 2) return;
  const line = box.borderColor !== -1 ? box.borderColor : style.fg;
  const tint = style.bg;
  const outer = inherited.bg;
  const heavy = box.borderHeavy && line !== -1 && tint !== -1 && outer !== -1;
  let top = "▁";
  let topFg = line;
  let topBg = outer;
  let bottom = "▔";
  let bottomFg = line;
  let bottomBg = outer;
  let left = "▏";
  let leftFg = line;
  let leftBg = tint;
  let right = "▕";
  let rightFg = line;
  let rightBg = tint;
  if (heavy) {
    top = "▂";
    bottom = "▆";
    bottomFg = outer;
    bottomBg = line;
    left = "▎";
    right = "▊";
    rightFg = tint;
    rightBg = line;
  }
  const topStyle = new Style(topFg, topBg, 0);
  const bottomStyle = new Style(bottomFg, bottomBg, 0);
  const leftStyle = new Style(leftFg, leftBg, 0);
  const rightStyle = new Style(rightFg, rightBg, 0);
  const tabRow = tabRowOf(box);
  // With tabs, the edge is the pane's first row with its line along the top, right under the tab
  // row, the active tab sitting on it in its color.
  const edge = y + tabRow;
  const spans = tabSpans(box);
  const active = tabActive(box);
  const lid = new Style(line, tint, 0);
  for (let i = 0; i < w; i++) {
    if (tabRow === 0) putClipped(screen, clip, x + i, y, top, 1, topStyle);
    else if (i > 0 && i < w - 1) putClipped(screen, clip, x + i, edge, "▔", 1, lid);
    putClipped(screen, clip, x + i, y + h - 1, bottom, 1, bottomStyle);
  }
  if (tabRow > 0) {
    putClipped(screen, clip, x, edge, box.borderSides ? "🭽" : "▔", 1, lid);
    putClipped(screen, clip, x + w - 1, edge, box.borderSides ? "🭾" : "▔", 1, lid);
  }
  for (let j = 1 + tabRow; j < h - 1 && box.borderSides; j++) {
    putClipped(screen, clip, x, y + j, left, 1, leftStyle);
    putClipped(screen, clip, x + w - 1, y + j, right, 1, rightStyle);
  }
  const labels = tabLabels(box);
  for (let s = 0; s < spans.start.length; s++) {
    const labelIndex = spans.index[s];
    const on = labelIndex === active;
    const fg = on ? (box.tabFg !== -1 ? box.tabFg : tint) : line;
    const bg = on ? (box.tabBg !== -1 ? box.tabBg : line) : outer;
    const attrs = on ? ATTR_BOLD : 0;
    const tabStyle = new Style(fg, bg, attrs);
    const end = spans.end[s];
    let cx = spans.start[s];
    for (const g of graphemes(" " + labels[labelIndex] + " ")) {
      const gw = graphemeWidth(g);
      if (cx + gw > end) break;
      putClipped(screen, clip, cx, y, g, gw, tabStyle);
      cx += gw;
    }
  }
};

/**
 * @param focus the focused element: an input shows its caret, anything else shows inverse
 */
export const paint = (node: TNode, screen: Screen, clip: Clip, inherited: Style, caret: Caret, focus: TElement | null) => {
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
      if (node.border && node.borderStyle === "cell") {
        if (node.h > 2) {
          const c = clip.intersect(node.x, node.y + 1, node.w, node.h - 2);
          screen.fill(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0, style);
        }
      } else {
        const c = clip.intersect(node.x, node.y, node.w, node.h);
        screen.fill(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0, style);
      }
    }
    if (node.rule) {
      for (let i = 0; i < node.w; i++) putClipped(screen, clip, node.x + i, node.y, "─", 1, style);
      return;
    }
    if (node.border && node.borderStyle === "cell") drawCellBorder(screen, clip, node, style, inherited);
    else if (node.border) drawBorder(screen, clip, node, style);
    const pad = node.padding + (node.border ? 1 : 0);
    const tabRow = tabRowOf(node);
    const inner = clip.intersect(node.x + pad, node.y + pad + tabRow, node.w - pad * 2, node.h - pad * 2 - tabRow);
    for (let c = node.firstChild; c !== null; c = c.next) {
      if (c instanceof TBox && c.layer) continue;
      paint(c, screen, inner, style, caret, focus);
    }
    if (focused) invert(screen, clip, node);
  }
};

/**
 * The focus ring: every cell of the element shown inverse, over what it painted.
 */
const invert = (screen: Screen, clip: Clip, node: TElement) => {
  const c = clip.intersect(node.x, node.y, node.w, node.h);
  if (!c.empty) screen.addAttr(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0, ATTR_INVERSE);
};

/**
 * The visual rows of an input at width `w`: each logical line split by character width.
 */
export const inputVisualRows = (input: TInput, w: number): string[][] => {
  const width = w < 1 ? 1 : w;
  const rows: string[][] = [];
  for (const line of input.lines) {
    let row: string[] = [];
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
 */
export const inputCaretCell = (input: TInput, w: number): [number, number] => {
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

const paintInput = (input: TInput, screen: Screen, clip: Clip, style: Style, caret: Caret, focused: boolean) => {
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

/** The style `el`'s ancestors hand down to it, as the tree pass would have: a layer drawn on its own keeps their colors. */
const inheritedAt = (el: TElement): Style => {
  const chain: TElement[] = [];
  for (let p = el.parent; p !== null; p = p.parent) chain.push(p);
  let style = DEFAULT_STYLE;
  for (let i = chain.length - 1; i >= 0; i--) style = chain[i].style.inherit(style);
  return style;
};

/**
 * Paint the overlay layers under `root` over what the tree painted, in tree order, each over the
 * whole screen in the style its ancestors hand down, then its shadow: the column right of it and
 * the row below it take the shadow's bg and keep their glyphs.
 */
export const paintLayers = (root: TNode, screen: Screen, caret: Caret, focus: TElement | null) => {
  const full = new Clip(0, 0, screen.w, screen.h);
  for (const layer of collectLayers(root, [])) {
    paint(layer, screen, full, inheritedAt(layer), caret, focus);
    if (layer.shadow === -1) continue;
    screen.setBg(layer.x + layer.w, layer.y + 1, 1, layer.h - 1, layer.shadow);
    screen.setBg(layer.x + 1, layer.y + layer.h, layer.w - 1, 1, layer.shadow);
  }
};
