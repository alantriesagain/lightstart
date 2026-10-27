/**
 * Easing functions: signature (t: 0..1) => 0..1 (mostly).
 * Back/bounce/elastic may overshoot [0,1] briefly; that's the point.
 */

/** @import { EasingFn } from "./types.js" */

/** @type {EasingFn} */
export const linear = (t) => t;

/** @type {EasingFn} */
export const easeIn = (t) => t * t;
/** @type {EasingFn} */
export const easeOut = (t) => 1 - (1 - t) * (1 - t);
/** @type {EasingFn} */
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const C1 = 1.70158;
const C2 = C1 * 1.525;
const C3 = C1 + 1;
const C4 = (2 * Math.PI) / 3;
const N1 = 7.5625;
const D1 = 2.75;

/** @type {EasingFn} */
export const easeInBack = (t) => C3 * t * t * t - C1 * t * t;
/** @type {EasingFn} */
export const easeOutBack = (t) => 1 + C3 * Math.pow(t - 1, 3) + C1 * Math.pow(t - 1, 2);
/** @type {EasingFn} */
export const easeInOutBack = (t) =>
  t < 0.5
    ? (Math.pow(2 * t, 2) * ((C2 + 1) * 2 * t - C2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((C2 + 1) * (t * 2 - 2) + C2) + 2) / 2;

/** @type {EasingFn} */
export const easeOutBounce = (t) => {
  if (t < 1 / D1) return N1 * t * t;
  if (t < 2 / D1) return N1 * (t -= 1.5 / D1) * t + 0.75;
  if (t < 2.5 / D1) return N1 * (t -= 2.25 / D1) * t + 0.9375;
  return N1 * (t -= 2.625 / D1) * t + 0.984375;
};
/** @type {EasingFn} */
export const easeInBounce = (t) => 1 - easeOutBounce(1 - t);

/** @type {EasingFn} */
export const easeOutElastic = (t) => {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * C4) + 1;
};

/** @type {Record<string, EasingFn>} */
export const EASINGS = {
  linear,
  easeIn,
  easeOut,
  easeInOut,
  easeInBack,
  easeOutBack,
  easeInOutBack,
  easeOutBounce,
  easeInBounce,
  easeOutElastic,
};

/** Names of every registered easing: the canonical list for validators and pickers. */
export const EASING_NAMES = Object.keys(EASINGS);

/**
 * Apply a named easing, falling back to `easeInOut` for unknown names.
 *
 * @param {string | undefined} name
 * @param {number} t
 * @returns {number}
 */
export const ease = (name, t) => (EASINGS[name ?? ""] || easeInOut)(t);
