/**
 * @bootstrapp/light/tdom/screen: a cell grid double buffer and the diff
 * that turns two frames into the smallest escape stream.
 */
import { CSI, SYNC_END, SYNC_START, cup, sgrTransition } from "./ansi.ts";
import { COLOR_DEFAULT, Style } from "./style.ts";

const SPACE = 0x20;
const CONT = 0xffffffff;
const INTERNED = 0x80000000;

const internTable: string[] = [];
const internIndex: Map<string, number> = new Map();

const internGlyph = (g: string) => {
  const cp = g.codePointAt(0) ?? SPACE;
  const single = cp > 0xffff ? g.length === 2 : g.length === 1;
  if (single) return cp;
  let i = internIndex.get(g);
  if (i === undefined) {
    i = internTable.length;
    internTable.push(g);
    internIndex.set(g, i);
  }
  return i | INTERNED;
};

const glyphString = (code: number) => {
  if (code === CONT) return "";
  if ((code & INTERNED) !== 0 && code !== CONT) return internTable[code & 0x7fffffff];
  return String.fromCodePoint(code);
};

export class Screen {
  w: number;
  h: number;
  glyph: Uint32Array;
  fg: Int32Array;
  bg: Int32Array;
  attrs: Uint8Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.glyph = new Uint32Array(n);
    this.fg = new Int32Array(n);
    this.bg = new Int32Array(n);
    this.attrs = new Uint8Array(n);
    this.clear();
  }

  clear() {
    this.glyph.fill(SPACE);
    this.fg.fill(COLOR_DEFAULT);
    this.bg.fill(COLOR_DEFAULT);
    this.attrs.fill(0);
  }

  /**
   * Write one grapheme of `width` cells at (x, y); writes outside the grid are dropped.
   */
  put(x: number, y: number, g: string, width: number, style: Style) {
    if (x < 0 || y < 0 || y >= this.h || x >= this.w) return;
    const i = y * this.w + x;
    if (this.glyph[i] === CONT && x > 0) this.glyph[i - 1] = SPACE;
    this.glyph[i] = width === 0 ? SPACE : internGlyph(g);
    this.fg[i] = style.fg;
    this.bg[i] = style.bg;
    this.attrs[i] = style.attrs;
    if (width === 2)
      if (x + 1 < this.w) {
        this.glyph[i + 1] = CONT;
        this.fg[i + 1] = style.fg;
        this.bg[i + 1] = style.bg;
        this.attrs[i + 1] = style.attrs;
      } else this.glyph[i] = SPACE;
     else if (x + 1 < this.w && this.glyph[i + 1] === CONT) this.glyph[i + 1] = SPACE;
  }

  /**
   * Fill a rectangle with spaces in `style`, clipped to the grid.
   */
  fill(x: number, y: number, w: number, h: number, style: Style) {
    const x0 = x < 0 ? 0 : x;
    const y0 = y < 0 ? 0 : y;
    const x1 = x + w > this.w ? this.w : x + w;
    const y1 = y + h > this.h ? this.h : y + h;
    for (let yy = y0; yy < y1; yy++) {
      const row = yy * this.w;
      for (let xx = x0; xx < x1; xx++) {
        const i = row + xx;
        this.glyph[i] = SPACE;
        this.fg[i] = style.fg;
        this.bg[i] = style.bg;
        this.attrs[i] = style.attrs;
      }
    }
  }

  /**
   * Set an attribute bit on every cell of a rectangle, clipped to the grid.
   */
  addAttr(x: number, y: number, w: number, h: number, bit: number) {
    const x0 = x < 0 ? 0 : x;
    const y0 = y < 0 ? 0 : y;
    const x1 = x + w > this.w ? this.w : x + w;
    const y1 = y + h > this.h ? this.h : y + h;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.attrs[yy * this.w + xx] |= bit;
  }

  styleAt(i: number) {
    return new Style(this.fg[i], this.bg[i], this.attrs[i]);
  }

  rowText(y: number, from = 0, to = this.w) {
    let s = "";
    const row = y * this.w;
    for (let x = Math.max(0, from); x < Math.min(to, this.w); x++) s += glyphString(this.glyph[row + x]);
    return s;
  }

  text() {
    const rows: string[] = [];
    for (let y = 0; y < this.h; y++) {
      let row = this.rowText(y);
      let end = row.length;
      while (end > 0 && row[end - 1] === " ") end--;
      row = row.slice(0, end);
      rows.push(row);
    }
    while (rows.length > 0 && rows[rows.length - 1].length === 0) rows.pop();
    return rows.join("\n");
  }

  copyFrom(o: Screen) {
    this.glyph.set(o.glyph);
    this.fg.set(o.fg);
    this.bg.set(o.bg);
    this.attrs.set(o.attrs);
  }
}

/**
 * The escape stream that updates a terminal showing `front` to show
 * `back`, wrapped in synchronized-output markers; empty when nothing
 * changed. `front` is updated to match.
 */
export const diffScreens = (front: Screen, back: Screen) => {
  let out = "";
  let curX = -1;
  let curY = -1;
  let style: Style | null = null;
  const w = back.w;
  for (let y = 0; y < back.h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      const g = back.glyph[i];
      if (g === front.glyph[i] && back.fg[i] === front.fg[i] && back.bg[i] === front.bg[i] && back.attrs[i] === front.attrs[i]) continue;
      front.glyph[i] = g;
      front.fg[i] = back.fg[i];
      front.bg[i] = back.bg[i];
      front.attrs[i] = back.attrs[i];
      if (g === CONT) continue;
      if (curX !== x || curY !== y) {
        out += cup(x, y);
        curX = x;
        curY = y;
      }
      const next = new Style(back.fg[i], back.bg[i], back.attrs[i]);
      out += sgrTransition(style, next);
      style = next;
      out += glyphString(g);
      const wide = x + 1 < w && back.glyph[i + 1] === CONT;
      curX += wide ? 2 : 1;
      if (wide) {
        front.glyph[i + 1] = CONT;
        front.fg[i + 1] = back.fg[i + 1];
        front.bg[i + 1] = back.bg[i + 1];
        front.attrs[i + 1] = back.attrs[i + 1];
        x++;
      }
    }
  }
  if (out.length === 0) return "";
  return SYNC_START + out + CSI + "0m" + SYNC_END;
};
