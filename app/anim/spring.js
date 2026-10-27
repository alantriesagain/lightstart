/**
 * Damped springs, sampled. A spring here is not a runtime primitive: it is
 * SAMPLED (semi-implicit Euler, fixed dt) and emitted as a plain `{t, value}`
 * channel that a keyframe player replays with implicit linear easing;
 * deterministic, validator-clean, and editable like any other channel.
 *
 * For a spring that is integrated live against a game loop instead of baked
 * ahead of time, see `createSpring` in ./tween.js.
 */

/** @import { SpringConfig, KeyframePoint } from "./types.js" */

const DEFAULTS = {
  from: 0,
  to: 1,
  stiffness: 170,
  damping: 26,
  mass: 1,
  initialVelocity: 0,
  fps: 60,
  maxDurationMs: 10000,
};

/**
 * @param {number} v
 * @param {number} decimals
 * @returns {number}
 */
const round = (v, decimals) => {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
};

/**
 * Sample a damped spring from `from` to `to` until it settles (or
 * `maxDurationMs`). Returns dense `{t, value}` points at `1000/fps` ms steps,
 * with the final point clamped exactly to `to`.
 *
 * @param {SpringConfig} [config]
 * @returns {KeyframePoint[]}
 */
export const sampleSpring = (config = {}) => {
  const { from, to, stiffness, damping, mass, initialVelocity, fps, maxDurationMs } = { ...DEFAULTS, ...config };
  const amplitude = Math.max(Math.abs(to - from), Math.abs(initialVelocity) / 100, 1e-6);
  const restDisplacement = amplitude * 0.005;
  const restSpeed = amplitude * 0.05;
  const dt = 1 / Math.max(1, fps);
  const stepMs = 1000 * dt;

  let x = from;
  let v = initialVelocity;
  const points = [{ t: 0, value: round(from, 4) }];
  if (from === to && initialVelocity === 0) return points;

  for (let step = 1; step * stepMs <= maxDurationMs; step++) {
    const a = (-stiffness * (x - to) - damping * v) / mass;
    v += a * dt;
    x += v * dt;
    points.push({ t: Math.round(step * stepMs), value: round(x, 4) });
    if (Math.abs(x - to) < restDisplacement && Math.abs(v) < restSpeed) break;
  }

  points[points.length - 1] = { t: points[points.length - 1].t, value: round(to, 4) };
  return points;
};

/**
 * True when any point between anchors `a` and `k` strays further than
 * `tolerance` from the straight line joining them.
 *
 * @param {KeyframePoint[]} points
 * @param {number} a
 * @param {number} k
 * @param {number} tolerance
 * @returns {boolean}
 */
const deviates = (points, a, k, tolerance) => {
  const p0 = points[a];
  const p1 = points[k];
  const span = p1.t - p0.t || 1;
  for (let i = a + 1; i < k; i++) {
    const p = points[i];
    const lerped = p0.value + ((p.t - p0.t) / span) * (p1.value - p0.value);
    if (Math.abs(p.value - lerped) > tolerance) return true;
  }
  return false;
};

/**
 * Prune collinear points from a dense channel: any point reproducible by
 * linear interpolation of its kept neighbours (within `tolerance`) is dropped.
 * A typical spring bakes down to ~10–25 keyframes.
 *
 * @param {KeyframePoint[]} points
 * @param {number} tolerance
 * @returns {KeyframePoint[]}
 */
export const simplifyChannel = (points, tolerance) => {
  if (!Array.isArray(points) || points.length <= 2) return points || [];
  const out = [points[0]];
  let anchor = 0;
  for (let k = anchor + 2; k < points.length; k++)
    if (deviates(points, anchor, k, tolerance)) {
      out.push(points[k - 1]);
      anchor = k - 1;
      k = anchor + 1;
    }
  out.push(points[points.length - 1]);
  return out;
};

/**
 * Baked spring as a ready keyframe channel (sampled + simplified).
 *
 * @param {SpringConfig} [config]
 * @returns {KeyframePoint[]}
 */
export const springChannel = (config = {}) => {
  const dense = sampleSpring(config);
  const { from, to } = { ...DEFAULTS, ...config };
  const tolerance = Math.max(Math.abs(to - from), 1e-6) * 0.005;
  return simplifyChannel(dense, tolerance);
};

/**
 * Settle time of a spring in ms, for laying out clips around a baked spring.
 *
 * @param {SpringConfig} [config]
 * @returns {number}
 */
export const springDurationMs = (config = {}) => {
  const dense = sampleSpring(config);
  return dense[dense.length - 1].t;
};
