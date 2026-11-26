/**
 * @file Reading a sent image before anything else touches it. A photo arrives
 * as a data URL inside an ordinary JSON write, so this is the one gate between
 * a request body and a row: the type it declares has to agree with its bytes,
 * and its weight, its size, its shape and its single frame have to be what a
 * cropper makes. Anything else is refused, whatever it says it is.
 */

import { imageSize } from "@lightstart/images";

import type { ImageLimits, ImageType, ReadImage } from "../types.ts";

/** The limits a profile photo has to fit. */
export const IMAGE_LIMITS: ImageLimits = { maxBytes: 150_000, minSide: 128, maxSide: 1024, squareTolerance: 0.02 };

const DATA_URL = /^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/;

const EXTENSIONS: Record<ImageType, "webp" | "jpg" | "png"> = { webp: "webp", jpeg: "jpg", png: "png" };

const fourcc = (bytes: Uint8Array, at: number): string => String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);

const decode = (text: string): Uint8Array | null => {
  try {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
};

/**
 * Whether the image holds more than one frame: a WebP flagged or chunked as
 * an animation, or a PNG carrying APNG's control chunk. A review sees the
 * first frame, so a later one could be anything.
 */
const animated = (bytes: Uint8Array, type: ImageType): boolean => {
  if (type === "webp") {
    if (fourcc(bytes, 12) === "VP8X" && (bytes[20] & 0x02) !== 0) return true;
    for (let at = 12; at + 8 <= bytes.length; ) {
      const name = fourcc(bytes, at);
      if (name === "ANIM" || name === "ANMF") return true;
      const size = bytes[at + 4] | (bytes[at + 5] << 8) | (bytes[at + 6] << 16) | (bytes[at + 7] * 0x1000000);
      at += 8 + size + (size % 2);
    }
    return false;
  }
  if (type !== "png") return false;
  for (let at = 8; at + 8 <= bytes.length; ) {
    const size = bytes[at] * 0x1000000 + (bytes[at + 1] << 16) + (bytes[at + 2] << 8) + bytes[at + 3];
    const name = fourcc(bytes, at + 4);
    if (name === "acTL") return true;
    if (name === "IEND") return false;
    at += 12 + size;
  }
  return false;
};

/**
 * The image a data URL carries, or why it is refused.
 */
export const readImageDataUrl = (value: unknown, limits: ImageLimits = IMAGE_LIMITS): ReadImage => {
  if (typeof value !== "string" || value === "") return { ok: false, error: "no image" };
  if (value.length > Math.ceil(limits.maxBytes / 3) * 4 + 32) return { ok: false, error: "too heavy" };
  const match = DATA_URL.exec(value);
  if (match === null) return { ok: false, error: "not an image" };
  const declared = match[1] as ImageType;
  const bytes = decode(match[2]);
  if (bytes === null) return { ok: false, error: "not an image" };
  if (bytes.length > limits.maxBytes) return { ok: false, error: "too heavy" };
  const size = imageSize(bytes);
  if (size === null || size.type !== declared) return { ok: false, error: "not an image" };
  const { width, height } = size;
  if (Math.min(width, height) < limits.minSide) return { ok: false, error: "too small" };
  if (Math.max(width, height) > limits.maxSide) return { ok: false, error: "too large" };
  if (Math.abs(width - height) > Math.max(width, height) * limits.squareTolerance) return { ok: false, error: "not square" };
  if (animated(bytes, declared)) return { ok: false, error: "animated" };
  return { ok: true, type: declared, ext: EXTENSIONS[declared], contentType: `image/${declared}`, bytes, width, height, dataUrl: value };
};
