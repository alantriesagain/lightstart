/**
 * A QR reader, the encoder run backwards. `decodeQr(image)` finds a symbol in
 * a camera frame (the three finder patterns, the alignment pattern nearest
 * the fourth corner, a perspective grid through them) and reads its text;
 * `readMatrix(modules, size)` reads a grid already sampled. Format and
 * version information are matched to the nearest valid code, every block is
 * corrected by Reed-Solomon (Berlekamp-Massey, Chien, Forney), and a mirrored
 * symbol reads as well. Numeric, alphanumeric and byte segments; byte text
 * is UTF-8. Pure: no `$APP`, no DOM.
 */

import { EXP, LOG, dataOrder, formatInfo, functionModules, layout, maskBit, mul, versionInfo } from "./encode.js";

/** @import { QrHomography, QrImage, QrLevel, QrPoint } from "./types.ts" */

/** @type {QrLevel[]} */
const LEVEL_NAMES = ["L", "M", "Q", "H"];
const FORMATS = LEVEL_NAMES.flatMap((level) => [0, 1, 2, 3, 4, 5, 6, 7].map((mask) => ({ level, mask, bits: formatInfo(level, mask) })));
const VERSIONS = Array.from({ length: 34 }, (_, i) => ({ version: i + 7, bits: versionInfo(i + 7) }));
const ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

/** @param {number} a @param {number} b */
const distance = (a, b) => {
  let x = a ^ b;
  let n = 0;
  for (; x; x &= x - 1) n++;
  return n;
};

/** @param {number} a @param {number} b */
const div = (a, b) => (a ? EXP[(LOG[a] + 255 - LOG[b]) % 255] : 0);

/** @param {number[]} poly coefficients, lowest degree first @param {number} x */
const evaluate = (poly, x) => {
  let y = 0;
  for (let i = poly.length - 1; i >= 0; i--) y = mul(y, x) ^ poly[i];
  return y;
};

/** @param {number[]} block @param {number} count */
const syndromesOf = (block, count) => {
  const out = new Array(count).fill(0);
  for (let j = 0; j < count; j++) {
    let s = 0;
    for (const byte of block) s = mul(s, EXP[j]) ^ byte;
    out[j] = s;
  }
  return out;
};

/**
 * One block with its error-correction codewords, corrected in place.
 *
 * @param {number[]} block
 * @param {number} ecCount
 * @returns {boolean} false when it holds more errors than it can correct
 */
export const correctBlock = (block, ecCount) => {
  const syndromes = syndromesOf(block, ecCount);
  if (syndromes.every((s) => s === 0)) return true;
  let locator = [1];
  let previous = [1];
  let errors = 0;
  let shift = 1;
  let last = 1;
  for (let r = 0; r < ecCount; r++) {
    let delta = syndromes[r];
    for (let i = 1; i <= errors; i++) delta ^= mul(locator[i] ?? 0, syndromes[r - i]);
    if (delta === 0) {
      shift++;
      continue;
    }
    const factor = div(delta, last);
    const next = new Array(Math.max(locator.length, previous.length + shift)).fill(0);
    locator.forEach((c, i) => { next[i] = c; });
    previous.forEach((c, i) => { next[i + shift] ^= mul(factor, c); });
    if (2 * errors <= r) {
      previous = locator;
      errors = r + 1 - errors;
      last = delta;
      shift = 1;
    } else shift++;
    locator = next;
  }
  if (errors * 2 > ecCount) return false;
  const n = block.length;
  const omega = new Array(ecCount).fill(0);
  for (let i = 0; i < locator.length; i++)
    for (let j = 0; j + i < ecCount; j++) omega[i + j] ^= mul(locator[i], syndromes[j]);
  const derivative = locator.slice(1).map((c, i) => (i % 2 === 0 ? c : 0));
  let found = 0;
  for (let k = 0; k < n; k++) {
    const power = n - 1 - k;
    const inverse = EXP[(255 - (power % 255)) % 255];
    if (evaluate(locator, inverse) !== 0) continue;
    const slope = evaluate(derivative, inverse);
    if (!slope) return false;
    block[k] ^= mul(EXP[power % 255], div(evaluate(omega, inverse), slope));
    found++;
  }
  return found === errors && syndromesOf(block, ecCount).every((s) => s === 0);
};

