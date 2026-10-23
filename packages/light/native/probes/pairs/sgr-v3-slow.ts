const ATTR_BOLD = 1;
const ATTR_DIM = 2;
const ATTR_ITALIC = 4;
const ATTR_UNDERLINE = 8;
const ATTR_INVERSE = 16;
const ATTR_STRIKE = 32;
const CSI = "\u001b[";

class Style {
  fg: number;
  bg: number;
  attrs: number;
  constructor(fg: number, bg: number, attrs: number) {
    this.fg = fg;
    this.bg = bg;
    this.attrs = attrs;
  }
  has(bit: number) {
    return (this.attrs & bit) !== 0;
  }
  equals(o: Style) {
    return this.fg === o.fg && this.bg === o.bg && this.attrs === o.attrs;
  }
}

const colorSgr = (c: number, fg: boolean) => {
  if (c === -1) return fg ? "39" : "49";
  if (c < 8) return String((fg ? 30 : 40) + c);
  if (c < 16) return String((fg ? 90 : 100) + (c - 8));
  return (fg ? "38;5;" : "48;5;") + String(c);
};

const sgrTransition = (prev: Style | null, next: Style) => {
  if (prev !== null && prev.equals(next)) return "";
  const params: string[] = [];
  let full = prev === null;
  if (prev !== null && (prev.attrs & ~next.attrs) !== 0) full = true;
  if (full) {
    params.push("0");
    if (next.has(ATTR_BOLD)) params.push("1");
    if (next.has(ATTR_DIM)) params.push("2");
    if (next.has(ATTR_ITALIC)) params.push("3");
    if (next.has(ATTR_UNDERLINE)) params.push("4");
    if (next.has(ATTR_INVERSE)) params.push("7");
    if (next.has(ATTR_STRIKE)) params.push("9");
    if (next.fg !== -1) params.push(colorSgr(next.fg, true));
    if (next.bg !== -1) params.push(colorSgr(next.bg, false));
  } else {
    const p = prev as Style;
    const added = next.attrs & ~p.attrs;
    if ((added & ATTR_BOLD) !== 0) params.push("1");
    if ((added & ATTR_DIM) !== 0) params.push("2");
    if ((added & ATTR_ITALIC) !== 0) params.push("3");
    if ((added & ATTR_UNDERLINE) !== 0) params.push("4");
    if ((added & ATTR_INVERSE) !== 0) params.push("7");
    if ((added & ATTR_STRIKE) !== 0) params.push("9");
    if (next.fg !== p.fg) params.push(colorSgr(next.fg, true));
    if (next.bg !== p.bg) params.push(colorSgr(next.bg, false));
  }
  return params.length === 0 ? "" : CSI + params.join(";") + "m";
};
const W = 120;
const H = 40;
const N = W * H;
const glyph = { front: new Int32Array(N), back: new Int32Array(N) };
const fgs = { front: new Int32Array(N), back: new Int32Array(N) };
const bgs = { front: new Int32Array(N), back: new Int32Array(N) };
const ats = { front: new Int32Array(N), back: new Int32Array(N) };
const palette: Array<[number, number, number]> = [[1, -1, 0], [2, 4, 1], [-1, 3, 8]];

const diff = () => {
  let out = "";
  let style: Style | null = null;
  for (let i = 0; i < N; i++) {
    if (glyph.back[i] === glyph.front[i] && fgs.back[i] === fgs.front[i] && bgs.back[i] === bgs.front[i] && ats.back[i] === ats.front[i]) continue;
    glyph.front[i] = glyph.back[i];
    fgs.front[i] = fgs.back[i];
    bgs.front[i] = bgs.back[i];
    ats.front[i] = ats.back[i];
    const next = new Style(fgs.back[i], bgs.back[i], ats.back[i]);
    out += sgrTransition(style, next);
    style = next;
    out += String.fromCharCode(glyph.back[i]);
  }
  return out;
};

const start = performance.now();
let bytes = 0;
for (let frame = 0; frame < 200; frame++) {
  for (let y = 0; y < H; y++) {
    const [f, b, a] = palette[(y + frame) % palette.length];
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      glyph.back[i] = 97 + ((x + frame) % 26);
      fgs.back[i] = f;
      bgs.back[i] = b;
      ats.back[i] = a;
    }
  }
  bytes += diff().length;
}
console.log(bytes);
console.error(`${(performance.now() - start).toFixed(1)}`);

export {};
