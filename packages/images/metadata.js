/**
 * @file Dependency-free image metadata from raw bytes: node- and browser-safe
 * (takes a Uint8Array/Buffer, touches no fs).
 */

/**
 * @param {Uint8Array} b
 * @param {number} i
 * @returns {number}
 */
const readU16BE = (b, i) => (b[i] << 8) | b[i + 1];

/**
 * @param {Uint8Array} b
 * @param {number} i
 * @returns {number}
 */
const readU32BE = (b, i) => b[i] * 0x1000000 + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];

/**
 * The dimensions in a JPEG's SOF marker, or null.
 * @param {Uint8Array} b
 * @returns {{ width: number, height: number } | null}
 */
const jpegSize = (b) => {
  let i = 2;
  while (i <= b.length - 9) {
    if (b[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = b[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
      return { width: readU16BE(b, i + 7), height: readU16BE(b, i + 5) };
    i += 2 + readU16BE(b, i + 2);
  }
  return null;
};

/**
 * The dimensions in a PNG's IHDR chunk, or null.
 * @param {Uint8Array} b
 * @returns {{ width: number, height: number } | null}
 */
const pngSize = (b) => (b.length > 24 ? { width: readU32BE(b, 16), height: readU32BE(b, 20) } : null);

/**
 * The dimensions in a WebP's VP8, VP8L or VP8X chunk, or null.
 * @param {Uint8Array} b
 * @returns {{ width: number, height: number } | null}
 */
const webpSize = (b) => {
  if (b.length < 30) return null;
  const fourcc = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (fourcc === "VP8 ")
    return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
  if (fourcc === "VP8L") {
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (fourcc === "VP8X")
    return {
      width: (b[24] | (b[25] << 8) | (b[26] << 16)) + 1,
      height: (b[27] | (b[28] << 8) | (b[29] << 16)) + 1,
    };
  return null;
};

/**
 * `{ type, width, height }` for JPEG/PNG/WebP bytes, or null when the format
 * is unrecognized or the header is truncated.
 * @param {Uint8Array | ArrayLike<number>} bytes
 * @returns {{ type: "jpeg" | "png" | "webp", width: number, height: number } | null}
 */
export const imageSize = (bytes) => {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b[0] === 0xff && b[1] === 0xd8) {
    const s = jpegSize(b);
    return s && { type: "jpeg", ...s };
  }
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const s = pngSize(b);
    return s && { type: "png", ...s };
  }
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) {
    const s = webpSize(b);
    return s && { type: "webp", ...s };
  }
  return null;
};
