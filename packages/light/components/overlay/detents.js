/**
 * @bootstrapp/light/components/overlay/detents
 *
 * The stop arithmetic a draggable sheet needs, as pure functions of numbers:
 * where each named stop sits, which one a release belongs to, how fast the
 * finger was going, and how far past a bound the sheet is allowed to stretch.
 * No DOM and no `$APP`, so `anim-drag-panel` and `lc-bottom-sheet` answer these
 * questions the same way and `node --test` can ask them directly.
 */

/** @import { DetentName, DetentStops } from "../types.ts" */

export const DISMISS_ZONE_PX = 24;
export const RUBBER_PX = 64;

/**
 * Pixel offsets (translateY from fully open) for each named stop.
 * @param {{ height: number, halfPx: number, peekPx: number }} arg
 * @returns {DetentStops}
 */
export const resolveStops = ({ height, halfPx, peekPx }) => ({
  full: 0,
  half: Math.max(0, height - halfPx),
  closed: Math.max(0, height - peekPx),
});

/**
 * The stop label nearest to a y offset; `closed` only inside the dismiss zone.
 * @param {DetentStops} stops
 * @param {number} y
 * @returns {DetentName}
 */
export const classify = (stops, y) => {
  if (y >= stops.closed - DISMISS_ZONE_PX) return "closed";
  /** @type {[DetentName, number][]} */
  const near = [["full", stops.full], ["half", stops.half]];
  const [label] = near.reduce((a, b) => (Math.abs(b[1] - y) < Math.abs(a[1] - y) ? b : a));
  return label;
};

/**
 * Average release velocity (px/ms) over the most recent 100ms of samples.
 * @param {{ t: number, y: number }[]} samples
 * @param {number} now
 */
export const releaseVelocity = (samples, now) => {
  const recent = samples.filter((s) => now - s.t < 100);
  if (recent.length < 2) return 0;
  const dt = recent[recent.length - 1].t - recent[0].t;
  if (dt < 20) return 0;
  return (recent[recent.length - 1].y - recent[0].y) / dt;
};

/**
 * Asymptotic overshoot damping: full drags past a bound compress into ~RUBBER_PX.
 * @param {number} overshoot
 */
export const rubber = (overshoot) => RUBBER_PX * (1 - 1 / (overshoot / RUBBER_PX + 1));
