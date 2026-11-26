/**
 * @file @lightstart/images: image variants (a thumbnail, a card) made from a
 * photo, with their metadata and the URLs to them. This entry holds what a
 * page and a Worker share; the node resize and the normalize step are in
 * `@lightstart/images/node`, so a bundle of this one never reaches Playwright.
 */

export { variantUrl, thumbUrl, isVariant } from "./paths.js";
export { imageSize } from "./metadata.js";
export { resizeImage } from "./browser.js";
export type { ResizeOp, ImageVariant, ImagesConfig, ResizeResult, Resizer } from "./types.ts";
