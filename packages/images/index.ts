/**
 * @file @lightstart/images: image variants (a thumbnail, a card) made from a
 * photo, with their metadata and the URLs to them.
 */

export { variantUrl, thumbUrl, isVariant } from "./paths.js";
export { imageSize } from "./metadata.js";
export { resizeImage } from "./browser.js";
export { createResizer } from "./resize.js";
export { DEFAULTS, imagesConfig, scanPending, normalizeImages } from "./normalize.js";
export type { ResizeOp, ImageVariant, ImagesConfig, ResizeResult, Resizer } from "./types.ts";
