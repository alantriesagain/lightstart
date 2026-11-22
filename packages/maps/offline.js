/**
 * Offline packs: prefetch a route's tiles plus whatever app URLs each stop
 * needs (content files, images), priming the SW/HTTP cache or the native
 * shell's response cache. Coverage comes from `coverage.js`: the same
 * arithmetic the bake uses, so a pack and the baked set agree.
 */

import { bboxOfPoints } from "./mercator.js";
import { coverageTiles, manifestZooms, sparseTileExists } from "./coverage.js";
import { appUrl } from "@lightstart/app";
/** @import { TilesManifest } from "./types.ts" */

const PAD = 0.02;
const NEAR_RADIUS = 2;
const CONCURRENCY = 6;

/**
 * @param {Array<{ lat: number, lng: number }>} stops
 * @param {TilesManifest | null} manifest
 * @returns {Set<string>} `z/x/y` keys
 */
export const tileKeys = (stops, manifest) => {
  const bbox = bboxOfPoints(stops);
  if (!bbox) return new Set();
  const { minZoom, fullMax, maxZoom } = manifestZooms(manifest);
  return coverageTiles({
    bbox: { west: bbox.west - PAD, east: bbox.east + PAD, south: bbox.south - PAD, north: bbox.north + PAD },
    points: stops,
    fullMin: minZoom,
    fullMax,
    nearMax: maxZoom,
    radius: NEAR_RADIUS,
  });
};

/**
 * Rough size for the download button (tiles ~14KB, each extra ~42KB).
 *
 * @param {{ stops: Array<{ lat: number, lng: number }>, manifest?: TilesManifest | null, extraCount?: number }} options
 */
export const estimatePack = ({ stops, manifest = null, extraCount = 0 }) => {
  const tiles = tileKeys(stops, manifest).size;
  const bytes = tiles * 14000 + extraCount * 42000;
  const mb = bytes / 1e6;
  return { tiles, bytes, label: mb >= 1 ? `~${Math.round(mb)} MB` : tiles ? "<1 MB" : "" };
};

/**
 * @param {{ stops: Array<{ lat: number, lng: number }>, manifest?: TilesManifest | null,
 *   tileBase?: string, extraUrls?: () => Iterable<string> }} options
 */
export const packUrls = ({ stops, manifest = null, tileBase = appUrl("/assets/tiles"), extraUrls = () => [] }) => {
  const urls = new Set();
  const sparse = manifest?.sparse;
  const fullZoomMax = manifest?.fullZoomMax;
  for (const key of tileKeys(stops, manifest)) {
    const [z, x, y] = key.split("/").map(Number);
    if (!sparseTileExists(sparse, fullZoomMax, z, x, y)) continue;
    urls.add(`${tileBase}/${key}.png`);
  }
  for (const url of extraUrls()) urls.add(url);
  return [...urls];
};

/**
 * Fetch every pack URL, a few at a time, and report what actually arrived.
 *
 * The body is read, not just the headers: a `fetch` resolves as soon as the
 * response head is in, and neither a service worker's `cache.put` of a clone
 * nor the native shell's `HttpResponseCache` commits an entry for a stream
 * nobody drained. Without this a pack could report success online and have
 * stored nothing.
 *
 * `cache: "force-cache"` is gone. It asks the browser to prefer a stale copy
 * over fetching, which is the opposite of what a download is for, and the
 * native shell forwards no request headers so it never meant anything there.
 *
 * @param {{ urls: string[], onProgress?: (done: number, total: number) => void, concurrency?: number }} options
 * @returns {Promise<{ total: number, ok: number, failed: number, complete: boolean }>}
 */
export const downloadPack = async ({ urls, onProgress, concurrency = CONCURRENCY }) => {
  let done = 0;
  let ok = 0;
  onProgress?.(0, urls.length);
  let idx = 0;
  const worker = async () => {
    while (idx < urls.length) {
      const url = urls[idx++];
      try {
        const response = await fetch(url);
        if (response.ok) {
          await response.arrayBuffer();
          ok += 1;
        }
      } catch {}
      done++;
      onProgress?.(done, urls.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length || 1) }, worker));
  return { total: urls.length, ok, failed: urls.length - ok, complete: ok === urls.length };
};
