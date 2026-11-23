/**
 * The stop tables a body prints, in thirds, and the arithmetic between them:
 * how many stops of light one setting gives over another, the nearest printed
 * stop to a value, and each value in a body's words.
 */

export const SHUTTER_THIRDS = [30, 25, 20, 15, 13, 10, 8, 6, 5, 4, 3.2, 2.5, 2, 1.6, 1.3, 1, 0.8, 0.6, 0.5, 0.4, 0.3, 1 / 4, 1 / 5, 1 / 6, 1 / 8, 1 / 10, 1 / 13, 1 / 15, 1 / 20, 1 / 25, 1 / 30, 1 / 40, 1 / 50, 1 / 60, 1 / 80, 1 / 100, 1 / 125, 1 / 160, 1 / 200, 1 / 250, 1 / 320, 1 / 400, 1 / 500, 1 / 640, 1 / 800, 1 / 1000, 1 / 1250, 1 / 1600, 1 / 2000, 1 / 2500, 1 / 3200, 1 / 4000, 1 / 5000, 1 / 6400, 1 / 8000];
export const APERTURE_THIRDS = [1, 1.1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22];
export const ISO_THIRDS = [100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000, 10000, 12800, 16000, 20000, 25600];
export const EV_THIRDS = [-3, -2.67, -2.33, -2, -1.67, -1.33, -1, -0.67, -0.33, 0, 0.33, 0.67, 1, 1.33, 1.67, 2, 2.33, 2.67, 3];

export const BASE_ISO = 100;

/**
 * Stops of light `b` gives over `a`, positive when `b` lets more in: a longer
 * shutter, a higher ISO, a wider aperture (a smaller f-number).
 * @param {"shutter" | "iso" | "aperture"} kind
 * @param {number} a
 * @param {number} b
 */
export const stopsBetween = (kind, a, b) => {
  if (!(a > 0) || !(b > 0)) return 0;
  if (kind === "aperture") return 2 * Math.log2(a / b);
  return Math.log2(b / a);
};

/**
 * The index of the printed stop nearest a value, measured in stops, so a
 * shutter of 0.0167 s lands on 1/60 and not its neighbour.
 * @param {number[]} table
 * @param {number} value
 */
export const nearestStop = (table, value) => {
  if (!(value > 0)) return -1;
  let best = 0;
  let bestD = Infinity;
  table.forEach((stop, i) => {
    const d = Math.abs(Math.log2(stop / value));
    if (d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
};

/**
 * The part of a table a camera can reach.
 * @param {number[]} table
 * @param {{ min?: number, max?: number } | null | undefined} range
 */
export const clipStops = (table, range) => (range ? table.filter((v) => (range.min == null || v >= range.min) && (range.max == null || v <= range.max)) : table);

/** @param {number} seconds */
export const formatShutter = (seconds) => {
  if (!(seconds > 0)) return "--";
  if (seconds >= 1) return `${Number(seconds.toFixed(1))}"`;
  if (seconds >= 0.3) return `0"${Math.round(seconds * 10)}`;
  return `1/${Math.round(1 / seconds)}`;
};

/** @param {number} f */
export const formatAperture = (f) => (f > 0 ? `f/${Number(f.toFixed(1))}` : "--");

/** @param {number | "auto" | null | undefined} iso */
export const formatIso = (iso) => (iso === "auto" ? "A" : typeof iso === "number" && iso > 0 ? String(Math.round(iso)) : "--");

/** @param {number | null | undefined} ev */
export const formatEv = (ev) => {
  if (typeof ev !== "number") return "--";
  if (Math.abs(ev) < 0.17) return "±0";
  const thirds = Math.round(Math.abs(ev) * 3);
  const whole = Math.floor(thirds / 3);
  const rest = thirds % 3;
  const frac = rest === 1 ? "⅓" : rest === 2 ? "⅔" : "";
  return `${ev > 0 ? "+" : "−"}${whole || !frac ? whole : ""}${frac}`;
};

/** A count of stops as a body says it: "a third of a stop", "two stops". */
/** @param {number} stops */
export const sayStops = (stops) => {
  const n = Math.abs(stops);
  const thirds = Math.round(n * 3);
  if (thirds === 0) return "no stops";
  if (thirds === 1) return "a third of a stop";
  if (thirds === 2) return "two thirds of a stop";
  const whole = Math.floor(thirds / 3);
  const rest = thirds % 3;
  const words = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const w = words[whole] ?? String(whole);
  const frac = rest === 1 ? " and a third" : rest === 2 ? " and two thirds" : "";
  return `${w}${frac} ${whole === 1 && !rest ? "stop" : "stops"}`;
};
