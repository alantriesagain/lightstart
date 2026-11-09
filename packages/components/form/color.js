/**
 * Hex colours as a form control holds them: `#rrggbb`, or `#rrggbbaa` when
 * the alpha is not 1. Pure, so a picker and a test agree on every edge.
 */

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Read any hex spelling. `hex` is the six-digit colour, lowercase with its
 * hash, or "" when the value is not a colour; `alpha` is 0 to 1 when the
 * value carried one, else null.
 * @param {unknown} value
 * @returns {{ hex: string, alpha: number | null }}
 */
export const parseHex = (value) => {
  const match = String(value ?? "").trim().match(HEX);
  if (!match) return { hex: "", alpha: null };
  let digits = match[1].toLowerCase();
  if (digits.length <= 4) digits = [...digits].map((d) => d + d).join("");
  const alpha = digits.length === 8 ? Math.round((parseInt(digits.slice(6), 16) / 255) * 1000) / 1000 : null;
  return { hex: `#${digits.slice(0, 6)}`, alpha };
};

/**
 * Write a colour back: the six digits, plus two for the alpha when the
 * control tracks alpha and it is below 1.
 * @param {string} hex
 * @param {number | null} alpha
 * @param {boolean} withAlpha
 */
export const formatHex = (hex, alpha, withAlpha) => {
  const { hex: base } = parseHex(hex);
  if (!base) return "";
  if (!withAlpha || alpha === null || alpha >= 1) return base;
  const clamped = Math.max(0, Math.min(1, alpha));
  return `${base}${Math.round(clamped * 255).toString(16).padStart(2, "0")}`;
};

/** @param {unknown} a @param {unknown} b */
export const sameColor = (a, b) => {
  const pa = parseHex(a);
  const pb = parseHex(b);
  return pa.hex !== "" && pa.hex === pb.hex && (pa.alpha ?? 1) === (pb.alpha ?? 1);
};
