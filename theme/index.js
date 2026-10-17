/**
 * @file @bootstrapp/light/theme
 * Design tokens from a theme object: the color math that derives shades,
 * readable "on" colors and a dark side, the CSS variables a theme becomes,
 * and applying them to the document, to one region, or as a stylesheet
 * string for a build. Fonts a theme names are requested through
 * `configureTheme({ requestFont })`, Google Fonts by default. The color math
 * and the variables themselves are `tokens.ts`, which touches no document.
 */
import { HSL, SHADE_SUFFIXES, adjustLightness, deepMerge, generateDarkTheme, generateShades, generateThemeVariables, hslToCSS, isDarkBase, mixWithColor, parseColor, rgbToHSL } from "./tokens.ts";

/** @import { FontValue, ThemeData } from "./types.ts" */

const config = {
  /** @type {(googleName: string) => void} */
  requestFont: (googleName) => {
    const href = googleFontsUrl(googleName);
    if (href) loadCSS(href);
  },
};

/**
 * Hand the theme engine what its host knows: `requestFont(name)` is called
 * once per font family a theme names (a build that bundled its fonts passes a
 * no-op).
 * @param {Partial<typeof config>} options
 */
export const configureTheme = (options) => {
  Object.assign(config, options);
};

/** @type {Set<string>} */
const loadedFonts = new Set();
/** @type {Set<string>} */
const loadedCSSFiles = new Set();

/**
 * Link a stylesheet into the head once.
 * @param {string} href
 * @param {boolean} [prepend] put it first, under every other stylesheet
 */
const loadCSS = (href, prepend = false) => {
  if (loadedCSSFiles.has(href))
    return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;

  if (prepend)
    document.head.prepend(link);
   else
    document.head.appendChild(link);

  loadedCSSFiles.add(href);
};

const CSS_FONT_KEYWORDS = new Set([
  "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "ui-rounded",
  "serif", "sans-serif", "monospace", "cursive", "fantasy", "math",
  "inherit", "initial", "unset", "revert", "revert-layer",
]);

/**
 * @param {FontValue | undefined} fontValue
 * @returns {string | null}
 */
