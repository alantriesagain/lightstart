/**
 * @bootstrapp/light/components/utils/scale
 *
 * The arithmetic behind a chart's value axis: a round top for the scale, and a
 * short label for a tick.
 */

/** @type {[number, string][]} */
const UNITS = [
  [1e12, "T"],
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
];

/**
 * A number as a short label: 1200 is "1.2K", 3000000 is "3M", 42.5 is "42.5".
 * @param {number} value
 * @returns {string}
 */
export const compactNumber = (value) => {
  const abs = Math.abs(value);
  for (const [size, unit] of UNITS)
    if (abs >= size) return `${trim(value / size)}${unit}`;
  return trim(value);
};

/** @param {number} value */
const trim = (value) => String(Number(value.toFixed(Math.abs(value) >= 100 ? 0 : 1)));

/**
 * The smallest round number at or above `max` that `intervals` equal steps
 * divide into round steps (1, 2, 2.5 or 5 times a power of ten).
 * @param {number} max
 * @param {number} [intervals]
 * @returns {number}
 */
export const niceMax = (max, intervals = 4) => {
  if (!(max > 0)) return intervals;
  const raw = max / intervals;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw - 1e-9) ?? 10 * magnitude;
  return step * intervals;
};
