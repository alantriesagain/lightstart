/**
 * A photo made no larger than a phone screen needs, as a JPEG, before it
 * travels. The EXIF orientation is read first and baked into the pixels,
 * since the canvas keeps no EXIF.
 */
import { readExifTags } from "./exif.js";

const ORIENTATION_TAG = 0x0112;

/**
 * @param {Blob} blob
 * @param {{ max?: number, quality?: number }} [options]
 * @returns {Promise<Blob>}
 */
export const downscale = async (blob, { max = 1600, quality = 0.85 } = {}) => {
  const tags = readExifTags(await blob.arrayBuffer());
  const orientation = Number(tags?.[ORIENTATION_TAG]) || 1;
  const bitmap = await createImageBitmap(blob, { imageOrientation: "none" }).catch(() => createImageBitmap(blob));
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const turned = orientation >= 5;
  const canvas = new OffscreenCanvas(turned ? h : w, turned ? w : h);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    if (orientation === 3) ctx.rotate(Math.PI);
    if (orientation === 6) ctx.rotate(Math.PI / 2);
    if (orientation === 8) ctx.rotate(-Math.PI / 2);
    if (orientation === 2 || orientation === 4) ctx.scale(-1, 1);
    if (orientation === 5 || orientation === 7) {
      ctx.rotate(orientation === 5 ? Math.PI / 2 : -Math.PI / 2);
      ctx.scale(1, -1);
    }
    if (orientation === 4) ctx.rotate(Math.PI);
    ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
  }
  bitmap.close();
  return canvas.convertToBlob({ type: "image/jpeg", quality });
};
