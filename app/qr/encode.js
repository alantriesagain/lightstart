/**
 * A byte-mode QR encoder: versions 1 to 40, four error-correction
 * levels, Reed-Solomon over GF(256), all eight masks scored by the four
 * penalty rules. Pure: no `$APP`, no DOM, runs under node and in the
 * browser. The three tables are the standard's (total codewords per
 * version, error-correction codewords and block counts per version and
 * level); everything else is computed.
 */

/** @import { QrLevel, QrMatrix, QrOptions } from "./types.js" */

const TOTAL = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655, 733, 815, 901, 991, 1085, 1156, 1258, 1364, 1474, 1588, 1706, 1828, 1921, 2051, 2185, 2323, 2465, 2611, 2761, 2876, 3034, 3196, 3362, 3532, 3706];
const EC = [7, 10, 13, 17, 10, 16, 22, 28, 15, 26, 36, 44, 20, 36, 52, 64, 26, 48, 72, 88, 36, 64, 96, 112, 40, 72, 108, 130, 48, 88, 132, 156, 60, 110, 160, 192, 72, 130, 192, 224, 80, 150, 224, 264, 96, 176, 260, 308, 104, 198, 288, 352, 120, 216, 320, 384, 132, 240, 360, 432, 144, 280, 408, 480, 168, 308, 448, 532, 180, 338, 504, 588, 196, 364, 546, 650, 224, 416, 600, 700, 224, 442, 644, 750, 252, 476, 690, 816, 270, 504, 750, 900, 300, 560, 810, 960, 312, 588, 870, 1050, 336, 644, 952, 1110, 360, 700, 1020, 1200, 390, 728, 1050, 1260, 420, 784, 1140, 1350, 450, 812, 1200, 1440, 480, 868, 1290, 1530, 510, 924, 1350, 1620, 540, 980, 1440, 1710, 570, 1036, 1530, 1800, 570, 1064, 1590, 1890, 600, 1120, 1680, 1980, 630, 1204, 1770, 2100, 660, 1260, 1860, 2220, 720, 1316, 1950, 2310, 750, 1372, 2040, 2430];
const BLOCKS = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 2, 2, 4, 1, 2, 4, 4, 2, 4, 4, 4, 2, 4, 6, 5, 2, 4, 6, 6, 2, 5, 8, 8, 4, 5, 8, 8, 4, 5, 8, 11, 4, 8, 10, 11, 4, 9, 12, 16, 4, 9, 16, 16, 6, 10, 12, 18, 6, 10, 17, 16, 6, 11, 16, 19, 6, 13, 18, 21, 7, 14, 21, 25, 8, 16, 20, 25, 8, 17, 23, 25, 9, 17, 23, 34, 9, 18, 25, 30, 10, 20, 27, 32, 12, 21, 29, 35, 12, 23, 34, 37, 12, 25, 34, 40, 13, 26, 35, 42, 14, 28, 38, 45, 15, 29, 40, 48, 16, 31, 43, 51, 17, 33, 45, 54, 18, 35, 48, 57, 19, 37, 51, 60, 19, 38, 53, 63, 20, 40, 56, 66, 21, 43, 59, 70, 22, 45, 62, 74, 24, 47, 65, 77, 25, 49, 68, 81];
const LEVELS = /** @type {const} */ ({ L: 0, M: 1, Q: 2, H: 3 });
const FORMAT_BITS = /** @type {const} */ ({ L: 1, M: 0, Q: 3, H: 2 });

/** Powers of the generator in GF(256) over `0x11d`, doubled so a sum of two logs needs no modulo. */
export const EXP = new Uint8Array(512);
/** The discrete log of each nonzero element of GF(256). */
export const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x = x << 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];

/** A product in GF(256). @param {number} a @param {number} b */
export const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

