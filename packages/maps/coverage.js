/**
 * Tile-coverage arithmetic shared by the bake (`maps:tiles`) and the runtime
 * offline packs, so the two provably agree: a full pyramid over the bbox up
 * to `fullMax`, then per-point squares of `radius` tiles up to `nearMax`.
 */

import { lngLatToWorld, tileRange, worldToTile } from "./mercator.js";

/**
 * @param {{ bbox?: { west: number, east: number, south: number, north: number } | null,
 *   points?: Array<{ lat: number, lng: number }>,
 *   fullMin: number, fullMax: number, nearMax: number, radius?: number }} options
 * @returns {Set<string>} `z/x/y` keys
 */
export const coverageTiles = ({ bbox = null, points = [], fullMin, fullMax, nearMax, radius = 2 }) => {
  const keys = new Set();
  if (bbox)
    for (let z = fullMin; z <= fullMax; z++) {
      const r = tileRange(bbox, z);
      for (let y = r.y0; y <= r.y1; y++)
        for (let x = r.x0; x <= r.x1; x++) keys.add(`${z}/${x}/${y}`);
    }
  for (let z = fullMax + 1; z <= nearMax; z++) {
    const n = 2 ** z;
    for (const p of points) {
      const [wx, wy] = lngLatToWorld(p.lng, p.lat);
      const [cx, cy] = worldToTile(wx, wy, z);
      for (let y = Math.max(0, cy - radius); y <= Math.min(n - 1, cy + radius); y++)
        for (let x = Math.max(0, cx - radius); x <= Math.min(n - 1, cx + radius); x++)
          keys.add(`${z}/${x}/${y}`);
    }
  }
  return keys;
};

/**
 * Answer whether a tile was baked, from the manifest's sparse y-run index.
 * Everything at or below `fullZoomMax` exists by construction; above it a
 * tile exists only when its column's runs cover the row.
 *
 * @param {Record<string, Record<string, Array<[number, number]>>> | null | undefined} sparse
 * @param {number | null | undefined} fullZoomMax
 * @param {number} z
 * @param {number} x
 * @param {number} y
 */
export const sparseTileExists = (sparse, fullZoomMax, z, x, y) => {
  if (!sparse || typeof fullZoomMax !== "number" || !Number.isFinite(fullZoomMax) || z <= fullZoomMax) return true;
  const runs = sparse[z]?.[x];
  if (!runs) return false;
  return runs.some(([y0, y1]) => y >= y0 && y <= y1);
};

/**
 * The zoom bands a manifest implies, with the bake's defaults for holes.
 * @param {import("./types.ts").TilesManifest | null | undefined} manifest
 */
export const manifestZooms = (manifest) => ({
  minZoom: manifest?.minZoom ?? 8,
  fullMax: manifest?.fullZoomMax ?? Math.min(13, manifest?.maxZoom ?? 13),
  maxZoom: manifest?.maxZoom ?? 14,
});
