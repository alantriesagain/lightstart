/// <reference lib="dom" />
/**
 * Skins: a whole theme applied to the preview stage alone.
 *
 * A skin answers "what would this look like in another toolkit", so it has to
 * reach every component on the stage and nothing around it. `applyScopedTheme`
 * writes the palette onto `[data-lc-skin="<name>"]`, which descendants inherit
 * from and which beats `:root` by proximity rather than by specificity. The
 * showcase chrome, and the whole IDE when the showcase is a tab in it, keep the
 * host's theme, and two tabs can wear two skins at once.
 *
 * The font is loaded here rather than through `loadFont`, which writes
 * `--font-family-base` on `:root` and would take the chrome with it.
 */

import { applyScopedDarkTheme, applyScopedTheme, clearScopedTheme, googleFontsUrl, loadCSS, loadFont } from "@lightstart/light/theme";
import type { ThemeData, ThemeFont } from "@lightstart/light/theme";
import { loadPreset } from "@lightstart/light/theme/presets.js";

void loadFont;

export const SKIN_ATTRIBUTE = "data-lc-skin";

export const skinScope = (name: string): string => `[${SKIN_ATTRIBUTE}="${name}"]`;

const styleIds = (name: string): { light: string; dark: string } => ({
  light: `lc-skin-${name}`,
  dark: `lc-skin-${name}-dark`,
});

const cssFamily = (family: unknown): string | null => {
  const value = typeof family === "object" && family !== null
    ? (family as { family?: unknown }).family
    : family;
  if (typeof value !== "string" || !value.trim()) return null;
  return value.includes(",") ? value : `'${value}', sans-serif`;
};

/**
 * `font.family` flattens to `--font-family`, but what elements actually read is
 * `--font-family-base`, which only the document-wide loader writes. Naming it
 * inside the `font` group puts it on the scope instead.
 */
const withStageFont = (theme: ThemeData): ThemeData => {
  const font = theme.font;
  const family = cssFamily(font?.family);
  if (!family) return theme;
  return { ...theme, font: { ...font, "family-base": family } };
};

const loadSkinFont = (theme: ThemeData): void => {
  const font = theme.font as ThemeFont | undefined;
  const requested = font?.google ?? font?.family;
  if (!requested) return;
  const url = googleFontsUrl(requested as string | string[]);
  if (url) loadCSS(url);
};

/**
 * Dress the stage in a preset. Answers false when no preset carries the name,
 * which is how the caller learns to fall back to the host's theme.
 */
export const applySkin = async (name: string): Promise<boolean> => {
  const preset = await loadPreset(name);
  if (!preset) return false;
  const scope = skinScope(name);
  const ids = styleIds(name);
  const theme = withStageFont(preset);
  const light = { ...theme };
  delete light.dark;
  applyScopedTheme(scope, light, ids.light);
  applyScopedDarkTheme(`:root.dark ${scope}`, theme, ids.dark);
  loadSkinFont(preset);
  return true;
};

export const clearSkin = (name: string): void => {
  const ids = styleIds(name);
  clearScopedTheme("", ids.light);
  clearScopedTheme("", ids.dark);
};
