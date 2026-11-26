/**
 * @file Asset normalization: every image in the configured dirs ships as
 * `<name>.<ext>` capped at a default max size, plus one sibling variant per
 * configured entry (default: a square `_thumb`). Idempotent; a fast metadata
 * pre-scan finds pending work and Chromium only launches when there is some.
 * Configure per project under `package.json → light.images`.
 * @import { ImagesConfig, ImageVariant } from "./types.ts"
 */

import fs from "node:fs/promises";
import path from "node:path";
import { imageSize } from "./metadata.js";
import { isVariant, variantUrl } from "./paths.js";
import { createResizer } from "./resize.js";

/**
 * The config a project gets when it names none.
 * @type {ImagesConfig}
 */
export const DEFAULTS = {
  dirs: [],
  maxPx: 1280,
  maxBytes: 300 * 1024,
  quality: 0.8,
  variants: [{ suffix: "thumb", width: 128, height: 128, fit: "cover", quality: 0.78 }],
};

/**
 * `light.images` from the project's package.json, merged over `DEFAULTS`.
 * @param {string} projectDir
 * @returns {Promise<ImagesConfig>}
 */
export async function imagesConfig(projectDir) {
  /** @type {{ light?: { images?: Partial<ImagesConfig> } }} */
  let pkg = {};
  try {
    pkg = JSON.parse(await fs.readFile(path.join(projectDir, "package.json"), "utf8"));
  } catch {}
  return { ...DEFAULTS, ...(pkg.light?.images || {}) };
}

/**
 * @param {string} name
 * @returns {boolean}
 */
const isImage = (name) => /\.(jpe?g|png|webp)$/i.test(name);

const BYTES_TOLERANCE = 1.25;
const MIN_SHRINK = 0.9;

/**
 * A source image that needs its cap, a missing variant, or both.
 * @typedef {{
 *   file: string,
 *   name: string,
 *   dir: string,
 *   oversized: boolean,
 *   missing: ImageVariant[],
 * }} PendingJob
 */

/**
 * The sources under `dirs` that are oversized or miss a variant, without
 * launching Chromium.
 * @param {{ root: string, dirs: string[], maxPx: number, maxBytes: number, variants: ImageVariant[] }} opts
 * @returns {Promise<PendingJob[]>}
 */
export async function scanPending({ root, dirs, maxPx, maxBytes, variants }) {
  /** @type {PendingJob[]} */
  const jobs = [];
  const suffixes = variants.map((v) => v.suffix);
  for (const dir of dirs) {
    const abs = path.join(root, dir);
    /** @type {string[]} */
    let names;
    try {
      names = await fs.readdir(abs);
    } catch {
      continue;
    }
    for (const name of names.filter((n) => isImage(n) && !suffixes.some((s) => isVariant(n, s)))) {
      const file = path.join(abs, name);
      const buf = await fs.readFile(file);
      const size = imageSize(buf);
      if (!size) continue;
      const oversized = Math.max(size.width, size.height) > maxPx || buf.length > maxBytes * BYTES_TOLERANCE;
      /** @type {ImageVariant[]} */
      const missing = [];
      for (const v of variants)
        try {
          await fs.access(path.join(abs, path.basename(variantUrl(name, v.suffix))));
        } catch {
          missing.push(v);
        }
      if (oversized || missing.length) jobs.push({ file, name, dir, oversized, missing });
    }
  }
  return jobs;
}

/**
 * The cap attempts, tried in order until one fits the byte budget.
 * @param {number} maxPx
 * @param {number} quality
 * @returns {import("./types.ts").ResizeOp[]}
 */
const capOps = (maxPx, quality) => [
  { width: maxPx, quality },
  { width: maxPx, quality: 0.72 },
  { width: maxPx, quality: 0.65 },
  { width: Math.round(maxPx * 0.85), quality: 0.7 },
  { width: Math.round(maxPx * 0.7), quality: 0.7 },
];

/**
 * Cap the oversized images and write the missing variants under `dirs`.
 * Answers how many sources it processed, and in a dry run how many are
 * pending.
 * @param {{
 *   root: string,
 *   dirs?: string[],
 *   maxPx?: number,
 *   maxBytes?: number,
 *   quality?: number,
 *   variants?: ImageVariant[],
 *   log?: (line: string) => void,
 *   dryRun?: boolean,
 * }} opts
 * @returns {Promise<{ processed: number, pending?: number }>}
 */
export async function normalizeImages({
  root,
  dirs = DEFAULTS.dirs,
  maxPx = DEFAULTS.maxPx,
  maxBytes = DEFAULTS.maxBytes,
  quality = DEFAULTS.quality,
  variants = DEFAULTS.variants,
  log = console.log,
  dryRun = false,
}) {
  const jobs = await scanPending({ root, dirs, maxPx, maxBytes, variants });
  if (!jobs.length) {
    log("images: nothing to normalize");
    return { processed: 0 };
  }
  if (dryRun) {
    for (const job of jobs)
      log(
        `images: would process ${path.relative(root, job.file)}${job.oversized ? " (cap)" : ""}${
          job.missing.length ? ` (+${job.missing.map((v) => v.suffix).join(",")})` : ""
        }`,
      );
    return { processed: 0, pending: jobs.length };
  }
  const resizer = await createResizer();
  let processed = 0;
  try {
    for (const job of jobs) {
      const buf = await fs.readFile(job.file);
      if (job.oversized) {
        /** @type {import("./types.ts").ResizeResult | null} */
        let best = null;
        for (const op of capOps(maxPx, quality)) {
          const [r] = await resizer.resize(buf, [op]);
          if (!best || r.size < best.size) best = r;
          if (r.size <= maxBytes) {
            best = r;
            break;
          }
        }
        if (best && best.bytes.length < buf.length * MIN_SHRINK) await fs.writeFile(job.file, best.bytes);
      }
      for (const v of job.missing) {
        const [r] = await resizer.resize(buf, [{ width: v.width, height: v.height, fit: v.fit, quality: v.quality }]);
        await fs.writeFile(path.join(path.dirname(job.file), path.basename(variantUrl(job.name, v.suffix))), r.bytes);
      }
      processed++;
      log(
        `images: ${path.relative(root, job.file)}${job.oversized ? " capped" : ""}${
          job.missing.length ? ` +${job.missing.map((v) => v.suffix).join(",")}` : ""
        }`,
      );
    }
  } finally {
    await resizer.close();
  }
  log(`images: ${processed} normalized`);
  return { processed };
}