/** @param {number[]} bytes @param {number} version */
const parse = (bytes, version) => {
  let pos = 0;
  const left = () => bytes.length * 8 - pos;
  const read = (/** @type {number} */ width) => {
    let value = 0;
    for (let i = 0; i < width; i++, pos++) value = (value << 1) | ((bytes[pos >> 3] >> (7 - (pos & 7))) & 1);
    return value;
  };
  const tier = version < 10 ? 0 : version < 27 ? 1 : 2;
  /** @type {number[]} */
  const out = [];
  while (left() >= 4) {
    const mode = read(4);
    if (mode === 0) break;
    if (mode === 7) {
      if (left() < 8) return null;
      const first = read(8);
      if (first & 0x80) read(first & 0x40 ? 16 : 8);
      continue;
    }
    const width = mode === 4 ? [8, 16, 16][tier] : mode === 1 ? [10, 12, 14][tier] : mode === 2 ? [9, 11, 13][tier] : 0;
    if (!width || left() < width) return null;
    let count = read(width);
    if (mode === 4) {
      if (left() < count * 8) return null;
      for (; count > 0; count--) out.push(read(8));
    } else if (mode === 1)
      for (; count > 0; count -= 3) {
        const digits = Math.min(count, 3);
        const bits = [0, 4, 7, 10][digits];
        if (left() < bits) return null;
        for (const ch of String(read(bits)).padStart(digits, "0")) out.push(ch.charCodeAt(0));
      }
    else
      for (; count > 0; count -= 2)
        if (count === 1) {
          if (left() < 6) return null;
          out.push(ALPHANUMERIC.charCodeAt(read(6)));
        } else {
          if (left() < 11) return null;
          const pair = read(11);
          out.push(ALPHANUMERIC.charCodeAt(Math.floor(pair / 45)), ALPHANUMERIC.charCodeAt(pair % 45));
        }

  }
  return new TextDecoder().decode(new Uint8Array(out));
};

/**
 * The text of a sampled symbol, or null when it does not read.
 *
 * @param {ArrayLike<number>} modules `modules[y * size + x]` is 1 for a dark module
 * @param {number} size 21 to 177
 * @returns {string | null}
 */
export const readMatrix = (modules, size) => {
  const version = (size - 17) / 4;
  if (!Number.isInteger(version) || version < 1 || version > 40) return null;
  const at = (/** @type {number} */ x, /** @type {number} */ y) => modules[y * size + x] & 1;
  let near = 0;
  let far = 0;
  for (let i = 0; i < 6; i++) near |= at(8, i) << i;
  near |= (at(8, 7) << 6) | (at(8, 8) << 7) | (at(7, 8) << 8);
  for (let i = 9; i < 15; i++) near |= at(14 - i, 8) << i;
  for (let i = 0; i < 8; i++) far |= at(size - 1 - i, 8) << i;
  for (let i = 8; i < 15; i++) far |= at(8, size - 15 + i) << i;
  const format = FORMATS.reduce((best, f) => {
    const d = Math.min(distance(f.bits, near), distance(f.bits, far));
    return d < best.d ? { f, d } : best;
  }, { f: FORMATS[0], d: 99 });
  if (format.d > 3) return null;
  if (version >= 7) {
    let right = 0;
    let below = 0;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      right |= at(a, b) << i;
      below |= at(b, a) << i;
    }
    const read = VERSIONS.reduce((best, v) => {
      const d = Math.min(distance(v.bits, right), distance(v.bits, below));
      return d < best.d ? { v, d } : best;
    }, { v: VERSIONS[0], d: 99 });
    if (read.d <= 3 && read.v.version !== version) return null;
  }
  const { level, mask } = format.f;
  const { blocks, ecPerBlock, dataTotal, shortLen, longBlocks } = layout(version, level);
  const total = dataTotal + ecPerBlock * blocks;
  const order = dataOrder(size, functionModules(version).reserved);
  const codewords = new Array(total).fill(0);
  for (let i = 0; i < total * 8; i++) {
    const index = order[i];
    const x = index % size;
    const bit = (modules[index] & 1) ^ (maskBit(mask, x, (index - x) / size) ? 1 : 0);
    codewords[i >> 3] |= bit << (7 - (i & 7));
  }
  const lengths = Array.from({ length: blocks }, (_, b) => shortLen + (b >= blocks - longBlocks ? 1 : 0));
  const split = lengths.map((len) => new Array(len + ecPerBlock).fill(0));
  let k = 0;
  for (let i = 0; i <= shortLen; i++) for (let b = 0; b < blocks; b++) if (i < lengths[b]) split[b][i] = codewords[k++];
  for (let i = 0; i < ecPerBlock; i++) for (let b = 0; b < blocks; b++) split[b][lengths[b] + i] = codewords[k++];
  /** @type {number[]} */
  const data = [];
  for (let b = 0; b < blocks; b++) {
    if (!correctBlock(split[b], ecPerBlock)) return null;
    data.push(...split[b].slice(0, lengths[b]));
  }
  return parse(data, version);
};

