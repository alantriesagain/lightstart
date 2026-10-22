/**
 * @bootstrapp/light/tdom/layout: two passes, measure bottom-up and arrange
 * top-down. One flex axis per box, fixed sizes, padding, a one-cell border,
 * scroll boxes that stick to the bottom. Wrapped text, measured sizes and
 * scroll positions are cached on the node across frames by version, so a
 * box measured again in the same frame, or in the next one with nothing
 * changed beneath it, answers at once; a cached Size is never changed. An
 * input, whose lines may be set without a version bump, is measured afresh.
 */
import { TAnchor, TBox, TElement, TInput, TNode, TRun, TSpan, TText } from "./node.ts";
import { Style } from "./style.ts";
import { stringWidth } from "./width.ts";
import { InlineRun, WrappedLine, wrapRuns } from "./wrap.ts";

export class Size {
  w: number;
  h: number;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
  }
}

const NO_SIZE = new Size(0, 0);

/** A box's last measure, kept across frames while the width it was offered, its version and the style it inherits hold. */
export class MeasureCache {
  width: number;
  version: number;
  under: Style;
  size: Size;

  constructor(width: number, version: number, under: Style, size: Size) {
    this.width = width;
    this.version = version;
    this.under = under;
    this.size = size;
  }
}

/** The wrapped lines of a text-like node, and its size at that width, kept across frames while its width, its version and the style it inherits hold. */
export class TextLayout {
  lines: WrappedLine[];
  wrappedFor: number;
  version: number;
  under: Style | null;
  naturalWidth: number;
  size: Size;

  constructor() {
    this.lines = [];
    this.wrappedFor = -1;
    this.version = -1;
    this.under = null;
    this.naturalWidth = 0;
    this.size = NO_SIZE;
  }
}

export const textLayoutOf = (node: TNode) => {
  if (node.textLayout === null) node.textLayout = new TextLayout();
  return node.textLayout;
};

/** Scroll state kept per box across frames. */
export class ScrollState {
  contentH: number;
  atBottom: boolean;

  constructor() {
    this.contentH = 0;
    this.atBottom = true;
  }
}

export const scrollStateOf = (box: TBox) => {
  if (box.scrollState === null) box.scrollState = new ScrollState();
  return box.scrollState;
};

/**
 * Collect a text's inline runs with their inherited styles.
 */
export const inlineRuns = (el: TElement, base: Style, out: InlineRun[]) => {
  const style = el.style.inherit(base);
  for (let c = el.firstChild; c !== null; c = c.next)
    if (c instanceof TRun) out.push(new InlineRun(c.text, style));
    else if (c instanceof TSpan) inlineRuns(c, style, out);
    else if (c instanceof TText) inlineRuns(c, style, out);
};

const chrome = (box: TBox) => box.padding * 2 + (box.border ? 2 : 0);

const shown = (node: TNode) => !(node instanceof TAnchor) && !(node instanceof TElement && node.hidden);

const flexOf = (node: TNode) => (node instanceof TBox ? node.flex : 0);

/** The flex a column gives a child: a box's, unless the box fixes its height. */
const growOf = (node: TNode) => (node instanceof TBox && node.height === null ? node.flex : 0);

/** The width a child takes in a row: the width a box fixes, else its measured width. */
const widthIn = (node: TNode, size: Size) => (node instanceof TBox && node.width !== null ? node.width : size.w);

const wrapText = (node: TElement, width: number, mode: string, inherited: Style) => {
  const tl = textLayoutOf(node);
  if (tl.wrappedFor === width && tl.version === node.version && tl.under !== null && tl.under.equals(inherited)) return tl;
  const runs: InlineRun[] = [];
  inlineRuns(node, inherited, runs);
  tl.lines = wrapRuns(runs, width, mode);
  tl.wrappedFor = width;
  tl.version = node.version;
  tl.under = inherited;
  let natural = 0;
  for (const l of tl.lines) if (l.width > natural) natural = l.width;
  tl.naturalWidth = natural;
  tl.size = new Size(Math.min(natural, width), tl.lines.length);
  return tl;
};

