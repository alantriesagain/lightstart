/**
 * @bootstrapp/light/tdom/layout: two passes, measure bottom-up and arrange
 * top-down. One flex axis per box, fixed sizes, padding, a one-cell border,
 * scroll boxes that stick to the bottom. Wrapped text and scroll positions
 * are cached on the node across frames by version.
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

/** The wrapped lines of a text-like node, kept across frames while its width, its version and the style it inherits hold. */
export class TextLayout {
  lines: WrappedLine[];
  wrappedFor: number;
  version: number;
  under: Style | null;
  naturalWidth: number;

  constructor() {
    this.lines = [];
    this.wrappedFor = -1;
    this.version = -1;
    this.under = null;
    this.naturalWidth = 0;
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

const visibleChildren = (el: TElement) => {
  const out: TNode[] = [];
  for (let c = el.firstChild; c !== null; c = c.next) {
    if (c instanceof TAnchor) continue;
    if (c instanceof TElement && c.hidden) continue;
    out.push(c);
  }
  return out;
};

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
 * Measure a node for the available width; answers its natural size.
 */
export const measure = (node: TNode, availW: number, inherited: Style): Size => {
  if (node instanceof TRun) {
    const tl = textLayoutOf(node);
    if (tl.wrappedFor !== availW || tl.version !== node.version) {
      tl.lines = wrapRuns([new InlineRun(node.text, inherited)], availW, "none");
      tl.wrappedFor = availW;
      tl.version = node.version;
      tl.naturalWidth = stringWidth(node.text);
    }
    return new Size(Math.min(tl.naturalWidth, availW), tl.lines.length);
  }
  if (node instanceof TText) {
    const tl = wrapText(node, availW, node.wrap, inherited);
    return new Size(Math.min(tl.naturalWidth, availW), tl.lines.length);
  }
  if (node instanceof TInput) {
    const rows = inputRows(node, availW);
    const h = Math.max(node.minLines, Math.min(node.maxLines, rows));
    return new Size(availW, h);
  }
  if (node instanceof TBox) return measureBox(node, availW, inherited);
  return new Size(0, 0);
};

const measureBox = (box: TBox, availW: number, inherited: Style) => {
  const style = box.style.inherit(inherited);
  const outerW = box.width !== null ? box.width : availW;
  const innerW = Math.max(0, outerW - chrome(box));
  const kids = visibleChildren(box);
  let w = 0;
  let h = 0;
  if (box.rule) return new Size(outerW, box.height !== null ? box.height : 1);
  if (box.direction === "row") {
    let fixed = 0;
    let flexTotal = 0;
    const sizes: Size[] = [];
    for (const k of kids)
      if (k instanceof TBox && k.flex > 0) {
        flexTotal += k.flex;
        sizes.push(new Size(0, 0));
      } else {
        const s = measure(k, innerW, style);
        if (k instanceof TBox && k.width !== null) s.w = k.width;
        sizes.push(s);
        fixed += s.w;
      }
    const gaps = kids.length > 1 ? box.gap * (kids.length - 1) : 0;
    const remaining = Math.max(0, innerW - fixed - gaps);
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i];
      if (k instanceof TBox && k.flex > 0) {
        const share = flexTotal > 0 ? Math.floor((remaining * k.flex) / flexTotal) : 0;
        sizes[i] = measure(k, share, style);
        sizes[i].w = share;
      }
      if (sizes[i].h > h) h = sizes[i].h;
      w += sizes[i].w;
    }
    w += gaps;
  } else {
    for (const k of kids) {
      const s = measure(k, innerW, style);
      if (s.w > w) w = s.w;
      h += s.h;
    }
    if (kids.length > 1) h += box.gap * (kids.length - 1);
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
    const tl = textLayoutOf(node);
    if (tl.wrappedFor !== w || tl.version !== node.version) {
      tl.lines = wrapRuns([new InlineRun(node.text, inherited)], w, "none");
      tl.wrappedFor = w;
      tl.version = node.version;
    }
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
  const kids = visibleChildren(box);
  if (kids.length === 0) return;

  if (box.direction === "row") {
    const sizes: Size[] = [];
    let fixed = 0;
    let flexTotal = 0;
    for (const k of kids)
      if (k instanceof TBox && k.flex > 0) {
        flexTotal += k.flex;
        sizes.push(new Size(0, 0));
      } else {
        const s = measure(k, cw, style);
        if (k instanceof TBox && k.width !== null) s.w = k.width;
        sizes.push(s);
        fixed += s.w;
      }
    const gaps = kids.length > 1 ? box.gap * (kids.length - 1) : 0;
    const remaining = Math.max(0, cw - fixed - gaps);
    let cursor = cx;
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i];
      let kw = sizes[i].w;
      if (k instanceof TBox && k.flex > 0) kw = flexTotal > 0 ? Math.floor((remaining * k.flex) / flexTotal) : 0;
      const kh = box.align === "stretch" ? ch : Math.min(ch, measure(k, kw, style).h);
      const ky = box.align === "end" ? cy + ch - kh : cy;
      arrange(k, cursor, ky, kw, kh, style);
      cursor += kw + box.gap;
    }
    return;
  }

  const sizes: Size[] = [];
  let fixedH = 0;
  let flexTotal = 0;
  for (const k of kids) {
    const s = measure(k, cw, style);
    sizes.push(s);
    if (k instanceof TBox && k.flex > 0 && k.height === null) flexTotal += k.flex;
    else fixedH += s.h;
  }
  const gaps = kids.length > 1 ? box.gap * (kids.length - 1) : 0;
  const totalH = fixedH + gaps;
  let remaining = Math.max(0, ch - totalH);
  if (flexTotal === 0 && !box.scroll && totalH > ch) remaining = 0;
  const scrolling = box.scroll;
  let contentH = 0;
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    let kh = sizes[i].h;
    if (k instanceof TBox && k.flex > 0 && k.height === null && flexTotal > 0) kh = Math.floor((remaining * k.flex) / flexTotal);
    contentH += kh;
    if (i > 0) contentH += box.gap;
  }
  let offset = 0;
  if (scrolling) {
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
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    let kh = sizes[i].h;
    if (k instanceof TBox && k.flex > 0 && k.height === null && flexTotal > 0) kh = Math.floor((remaining * k.flex) / flexTotal);
    let kw = cw;
    if (box.align !== "stretch") kw = Math.min(cw, sizes[i].w);
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
  if (node instanceof TBox) node.scrollState = null;
  if (node instanceof TElement) for (let c = node.firstChild; c !== null; c = c.next) forgetLayout(c);
};
