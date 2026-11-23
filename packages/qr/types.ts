/**
 * @lightstart/qr: public type declarations.
 */

export type QrLevel = "L" | "M" | "Q" | "H";

export interface QrOptions {
  /** Error correction level; `M` by default. */
  level?: QrLevel;
  /** Force a mask pattern (0 to 7) instead of scoring all eight. */
  mask?: number;
}

/** A finished symbol: `modules[y * size + x]` is 1 for a dark module. */
export interface QrMatrix {
  version: number;
  size: number;
  level: QrLevel;
  mask: number;
  modules: Uint8Array;
}

export interface SvgOptions {
  /** Quiet zone in modules on every side; 1 by default (the spec asks for 4 on print). */
  margin?: number;
  /** Rendered width and height in CSS pixels; omitted, the SVG scales with its box. */
  size?: number;
  /** Fill of the dark modules; `currentColor` by default. */
  color?: string;
}

export interface TerminalOptions {
  /** Quiet zone in modules; 2 by default. */
  margin?: number;
}

/** A frame to read: RGBA as `getImageData` gives it, or one luminance byte a pixel. */
export interface QrImage {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

/** A finder pattern's centre in the image, with the size of one module there. */
export interface QrPoint {
  x: number;
  y: number;
  module: number;
}

/** A plane projective map as nine coefficients, column by column. */
export type QrHomography = [number, number, number, number, number, number, number, number, number];