const resolveGoogleFontName = (fontValue) => {
  if (!fontValue) return null;
  if (typeof fontValue === "object") {
    if (fontValue.google === false) return null;
    if (typeof fontValue.google === "string") return fontValue.google;
    return resolveGoogleFontName(fontValue.family);
  }
  if (typeof fontValue !== "string") return null;
  const trimmed = fontValue.trim();
  if (!trimmed) return null;
  if (trimmed.includes(",")) return null;
  const noQuotes = trimmed.replace(/^['"]|['"]$/g, "").trim();
  if (CSS_FONT_KEYWORDS.has(noQuotes.toLowerCase())) return null;
  return noQuotes;
};

/**
 * The CSS `font-family` value a theme font becomes.
 * @param {FontValue} fontValue
 * @returns {string}
 */
const cssFamilyFor = (fontValue) => {
  if (typeof fontValue === "object" && typeof fontValue.family === "string")
    return fontValue.family;
  if (typeof fontValue !== "string") return "";
  return fontValue.includes(",") ? fontValue : `'${fontValue}', sans-serif`;
};

/**
 * The Google Fonts stylesheet for one or more families, or null for none.
 * The weight range covers every `font.*` step a theme can name.
 *
 * @param {FontValue | FontValue[]} families
 * @returns {string | null}
 */
const googleFontsUrl = (families) => {
  const names = (Array.isArray(families) ? families : [families])
    .map((name) => resolveGoogleFontName(name))
    .filter((name) => typeof name === "string" && name.length > 0)
    .map((name) => /** @type {string} */ (name));
  if (!names.length) return null;
  const query = names
    .map((name) => `family=${encodeURIComponent(name).replace(/%20/g, "+")}:wght@300;400;500;600;700;800;900`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
};

/**
 * Set a font variable (`--font-family-base` also sets the body face) and
 * request the family once.
 * @param {FontValue | undefined} fontValue
 * @param {string} [varName]
 */
const loadFont = (fontValue, varName = "font-family-base") => {
  if (!fontValue) return;

  const googleName = resolveGoogleFontName(fontValue);
  if (googleName && !loadedFonts.has(googleName)) {
    loadedFonts.add(googleName);
    config.requestFont(googleName);
  }

  const styleId = `theme-font-${varName}`;
  let styleTag = document.getElementById(styleId);

  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = styleId;
    document.head.appendChild(styleTag);
  }

  const fontValueCss = cssFamilyFor(fontValue);

  if (varName === "font-family-base")
    styleTag.textContent = `
      :root { --font-family-base: ${fontValueCss}; }
      body { font-family: var(--font-family-base); }
    `;
   else
    styleTag.textContent = `:root { --${varName}: ${fontValueCss}; }`;

};

const VARIANT_PROPS = [
  "background",
  "color",
  "border-color",
  "hover-background",
  "hover-color",
  "hover-border-color",
  "active-background",
];

const VARIANT_STATES = ["hover", "active", "focus", "disabled"];

/**
 * A variant exists because the theme names it. `lc.button["quiet-background"]`
 * declares a `quiet` button, and this is the rule that binds it:
 * `lc-button[variant="quiet"]` pointing `--lc-button-background` at
 * `--lc-button-quiet-background`.
 *
 * Only the properties the theme actually declared are bound, so a variant the
 * component already styles keeps whatever it does not mention.
 *
 * @param {Record<string, string>} variables flattened theme variables
 * @param {string[]} [components]
 * @returns {string} CSS, one rule per declared variant
 */
const generateVariantRules = (variables, components = ["button"]) => {
  const found = new Map();
  for (const component of components)
    for (const key of Object.keys(variables)) {
      const variant = new RegExp(`^--lc-${component}-(.+)-background$`).exec(key)?.[1];
      if (!variant) continue;
      if (VARIANT_STATES.some((state) => variant.endsWith(`-${state}`))) continue;
      found.set(`${component}|${variant}`, { component, variant });
    }

  const rules = [];
  for (const key of Object.keys(variables)) {
    const name = /^--color-([a-z0-9-]+)$/.exec(key)?.[1];
    if (!name || name.startsWith("on-")) continue;
    if (SHADE_SUFFIXES.some((shade) => name.endsWith(`-${shade}`))) continue;
    if (variables[`--color-on-${name}`] === undefined) continue;
    for (const component of components)
      rules.push(
        `lc-${component}[variant="${name}"] {\n` +
        `  --lc-${component}-background: var(--color-${name});\n` +
        `  --lc-${component}-color: var(--color-on-${name});\n` +
        `  --lc-${component}-hover-background: var(--color-${name}-dark, var(--color-${name}));\n` +
        `}`,
      );
  }

  for (const { component, variant } of found.values()) {
    const declarations = VARIANT_PROPS
      .filter((prop) => variables[`--lc-${component}-${variant}-${prop}`] !== undefined)
      .map((prop) => `  --lc-${component}-${prop}: var(--lc-${component}-${variant}-${prop});`);
    if (declarations.length)
      rules.push(`lc-${component}[variant="${variant}"] {\n${declarations.join("\n")}\n}`);
  }
  return rules.join("\n");
};

/** @param {string} css @param {string} [styleId] */
const injectVariantRules = (css, styleId = "lc-variant-rules") => {
  if (!css) return;
  let styleTag = document.getElementById(styleId);
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = styleId;
    document.head.appendChild(styleTag);
  }
  styleTag.textContent = css;
};

/**
 * Write variables as one rule into a style element of their own.
 * @param {Record<string, string>} variables
 * @param {string} [styleId]
 * @param {string} [selector]
 */
const injectThemeCSS = (
  variables,
  styleId = "dynamic-theme-vars",
  selector = ":root",
) => {
  let styleTag = document.getElementById(styleId);

  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = styleId;
    document.head.appendChild(styleTag);
  }

  const cssRules = Object.entries(variables)
    .map(([key, val]) => `${key}: ${val};`)
    .join("\n  ");

  styleTag.textContent = `${selector} {\n  ${cssRules}\n}`;
};

/**
 * The faces a theme names. Only a project's own theme used to reach `loadFont`,
 * so a preset applied by name rendered in the browser's default serif.
 *
 * @param {ThemeData} theme
 */
const applyThemeFonts = (theme) => {
  const font = theme?.font;
  if (font?.family) loadFont(font.family, "font-family-base");
  if (font?.heading) loadFont(font.heading, "font-heading");
};

/**
 * The dark side on `:root.dark`: derived from the light theme, with the
 * theme's own dark block laid over it.
 * @param {ThemeData} lightTheme
 * @param {ThemeData} [explicitDark]
 */
const applyDarkTheme = (lightTheme, explicitDark) => {
  const hasExplicit = explicitDark && Object.keys(explicitDark).length > 0;
  if (!hasExplicit && isDarkBase(lightTheme)) return void document.getElementById("dark-theme-vars")?.remove();
  const auto = generateDarkTheme(lightTheme);
  const dark = hasExplicit ? deepMerge(auto, explicitDark) : auto;
  injectThemeCSS(generateThemeVariables(dark), "dark-theme-vars", ":root.dark");
};

/**
 * Apply a theme to the document: variables on `:root`, variant rules, the
 * dark side and fonts.
 * @param {ThemeData | null | undefined} themeData
 */
