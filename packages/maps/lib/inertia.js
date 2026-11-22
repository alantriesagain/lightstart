/**
 * Fling physics for a released drag: the pointer's recent samples become a
 * velocity in screen pixels per millisecond, which decays frame by frame
 * until it is too slow to see.
 */

/** @import { MapVelocity, VelocitySample } from "../types.ts" */

export const MAX_SAMPLES = 12;
export const SAMPLE_WINDOW_MS = 100;
export const MIN_SPAN_MS = 20;
export const MIN_RELEASE_SPEED = 0.05;
export const STOP_SPEED = 0.01;
export const DAMPING = 0.94;
export const FRAME_MS = 16.7;

/**
 * Records a pointer step, keeping the last `MAX_SAMPLES`.
 * @param {VelocitySample[]} samples
 * @param {VelocitySample} sample
 * @returns {VelocitySample[]}
 */
export const pushSample = (samples, sample) => {
  samples.push(sample);
  while (samples.length > MAX_SAMPLES) samples.shift();
  return samples;
};

/**
 * The velocity a drag releases with: its travel over the last
 * `SAMPLE_WINDOW_MS`, or null when that span is too short or too slow.
 * @param {VelocitySample[]} samples
 * @param {number} now
 * @returns {MapVelocity | null}
 */
export const releaseVelocity = (samples, now) => {
  let first = -1;
  let dx = 0;
  let dy = 0;
  for (const s of samples)
    if (now - s.t < SAMPLE_WINDOW_MS) {
      if (first < 0) first = s.t;
      dx += s.dx;
      dy += s.dy;
    }
  const span = first < 0 ? 0 : now - first;
  if (span <= MIN_SPAN_MS) return null;
  const vx = dx / span;
  const vy = dy / span;
  return Math.hypot(vx, vy) > MIN_RELEASE_SPEED ? { vx, vy } : null;
};

/**
 * The velocity one frame later, or null once it stops.
 * @param {MapVelocity} velocity
 * @param {number} dt
 * @returns {MapVelocity | null}
 */
export const stepInertia = (velocity, dt) => {
  const damp = DAMPING ** (dt / FRAME_MS);
  const vx = velocity.vx * damp;
  const vy = velocity.vy * damp;
  return Math.hypot(vx, vy) < STOP_SPEED ? null : { vx, vy };
};
