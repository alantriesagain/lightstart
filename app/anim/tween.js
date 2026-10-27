/**
 * Runtime animation: dt-driven tweens, timelines and live springs. The
 * counterpart to ./spring.js: that module BAKES motion ahead of time into a
 * keyframe channel; this one INTEGRATES it as the clock advances.
 *
 * Nothing here schedules itself. Every primitive is stepped by its owner (a
 * game loop, a test, a render tick) with a delta in milliseconds, so the whole
 * module is deterministic and node-safe.
 */

/** @import { EasingName, Tween, TweenConfig, Timeline, LiveSpring, LiveSpringConfig } from "./types.js" */

import { ease } from "./easing.js";

/** @param {number} v */
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * A one-shot interpolation from `from` to `to` over `ms`.
 *
 * @param {TweenConfig} config
 * @returns {Tween}
 */
export const createTween = ({ from = 0, to = 1, ms = 300, easing = "easeInOut", delay = 0, onUpdate, onComplete } = {}) => {
  const span = Math.max(0, ms);
  let elapsed = 0;
  let done = false;
  let cancelled = false;

  /** @param {number} t */
  const valueAt = (t) => from + (to - from) * ease(easing, t);

  const tween = {
    value: from,
    get done() {
      return done || cancelled;
    },
    get elapsed() {
      return elapsed;
    },
    get progress() {
      return span === 0 ? 1 : clamp01((elapsed - delay) / span);
    },

    /** @param {number} dtMs */
    step(dtMs) {
      if (done || cancelled) return tween.value;
      elapsed += dtMs;
      if (elapsed < delay) return tween.value;

      const t = span === 0 ? 1 : clamp01((elapsed - delay) / span);
      tween.value = t >= 1 ? to : valueAt(t);
      onUpdate?.(tween.value, t);

      if (t >= 1) {
        done = true;
        onComplete?.(tween.value);
      }
      return tween.value;
    },

    cancel() {
      cancelled = true;
    },

    reset() {
      elapsed = 0;
      done = false;
      cancelled = false;
      tween.value = from;
      return tween;
    },
  };

  return tween;
};

/**
 * An ordered set of tweens on one clock. Each entry starts at its own offset,
 * so `add(t, 500)` runs `t` half a second into the timeline.
 *
 * @returns {Timeline}
 */
export const createTimeline = () => {
  /** @type {{ tween: Tween, at: number, started: boolean }[]} */
  const entries = [];
  let elapsed = 0;

  const timeline = {
    get elapsed() {
      return elapsed;
    },
    get done() {
      return entries.every((e) => e.started && e.tween.done);
    },

    /**
     * @param {Tween} tween
     * @param {number} [at] ms offset from the timeline's start
     */
    add(tween, at = 0) {
      entries.push({ tween, at, started: false });
      return timeline;
    },

    /** @param {number} dtMs */
    step(dtMs) {
      elapsed += dtMs;
      for (const entry of entries) {
        if (elapsed < entry.at) continue;
        if (!entry.started) {
          entry.started = true;
          entry.tween.step(elapsed - entry.at);
          continue;
        }
        entry.tween.step(dtMs);
      }
      return timeline;
    },

    cancel() {
      for (const entry of entries) entry.tween.cancel();
    },

    reset() {
      elapsed = 0;
      for (const entry of entries) {
        entry.started = false;
        entry.tween.reset();
      }
      return timeline;
    },
  };

  return timeline;
};

const SUBSTEP_MS = 1000 / 240;

/**
 * A spring integrated live, with a target that can be moved at any time:
 * the primitive for camera follow, UI that chases a value, and anything that
 * has to react to input mid-flight (which a baked channel cannot do).
 *
 * Integration is sub-stepped at a fixed 240Hz so a dropped frame can't blow
 * the spring up.
 *
 * @param {LiveSpringConfig} config
 * @returns {LiveSpring}
 */
export const createSpring = ({ value = 0, target, stiffness = 170, damping = 26, mass = 1, velocity = 0 } = {}) => {
  let x = value;
  let v = velocity;
  let goal = target ?? value;

  const spring = {
    get value() {
      return x;
    },
    get velocity() {
      return v;
    },
    get target() {
      return goal;
    },
    get atRest() {
      const amplitude = Math.max(Math.abs(goal - x), 1e-6);
      return Math.abs(x - goal) < amplitude * 0.005 && Math.abs(v) < amplitude * 0.05;
    },

    /**
     * Move the goal without disturbing current position or velocity.
     * @param {number} next
     */
    setTarget(next) {
      goal = next;
      return spring;
    },

    /**
     * Jump to a value, killing velocity. For teleports and resets.
     * @param {number} next
     */
    snap(next) {
      x = next;
      goal = next;
      v = 0;
      return spring;
    },

    /** @param {number} dtMs */
    step(dtMs) {
      let remaining = Math.max(0, dtMs);
      while (remaining > 0) {
        const stepMs = Math.min(SUBSTEP_MS, remaining);
        const dt = stepMs / 1000;
        const a = (-stiffness * (x - goal) - damping * v) / mass;
        v += a * dt;
        x += v * dt;
        remaining -= stepMs;
      }
      return x;
    },
  };

  return spring;
};
