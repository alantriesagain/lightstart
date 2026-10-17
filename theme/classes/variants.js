/**
 * Variant composition. Prefixed variants collect ancestor selectors
 * (`dark:` → `:root.dark`, `group-hover:` → `.group:hover`), pseudo variants
 * append, breakpoints collect media queries. `dark:` deliberately diverges
 * from wind4: it targets the `:root.dark` class the theme system flips, so
 * one toggle drives both the token variables and the variant.
 */

import { arbitraryValue } from "./parse.js";

/** Identical in browser and Node (no CSS.escape dependency) so build and runtime emit byte-identical selectors. */
/** @param {string} cls */
export const escapeSelector = (cls) => {
  let out = "";
  for (let i = 0; i < cls.length; i++) {
    const ch = cls[i];
    if (i === 0 && /\d/.test(ch)) out += `\\3${ch} `;
    else if (/[a-zA-Z0-9_-]/.test(ch)) out += ch;
    else out += `\\${ch}`;
  }
  return out;
};

const PSEUDO_CLASSES = /** @type {Record<string, string>} */ ({
  hover: ":hover",
  focus: ":focus",
  "focus-within": ":focus-within",
  "focus-visible": ":focus-visible",
  active: ":active",
  visited: ":visited",
  target: ":target",
  first: ":first-child",
  last: ":last-child",
  only: ":only-child",
  odd: ":nth-child(odd)",
  even: ":nth-child(even)",
  "first-of-type": ":first-of-type",
  "last-of-type": ":last-of-type",
  "only-of-type": ":only-of-type",
  empty: ":empty",
  disabled: ":disabled",
  enabled: ":enabled",
  checked: ":checked",
  indeterminate: ":indeterminate",
  default: ":default",
  required: ":required",
  optional: ":optional",
  valid: ":valid",
  invalid: ":invalid",
  "in-range": ":in-range",
  "out-of-range": ":out-of-range",
  "placeholder-shown": ":placeholder-shown",
  autofill: ":autofill",
  "read-only": ":read-only",
  open: "[open]",
});

const PSEUDO_ELEMENTS = /** @type {Record<string, string>} */ ({
  before: "::before",
  after: "::after",
  placeholder: "::placeholder",
  file: "::file-selector-button",
  marker: "::marker",
  selection: "::selection",
  "first-line": "::first-line",
  "first-letter": "::first-letter",
  backdrop: "::backdrop",
});

const MEDIA_VARIANTS = /** @type {Record<string, [string, number]>} */ ({
  print: ["print", 300000],
  "motion-reduce": ["(prefers-reduced-motion: reduce)", 310000],
  "motion-safe": ["(prefers-reduced-motion: no-preference)", 310000],
  portrait: ["(orientation: portrait)", 320000],
  landscape: ["(orientation: landscape)", 320000],
  "contrast-more": ["(prefers-contrast: more)", 330000],
  "contrast-less": ["(prefers-contrast: less)", 330000],
});

/**
 * @param {Record<string, string>} screens
 * @returns {(variants: string[], className: string) => {selector: string, medias: string[], weight: number}|null}
 */
export const createVariantApplier = (screens) => {
  const screenWidth = (/** @type {string} */ name) => parseInt(screens[name], 10) || 0;

  return (variants, className) => {
    const prefixes = [];
    let suffix = "";
    const medias = [];
    let weight = 0;

    for (const variant of variants) {
      if (PSEUDO_CLASSES[variant] !== undefined) {
        suffix += PSEUDO_CLASSES[variant];
        continue;
      }
      if (PSEUDO_ELEMENTS[variant] !== undefined) {
        suffix += PSEUDO_ELEMENTS[variant];
        continue;
      }
      if (screens[variant] !== undefined) {
        medias.push(`(min-width: ${screens[variant]})`);
        weight = Math.max(weight, screenWidth(variant));
        continue;
      }
      if (variant.startsWith("max-") && screens[variant.slice(4)] !== undefined) {
        const name = variant.slice(4);
        medias.push(`(max-width: ${parseInt(screens[name], 10) - 0.02}px)`);
        weight = Math.max(weight, 100000 + (100000 - screenWidth(name)));
        continue;
      }
      if (MEDIA_VARIANTS[variant] !== undefined) {
        const [query, w] = MEDIA_VARIANTS[variant];
        medias.push(query);
        weight = Math.max(weight, w);
        continue;
      }
      if (variant === "dark") {
        prefixes.push(":root.dark");
        continue;
      }
      if (variant === "ltr" || variant === "rtl") {
        prefixes.push(`[dir="${variant}"]`);
        continue;
      }
      if (variant.startsWith("group-")) {
        const pseudo = PSEUDO_CLASSES[variant.slice(6)];
        if (pseudo === undefined) return null;
        prefixes.push(`.group${pseudo}`);
        continue;
      }
      if (variant.startsWith("peer-")) {
        const pseudo = PSEUDO_CLASSES[variant.slice(5)];
        if (pseudo === undefined) return null;
        prefixes.push(`.peer${pseudo} ~`);
        continue;
      }
      if (variant.startsWith("aria-")) {
        const rest = variant.slice(5);
        if (rest.startsWith("[") && rest.endsWith("]"))
          suffix += `[aria-${arbitraryValue(rest.slice(1, -1))}]`;
        else suffix += `[aria-${rest}="true"]`;
        continue;
      }
      if (variant.startsWith("data-")) {
        const rest = variant.slice(5);
        if (rest.startsWith("[") && rest.endsWith("]"))
          suffix += `[data-${arbitraryValue(rest.slice(1, -1))}]`;
        else suffix += `[data-${rest}]`;
        continue;
      }
      if (variant.startsWith("[") && variant.endsWith("]")) {
        const inner = arbitraryValue(variant.slice(1, -1));
        if (!inner.includes("&")) return null;
        const base = `.${escapeSelector(className)}${suffix}`;
        const substituted = inner.replaceAll("&", base);
        return { selector: prefixes.length ? `${prefixes.join(" ")} ${substituted}` : substituted, medias, weight };
      }
      return null;
    }

    const base = `.${escapeSelector(className)}${suffix}`;
    const selector = prefixes.length ? `${prefixes.join(" ")} ${base}` : base;
    return { selector, medias, weight };
  };
};
