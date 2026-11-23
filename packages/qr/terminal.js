/**
 * A QR matrix as terminal text: two module rows per line in half-block
 * glyphs, dark on the terminal's foreground, with a quiet zone. Pure.
 */

/** @import { QrMatrix, TerminalOptions } from "./types.ts" */

const GLYPHS = [" ", "▀", "▄", "█"];

/**
 * @param {QrMatrix} matrix
 * @param {TerminalOptions} [options]
 */
export const toTerminal = (matrix, options = {}) => {
  const { margin = 2 } = options;
  const { size, modules } = matrix;
  const span = size + margin * 2;
  const dark = (/** @type {number} */ x, /** @type {number} */ y) => {
    const mx = x - margin;
    const my = y - margin;
    return mx >= 0 && my >= 0 && mx < size && my < size ? modules[my * size + mx] : 0;
  };
  const lines = [];
  for (let y = 0; y < span; y += 2) {
    let line = "";
    for (let x = 0; x < span; x++) line += GLYPHS[dark(x, y) | (dark(x, y + 1) << 1)];
    lines.push(line);
  }
  return lines.join("\n");
};