/** @param {QrImage} image */
const luminance = ({ data, width, height }) => {
  const count = width * height;
  if (data.length === count) return Uint8Array.from(data);
  const gray = new Uint8Array(count);
  for (let i = 0, j = 0; i < count; i++, j += 4) gray[i] = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8;
  return gray;
};

/** @param {Uint8Array} gray @param {number} width @param {number} height */
const adaptive = (gray, width, height) => {
  const stride = width + 1;
  const sums = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += gray[y * width + x];
      sums[(y + 1) * stride + x + 1] = sums[y * stride + x + 1] + row;
    }
  }
  const radius = Math.max(8, Math.round(Math.min(width, height) / 12));
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const top = Math.max(0, y - radius);
    const bottom = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x++) {
      const left = Math.max(0, x - radius);
      const right = Math.min(width, x + radius + 1);
      const sum = sums[bottom * stride + right] - sums[top * stride + right] - sums[bottom * stride + left] + sums[top * stride + left];
      const mean = sum / ((bottom - top) * (right - left));
      out[y * width + x] = gray[y * width + x] < mean * 0.9 ? 1 : 0;
    }
  }
  return out;
};

/** @param {Uint8Array} gray */
const otsu = (gray) => {
  const histogram = new Array(256).fill(0);
  for (const v of gray) histogram[v]++;
  let total = 0;
  for (let i = 0; i < 256; i++) total += i * histogram[i];
  let below = 0;
  let belowSum = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    below += histogram[t];
    if (!below || below === gray.length) continue;
    belowSum += t * histogram[t];
    const meanBelow = belowSum / below;
    const meanAbove = (total - belowSum) / (gray.length - below);
    const spread = below * (gray.length - below) * (meanBelow - meanAbove) ** 2;
    if (spread > best) {
      best = spread;
      threshold = t;
    }
  }
  return gray.map((v) => (v <= threshold ? 1 : 0));
};

/** @param {number[]} runs five run lengths, dark first */
const finderRatio = (runs) => {
  const total = runs.reduce((a, b) => a + b, 0);
  if (total < 7) return false;
  const unit = total / 7;
  const slack = unit / 2;
  return Math.abs(unit - runs[0]) < slack && Math.abs(unit - runs[1]) < slack && Math.abs(3 * unit - runs[2]) < 3 * slack && Math.abs(unit - runs[3]) < slack && Math.abs(unit - runs[4]) < slack;
};

/**
 * The five runs through a point along one axis, and the centre of the middle
 * one, or null when they are not a finder's 1:1:3:1:1.
 *
 * @param {(i: number) => number} read 1 for dark, 0 for light, 0 off the image
 * @param {number} at
 * @param {number} limit
 */
const crossRuns = (read, at, limit) => {
  if (!read(at)) return null;
  const runs = [0, 0, 0, 0, 0];
  let i = at;
  for (; i >= 0 && read(i); i--) runs[2]++;
  for (; i >= 0 && !read(i); i--) runs[1]++;
  for (; i >= 0 && read(i); i--) runs[0]++;
  const start = at - runs[2] + 1;
  i = at + 1;
  for (; i < limit && read(i); i++) runs[2]++;
  const end = i;
  for (; i < limit && !read(i); i++) runs[3]++;
  for (; i < limit && read(i); i++) runs[4]++;
  if (!runs[0] || !runs[1] || !runs[3] || !runs[4] || !finderRatio(runs)) return null;
  return { center: (start + end) / 2, total: runs.reduce((a, b) => a + b, 0) };
};

