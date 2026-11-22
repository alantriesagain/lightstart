/**
 * @file @lightstart/pwa: an app's web manifest and service worker. A project
 * opts in with `src/pwa.ts` or `src/pwa.js` default-exporting `definePwa`, and
 * `light build` writes `manifest.webmanifest` and `sw.js` from it. The page
 * API lives at `@lightstart/pwa/page`; this module re-exports its types.
 */

export type { PwaPage, PwaPageOptions, PwaUpdateState } from "./page.ts";

/** One icon in the manifest, the app's and a shortcut's. */
export interface PwaIcon {
  src: string;
  sizes: string;
  type?: string;
  purpose?: string;
}

/** One shortcut in the manifest. */
export interface PwaShortcut {
  name: string;
  short_name?: string;
  description?: string;
  url: string;
  icons?: PwaIcon[];
}

/** One screenshot in the manifest. */
export interface PwaScreenshot {
  src: string;
  sizes?: string;
  type?: string;
  form_factor?: string;
  label?: string;
}

/** How the page handles a waiting worker: `"off"` only follows the signal, `"prompt"` waits for the app or the toast, `"silent"` applies at the next route change, and `"force"` applies at once. */
export type PwaUpdate = "off" | "silent" | "prompt" | "force";

/** What `src/pwa.ts` (or `.js`) declares: the manifest's fields and how an update is handled. */
export interface PwaConfig {
  name?: string;
  short_name?: string;
  description?: string;
  icons?: PwaIcon[];
  theme_color?: string;
  background_color?: string;
  display?: string;
  start_url?: string;
  scope?: string;
  shortcuts?: PwaShortcut[];
  screenshots?: PwaScreenshot[];
  categories?: string[];
  update?: PwaUpdate;
}

/** The manifest object written to `manifest.webmanifest`. */
export interface PwaManifest {
  name: string;
  short_name: string;
  description?: string;
  icons?: PwaIcon[];
  theme_color?: string;
  background_color?: string;
  display: string;
  start_url: string;
  scope: string;
  shortcuts?: PwaShortcut[];
  screenshots?: PwaScreenshot[];
  categories?: string[];
}

/** Keep the config's literal type; the build reads the default export. */
export const definePwa = (config: PwaConfig): PwaConfig => config;
