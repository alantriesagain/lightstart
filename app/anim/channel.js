/**
 * Keyframe-channel math: cubic-bezier timing (CSS easing semantics) and
 * interpolation over `{t, value, easing?, bezier?}` channels, the same
 * channel shape `springChannel` emits.
 */
import { ease } from "./easing.js";

/**
 * Cubic-bezier timing function: returns `y` for a given progress `x` (0..1),
 * solving x(t)=x via Newton-Raphson with a bisection guard (CSS easing math).
 * @param {number} p1x @param {number} p1y @param {number} p2x @param {number} p2y
 */
export const cubicBezier = (p1x, p1y, p2x, p2y) => {
  const A = (/** @type {number} */ a, /** @type {number} */ b) => 1 - 3 * b + 3 * a;
  const B = (/** @type {number} */ a, /** @type {number} */ b) => 3 * b - 6 * a;
  const C = (/** @type {number} */ a) => 3 * a;
  const calc = (/** @type {number} */ t, /** @type {number} */ a, /** @type {number} */ b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
  const slope = (/** @type {number} */ t, /** @type {number} */ a, /** @type {number} */ b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
  return (/** @type {number} */ x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const xErr = calc(t, p1x, p2x) - x;
      if (Math.abs(xErr) < 1e-5) break;
      const d = slope(t, p1x, p2x);
      if (Math.abs(d) < 1e-6) break;
      t -= xErr / d;
    }
    let lo = 0, hi = 1, mt = t;
    while (Math.abs(calc(mt, p1x, p2x) - x) > 1e-5 && hi - lo > 1e-6) {
      if (calc(mt, p1x, p2x) < x) lo = mt; else hi = mt;
      mt = (lo + hi) / 2;
    }
    return calc(Math.max(0, Math.min(1, mt)), p1y, p2y);
  };
};

/**
 * Interpolate a single channel (array of `{t, value, easing?, bezier?}`, t ascending) at time `t`.
 * Clamps to the first/last value outside the range. Returns `undefined` for an empty channel.
 * @param {Array<{t:number,value:number,easing?:string,bezier?:number[]}>} channel @param {number} t
 */
export const interpChannel = (channel, t) => {
  if (!channel?.length) return undefined;
  if (t <= channel[0].t) return channel[0].value;
  const last = channel[channel.length - 1];
  if (t >= last.t) return last.value;
  let i = 0;
  while (i < channel.length - 1 && channel[i + 1].t <= t) i++;
  const k0 = channel[i], k1 = channel[i + 1];
  const span = k1.t - k0.t;
  if (span <= 0) return k1.value;
  const p = (t - k0.t) / span;
  const eased = Array.isArray(k0.bezier) && k0.bezier.length === 4
    ? cubicBezier(k0.bezier[0], k0.bezier[1], k0.bezier[2], k0.bezier[3])(p)
    : ease(k0.easing || "linear", p);
  return k0.value + (k1.value - k0.value) * eased;
};
