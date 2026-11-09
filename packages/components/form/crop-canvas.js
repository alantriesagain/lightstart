/**
 * The canvas half of cropping a picture: opening it as a bitmap the way a
 * camera meant it (EXIF orientation applied), no larger than a canvas can
 * safely hold, and encoding the chosen square as a small square image.
 *
 * WebP is asked for first. A browser that cannot encode it hands back a PNG
 * under the same call, which is far heavier, so one probe decides and JPEG,
 * on a white ground since it has no transparency, is the fallback.
 */

import { fitWithin, halvingSteps, qualitySteps, sourceRect } from "./crop-rect.js";

/** @import { CropBounds, CropRect } from "../types.ts" */

/** The most pixels a working picture keeps: what iOS Safari draws into a canvas. */
export const MAX_PIXELS = 8_388_608;

/** @type {Promise<boolean> | null} */
let webp = null;

/** Whether this browser encodes WebP rather than quietly handing back a PNG. */
export const encodesWebp = () => {
  webp ??= new Promise((resolve) => {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    probe.toBlob((blob) => resolve(blob?.type === "image/webp"), "image/webp", 0.8);
  });
  return webp;
};

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string} type
 * @param {number} quality
 * @returns {Promise<Blob | null>}
 */
const encode = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * A picture from a file, a blob or an address, as a bitmap no larger than
 * `MAX_PIXELS`. Throws when the browser cannot decode it, which is what a
 * HEIC file does outside Safari.
 * @param {Blob | string} source
 * @returns {Promise<ImageBitmap>}
 */
export const loadPicture = async (source) => {
  const blob = typeof source === "string" ? await (await fetch(source)).blob() : source;
  const full = await createImageBitmap(blob, { imageOrientation: "from-image" });
  const fit = fitWithin(full.width, full.height, MAX_PIXELS);
  if (fit.scale >= 1) return full;
  const smaller = await createImageBitmap(full, { resizeWidth: fit.width, resizeHeight: fit.height, resizeQuality: "high" });
  full.close();
  return smaller;
};

/**
 * Gives a picture's memory back.
 * @param {ImageBitmap | null | undefined} picture
 */
export const releasePicture = (picture) => picture?.close();

/**
 * @param {number} size
 * @returns {[HTMLCanvasElement, CanvasRenderingContext2D]}
 */
const canvasOf = (size) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return [canvas, context];
};

/**
 * Draws the square `rect` of `picture` onto a canvas `size` wide, shrinking
 * through halvings so a large square comes out smooth.
 * @param {ImageBitmap} picture
 * @param {CropRect} rect
 * @param {CropBounds} bounds
 * @param {number} size
 * @param {string} [ground] a colour to lay under the picture, for a format with no transparency
 */
export const drawSquare = (picture, rect, bounds, size, ground = "") => {
  const { sx, sy, size: source } = sourceRect(rect, bounds);
  /** @type {CanvasImageSource} */
  let from = picture;
  let fromX = sx;
  let fromY = sy;
  let fromSize = source;
  const steps = source > size ? halvingSteps(source, size) : [size];
  /** @type {HTMLCanvasElement} */
  let canvas = document.createElement("canvas");
  for (const [i, step] of steps.entries()) {
    const [next, context] = canvasOf(step);
    if (ground && i === steps.length - 1) {
      context.fillStyle = ground;
      context.fillRect(0, 0, step, step);
    }
    context.drawImage(from, fromX, fromY, fromSize, fromSize, 0, 0, step, step);
    from = next;
    fromX = 0;
    fromY = 0;
    fromSize = step;
    canvas = next;
  }
  return canvas;
};

/**
 * The square `rect` of `picture` as an image `size` pixels wide, at the best
 * quality that comes in at `maxBytes` or under; null when none does.
 * @param {ImageBitmap} picture
 * @param {CropRect} rect
 * @param {CropBounds} bounds
 * @param {{ size?: number, type?: string, quality?: number, maxBytes?: number }} [options]
 * @returns {Promise<Blob | null>}
 */
export const cropToBlob = async (picture, rect, bounds, { size = 512, type = "image/webp", quality = 0.9, maxBytes = 150_000 } = {}) => {
  const wanted = type === "image/webp" && !(await encodesWebp()) ? "image/jpeg" : type;
  const canvas = drawSquare(picture, rect, bounds, size, wanted === "image/jpeg" ? "#ffffff" : "");
  for (const q of qualitySteps(quality, 0.4, 0.1)) {
    const blob = await encode(canvas, wanted, q);
    if (blob && blob.size <= maxBytes) return blob;
  }
  return null;
};
