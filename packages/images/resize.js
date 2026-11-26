/**
 * @file Node-side image resize engine. Decoding and encoding run in headless
 * Chromium (`createImageBitmap` + `OffscreenCanvas`) through Playwright, so the
 * package needs no native image dependency (no sharp). Playwright is imported
 * lazily and is only required when a resize actually happens.
 *
 * `createResizer()` boots one browser page to serve many `resize()` calls;
 * always `close()` it. Bytes go in, bytes come out; no fs here.
 * @import { ResizeOp } from "./types.ts"
 */

/**
 * The browser page's work: decode base64 bytes, render each operation and
 * answer them as base64. Serialized into Chromium, so it imports nothing.
 * @param {{ b64: string, ops: ResizeOp[] }} args
 * @returns {Promise<Array<{ b64: string, size: number, width: number, height: number }>>}
 */
const PAGE_FN = async ({ b64, ops }) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes]));
  /**
   * @param {Blob} blob
   * @returns {Promise<string>}
   */
  const toB64 = async (blob) => {
    const ab = new Uint8Array(await blob.arrayBuffer());
    let s = "";
    for (let i = 0; i < ab.length; i += 0x8000) s += String.fromCharCode(...ab.subarray(i, i + 0x8000));
    return btoa(s);
  };
  /**
   * @param {ResizeOp} op
   * @returns {Promise<{ b64: string, size: number, width: number, height: number }>}
   */
  const render = async ({ width, height, fit = "max", quality = 0.8, type = "image/jpeg" }) => {
    let w, h, sx = 0, sy = 0, sw = bitmap.width, sh = bitmap.height;
    if (fit === "cover") {
      w = width;
      h = height ?? width;
      const scale = Math.max(w / bitmap.width, h / bitmap.height);
      sw = Math.round(w / scale);
      sh = Math.round(h / scale);
      sx = Math.round((bitmap.width - sw) / 2);
      sy = Math.round((bitmap.height - sh) / 2);
    } else {
      const scale = Math.min(1, width / bitmap.width, (height ?? width) / bitmap.height);
      w = Math.round(bitmap.width * scale);
      h = Math.round(bitmap.height * scale);
    }
    const canvas = new OffscreenCanvas(w, h);
    /** @type {OffscreenCanvasRenderingContext2D} */ (canvas.getContext("2d")).drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);
    const blob = await canvas.convertToBlob({ type, quality });
    return { b64: await toB64(blob), size: blob.size, width: w, height: h };
  };
  /** @type {Array<{ b64: string, size: number, width: number, height: number }>} */
  const results = [];
  for (const op of ops) results.push(await render(op));
  bitmap.close();
  return results;
};

/**
 * Boot one headless Chromium page that serves many resizes. Playwright and its
 * Chromium must be installed in the project: `pnpm add -D playwright &&
 * pnpm exec playwright install chromium`.
 * @returns {Promise<import("./types.ts").Resizer>}
 */
export async function createResizer() {
  /** @type {typeof import("playwright").chromium} */
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error("Playwright is not installed. Run: pnpm add -D playwright && pnpm exec playwright install chromium");
  }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  return {
    async resize(bytes, ops) {
      const results = await page.evaluate(PAGE_FN, { b64: Buffer.from(bytes).toString("base64"), ops });
      return results.map((r) => ({ ...r, bytes: Buffer.from(r.b64, "base64") }));
    },
    close: () => browser.close(),
  };
}