const applyTheme = (themeData) => {
  const { dark: explicitDark, ...lightTheme } = themeData || {};
  const variables = generateThemeVariables(lightTheme);
  injectThemeCSS(variables);
  injectVariantRules(generateVariantRules(variables));
  applyDarkTheme(lightTheme, explicitDark);
  applyThemeFonts(lightTheme);
};

/** @param {string} scope */
const scopedStyleId = (scope) => `scoped-theme-${scope.replace(/\W/g, "-")}`;

/**
 * A theme's variables on a region instead of the document.
 * @param {string} scope any CSS selector
 * @param {ThemeData} themeData
 * @param {string} [styleId]
 */
const applyScopedTheme = (scope, themeData, styleId) => {
  const cssVars = generateThemeVariables(themeData);
  injectThemeCSS(cssVars, styleId || scopedStyleId(scope), scope);
};

/**
 * Drop a scoped palette, leaving the elements under `scope` on the document's
 * own theme again. Takes whatever identified the scope when it was applied: the
 * same selector, or the same explicit `styleId`.
 *
 * @param {string} scope
 * @param {string} [styleId]
 */
const clearScopedTheme = (scope, styleId) => {
  document.getElementById(styleId || scopedStyleId(scope))?.remove();
};

/**
 * The dark palette on a region instead of the whole document, for a screen that
 * is dark whatever the reader chose: a media player, a viewer, a camera.
 *
 * Takes the same object as `applyTheme` and derives the dark side the same way,
 * so a region gets every token, not just the ones the theme spelled out. The
 * variables land on the scope element and descendants inherit from there, which
 * is nearer than `:root` and therefore wins without any specificity contest.
 *
 * @param {string} scope any CSS selector, e.g. `"my-player, my-viewer"`
 * @param {ThemeData | null | undefined} themeData the whole theme, `dark` block included
 * @param {string} [styleId]
 */
const applyScopedDarkTheme = (scope, themeData, styleId) => {
  const { dark: explicitDark, ...lightTheme } = themeData || {};
  const auto = generateDarkTheme(lightTheme);
  const dark = explicitDark && Object.keys(explicitDark).length ? deepMerge(auto, explicitDark) : auto;
  applyScopedTheme(scope, dark, styleId || `scoped-dark-${scope.replace(/\W/g, "-")}`);
};

/**
 * A theme as one stylesheet: its variables on `:root`, the variant rules, and
 * the dark side on `:root.dark` (derived unless the theme spells it out, and
 * skipped for a theme that is dark already). `overrides` is a partial theme
 * laid over it, a `dark` block included.
 * @param {ThemeData | null} themeData
 * @param {ThemeData} [overrides]
 * @returns {string}
 */
export const themeCSS = (themeData, overrides) => {
  const { dark: themeDark, ...lightTheme } = themeData || {};
  let explicitDark = themeDark;
  /** @type {Record<string, string>} */
  const lightVars = themeData ? generateThemeVariables(lightTheme) : {};

  if (overrides) {
    const { dark: overrideDark, ...lightOverrides } = overrides;
    Object.assign(lightVars, generateThemeVariables(lightOverrides));
    if (overrideDark && !explicitDark) explicitDark = overrideDark;
  }

  const font = /** @type {{ family?: FontValue, heading?: FontValue } | undefined} */ (themeData?.font || overrides?.font);
  if (font?.family) lightVars["--font-family-base"] = cssFamilyFor(font.family);
  if (font?.heading) lightVars["--font-heading"] = cssFamilyFor(font.heading);

  if (Object.keys(lightVars).length === 0) return "";

  /** @param {Record<string, string>} vars */
  const toRules = (vars) =>
    Object.entries(vars)
      .map(([key, val]) => `${key}: ${val};`)
      .join("\n  ");

  let css = `:root {\n  ${toRules(lightVars)}\n}`;

  const variantRules = generateVariantRules(lightVars);
  if (variantRules) css += `\n${variantRules}`;

  if (themeData && (explicitDark || !isDarkBase(lightTheme))) {
    const auto = generateDarkTheme(lightTheme);
    const dark = explicitDark ? deepMerge(auto, explicitDark) : auto;
    css += `\n:root.dark {\n  ${toRules(generateThemeVariables(dark))}\n}`;
  }

  return css;
};

export {
  HSL,
  parseColor,
  generateShades,
  generateThemeVariables,
  generateVariantRules,
  generateDarkTheme,
  injectThemeCSS,
  applyTheme,
  applyDarkTheme,
  applyScopedTheme,
  applyScopedDarkTheme,
  clearScopedTheme,
  loadCSS,
  loadFont,
  googleFontsUrl,
  cssFamilyFor,
  rgbToHSL,
  hslToCSS,
  adjustLightness,
  mixWithColor,
};
