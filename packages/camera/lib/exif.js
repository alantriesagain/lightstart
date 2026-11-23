/**
 * Minimal EXIF reader for JPEG blobs.
 *
 * Reads only the tags this app teaches from: focal length, 35mm-equivalent focal
 * length, f-number, exposure time, and ISO. Many getUserMedia captures (and every
 * canvas-derived frame) carry NO EXIF at all; in that case we return null and the
 * UI falls back to the values it derived from zoom + lens. This is intentionally a
 * small hand-rolled parser, not a dependency.
 */

/** @import { CameraExif } from "../types.ts" */

const TAG = {
  exifIFD: 0x8769,
  exposureTime: 0x829a,
  fNumber: 0x829d,
  isoSpeed: 0x8827,
  focalLength: 0x920a,
  focalLength35: 0xa405,
};

/** @type {Record<number, number>} */
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 9: 4, 10: 8 };

/** @param {DataView} view @param {number} offset @param {number} length @returns {string} */
const ascii = (view, offset, length) => {
  let out = "";
  for (let i = 0; i < length; i++) out += String.fromCharCode(view.getUint8(offset + i));
  return out;
};

/** @param {DataView} view @param {number} tiffStart */
const parseTiff = (view, tiffStart) => {
  const le = ascii(view, tiffStart, 2) === "II";
  const u16 = (/** @type {number} */ abs) => view.getUint16(abs, le);
  const u32 = (/** @type {number} */ abs) => view.getUint32(abs, le);
  const i32 = (/** @type {number} */ abs) => view.getInt32(abs, le);
  if (u16(tiffStart + 2) !== 0x002a) return null;

  /** @type {Record<number, number | number[]>} */
  const out = {};

  /** @param {number} type @param {number} count @param {number} valOff @returns {number | number[]} */
  const readValue = (type, count, valOff) => {
    const byteLen = (TYPE_SIZE[type] || 1) * count;
    const dataOff = byteLen <= 4 ? valOff : tiffStart + u32(valOff);
    const one = (/** @type {number} */ i) => {
      switch (type) {
        case 3: return u16(dataOff + i * 2);
        case 4: return u32(dataOff + i * 4);
        case 5: return u32(dataOff + i * 8) / (u32(dataOff + i * 8 + 4) || 1);
        case 10: return i32(dataOff + i * 8) / (i32(dataOff + i * 8 + 4) || 1);
        default: return view.getUint8(dataOff + i);
      }
    };
    if (count === 1) return one(0);
    /** @type {number[]} */
    const arr = [];
    for (let i = 0; i < count; i++) arr.push(one(i));
    return arr;
  };

  const seen = new Set();
  const readIFD = (/** @type {number} */ ifdAbs) => {
    if (ifdAbs <= tiffStart || ifdAbs + 2 > view.byteLength || seen.has(ifdAbs)) return;
    seen.add(ifdAbs);
    const count = u16(ifdAbs);
    for (let i = 0; i < count; i++) {
      const entry = ifdAbs + 2 + i * 12;
      if (entry + 12 > view.byteLength) break;
      const tag = u16(entry);
      const type = u16(entry + 2);
      const num = u32(entry + 4);
      const valOff = entry + 8;
      if (tag === TAG.exifIFD) readIFD(tiffStart + u32(valOff));
      else out[tag] = readValue(type, num, valOff);
    }
  };

  readIFD(tiffStart + u32(tiffStart + 4));
  return out;
};

/**
 * Read raw EXIF tag values from a JPEG ArrayBuffer. Returns null if it is not a
 * JPEG or carries no EXIF APP1 segment.
 * @param {ArrayBuffer} buffer
 */
export const readExifTags = (buffer) => {
  if (!buffer || buffer.byteLength < 4) return null;
  const view = new DataView(buffer);
  if (view.getUint16(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    if ((marker & 0xff00) !== 0xff00) break;
    const size = view.getUint16(offset + 2);
    if (marker === 0xffe1 && ascii(view, offset + 4, 4) === "Exif")
      return parseTiff(view, offset + 10);
    offset += 2 + size;
  }
  return null;
};

/** @param {unknown} v @returns {unknown} */
const first = (v) => (Array.isArray(v) ? v[0] : v);

/** @param {number | null} seconds @returns {string | null} */
const formatShutter = (seconds) => {
  if (!seconds || seconds <= 0) return null;
  if (seconds >= 1) return `${Math.round(seconds * 10) / 10}s`;
  return `1/${Math.round(1 / seconds)}`;
};

/**
 * Parse a JPEG blob into the normalized EXIF shape this app teaches from.
 * @param {Blob} blob
 * @returns {Promise<CameraExif | null>}
 */
export const parseExif = async (blob) => {
  if (!blob || typeof blob.arrayBuffer !== "function") return null;
  const tags = readExifTags(await blob.arrayBuffer());
  if (!tags) return null;
  const exposure = first(tags[TAG.exposureTime]);
  const focal = first(tags[TAG.focalLength]);
  const fnum = first(tags[TAG.fNumber]);
  return {
    focalLength: focal != null ? Math.round(Number(focal)) : null,
    focalLength35: tags[TAG.focalLength35] != null ? Math.round(Number(first(tags[TAG.focalLength35]))) : null,
    fNumber: fnum != null ? Math.round(Number(fnum) * 10) / 10 : null,
    exposureTime: exposure != null ? formatShutter(Number(exposure)) : null,
    exposureSeconds: exposure != null ? Number(exposure) : null,
    iso: tags[TAG.isoSpeed] != null ? Number(first(tags[TAG.isoSpeed])) : null,
  };
};
