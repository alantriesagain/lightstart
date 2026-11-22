/**
 * The map's camera without the DOM: where the world is centred and how far
 * in, as Web Mercator world coordinates in [0, 1] and a fractional zoom, and
 * how panning, anchored zoom, flights and fits move it. Every step that moves
 * the camera answers a new one; a step that moves nothing answers the camera
 * it was given.
 */
import { boundsToCenterZoom, worldSize } from "../mercator.js";

/** @import { Bbox, MapCamera, MapCenterZoom, MapFlight, MapLimits, MapViewport, PinchIntent, WorldRect } from "../types.ts" */

export const ZOOM_EPSILON = 0.002;
export const ZOOM_RATE = 0.012;

/** @type {WorldRect} */
const WHOLE_WORLD = { x0: 0, y0: 0, x1: 1, y1: 1 };

/**
 * @param {number} t
 * @returns {number}
 */
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
export const clampNum = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * @param {number} zoom
 * @param {MapLimits} limits
 * @returns {number}
 */
export const clampZoom = (zoom, limits) => clampNum(zoom, limits.minZoom, limits.maxZoom);

/**
 * The camera held inside the bounds, centred on them along an axis the
 * viewport is wider than.
 * @param {MapCamera} camera
 * @param {MapViewport} viewport
 * @param {WorldRect | null} world
 * @returns {MapCamera}
 */
export const clampCenter = (camera, viewport, world) => {
  const b = world || WHOLE_WORLD;
  const s = worldSize(camera.zoom);
  const hw = viewport.w / 2 / s;
  const hh = viewport.h / 2 / s;
  const cx = b.x1 - b.x0 <= hw * 2 ? (b.x0 + b.x1) / 2 : clampNum(camera.cx, b.x0 + hw, b.x1 - hw);
  const cy = b.y1 - b.y0 <= hh * 2 ? (b.y0 + b.y1) / 2 : clampNum(camera.cy, b.y0 + hh, b.y1 - hh);
  return cx === camera.cx && cy === camera.cy ? camera : { ...camera, cx, cy };
};

/**
 * @param {MapCamera} camera
 * @param {MapViewport} viewport
 * @param {number} px
 * @param {number} py
 * @param {number[]} [out]
 * @returns {number[]}
 */
export const screenToWorld = (camera, viewport, px, py, out = [0, 0]) => {
  const s = worldSize(camera.zoom);
  out[0] = camera.cx + (px - viewport.w / 2) / s;
  out[1] = camera.cy + (py - viewport.h / 2) / s;
  return out;
};

/**
 * @param {MapCamera} camera
 * @param {MapViewport} viewport
 * @param {number} wx
 * @param {number} wy
 * @param {number[]} [out]
 * @returns {number[]}
 */
export const worldToScreen = (camera, viewport, wx, wy, out = [0, 0]) => {
  const s = worldSize(camera.zoom);
  out[0] = (wx - camera.cx) * s + viewport.w / 2;
  out[1] = (wy - camera.cy) * s + viewport.h / 2;
  return out;
};

/**
 * The camera after the world is dragged by a screen distance.
 * @param {MapCamera} camera
 * @param {number} dx
 * @param {number} dy
 * @returns {MapCamera}
 */
export const panBy = (camera, dx, dy) => {
  const s = worldSize(camera.zoom);
  return { ...camera, cx: camera.cx - dx / s, cy: camera.cy - dy / s };
};

/**
 * The camera at a new zoom with the world point under a screen point held
 * under it.
 * @param {MapCamera} camera
 * @param {MapViewport} viewport
 * @param {number} zoom
 * @param {number} px
 * @param {number} py
 * @returns {MapCamera}
 */
export const anchoredZoom = (camera, viewport, zoom, px, py) => {
  const s0 = worldSize(camera.zoom);
  const s1 = worldSize(zoom);
  const ox = px - viewport.w / 2;
  const oy = py - viewport.h / 2;
  return { ...camera, zoom, cx: camera.cx + ox / s0 - ox / s1, cy: camera.cy + oy / s0 - oy / s1 };
};

/**
 * The camera after one pinch step: panned by the midpoint's travel, zoomed by
 * the spread about the midpoint, and settled there.
 * @param {MapCamera} camera
 * @param {MapViewport} viewport
 * @param {MapLimits} limits
 * @param {PinchIntent} intent
 * @returns {MapCamera}
 */
export const pinchZoom = (camera, viewport, limits, intent) => {
  const panned = panBy(camera, intent.dx, intent.dy);
  const zoomed = anchoredZoom(panned, viewport, clampZoom(panned.zoom + Math.log2(intent.scale), limits), intent.x, intent.y);
  zoomed.zTarget = zoomed.zoom;
  return zoomed;
};

/**
 * The camera heading for a zoom about a screen point, reached frame by frame
 * through `approachZoomTarget`.
 * @param {MapCamera} camera
 * @param {MapLimits} limits
 * @param {number} zoom
 * @param {number} px
 * @param {number} py
 * @returns {MapCamera}
 */
export const zoomTarget = (camera, limits, zoom, px, py) => ({ ...camera, anchorX: px, anchorY: py, zTarget: clampZoom(zoom, limits) });

/**
 * One frame's step toward the target zoom, snapping once it is within
 * `ZOOM_EPSILON`.
 * @param {MapCamera} camera
 * @param {MapViewport} viewport
 * @param {number} dt
 * @returns {MapCamera}
 */
export const approachZoomTarget = (camera, viewport, dt) => {
  if (camera.zTarget === camera.zoom) return camera;
  if (Math.abs(camera.zTarget - camera.zoom) <= ZOOM_EPSILON)
    return anchoredZoom(camera, viewport, camera.zTarget, camera.anchorX, camera.anchorY);
  const step = 1 - Math.exp(-dt * ZOOM_RATE);
  return anchoredZoom(camera, viewport, camera.zoom + (camera.zTarget - camera.zoom) * step, camera.anchorX, camera.anchorY);
};

/**
 * @param {MapCamera} camera
 * @param {MapCenterZoom} to
 * @param {number} t0
 * @param {number} ms
 * @returns {MapFlight}
 */
export const createFlight = (camera, to, t0, ms) => ({ t0, ms, from: { cx: camera.cx, cy: camera.cy, zoom: camera.zoom }, to });

/**
 * Where a flight is at a time, eased, and whether it has landed.
 * @param {MapFlight} flight
 * @param {number} t
 * @returns {MapCenterZoom & { done: boolean }}
 */
export const flightAt = (flight, t) => {
  const k = clampNum((t - flight.t0) / flight.ms, 0, 1);
  const e = easeInOutCubic(k);
  const { from, to } = flight;
  return {
    cx: from.cx + (to.cx - from.cx) * e,
    cy: from.cy + (to.cy - from.cy) * e,
    zoom: from.zoom + (to.zoom - from.zoom) * e,
    done: k >= 1,
  };
};

/**
 * The centre and whole zoom that frame a bbox in the viewport.
 * @param {Bbox} bbox
 * @param {MapViewport} viewport
 * @param {MapLimits} limits
 * @param {{ padding: number, maxZoom: number }} options
 * @returns {MapCenterZoom}
 */
export const fitCamera = (bbox, viewport, limits, { padding, maxZoom }) => {
  const fit = boundsToCenterZoom(bbox, viewport.w, viewport.h, padding, Math.min(maxZoom, limits.maxZoom));
  return { cx: fit.cx, cy: fit.cy, zoom: clampZoom(Math.floor(fit.zoom), limits) };
};
