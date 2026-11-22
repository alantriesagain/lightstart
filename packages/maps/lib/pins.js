/**
 * What a map pin is made of, without the DOM: the drop's geometry, which
 * points draw, how they group into clusters at a zoom, and the ring a
 * cluster wears.
 */
import { ICON_NAME } from "@lightstart/components/display/icon-mask.js";
import { lngLatToWorld, worldSize } from "../mercator.js";

/** @import { MapPoint, PinGroup } from "../types.ts" */

export const PIN_TIP_X = 18;
export const PIN_TIP_Y = 41;
export const PIN_WIDTH = 36;
export const PIN_HEIGHT = 43;
export const CLUSTER_SIZE = 40;
export const PHOTO_SIZE = 40;
export const DROP_PATH = "M18 41 L6.07 27.67 A16 16 0 1 1 29.93 27.67 Z";
export const FOLD_PATH = "M18 1 A16 16 0 0 1 29.93 27.67 L18 41 Z";
export const CLUSTER_MIN_ZOOM = 14;
const CLUSTER_CELL_PX = 56;

/**
 * The points a map can place: those with a finite latitude and longitude.
 * @param {MapPoint[]} points
 * @returns {MapPoint[]}
 */
export const finitePoints = (points) => points.filter((p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)));

/**
 * The points grouped by the grid cell they fall in at an integer zoom, one
 * group per point once the zoom is close enough to tell them apart.
 * @param {MapPoint[]} points
 * @param {number} zi
 * @returns {PinGroup[]}
 */
export const clusterPoints = (points, zi) => {
  if (zi >= CLUSTER_MIN_ZOOM) return points.map((p) => ({ points: [p] }));
  const s = worldSize(zi);
  /** @type {Map<string, PinGroup>} */
  const buckets = new Map();
  for (const p of points) {
    const [wx, wy] = lngLatToWorld(Number(p.lng), Number(p.lat));
    const key = `${Math.floor((wx * s) / CLUSTER_CELL_PX)}:${Math.floor((wy * s) / CLUSTER_CELL_PX)}`;
    const group = buckets.get(key);
    if (group) group.points.push(p);
    else buckets.set(key, { points: [p] });
  }
  return [...buckets.values()];
};

/**
 * Where a cluster sits: the mean of its points.
 * @param {MapPoint[]} points
 * @returns {{ lat: number, lng: number }}
 */
export const clusterCenter = (points) => ({
  lat: points.reduce((a, p) => a + Number(p.lat), 0) / points.length,
  lng: points.reduce((a, p) => a + Number(p.lng), 0) / points.length,
});

/**
 * A cluster's ring: each colour among its points, in proportion, largest
 * share first.
 * @param {MapPoint[]} points
 * @param {string} fallback the colour of a point that names none
 */
export const clusterRing = (points, fallback) => {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const p of points) {
    const color = p.color || fallback;
    counts.set(color, (counts.get(color) || 0) + 1);
  }
  let at = 0;
  const stops = [...counts].sort((a, b) => b[1] - a[1]).map(([color, n]) => {
    const from = at;
    at += (n / points.length) * 100;
    return `${color} ${from.toFixed(2)}% ${at.toFixed(2)}%`;
  });
  return `conic-gradient(${stops.join(",")})`;
};

/**
 * The identity a pin answers `activeId` with: its id, else its slug.
 * @param {MapPoint} pt
 */
export const pinId = (pt) => String(pt.id ?? pt.slug ?? "");

/**
 * @param {MapPoint} pt
 * @param {string} activeId
 */
export const isActivePin = (pt, activeId) => !!activeId && pinId(pt) === String(activeId);

/**
 * The glyph a pin shows: the point's, when it names a known icon, else the map pin.
 * @param {unknown} icon
 */
export const pinIcon = (icon) => (typeof icon === "string" && ICON_NAME.test(icon) ? icon : "map-pin");

/**
 * A key per group for keyed rendering: a pin by its point's identity, a
 * cluster by its lead point and size, each unique within the list.
 * @param {PinGroup[]} groups
 * @returns {string[]}
 */
export const pinKeys = (groups) => {
  /** @type {Set<string>} */
  const seen = new Set();
  return groups.map(({ points }) => {
    const lead = points[0];
    const id = pinId(lead) || `${lead.lat},${lead.lng}`;
    const base = points.length === 1 ? `pin:${id}` : `cluster:${id}:${points.length}`;
    let k = base;
    for (let n = 1; seen.has(k); n++) k = `${base}#${n}`;
    seen.add(k);
    return k;
  });
};