const wrapRun = (node: TRun, width: number, inherited: Style) => {
  const tl = textLayoutOf(node);
  if (tl.wrappedFor === width && tl.version === node.version) return tl;
  tl.lines = wrapRuns([new InlineRun(node.text, inherited)], width, "none");
  tl.wrappedFor = width;
  tl.version = node.version;
  tl.naturalWidth = stringWidth(node.text);
  tl.size = new Size(Math.min(tl.naturalWidth, width), tl.lines.length);
  return tl;
};

/**
 * Visual rows an input needs at `width`; each logical line wraps by characters.
 */
export const inputRows = (input: TInput, width: number) => {
  const w = width < 1 ? 1 : width;
  let rows = 0;
  for (const line of input.lines) {
    const lw = stringWidth(line);
    rows += lw === 0 ? 1 : Math.ceil(lw / w);
  }
  return rows;
};

/**
 * Measure a node for the available width; answers its natural size, which
 * the caller reads and never changes.
 */
export const measure = (node: TNode, availW: number, inherited: Style): Size => {
  if (node instanceof TRun) return wrapRun(node, availW, inherited).size;
  if (node instanceof TText) return wrapText(node, availW, node.wrap, inherited).size;
  if (node instanceof TInput) return new Size(availW, Math.max(node.minLines, Math.min(node.maxLines, inputRows(node, availW))));
  if (node instanceof TBox) return measureBox(node, availW, inherited);
  return NO_SIZE;
};

const measureBox = (box: TBox, availW: number, inherited: Style) => {
  const cache = box.measured;
  if (cache !== null && cache.width === availW && cache.version === box.version && cache.under.equals(inherited)) return cache.size;
  const size = boxSize(box, availW, inherited);
  if (cache === null) box.measured = new MeasureCache(availW, box.version, inherited, size);
  else {
    cache.width = availW;
    cache.version = box.version;
    cache.under = inherited;
    cache.size = size;
  }
  return size;
};

const boxSize = (box: TBox, availW: number, inherited: Style) => {
  const outerW = box.width !== null ? box.width : availW;
  if (box.rule) return new Size(outerW, box.height !== null ? box.height : 1);
  const style = box.style.inherit(inherited);
  const innerW = Math.max(0, outerW - chrome(box));
  let w = 0;
  let h = 0;
  let count = 0;
  if (box.direction === "row") {
    let fixed = 0;
    let flexTotal = 0;
    for (let k = box.firstChild; k !== null; k = k.next) {
      if (!shown(k)) continue;
      count++;
      const flex = flexOf(k);
      if (flex > 0) flexTotal += flex;
      else fixed += widthIn(k, measure(k, innerW, style));
    }
    const gaps = count > 1 ? box.gap * (count - 1) : 0;
    const remaining = Math.max(0, innerW - fixed - gaps);
    for (let k = box.firstChild; k !== null; k = k.next) {
      if (!shown(k)) continue;
      const flex = flexOf(k);
      if (flex > 0) {
        const share = flexTotal > 0 ? Math.floor((remaining * flex) / flexTotal) : 0;
        const s = measure(k, share, style);
        if (s.h > h) h = s.h;
        w += share;
      } else {
        const s = measure(k, innerW, style);
        if (s.h > h) h = s.h;
        w += widthIn(k, s);
      }
    }
    w += gaps;
  } else {
    for (let k = box.firstChild; k !== null; k = k.next) {
      if (!shown(k)) continue;
      count++;
      const s = measure(k, innerW, style);
      if (s.w > w) w = s.w;
      h += s.h;
    }
    if (count > 1) h += box.gap * (count - 1);
  }
  return new Size(box.width !== null ? box.width : w + chrome(box), box.height !== null ? box.height : h + chrome(box));
};

/**
 * Place `node` at (x, y) with size (w, h) and lay out its children.
 */
