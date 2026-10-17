/**
 * @bootstrapp/light/theme: the shapes a theme is made of.
 */

export type { FontValue, HSL, ShadeOption, ThemeData, ThemeFont } from "./tokens.ts";

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
