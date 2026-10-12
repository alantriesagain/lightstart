/**
 * @bootstrapp/light/tdom/style: an immutable text style. Colors are
 * numbers (-1 default, 0..255 indexed, 0x1000000 | rgb truecolor) and the
 * attributes are bits, so a style compares and copies cheaply.
 */

export const ATTR_BOLD = 1;
export const ATTR_DIM = 2;
export const ATTR_ITALIC = 4;
export const ATTR_UNDERLINE = 8;
export const ATTR_INVERSE = 16;
export const ATTR_STRIKE = 32;

export const COLOR_DEFAULT = -1;
export const TRUECOLOR_FLAG = 0x1000000;

export class Style {
  /**
   * @param {number} fg
   * @param {number} bg
   * @param {number} attrs
   */
  constructor(fg, bg, attrs) {
    this.fg = fg;
    this.bg = bg;
    this.attrs = attrs;
  }

  /** @param {number} fg */
  withFg(fg) {
    return fg === this.fg ? this : new Style(fg, this.bg, this.attrs);
  }

  /** @param {number} bg */
  withBg(bg) {
    return bg === this.bg ? this : new Style(this.fg, bg, this.attrs);
  }

  /**
   * @param {number} bit
   * @param {boolean} on
   */
  withAttr(bit, on) {
    const attrs = on ? this.attrs | bit : this.attrs & ~bit;
    return attrs === this.attrs ? this : new Style(this.fg, this.bg, attrs);
  }

  /** @param {number} bit */
  has(bit) {
    return (this.attrs & bit) !== 0;
  }

  /** @param {Style} o */
  equals(o) {
    return this.fg === o.fg && this.bg === o.bg && this.attrs === o.attrs;
  }

  /**
   * The style a child shows under `parent`: unset colors fall through, attributes join.
   * @param {Style} parent
   */
  inherit(parent) {
    const fg = this.fg === COLOR_DEFAULT ? parent.fg : this.fg;
    const bg = this.bg === COLOR_DEFAULT ? parent.bg : this.bg;
    const attrs = this.attrs | parent.attrs;
    if (fg === this.fg && bg === this.bg && attrs === this.attrs) return this;
    return new Style(fg, bg, attrs);
  }

  describe() {
    /** @type {string[]} */
    const parts = [];
    if (this.fg !== COLOR_DEFAULT) parts.push("fg=" + colorName(this.fg));
    if (this.bg !== COLOR_DEFAULT) parts.push("bg=" + colorName(this.bg));
    if (this.has(ATTR_BOLD)) parts.push("bold");
    if (this.has(ATTR_DIM)) parts.push("dim");
    if (this.has(ATTR_ITALIC)) parts.push("italic");
    if (this.has(ATTR_UNDERLINE)) parts.push("underline");
    if (this.has(ATTR_INVERSE)) parts.push("inverse");
    if (this.has(ATTR_STRIKE)) parts.push("strike");
    return parts.join(",");
  }
}

export const DEFAULT_STYLE = new Style(COLOR_DEFAULT, COLOR_DEFAULT, 0);

const NAMES = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];

/**
 * A readable name for a color number, for dumps and tests.
 * @param {number} c
 */
export const colorName = (c) => {
  if (c === COLOR_DEFAULT) return "default";
  if ((c & TRUECOLOR_FLAG) !== 0) {
    const rgb = c & 0xffffff;
    return "#" + rgb.toString(16).padStart(6, "0");
  }
  if (c < 8) return NAMES[c];
  if (c < 16) return "bright" + NAMES[c - 8];
  return String(c);
};
