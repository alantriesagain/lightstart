/**
 * Value resolution: theme-scale hit → default scale → numeric spacing /
 * fraction → arbitrary `[...]` → typed arbitrary. Colour resolution walks the
 * nested colour map and applies `/opacity` modifiers via color-mix, which is
 * the only alpha form that survives var()-based tokens.
 */

import { parseArbitrary } from "./parse.js";
/** @import { ColorScale } from "./types.ts" */

const COLOR_SHAPE = /^(?:#[0-9a-f]{3,8}$|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|hwb\(|color-mix\(|color\(|var\()/i;
const COLOR_KEYWORDS = new Set(["transparent", "currentColor", "inherit"]);

/** @param {string} value */
export const looksLikeColor = (value) =>
  COLOR_SHAPE.test(value) || COLOR_KEYWORDS.has(value);

/** @param {string} value */
export const looksLikeColorShape = (value) => COLOR_SHAPE.test(value);

/** @param {string} value */
export const looksLikeLength = (value) =>
  /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|vh|vw|dvh|svh|lvh|dvw|svw|lvw|vmin|vmax|ch|ex|cm|mm|in|pt|pc|%)?$/.test(value) ||
  /^calc\(|^min\(|^max\(|^clamp\(/.test(value) ||
  value === "0";

/** @param {string} value */
const numberToSpacing = (value) => {
  if (!/^\d+(?:\.\d+)?$/.test(value)) return null;
  const n = Number(value);
  return n === 0 ? "0px" : `${n * 0.25}rem`;
};

/** @param {string} value */
const fractionToPercent = (value) => {
  const match = /^(\d+)\/(\d+)$/.exec(value);
  if (!match) return null;
  const pct = (Number(match[1]) / Number(match[2])) * 100;
  return `${Number(pct.toFixed(6))}%`;
};

/**
 * @param {string} rest the token remainder after the rule prefix
 * @param {Record<string, string>} [themeSpacing] named spacing entries
 * @param {{keywords?: Record<string, string>, fractions?: boolean, arbitraryTypes?: string[]}} [options]
 */
export const resolveSpacing = (rest, themeSpacing = {}, options = {}) => {
  const { keywords = {}, fractions = true, arbitraryTypes = ["length", "size", "percentage"] } = options;
  if (keywords[rest] !== undefined) return keywords[rest];
  if (themeSpacing[rest] !== undefined) return themeSpacing[rest];
  const numeric = numberToSpacing(rest);
  if (numeric !== null) return numeric;
  if (fractions) {
    const pct = fractionToPercent(rest);
    if (pct !== null) return pct;
  }
  const arb = parseArbitrary(rest);
  if (arb && (arb.type === null || arbitraryTypes.includes(arb.type)))
    return arb.type === null && looksLikeColorShape(arb.value) && !arb.value.startsWith("var(") ? null : arb.value;
  return null;
};

/**
 * @param {string} rest
 * @param {Record<string, string|string[]> | undefined} scale
 * @param {((value: string, type: string | null) => string | null) | null} arbitrary what an arbitrary value becomes, null to take it as written
 */
export const resolveLookup = (rest, scale, arbitrary) => {
  const table = scale === undefined ? {} : scale;
  if (table[rest] !== undefined) return table[rest];
  const arb = parseArbitrary(rest);
  if (arb) {
    if (arbitrary !== null) return arbitrary(arb.value, arb.type);
    return arb.value;
  }
  return null;
};

/**
 * The colour a scale entry stands for: a plain value, or the entry's `DEFAULT`.
 * @param {string | ColorScale} hit
 * @returns {string | null}
 */
const colorValue = (hit) => {
  if (typeof hit === "string") return hit;
  const fallback = hit.DEFAULT;
  return typeof fallback === "string" ? fallback : null;
};

/**
 * @param {ColorScale} colors
 * @param {string} stem
 * @returns {string | null}
 */
const walkColors = (colors, stem) => {
  if (colors[stem] !== undefined) return colorValue(colors[stem]);
  const parts = stem.split("-");
  for (let i = parts.length - 1; i > 0; i--) {
    const head = parts.slice(0, i).join("-");
    const tail = parts.slice(i).join("-");
    const group = colors[head];
    if (group && typeof group === "object" && group[tail] !== undefined)
      return colorValue(group[tail]);

  }
  return null;
};

/**
 * @param {string} value
 * @param {string | null | undefined} modifier
 */
export const withAlpha = (value, modifier) => {
  if (modifier == null) return value;
  const pct = /^\d+(?:\.\d+)?$/.test(modifier) ? `${modifier}%` : modifier;
  return `color-mix(in srgb, ${value} ${pct}, transparent)`;
};

/**
 * @param {string} stem colour name without the `/modifier`
 * @param {string|null} modifier the `/70` opacity part
 * @param {ColorScale} colors the merged colour map
 * @param {ColorScale} [extras] per-utility overrides (textColor / backgroundColor / borderColor)
 */
export const resolveColor = (stem, modifier, colors, extras = {}) => {
  const scoped = walkColors(extras, stem);
  const value = scoped !== null ? scoped : walkColors(colors, stem);
  if (value !== null) return withAlpha(value, modifier);
  const arb = parseArbitrary(stem);
  if (arb) {
    if (arb.type === "color") return withAlpha(arb.value, modifier);
    if (arb.type === null && looksLikeColor(arb.value)) return withAlpha(arb.value, modifier);
  }
  return null;
};

/**
 * Bare numbers on 0–100 scales (opacity-50, brightness-125) become their fraction.
 * @param {string} rest
 * @param {{ max?: number }} [options]
 */
export const resolvePercentNumber = (rest, options = {}) => {
  const max = options.max === undefined ? 100 : options.max;
  if (/^\d+(?:\.\d+)?$/.test(rest)) {
    const n = Number(rest);
    if (n <= max * 2) return String(n / 100);
  }
  const arb = parseArbitrary(rest);
  if (arb && (arb.type === null || arb.type === "number" || arb.type === "percentage")) return arb.value;
  return null;
};

/**
 * @param {string} rest
 * @param {{ keywords?: Record<string, string> }} [options]
 */
export const resolveInteger = (rest, options = {}) => {
  const keywords = options.keywords === undefined ? {} : options.keywords;
  if (keywords[rest] !== undefined) return keywords[rest];
  if (/^\d+$/.test(rest)) return rest;
  const arb = parseArbitrary(rest);
  if (arb && (arb.type === null || arb.type === "number")) return arb.value;
  return null;
};
