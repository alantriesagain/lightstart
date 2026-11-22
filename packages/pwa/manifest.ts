/**
 * @file The manifest an app's config and `src/pwa` answer: `name` and
 * `short_name` default from the app, the base goes before each root-relative
 * path, and `start_url` and `scope` are the app's base with its trailing slash
 * (the worker's scope) when not given.
 */

import type { PwaConfig, PwaIcon, PwaManifest, PwaScreenshot, PwaShortcut } from "./index.ts";
import { baseScope, basedPath, normalizeBase } from "./base.ts";

/** The part of an app's config the manifest reads. */
export interface PwaApp {
  name: string;
  title?: string;
  base: string;
}

const iconOf = (base: string, icon: PwaIcon): PwaIcon => {
  const based: PwaIcon = { ...icon, src: basedPath(base, icon.src) };
  if (icon.type === undefined) delete based.type;
  if (icon.purpose === undefined) delete based.purpose;
  return based;
};

const shortcutOf = (base: string, shortcut: PwaShortcut): PwaShortcut => {
  const based: PwaShortcut = { ...shortcut, url: basedPath(base, shortcut.url) };
  if (shortcut.icons !== undefined) based.icons = shortcut.icons.map((icon) => iconOf(base, icon));
  return based;
};

const screenshotOf = (base: string, screenshot: PwaScreenshot): PwaScreenshot => {
  const based: PwaScreenshot = { ...screenshot, src: basedPath(base, screenshot.src) };
  if (screenshot.sizes === undefined) delete based.sizes;
  if (screenshot.type === undefined) delete based.type;
  if (screenshot.form_factor === undefined) delete based.form_factor;
  if (screenshot.label === undefined) delete based.label;
  return based;
};

/** The manifest object for `pwa`, with `app`'s name, title and base filling its defaults. */
export const manifestOf = (app: PwaApp, pwa: PwaConfig): PwaManifest => {
  const base = normalizeBase(app.base);
  const manifest: PwaManifest = {
    name: pwa.name ?? app.title ?? app.name,
    short_name: pwa.short_name ?? app.name,
    display: pwa.display ?? "standalone",
    start_url: pwa.start_url === undefined ? baseScope(base) : basedPath(base, pwa.start_url),
    scope: pwa.scope === undefined ? baseScope(base) : basedPath(base, pwa.scope),
  };
  if (pwa.description !== undefined) manifest.description = pwa.description;
  if (pwa.icons !== undefined) manifest.icons = pwa.icons.map((icon) => iconOf(base, icon));
  if (pwa.theme_color !== undefined) manifest.theme_color = pwa.theme_color;
  if (pwa.background_color !== undefined) manifest.background_color = pwa.background_color;
  if (pwa.shortcuts !== undefined) manifest.shortcuts = pwa.shortcuts.map((shortcut) => shortcutOf(base, shortcut));
  if (pwa.screenshots !== undefined) manifest.screenshots = pwa.screenshots.map((screenshot) => screenshotOf(base, screenshot));
  if (pwa.categories !== undefined) manifest.categories = [...pwa.categories];
  return manifest;
};
