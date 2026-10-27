/**
 * SVG for a QR matrix: one path of horizontal runs, a quiet zone in
 * the viewBox, crisp edges. Pure: a string in, a string out.
 */

/** @import { QrMatrix, SvgOptions } from "./types.js" */

/**
 * @param {QrMatrix} matrix
 * @param {SvgOptions} [options]
 */
export const toPath = (matrix, { margin = 1 } = {}) => {
  const { size, modules } = matrix;
  const parts = [];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      if (!modules[y * size + x]) continue;
      let run = 1;
      while (x + run < size && modules[y * size + x + run]) run++;
      parts.push(`M${x + margin} ${y + margin}h${run}v1h-${run}z`);
      x += run - 1;
    }
  return parts.join("");
};

/**
 * @param {QrMatrix} matrix
 * @param {SvgOptions} [options]
 */
export const toSvg = (matrix, { margin = 1, size, color = "currentColor" } = {}) => {
  const span = matrix.size + margin * 2;
  const dims = size ? ` width="${size}" height="${size}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${span} ${span}"${dims} shape-rendering="crispEdges"><path fill="${color}" d="${toPath(matrix, { margin })}"/></svg>`;
};

/**
 * @param {QrMatrix} matrix
 * @param {SvgOptions} [options]
 */
export const toDataUrl = (matrix, options = {}) =>
  `data:image/svg+xml;utf8,${toSvg(matrix, { color: "#000", ...options }).replace(/#/g, "%23").replace(/"/g, "'").replace(/</g, "%3C").replace(/>/g, "%3E")}`;
