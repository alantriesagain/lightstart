/**
 * What a pointer, a wheel or a pair of fingers asks of the map, read from
 * raw coordinates: a pinch step, a double tap, a wheel's zoom.
 */

/** @import { PinchIntent } from "../types.ts" */

export const TAP_THRESHOLD_PX = 5;
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_PX = 30;
export const WHEEL_ZOOM_RATE = 0.0025;
export const PINCH_WHEEL_ZOOM_RATE = 0.01;

/**
 * One finger of a pinch moving from `prev` to `cur` while the other rests:
 * how far the midpoint travelled, how much the spread grew, where the
 * midpoint now is, and the distance it counts as dragged.
 * @param {{ x: number, y: number }} prev
 * @param {{ x: number, y: number }} cur
 * @param {{ x: number, y: number }} other
 * @returns {PinchIntent}
 */
export const pinchIntent = (prev, cur, other) => {
  const x = (cur.x + other.x) / 2;
  const y = (cur.y + other.y) / 2;
  const dx = x - (prev.x + other.x) / 2;
  const dy = y - (prev.y + other.y) / 2;
  const prevDist = Math.hypot(prev.x - other.x, prev.y - other.y) || 1;
  const dist = Math.hypot(cur.x - other.x, cur.y - other.y) || 1;
  return { dx, dy, x, y, scale: dist / prevDist, moved: Math.hypot(dx, dy) + Math.abs(dist - prevDist) };
};

/**
 * Whether a tap lands close enough, soon enough, after the last one.
 * @param {{ t: number, x: number, y: number } | null} last
 * @param {{ t: number, x: number, y: number }} tap
 * @returns {boolean}
 */
export const isDoubleTap = (last, tap) =>
  !!last && tap.t - last.t < DOUBLE_TAP_MS && Math.hypot(tap.x - last.x, tap.y - last.y) < DOUBLE_TAP_PX;

/**
 * The zoom change a wheel step asks for; a trackpad pinch arrives as a
 * ctrl-wheel with small deltas, so it zooms faster per unit.
 * @param {number} deltaY
 * @param {boolean} ctrlKey
 * @returns {number}
 */
export const wheelZoomDelta = (deltaY, ctrlKey) => -deltaY * (ctrlKey ? PINCH_WHEEL_ZOOM_RATE : WHEEL_ZOOM_RATE);