/** @param {number} count */
const generator = (count) => {
  let poly = [1];
  for (let i = 0; i < count; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
};

/** @param {number[]} data @param {number[]} gen */
const remainder = (data, gen) => {
  const out = new Array(gen.length - 1).fill(0);
  for (const byte of data) {
    const factor = byte ^ out[0];
    out.shift();
    out.push(0);
    if (factor) for (let i = 0; i < out.length; i++) out[i] ^= mul(gen[i + 1], factor);
  }
  return out;
};

/**
 * Block layout and capacity of a version at a level.
 * @param {number} version @param {QrLevel} level
 */
export const layout = (version, level) => {
  const index = (version - 1) * 4 + LEVELS[level];
  const blocks = BLOCKS[index];
  const ecPerBlock = EC[index] / blocks;
  const dataTotal = TOTAL[version - 1] - EC[index];
  const shortLen = Math.floor(dataTotal / blocks);
  const longBlocks = dataTotal % blocks;
  return { blocks, ecPerBlock, dataTotal, shortLen, longBlocks };
};

/** @param {number} version */
export const alignmentPositions = (version) => {
  if (version === 1) return [];
  const size = 17 + 4 * version;
  const count = Math.floor(version / 7) + 2;
  const step = size === 145 ? 26 : Math.ceil((size - 13) / (2 * count - 2)) * 2;
  const positions = [size - 7];
  for (let i = 1; i < count - 1; i++) positions.unshift(positions[0] - step);
  positions.unshift(6);
  return positions;
};

/**
 * @param {number} value
 * @param {number} poly
 * @param {number} degree
 */
const bch = (value, poly, degree) => {
  let rem = value << degree;
  for (let i = 15; i >= 0 && rem >> degree; i--) {
    const shift = 31 - Math.clz32(rem) - degree;
    if (shift < 0) break;
    rem ^= poly << shift;
  }
  return rem;
};

/** @param {QrLevel} level @param {number} mask */
export const formatInfo = (level, mask) => {
  const data = (FORMAT_BITS[level] << 3) | mask;
  return ((data << 10) | bch(data, 0x537, 10)) ^ 0x5412;
};

/** @param {number} version */
export const versionInfo = (version) => (version << 12) | bch(version, 0x1f25, 12);

/**
 * The modules no data may touch, with the function patterns drawn in:
 * finders, separators, timing, alignment, the dark module, and the
 * format and version areas (drawn later, reserved now).
 * @param {number} version
 */
export const functionModules = (version) => {
  const size = 17 + 4 * version;
  const modules = new Uint8Array(size * size);
  const reserved = new Uint8Array(size * size);
  const set = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ dark) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y * size + x] = dark;
    reserved[y * size + x] = 1;
  };
  const finder = (/** @type {number} */ cx, /** @type {number} */ cy) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, d === 2 || d === 4 ? 0 : 1);
      }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  for (let i = 8; i < size - 8; i++) {
    set(i, 6, i % 2 === 0 ? 1 : 0);
    set(6, i, i % 2 === 0 ? 1 : 0);
  }
  const positions = alignmentPositions(version);
  const last = positions.length - 1;
  for (let i = 0; i < positions.length; i++)
    for (let j = 0; j < positions.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++)
          set(positions[j] + dx, positions[i] + dy, Math.max(Math.abs(dx), Math.abs(dy)) === 1 ? 0 : 1);
    }
  for (let i = 0; i < 9; i++) {
    if (i === 6) continue;
    set(8, i, 0);
    set(i, 8, 0);
  }
  for (let i = 0; i < 8; i++) {
    set(size - 1 - i, 8, 0);
    set(8, size - 1 - i, 0);
  }
  set(8, size - 8, 1);
  if (version >= 7)
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, 0);
      set(b, a, 0);
    }
  return { size, modules, reserved };
};

/**
 * @param {Uint8Array} modules
 * @param {number} size
 * @param {QrLevel} level
 * @param {number} mask
 * @param {number} version
 */
const drawInfo = (modules, size, level, mask, version) => {
  const bits = formatInfo(level, mask);
  const bit = (/** @type {number} */ i) => (bits >> i) & 1;
  for (let i = 0; i < 6; i++) modules[i * size + 8] = bit(i);
  modules[7 * size + 8] = bit(6);
  modules[8 * size + 8] = bit(7);
  modules[8 * size + 7] = bit(8);
  for (let i = 9; i < 15; i++) modules[8 * size + (14 - i)] = bit(i);
  for (let i = 0; i < 8; i++) modules[8 * size + (size - 1 - i)] = bit(i);
  for (let i = 8; i < 15; i++) modules[(size - 15 + i) * size + 8] = bit(i);
  if (version < 7) return;
  const info = versionInfo(version);
  for (let i = 0; i < 18; i++) {
    const v = (info >> i) & 1;
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    modules[b * size + a] = v;
    modules[a * size + b] = v;
  }
};

/**
 * Every non-function module in placement order (the zigzag up and down
 * the column pairs, skipping the vertical timing column).
 * @param {number} size
 * @param {Uint8Array} reserved
 */
export const dataOrder = (size, reserved) => {
  const order = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let v = 0; v < size; v++) {
      const y = upward ? size - 1 - v : v;
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        if (!reserved[y * size + x]) order.push(y * size + x);
      }
    }
  }
  return order;
};

/** @param {number} mask @param {number} x @param {number} y */
export const maskBit = (mask, x, y) => {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
};

