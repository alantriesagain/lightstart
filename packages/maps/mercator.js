/** @import { Bbox, MapPoint } from "./types.ts" */

export const TILE_SIZE = 256;
export const MAX_LAT = 85.0511287798;

/** @param {number} lat */
export const clampLat = (lat) => Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));

/**
 * @param {number} lng
 * @param {number} lat
 */
export const lngLatToWorld = (lng, lat) => {
  const rad = (clampLat(lat) * Math.PI) / 180;
  return [
    (lng + 180) / 360,
    (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2,
  ];
};

/**
 * @param {number} x
 * @param {number} y
 */
export const worldToLngLat = (x, y) => {
  const n = Math.PI - 2 * Math.PI * y;
  return [x * 360 - 180, (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))];
};

/** @param {number} zoom */
export const worldSize = (zoom) => TILE_SIZE * 2 ** zoom;

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
export const worldToTile = (x, y, z) => {
  const n = 2 ** z;
  return [
    Math.max(0, Math.min(n - 1, Math.floor(x * n))),
    Math.max(0, Math.min(n - 1, Math.floor(y * n))),
  ];
};

/** @param {{west:number,south:number,east:number,north:number}} bbox */
export const bboxToWorld = (bbox) => {
  const [x0, y0] = lngLatToWorld(bbox.west, bbox.north);
  const [x1, y1] = lngLatToWorld(bbox.east, bbox.south);
  return { x0, y0, x1, y1 };
};

/**
 * @param {{west:number,south:number,east:number,north:number}} bbox
 * @param {number} z
 */
export const tileRange = (bbox, z) => {
  const w = bboxToWorld(bbox);
  const [x0, y0] = worldToTile(w.x0, w.y0, z);
  const [x1, y1] = worldToTile(w.x1, w.y1, z);
  return { z, x0, y0, x1, y1 };
};

/**
 * @param {{west:number,south:number,east:number,north:number}} bbox
 * @param {number} width
 * @param {number} height
 * @param {number} [padding]
 * @param {number} [maxZoom]
 */
export const boundsToCenterZoom = (bbox, width, height, padding = 0, maxZoom = 18) => {
  const w = bboxToWorld(bbox);
  const dx = Math.max(w.x1 - w.x0, 1e-9);
  const dy = Math.max(w.y1 - w.y0, 1e-9);
  const pw = Math.max(width - padding * 2, 32);
  const ph = Math.max(height - padding * 2, 32);
  const zoom = Math.min(maxZoom, Math.log2(Math.min(pw / dx, ph / dy) / TILE_SIZE));
  return { cx: (w.x0 + w.x1) / 2, cy: (w.y0 + w.y1) / 2, zoom };
};

/**
 * Bbox of the densest cluster of points: median-centered, keeps points within
 * `expand`× the `keep`-percentile distance, so far-flung outliers don't blow up
 * the initial view. Degrades to the full bbox for small or evenly-spread sets.
 * @param {MapPoint[] | null | undefined} points
 * @param {{ keep?: number, expand?: number }} [options]
 */
export const focusBboxOfPoints = (points, { keep = 0.5, expand = 1.2 } = {}) => {
  const valid = (points || []).filter(
    (p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)),
  );
  if (valid.length < 4) return bboxOfPoints(valid);
  const median = (/** @type {number[]} */ arr) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const mx = median(valid.map((p) => lngLatToWorld(Number(p.lng), Number(p.lat))[0]));
  const my = median(valid.map((p) => lngLatToWorld(Number(p.lng), Number(p.lat))[1]));
  const dist = (/** @type {MapPoint} */ p) => {
    const [x, y] = lngLatToWorld(Number(p.lng), Number(p.lat));
    return Math.hypot(x - mx, y - my);
  };
  const sorted = valid.map(dist).sort((a, b) => a - b);
  const radius = sorted[Math.floor((valid.length - 1) * keep)] * expand;
  return bboxOfPoints(valid.filter((p) => dist(p) <= radius));
};

/**
 * @param {MapPoint[] | null | undefined} points
 * @returns {Bbox | null}
 */
export const bboxOfPoints = (points) => {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const pt of points || []) {
    const lat = Number(pt.lat);
    const lng = Number(pt.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return west <= east ? { west, south, east, north } : null;
};

const EARTH_RADIUS_M = 6371008.8;

/**
 * Great-circle distance in metres between two lat/lng points (haversine).
 * @param {{ lat: number | string, lng: number | string }} a
 * @param {{ lat: number | string, lng: number | string }} b
 * @returns {number}
 */
export const distanceMeters = (a, b) => {
  const toRad = (/** @type {number | string} */ v) => (Number(v) * Math.PI) / 180;
  const dLat = toRad(b.lat) - toRad(a.lat);
  const dLng = toRad(b.lng) - toRad(a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
};
