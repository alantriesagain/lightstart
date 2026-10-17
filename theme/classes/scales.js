/**
 * The one canonical theme: Tailwind's default scales, the framework token
 * colours, and `buildTheme(projectTheme)`, which turns a
 * project's `theme.js` groups into utility scales. Every token utility points
 * at the CSS variable, never the value, so `:root.dark` reassignment flows
 * through and dark mode still answers.
 */

const COLOR_VALUE = /^(?:#|rgba?\(|hsla?\(|oklch\(|oklab\(|color-mix\(|var\()/i;

/** A theme group mixes colours with sizes and weights; only the colours become utilities. */
/** @param {unknown} value */
export const isColorValue = (value) =>
  typeof value === "string" && COLOR_VALUE.test(value.trim());

/**
 * The colour map a project's own theme earns.
 *
 * `generateThemeVariables` flattens `theme.js` into `--color-<key>` and
 * `--text-<key>`, so every key a project declares already has a custom property
 *: it just had no class name. This names them: `color.ink` becomes `text-ink`
 * / `bg-ink` / `border-ink`.
 *
 * @param {Record<string, Record<string, unknown>>} [theme] the project's theme.js default export
 * @returns {Record<string, string>} colour scale entries
 */
export const themeColorVariables = (theme = {}) => {
  /** @type {Record<string, string>} */
  const colors = {};
  for (const [key, value] of Object.entries(theme?.color ?? {}))
    if (isColorValue(value)) colors[key] = `var(--color-${key})`;
  for (const [key, value] of Object.entries(theme?.text ?? {})) {
    if (key === "color" || colors[key] || !isColorValue(value)) continue;
    colors[key] = `var(--text-${key})`;
  }
  return colors;
};

/**
 * The type scale a theme declares, each utility pointing at its variable, so
 * `text-base` and `--text-base` are one size. Colours in the same group are
 * left to `themeColorVariables`.
 * @param {Record<string, unknown> | undefined} text
 * @returns {Record<string, string>}
 */
export const themeFontSizes = (text) => {
  /** @type {Record<string, string>} */
  const sizes = {};
  for (const [key, value] of Object.entries(text ?? {}))
    if (typeof value === "string" && /^[\d.]+(?:rem|px|em)$/.test(value.trim())) sizes[key] = `var(--text-${key})`;
  return sizes;
};
/** @param {string} name */
const shades = (name) => ({
  DEFAULT: `var(--color-${name})`,
  lighter: `var(--color-${name}-lighter)`,
  light: `var(--color-${name}-light)`,
  dark: `var(--color-${name}-dark)`,
  darker: `var(--color-${name}-darker)`,
});

export const FRAMEWORK_COLORS = {
  default: "var(--text-color)",
  muted: "var(--text-muted)",
  inverted: "var(--color-inverse)",
  canvas: "var(--canvas-background)",
  surface: shades("surface"),
  accent: shades("accent"),
  inverse: shades("inverse"),
  primary: shades("primary"),
  secondary: shades("secondary"),
  success: shades("success"),
  danger: shades("danger"),
  warning: shades("warning"),
  info: shades("info"),
  hover: "var(--color-hover)",
  focus: "var(--color-focus)",
  dim: "var(--border-color)",
  ide: {
    sidebar: "var(--ide-sidebar-background, var(--color-inverse))",
    "sidebar-border": "var(--ide-sidebar-border, var(--color-surface))",
    content: "var(--ide-content-background, var(--color-inverse))",
  },
  "on-surface": "var(--color-on-surface)",
  "on-accent": "var(--color-on-accent)",
  "on-inverse": "var(--color-on-inverse)",
  "on-primary": "var(--color-on-primary)",
  "on-secondary": "var(--color-on-secondary)",
  "on-success": "var(--color-on-success)",
  "on-danger": "var(--color-on-danger)",
  "on-warning": "var(--color-on-warning)",
  "on-info": "var(--color-on-info)",
};

const BASE_COLORS = {
  inherit: "inherit",
  current: "currentColor",
  transparent: "transparent",
  black: "#000",
  white: "#fff",
};

export const DEFAULT_THEME = {
  screens: { sm: "640px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1536px" },
  colors: { ...BASE_COLORS, ...FRAMEWORK_COLORS },
  textColor: { DEFAULT: "var(--text-color)", bg: "var(--canvas-background)" },
  backgroundColor: { DEFAULT: "var(--canvas-background)", bg: "var(--canvas-background)" },
  borderColor: { DEFAULT: "var(--border-color)", bg: "var(--canvas-background)" },
  spacing: { px: "1px" },
  fontSize: {
    xs: ["0.75rem", "1rem"],
    sm: ["0.875rem", "1.25rem"],
    base: ["1rem", "1.5rem"],
    lg: ["1.125rem", "1.75rem"],
    xl: ["1.25rem", "1.75rem"],
    "2xl": ["1.5rem", "2rem"],
    "3xl": ["1.875rem", "2.25rem"],
    "4xl": ["2.25rem", "2.5rem"],
    "5xl": ["3rem", "1"],
    "6xl": ["3.75rem", "1"],
    "7xl": ["4.5rem", "1"],
    "8xl": ["6rem", "1"],
    "9xl": ["8rem", "1"],
  },
  fontWeight: {
    thin: "var(--font-thin, 100)",
    extralight: "var(--font-extralight, 200)",
    light: "var(--font-light, 300)",
    normal: "var(--font-normal, 400)",
    medium: "var(--font-medium, 500)",
    semibold: "var(--font-semibold, 600)",
    bold: "var(--font-bold, 700)",
    extrabold: "var(--font-extrabold, 800)",
    black: "var(--font-black, 900)",
  },
  fontFamily: {
    sans: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
    serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  borderRadius: {
    none: "0px",
    xs: "0.125rem",
    sm: "0.25rem",
    DEFAULT: "0.25rem",
    md: "0.375rem",
    lg: "0.5rem",
    xl: "0.75rem",
    "2xl": "1rem",
    "3xl": "1.5rem",
    "4xl": "2rem",
    full: "9999px",
  },
  boxShadow: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
    inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
    none: "0 0 #0000",
  },
  dropShadow: {
    sm: "0 1px 1px rgb(0 0 0 / 0.05)",
    DEFAULT: "0 1px 2px rgb(0 0 0 / 0.1)",
    md: "0 4px 3px rgb(0 0 0 / 0.07)",
    lg: "0 10px 8px rgb(0 0 0 / 0.04)",
    xl: "0 20px 13px rgb(0 0 0 / 0.03)",
    "2xl": "0 25px 25px rgb(0 0 0 / 0.15)",
    none: "0 0 #0000",
  },
  lineHeight: {
    none: "1",
    tight: "1.25",
    snug: "1.375",
    normal: "1.5",
    relaxed: "1.625",
    loose: "2",
  },
  letterSpacing: {
    tighter: "-0.05em",
    tight: "-0.025em",
    normal: "0em",
    wide: "0.025em",
    wider: "0.05em",
    widest: "0.1em",
  },
  blur: {
    none: "0",
    sm: "4px",
    DEFAULT: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    "2xl": "40px",
    "3xl": "64px",
  },
  zIndex: { auto: "auto" },
  maxWidth: {
    none: "none",
    xs: "20rem",
    sm: "24rem",
    md: "28rem",
    lg: "32rem",
    xl: "36rem",
    "2xl": "42rem",
    "3xl": "48rem",
    "4xl": "56rem",
    "5xl": "64rem",
    "6xl": "72rem",
    "7xl": "80rem",
    prose: "65ch",
  },
  transitionTimingFunction: {
    DEFAULT: "cubic-bezier(0.4, 0, 0.2, 1)",
    linear: "linear",
    in: "cubic-bezier(0.4, 0, 1, 1)",
    out: "cubic-bezier(0, 0, 0.2, 1)",
    "in-out": "cubic-bezier(0.4, 0, 0.2, 1)",
  },
};

/**
 * @param {Record<string, unknown> | undefined} group
 * @param {string} varPrefix
 * @param {(key: string, value: string) => boolean} [filter]
 */
const scaleFromGroup = (group, varPrefix, filter = () => true) => {
  const scale = /** @type {Record<string, string>} */ ({});
  for (const [key, value] of Object.entries(group ?? {}))
    if (typeof value === "string" && filter(key, value))
      scale[key] = `var(--${varPrefix}-${key})`;
  return scale;
};

/** @param {Record<string, string>} colors */
const onColors = (colors) => {
  const on = /** @type {Record<string, string>} */ ({});
  for (const [key, value] of Object.entries(colors))
    if (typeof value === "string" && !key.startsWith("on-") && !colors[`on-${key}`])
      on[`on-${key}`] = `var(--color-on-${key})`;
  return on;
};

/**
 * @param {Record<string, Record<string, unknown>>} [projectTheme] the project's theme.js default export
 * @param {{palette?: Record<string, unknown>|null}} [options] pass the palette.js data to enable raw Tailwind colours
 */
export const buildTheme = (projectTheme = {}, { palette = null } = {}) => {
  const projectColors = themeColorVariables(projectTheme);
  const declaredColors = themeColorVariables({ color: projectTheme?.color });
  const colors = /** @type {Record<string, unknown>} */ ({ ...(palette ?? {}), ...DEFAULT_THEME.colors });
  for (const [key, value] of Object.entries({ ...projectColors, ...onColors(declaredColors) }))
    colors[key] = colors[key] && typeof colors[key] === "object"
      ? { ...colors[key], DEFAULT: value }
      : value;
  return {
    ...DEFAULT_THEME,
    screens: { ...DEFAULT_THEME.screens, ...projectTheme?.screens },
    colors,
    spacing: { ...DEFAULT_THEME.spacing, ...scaleFromGroup(projectTheme?.spacing, "spacing") },
    borderRadius: { ...DEFAULT_THEME.borderRadius, ...scaleFromGroup(projectTheme?.radius, "radius") },
    boxShadow: { ...DEFAULT_THEME.boxShadow, ...scaleFromGroup(projectTheme?.shadow, "shadow") },
    lineHeight: { ...DEFAULT_THEME.lineHeight, ...scaleFromGroup(projectTheme?.leading, "leading") },
    fontSize: { ...DEFAULT_THEME.fontSize, ...themeFontSizes(projectTheme?.text) },
    fontFamily: {
      ...DEFAULT_THEME.fontFamily,
      ...scaleFromGroup(projectTheme?.font, "font", (key, value) =>
        key !== "google" && key !== "size" && !/^\d/.test(value) && !isColorValue(value)),
    },
  };
};