/** @param {Uint8Array} bin @param {number} width @param {number} height */
const findFinders = (bin, width, height) => {
  /** @type {Array<{ x: number, y: number, module: number, count: number }>} */
  const found = [];
  for (let y = 0; y < height; y++) {
    const row = y * width;
    /** @type {number[]} */
    const runs = [];
    /** @type {number[]} */
    const starts = [];
    for (let x = 0; x < width; x++) {
      if (x === 0 || bin[row + x] !== bin[row + x - 1]) {
        runs.push(0);
        starts.push(x);
      }
      runs[runs.length - 1]++;
    }
    for (let i = bin[row] ? 0 : 1; i + 4 < runs.length; i += 2) {
      const five = runs.slice(i, i + 5);
      if (!finderRatio(five)) continue;
      const cx = Math.floor(starts[i + 2] + runs[i + 2] / 2);
      const vertical = crossRuns((v) => (v >= 0 && v < height ? bin[v * width + cx] : 0), y, height);
      if (!vertical) continue;
      const total = five.reduce((a, b) => a + b, 0);
      if (5 * Math.abs(vertical.total - total) >= 2 * total) continue;
      const cy = Math.floor(vertical.center);
      const horizontal = crossRuns((h) => (h >= 0 && h < width ? bin[cy * width + h] : 0), cx, width);
      if (!horizontal) continue;
      const module = (horizontal.total + vertical.total) / 14;
      const x = horizontal.center;
      const near = found.find((f) => Math.abs(f.x - x) <= f.module * 2 && Math.abs(f.y - vertical.center) <= f.module * 2 && Math.abs(f.module - module) <= Math.max(1, f.module / 2));
      if (near) {
        const n = near.count + 1;
        near.x = (near.x * near.count + x) / n;
        near.y = (near.y * near.count + vertical.center) / n;
        near.module = (near.module * near.count + module) / n;
        near.count = n;
      } else found.push({ x, y: vertical.center, module, count: 1 });
    }
  }
  return found.filter((f) => f.count >= 2).sort((a, b) => b.count - a.count).slice(0, 8);
};

/** @param {QrPoint} a @param {QrPoint} b */
const span = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** @param {QrPoint[]} finders */
const triples = (finders) => {
  /** @type {Array<{ score: number, tl: QrPoint, tr: QrPoint, bl: QrPoint }>} */
  const out = [];
  for (let i = 0; i < finders.length; i++)
    for (let j = i + 1; j < finders.length; j++)
      for (let k = j + 1; k < finders.length; k++) {
        const three = [finders[i], finders[j], finders[k]];
        const modules = three.map((p) => p.module);
        if (Math.max(...modules) > 2.5 * Math.min(...modules)) continue;
        const sides = [span(three[1], three[2]), span(three[0], three[2]), span(three[0], three[1])];
        const corner = sides.indexOf(Math.max(...sides));
        const tl = three[corner];
        const [a, b] = three.filter((_, n) => n !== corner);
        const legA = span(tl, a);
        const legB = span(tl, b);
        const square = Math.abs(legA ** 2 + legB ** 2 - sides[corner] ** 2) / sides[corner] ** 2;
        const lopsided = Math.abs(legA - legB) / Math.max(legA, legB);
        if (square > 0.4 || lopsided > 0.4) continue;
        const clockwise = (a.x - tl.x) * (b.y - tl.y) - (a.y - tl.y) * (b.x - tl.x) > 0;
        out.push({ score: square + lopsided, tl, tr: clockwise ? a : b, bl: clockwise ? b : a });
      }
  return out.sort((p, q) => p.score - q.score).slice(0, 4);
};

/** @param {number[]} q x0, y0 ... x3, y3 @returns {QrHomography} */
const squareToQuad = ([x0, y0, x1, y1, x2, y2, x3, y3]) => {
  const dx3 = x0 - x1 + x2 - x3;
  const dy3 = y0 - y1 + y2 - y3;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) return [x1 - x0, x2 - x1, x0, y1 - y0, y2 - y1, y0, 0, 0, 1];
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const den = dx1 * dy2 - dx2 * dy1;
  const a13 = (dx3 * dy2 - dx2 * dy3) / den;
  const a23 = (dx1 * dy3 - dx3 * dy1) / den;
  return [x1 - x0 + a13 * x1, x3 - x0 + a23 * x3, x0, y1 - y0 + a13 * y1, y3 - y0 + a23 * y3, y0, a13, a23, 1];
};

