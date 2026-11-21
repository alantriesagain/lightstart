/**
 * @file The app's deploy base: the path prefix it lives under when it is not
 * served from a domain's root (`https://user.github.io/budget` lives under
 * `/budget`). `appBase` reads it from `defineApp`'s config, `appUrl` puts it
 * before a root-relative path while the app runs, and the web host, the
 * generator and the build all take it from here.
 */

import { normalizeBasePath, withBase } from "@lightstart/router/url";

/** The part of an app's config the base comes from. */
export interface BaseConfig {
  /** An explicit base, overriding the path `url` names. */
  base?: string;
  /** The site's address, whose path is the base when `base` is absent. */
  url?: string;
}

/** The app's normalised base: `""` when it lives at the root, else a leading slash and no trailing slash. */
export const appBase = (config: BaseConfig): string => {
  if (config.base !== undefined) return normalizeBasePath(config.base);
  if (config.url === undefined || config.url === "") return "";
  try {
    return normalizeBasePath(new URL(config.url).pathname);
  } catch {
    return "";
  }
};

let runningBase = "";

/** Set the base of the app running now; the run does this when it starts. */
export const setAppBase = (base: string): void => {
  runningBase = normalizeBasePath(base);
};

/** A root-relative path of the app running now, with its base before it: `appUrl("/rates.json")` is `/budget/rates.json`; unchanged with no base. */
export const appUrl = (path: string): string => withBase(runningBase, path);
