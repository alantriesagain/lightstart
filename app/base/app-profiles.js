/**
 * App profile resolution: one build, many apps.
 *
 * Profiles live in `/apps/<name>.json` (shipped with the deploy); `/apps/index.json`
 * maps hostnames to profile names. Resolution order: `?app=` query override →
 * hostname match → `"default"`. The resolved profile is merged onto the manifest
 * before `bootstrap()`, so every runtime module (and the db-worker, via the
 * APP:BACKEND:START handshake) sees the merged result. A native shell whose
 * binary does not inject `__BOOTSTRAPP_SITE_ORIGIN__` gets it from the merged
 * public URL, so `siteOrigin()` names the web site there too.
 */

import { deepMerge } from "./deep-merge.js";

/** @import { AppProfile, Manifest } from "/app/base/app.js" */

const versioned = (/** @type {string} */ url, /** @type {Manifest} */ manifest) =>
  manifest.build?.id ? `${url}?v=${manifest.build.id}` : url;

const fetchJSON = async (/** @type {string} */ url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

const fillShellSiteOrigin = (/** @type {Manifest} */ manifest) => {
  const shell = /** @type {{ __BOOTSTRAPP_NATIVE__?: unknown, __BOOTSTRAPP_SITE_ORIGIN__?: string }} */ (/** @type {unknown} */ (globalThis));
  if (shell.__BOOTSTRAPP_NATIVE__ && !shell.__BOOTSTRAPP_SITE_ORIGIN__ && manifest.url)
    shell.__BOOTSTRAPP_SITE_ORIGIN__ = manifest.url.replace(/\/+$/, "");
};

const applyDomBranding = (/** @type {AppProfile} */ profile, /** @type {Manifest} */ manifest) => {
  if (profile.title) document.title = profile.title;
  const branding = profile.branding ?? {};

  if (branding.favicon) {
    let favicon = /** @type {HTMLLinkElement | null} */ (document.getElementById("favicon"));
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.id = "favicon";
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    favicon.href = branding.favicon;
  }

  if (branding.theme_color) {
    let meta = /** @type {HTMLMetaElement | null} */ (document.querySelector('meta[name="theme-color"]'));
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = branding.theme_color;
  }

  if (!manifest.build?.id) return;

  const pwaLink = /** @type {HTMLLinkElement | null} */ (document.querySelector('link[rel="manifest"]'));
  if (pwaLink) pwaLink.href = versioned(`/apps/manifest-${profile.name}.json`, manifest);

  if (manifest.theme?.bundle === false) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = versioned(`/apps/${profile.name}.theme.css`, manifest);
    document.head.appendChild(link);
  }
};

/**
 * Resolve the app profile for the current host and merge it onto the manifest.
 * No-op when a profile is already merged (e.g. the db-worker receiving the
 * frontend's manifest) or when no profile files ship with the deploy.
 *
 * @param {Manifest} manifest
 * @returns {Promise<void>}
 */
export const resolveAppProfile = async (manifest) => {
  if (manifest.app) return;

  let name = new URLSearchParams(globalThis.location.search).get("app")
    || /** @type {string | undefined} */ (/** @type {any} */ (globalThis).__BOOTSTRAPP_APP_PROFILE__);
  if (!name) {
    const index = await fetchJSON(versioned("/apps/index.json", manifest));
    name = index?.domains?.[globalThis.location.hostname];
  }
  name ||= "default";

  /** @type {AppProfile | null} */
  let profile = await fetchJSON(versioned(`/apps/${name}.json`, manifest));
  if (!profile && name !== "default")
    profile = await fetchJSON(versioned("/apps/default.json", manifest));
  if (!profile) return void console.warn(`[app-profiles] no profile found for "${name}", booting on base manifest`);

  manifest.app = profile;
  if (profile.title) manifest.name = profile.title;
  if (typeof profile.domain === "string")
    manifest.url = /^https?:/.test(profile.domain) ? profile.domain : `https://${profile.domain}`;
  fillShellSiteOrigin(manifest);

  const branding = profile.branding ?? {};
  for (const key of ["short_name", "description", "theme_color", "favicon", "og_image"])
    if (branding[key] != null) manifest[key] = branding[key];

  if (profile.theme) manifest.theme = /** @type {Manifest["theme"]} */ (deepMerge(manifest.theme ?? {}, profile.theme));
  if (profile.settings) manifest.settings = deepMerge(manifest.settings ?? {}, profile.settings);
  if (profile.frontendEntry) manifest.frontendEntry = profile.frontendEntry;

  applyDomBranding(profile, manifest);
};