/** @param {QrHomography} m @returns {QrHomography} */
const adjoint = ([a11, a21, a31, a12, a22, a32, a13, a23, a33]) => [
  a22 * a33 - a23 * a32, a23 * a31 - a21 * a33, a21 * a32 - a22 * a31,
  a13 * a32 - a12 * a33, a11 * a33 - a13 * a31, a12 * a31 - a11 * a32,
  a12 * a23 - a13 * a22, a13 * a21 - a11 * a23, a11 * a22 - a12 * a21,
];

/** @param {QrHomography} a @param {QrHomography} b @returns {QrHomography} */
const times = ([a11, a21, a31, a12, a22, a32, a13, a23, a33], [b11, b21, b31, b12, b22, b32, b13, b23, b33]) => [
  a11 * b11 + a21 * b12 + a31 * b13, a11 * b21 + a21 * b22 + a31 * b23, a11 * b31 + a21 * b32 + a31 * b33,
  a12 * b11 + a22 * b12 + a32 * b13, a12 * b21 + a22 * b22 + a32 * b23, a12 * b31 + a22 * b32 + a32 * b33,
  a13 * b11 + a23 * b12 + a33 * b13, a13 * b21 + a23 * b22 + a33 * b23, a13 * b31 + a23 * b32 + a33 * b33,
];

/**
 * The map taking one quadrilateral onto another, corner for corner.
 *
 * @param {number[]} from x0, y0 ... x3, y3
 * @param {number[]} to x0, y0 ... x3, y3
 * @returns {(x: number, y: number) => [number, number]}
 */
export const perspective = (from, to) => {
  const [a11, a21, a31, a12, a22, a32, a13, a23, a33] = times(squareToQuad(to), adjoint(squareToQuad(from)));
  return (x, y) => {
    const w = a13 * x + a23 * y + a33;
    return [(a11 * x + a21 * y + a31) / w, (a12 * x + a22 * y + a32) / w];
  };
};

/**
 * Where a module offset from the top-left finder's centre lands, from the
 * three finder centres alone. `near` and `wide` are how much closer the
 * top-right and bottom-left finders sit than the top-left one (the ratio of
 * their module sizes); at 1 and 1 the symbol is a parallelogram.
 *
 * @param {QrPoint} tl @param {QrPoint} tr @param {QrPoint} bl @param {number} reach modules between finder centres @param {number} near @param {number} wide
 * @returns {(u: number, v: number) => [number, number]}
 */
const model = (tl, tr, bl, reach, near, wide) => (u, v) => {
  const w = 1 + (u * (near - 1) + v * (wide - 1)) / reach;
  return [(tl.x + (u * (near * tr.x - tl.x) + v * (wide * bl.x - tl.x)) / reach) / w, (tl.y + (u * (near * tr.y - tl.y) + v * (wide * bl.y - tl.y)) / reach) / w];
};

/**
 * The centre of the alignment pattern nearest the fourth corner, searched
 * over the stretch between where a parallelogram and a perspective through
 * the finders put it, or null when nothing there has its shape.
 *
 * @param {Uint8Array} bin @param {number} width @param {number} height
 * @param {Array<(u: number, v: number) => [number, number]>} guesses @param {number} at the pattern's offset from the top-left finder, in modules
 */