/** @param {Uint8Array} m @param {number} size */
const penalty = (m, size) => {
  let score = 0;
  const at = (/** @type {number} */ x, /** @type {number} */ y) => m[y * size + x];
  for (let y = 0; y < size; y++) {
    let runX = 1;
    let runY = 1;
    for (let x = 1; x < size; x++) {
      if (at(x, y) === at(x - 1, y)) { runX++; if (runX === 5) score += 3; else if (runX > 5) score++; } else runX = 1;
      if (at(y, x) === at(y, x - 1)) { runY++; if (runY === 5) score += 3; else if (runY > 5) score++; } else runY = 1;
    }
  }
  for (let y = 0; y < size - 1; y++)
    for (let x = 0; x < size - 1; x++) {
      const c = at(x, y);
      if (c === at(x + 1, y) && c === at(x, y + 1) && c === at(x + 1, y + 1)) score += 3;
    }
  const CORE = [1, 0, 1, 1, 1, 0, 1];
  const finderLike = (/** @type {(i: number) => number} */ read) => {
    let hits = 0;
    for (let i = 0; i <= size - 11; i++) {
      if (CORE.every((bit, k) => read(i + 4 + k) === bit) && [0, 1, 2, 3].every((k) => read(i + k) === 0)) hits++;
      if (CORE.every((bit, k) => read(i + k) === bit) && [7, 8, 9, 10].every((k) => read(i + k) === 0)) hits++;
    }
    return hits;
  };
  for (let y = 0; y < size; y++) score += 40 * finderLike((i) => at(i, y));
  for (let x = 0; x < size; x++) score += 40 * finderLike((i) => at(x, i));
  let dark = 0;
  for (let i = 0; i < m.length; i++) dark += m[i];
  score += Math.floor(Math.abs((dark * 100) / m.length - 50) / 5) * 10;
  return score;
};

/**
 * @param {string} text
 * @param {QrOptions} [options]
 * @returns {QrMatrix}
 */
export const encode = (text, { level = "M", mask: forcedMask } = {}) => {
  const bytes = new TextEncoder().encode(text);
  let version = 0;
  for (let v = 1; v <= 40 && !version; v++) {
    const bits = 4 + (v < 10 ? 8 : 16) + bytes.length * 8;
    if (bits <= layout(v, level).dataTotal * 8) version = v;
  }
  if (!version) throw new Error(`qr: ${bytes.length} bytes do not fit version 40 at level ${level}`);
  const { blocks, ecPerBlock, dataTotal, shortLen, longBlocks } = layout(version, level);

  /** @type {number[]} */
  const stream = [];
  let acc = 0;
  let accBits = 0;
  const push = (/** @type {number} */ value, /** @type {number} */ width) => {
    for (let i = width - 1; i >= 0; i--) {
      acc = (acc << 1) | ((value >> i) & 1);
      accBits++;
      if (accBits === 8) { stream.push(acc); acc = 0; accBits = 0; }
    }
  };
  push(4, 4);
  push(bytes.length, version < 10 ? 8 : 16);
  for (const byte of bytes) push(byte, 8);
  const room = dataTotal * 8 - (stream.length * 8 + accBits);
  push(0, Math.min(4, room));
  if (accBits) push(0, 8 - accBits);
  for (let pad = 0xec; stream.length < dataTotal; pad ^= 0xec ^ 0x11) stream.push(pad);

  const gen = generator(ecPerBlock);
  /** @type {number[][]} */
  const dataBlocks = [];
  /** @type {number[][]} */
  const ecBlocks = [];
  let offset = 0;
  for (let b = 0; b < blocks; b++) {
    const len = shortLen + (b >= blocks - longBlocks ? 1 : 0);
    const block = stream.slice(offset, offset + len);
    offset += len;
    dataBlocks.push(block);
    ecBlocks.push(remainder(block, gen));
  }
  /** @type {number[]} */
  const codewords = [];
  for (let i = 0; i <= shortLen; i++) for (const block of dataBlocks) if (i < block.length) codewords.push(block[i]);
  for (let i = 0; i < ecPerBlock; i++) for (const block of ecBlocks) codewords.push(block[i]);

  const { size, modules: base, reserved } = functionModules(version);
  const order = dataOrder(size, reserved);
  const placed = new Uint8Array(size * size);
  order.forEach((index, i) => {
    placed[index] = i < codewords.length * 8 ? (codewords[i >> 3] >> (7 - (i & 7))) & 1 : 0;
  });

  const render = (/** @type {number} */ mask) => {
    const out = new Uint8Array(base);
    for (const index of order) {
      const x = index % size;
      const y = (index - x) / size;
      out[index] = placed[index] ^ (maskBit(mask, x, y) ? 1 : 0);
    }
    drawInfo(out, size, level, mask, version);
    return out;
  };

  let best = forcedMask ?? 0;
  let modules = render(best);
  if (forcedMask === undefined) {
    let bestScore = penalty(modules, size);
    for (let mask = 1; mask < 8; mask++) {
      const candidate = render(mask);
      const score = penalty(candidate, size);
      if (score < bestScore) { bestScore = score; best = mask; modules = candidate; }
    }
  }
  return { version, size, level, mask: best, modules };
};
