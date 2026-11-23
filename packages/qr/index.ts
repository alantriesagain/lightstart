/**
 * @file @lightstart/qr: a byte-mode QR encoder, SVG and terminal renderers,
 * and a reader that finds and decodes a QR code in a camera frame.
 */

export { encode } from "./encode.js";
export { decodeQr, perspective, readMatrix } from "./decode.js";
export { toDataUrl, toPath, toSvg } from "./svg.js";
export { toTerminal } from "./terminal.js";

export type {
  QrHomography,
  QrImage,
  QrLevel,
  QrMatrix,
  QrOptions,
  QrPoint,
  SvgOptions,
  TerminalOptions,
} from "./types.ts";