export const arrange = (node: TNode, x: number, y: number, w: number, h: number, inherited: Style) => {
  node.x = x;
  node.y = y;
  node.w = w;
  node.h = h;
  if (node instanceof TText) {
    wrapText(node, w, node.wrap, inherited);
    return;
  }
  if (node instanceof TRun) {
    wrapRun(node, w, inherited);
    return;
  }
  if (!(node instanceof TBox)) return;
  const box = node;
  const style = box.style.inherit(inherited);
  const pad = box.padding + (box.border ? 1 : 0);
  const cx = x + pad;
  const cy = y + pad;
  const cw = Math.max(0, w - pad * 2);
  const ch = Math.max(0, h - pad * 2);
  let count = 0;
  for (let k = box.firstChild; k !== null; k = k.next) if (shown(k)) count++;
  if (count === 0) return;
  const gaps = count > 1 ? box.gap * (count - 1) : 0;

  if (box.direction === "row") {
    let fixed = 0;
    let flexTotal = 0;
    for (let k = box.firstChild; k !== null; k = k.next) {
      if (!shown(k)) continue;
      const flex = flexOf(k);
      if (flex > 0) flexTotal += flex;
      else fixed += widthIn(k, measure(k, cw, style));
    }
    const remaining = Math.max(0, cw - fixed - gaps);
    let cursor = cx;
    for (let k = box.firstChild; k !== null; k = k.next) {
      if (!shown(k)) continue;
      const flex = flexOf(k);
      const kw = flex > 0 ? (flexTotal > 0 ? Math.floor((remaining * flex) / flexTotal) : 0) : widthIn(k, measure(k, cw, style));
      const kh = box.align === "stretch" ? ch : Math.min(ch, measure(k, kw, style).h);
      const ky = box.align === "end" ? cy + ch - kh : cy;
      arrange(k, cursor, ky, kw, kh, style);
      cursor += kw + box.gap;
    }
    return;
  }

  let fixedH = 0;
  let flexTotal = 0;
  for (let k = box.firstChild; k !== null; k = k.next) {
    if (!shown(k)) continue;
    const s = measure(k, cw, style);
    const grow = growOf(k);
    if (grow > 0) flexTotal += grow;
    else fixedH += s.h;
  }
  const totalH = fixedH + gaps;
  let remaining = Math.max(0, ch - totalH);
  if (flexTotal === 0 && !box.scroll && totalH > ch) remaining = 0;
  let offset = 0;
  if (box.scroll) {
    let contentH = gaps;
    for (let k = box.firstChild; k !== null; k = k.next) {
      if (!shown(k)) continue;
      const grow = growOf(k);
      contentH += grow > 0 && flexTotal > 0 ? Math.floor((remaining * grow) / flexTotal) : measure(k, cw, style).h;
    }
    const st = scrollStateOf(box);
    const maxScroll = Math.max(0, contentH - ch);
    let top = box.scrollTop;
    if (box.stickToBottom && st.atBottom) top = maxScroll;
    if (top > maxScroll) top = maxScroll;
    if (top < 0) top = 0;
    box.scrollTop = top;
    st.contentH = contentH;
    st.atBottom = top >= maxScroll;
    offset = top;
  }
  let cursor = cy - offset;
  for (let k = box.firstChild; k !== null; k = k.next) {
    if (!shown(k)) continue;
    const grow = growOf(k);
    const kh = grow > 0 && flexTotal > 0 ? Math.floor((remaining * grow) / flexTotal) : measure(k, cw, style).h;
    let kw = cw;
    if (box.align !== "stretch") kw = Math.min(cw, measure(k, cw, style).w);
    if (k instanceof TBox && k.width !== null) kw = Math.min(cw, k.width);
    const kx = box.align === "end" ? cx + cw - kw : cx;
    arrange(k, kx, cursor, kw, kh, style);
    cursor += kh + box.gap;
  }
};

/**
 * Lay out the whole tree for a terminal of cols by rows.
 */
export const layout = (root: TBox, cols: number, rows: number, inherited: Style) => {
  arrange(root, 0, 0, cols, rows, inherited);
};

/**
 * Scroll a box by `delta` rows, positive down; the next frame clamps it.
 */
export const scrollBy = (box: TBox, delta: number) => {
  const st = scrollStateOf(box);
  box.scrollTop = Math.max(0, box.scrollTop + delta);
  st.atBottom = false;
  box.invalidate();
};

/**
 * Forget the cached layout of a detached subtree.
 */
export const forgetLayout = (node: TNode) => {
  node.textLayout = null;
  if (node instanceof TBox) {
    node.scrollState = null;
    node.measured = null;
  }
  if (node instanceof TElement) for (let c = node.firstChild; c !== null; c = c.next) forgetLayout(c);
};