const findAlignment = (bin, width, height, guesses, at) => {
  const points = guesses.map((g) => ({ c: g(at, at), x: g(at + 1, at), y: g(at, at + 1) }));
  const ex = points.reduce((s, p) => s + p.c[0], 0) / points.length;
  const ey = points.reduce((s, p) => s + p.c[1], 0) / points.length;
  const ux = { x: points.reduce((s, p) => s + p.x[0] - p.c[0], 0) / points.length, y: points.reduce((s, p) => s + p.x[1] - p.c[1], 0) / points.length };
  const uy = { x: points.reduce((s, p) => s + p.y[0] - p.c[0], 0) / points.length, y: points.reduce((s, p) => s + p.y[1] - p.c[1], 0) / points.length };
  const unit = Math.max(1, Math.hypot(ux.x, ux.y));
  const radius = Math.ceil(Math.max(...points.map((p) => Math.hypot(p.c[0] - ex, p.c[1] - ey))) + unit * 5);
  const dark = (/** @type {number} */ x, /** @type {number} */ y) => {
    const px = Math.round(x);
    const py = Math.round(y);
    return px >= 0 && py >= 0 && px < width && py < height ? bin[py * width + px] : 0;
  };
  let best = 0;
  /** @type {Array<[number, number]>} */
  let found = [];
  for (let y = Math.round(ey - radius); y <= ey + radius; y++)
    for (let x = Math.round(ex - radius); x <= ex + radius; x++) {
      let score = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const ring = Math.max(Math.abs(dx), Math.abs(dy)) === 1 ? 0 : 1;
          if (dark(x + ux.x * dx + uy.x * dy, y + ux.y * dx + uy.y * dy) === ring) score++;
        }
      if (score > best) {
        best = score;
        found = [[x, y]];
      } else if (score === best) found.push([x, y]);
    }
  if (best < 23) return null;
  const [cx, cy] = found.reduce((a, b) => (Math.hypot(b[0] - ex, b[1] - ey) < Math.hypot(a[0] - ex, a[1] - ey) ? b : a));
  const same = found.filter(([x, y]) => Math.hypot(x - cx, y - cy) <= unit);
  return { x: same.reduce((s, p) => s + p[0], 0) / same.length, y: same.reduce((s, p) => s + p[1], 0) / same.length };
};

/** @param {Uint8Array} bin @param {number} width @param {number} height @param {(x: number, y: number) => [number, number]} map @param {number} dimension */
const sample = (bin, width, height, map, dimension) => {
  const modules = new Uint8Array(dimension * dimension);
  for (let v = 0; v < dimension; v++)
    for (let u = 0; u < dimension; u++) {
      const [x, y] = map(u + 0.5, v + 0.5);
      const px = Math.floor(x);
      const py = Math.floor(y);
      modules[v * dimension + u] = px >= 0 && py >= 0 && px < width && py < height ? bin[py * width + px] : 0;
    }
  return modules;
};

/** @param {Uint8Array} modules @param {number} size */
const transpose = (modules, size) => {
  const out = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) out[x * size + y] = modules[y * size + x];
  return out;
};

/** @param {Uint8Array} bin @param {number} width @param {number} height */
const scan = (bin, width, height) => {
  for (const { tl, tr, bl } of triples(findFinders(bin, width, height))) {
    const square = (/** @type {QrPoint} */ to) => {
      const angle = Math.atan2(to.y - tl.y, to.x - tl.x);
      return Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)));
    };
    const module = ((tl.module + tr.module + bl.module) / 3) * ((square(tr) + square(bl)) / 2);
    const estimate = Math.round((span(tl, tr) + span(tl, bl)) / 2 / module) + 7;
    const snapped = estimate + [1, 0, -1, 2][estimate & 3];
    for (const dimension of [snapped, snapped - 4, snapped + 4]) {
      if (dimension < 21 || dimension > 177) continue;
      const reach = dimension - 7;
      const flat = model(tl, tr, bl, reach, 1, 1);
      const deep = model(tl, tr, bl, reach, tl.module / tr.module, tl.module / bl.module);
      const near = dimension - 3.5;
      const from = [3.5, 3.5, near, 3.5, near, near, 3.5, near];
      const corners = [];
      const alignment = dimension > 21 ? findAlignment(bin, width, height, [flat, deep], dimension - 10) : null;
      if (alignment) corners.push({ from: [3.5, 3.5, near, 3.5, dimension - 6.5, dimension - 6.5, 3.5, near], to: [tl.x, tl.y, tr.x, tr.y, alignment.x, alignment.y, bl.x, bl.y] });
      for (const guess of [flat, deep]) corners.push({ from, to: [tl.x, tl.y, tr.x, tr.y, ...guess(reach, reach), bl.x, bl.y] });
      for (const { from, to } of corners) {
        const modules = sample(bin, width, height, perspective(from, to), dimension);
        const text = readMatrix(modules, dimension) ?? readMatrix(transpose(modules, dimension), dimension);
        if (text !== null) return text;
      }
    }
  }
  return null;
};

/**
 * The text of the QR code in an image, or null when none reads.
 *
 * @param {QrImage} image RGBA, as `getImageData` gives it, or one luminance byte a pixel
 * @returns {string | null}
 */
export const decodeQr = (image) => {
  const gray = luminance(image);
  return scan(adaptive(gray, image.width, image.height), image.width, image.height) ?? scan(otsu(gray), image.width, image.height);
};
