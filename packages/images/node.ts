/**
 * @file @lightstart/images/node: the node side, the resize engine over headless
 * Chromium and the normalize step `light images:normalize` runs. It reaches
 * Playwright and `node:fs`, so a page or a Worker imports `@lightstart/images`
 * instead.
 */

export { createResizer } from "./resize.js";
export { DEFAULTS, imagesConfig, scanPending, normalizeImages } from "./normalize.js";
export type { ResizeOp, ImageVariant, ImagesConfig, ResizeResult, Resizer } from "./types.ts";
