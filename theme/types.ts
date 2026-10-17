/**
 * @bootstrapp/light/theme: the shapes a theme is made of.
 */

/** A theme: nested token groups (`color`, `spacing`, `font`, ...) whose leaves become `--group-key` variables, and an optional `dark` block of the same shape. */
export type ThemeData = Record<string, unknown> & { dark?: ThemeData; font?: ThemeFont };

/** A font a theme names: a family string, or an object with the CSS family and the Google Fonts name to request (`google: false` requests none). */
export type FontValue = string | { family?: string; google?: string | false };

export interface ThemeFont {
  family?: FontValue;
  heading?: FontValue;
  [key: string]: unknown;
}

/** How one shade derives from a base color: a lightness step, or a mix with white or black. */
export interface ShadeOption {
  lightness?: number;
  mix?: string;
  amount?: number;
}

/** One icon set, in the `@iconify-json` shape: bodies keyed by name, sizes shared. */
export interface IconCollection {
  prefix?: string;
  width?: number;
  height?: number;
  icons: Record<string, { body: string; width?: number; height?: number; hidden?: boolean }>;
  aliases?: Record<string, { parent: string }>;
}

/** One icon resolved against its collection's defaults. */
export interface IconEntry {
  body: string;
  width: number;
  height: number;
}

/** Where a page reads one icon from. */
export interface IconSource {
  /** One icon by name, or null when there is none; `null` (the default) fetches nothing: the page's stylesheet has the icons, or the page shows none. */
  load: ((name: string) => Promise<IconEntry | null>) | null;
}

/** One entry of `presets.js`: a complete theme shipped under a name. */
export interface ThemePreset {
  name: string;
  label: string;
  description: string;
  loader: () => Promise<{ default?: Record<string, unknown> } & Record<string, unknown>>;
}

export * from "./index.js";
