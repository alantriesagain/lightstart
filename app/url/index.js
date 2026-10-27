/**
 * Single source of truth for the framework's public URL prefix.
 *
 * Browser-facing URLs use FRAMEWORK_URL_PREFIX (currently "/app").
 * Renaming the prefix is a one-string edit here; every emitter that
 * imports these helpers propagates the change automatically.
 *
 * Disk paths (under `node_modules/@bootstrapp/...`) are NOT affected;
 * pnpm controls the file system layout, this module only owns URLs.
 *
 * FRAMEWORK_APP_ENTRY_URL ("/app.js") is reserved at the project root;
 * any project file at <projectDir>/app.js would be shadowed by the
 * dev server's alias. No current project ships such a file.
 */

export const FRAMEWORK_URL_PREFIX = "/app";
export const FRAMEWORK_APP_ENTRY_URL = "/app.js";

export const frameworkPkgUrl = (/** @type {string} */ shortName, /** @type {string[]} */ ...rest) =>
  rest.length === 0
    ? `${FRAMEWORK_URL_PREFIX}/${shortName}`
    : `${FRAMEWORK_URL_PREFIX}/${shortName}/${rest.join("/")}`;

const APP_BASE_GLOBAL = "__BOOTSTRAPP_BASE__";

/**
 * Canonical form of a deploy base path: leading slash, no trailing slash,
 * empty string for a root deploy. `"/"`, `""`, `undefined` all mean root.
 *
 * @param {string} [base]
 * @returns {string}
 */
export const normalizeBasePath = (base) => {
  if (!base) return "";
  const withLead = base.startsWith("/") ? base : `/${base}`;
  const trimmed = withLead.replace(/\/+$/, "");
  return trimmed === "" ? "" : trimmed;
};

/**
 * Prefix a root-absolute app URL with an explicit base. Idempotent (a path
 * already under the base is returned untouched) and a no-op for a root
 * deploy, so callsites read the same whether or not a base is configured.
 * Relative paths, absolute URLs and data/blob URIs pass through.
 *
 * Node-side emitters use this directly with the base they read from settings;
 * runtime code calls `appUrl`, which supplies the inlined global.
 *
 * @param {string | undefined} base
 * @param {string} path
 * @returns {string}
 */
export const withBase = (base, path) => {
  const prefix = normalizeBasePath(base);
  if (!prefix || !path.startsWith("/") || path.startsWith("//")) return path;
  if (path === prefix || path.startsWith(`${prefix}/`)) return path;
  return `${prefix}${path}`;
};

/**
 * Append non-empty `params` to `path` as a query string (null/undefined/"" dropped).
 * @param {string} path
 * @param {Record<string, unknown>} [params]
 * @returns {string}
 */
export const withQuery = (path, params) => {
  if (!params) return path;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `${path}${path.includes("?") ? "&" : "?"}${s}` : path;
};

/**
 * The prelude the bundlers write at the top of each runtime's bundle so
 * `appUrl` resolves before any manifest is fetched. Empty for a root deploy,
 * which keeps root builds byte-identical to what they were before base paths
 * existed.
 *
 * @param {string} [base]
 * @returns {string}
 */
export const basePrelude = (base) => {
  const prefix = normalizeBasePath(base);
  return prefix ? `globalThis.${APP_BASE_GLOBAL} = ${JSON.stringify(prefix)};` : "";
};

/**
 * The deploy base path of the running app, `""` in dev and on a root deploy.
 * @returns {string}
 */
export const basePath = () =>
  normalizeBasePath(
    /** @type {Record<string, string | undefined>} */ (/** @type {unknown} */ (globalThis))[APP_BASE_GLOBAL],
  );

const API_ORIGIN_GLOBAL = "__BOOTSTRAPP_API_ORIGIN__";

/**
 * Where this install's API lives. Empty on the web, where the API is
 * same-origin and a root-relative path is right; a real origin in a native
 * shell, whose page is served from the app bundle and whose `/api/*` would
 * otherwise resolve against `appassets.androidplatform.net`.
 *
 * Beside `basePath` because it is the same kind of fact, read the same way, and
 * because anything calling the API needs it: leaving it in an auth package made
 * every other caller import auth for a prefix that has nothing to do with auth.
 *
 * @returns {string}
 */
export const apiOrigin = () =>
  /** @type {Record<string, string | undefined>} */ (/** @type {unknown} */ (globalThis))[API_ORIGIN_GLOBAL] || "";

const SITE_ORIGIN_GLOBAL = "__BOOTSTRAPP_SITE_ORIGIN__";

/**
 * Where this app lives on the web, without a trailing slash: the origin a link
 * someone else opens is built on. `location.origin` on the web; the public site
 * in a native shell, whose own origin (`appassets.androidplatform.net`,
 * `app://localhost`) opens nowhere for anybody else. The shell injects it, and
 * `resolveAppProfile` fills it from the profile's domain for a shell that does
 * not. Empty where there is no page (node tooling).
 *
 * @returns {string}
 */
export const siteOrigin = () => {
  const injected = /** @type {Record<string, string | undefined>} */ (/** @type {unknown} */ (globalThis))[SITE_ORIGIN_GLOBAL];
  if (injected) return injected.replace(/\/+$/, "");
  return globalThis.location?.origin ?? "";
};

const NATIVE_GLOBAL = "__BOOTSTRAPP_NATIVE__";
const PHONE_SHELLS = new Set(["android", "ios"]);

/**
 * Opens `url` in whatever claims it outside the app: WhatsApp for a `wa.me`
 * link, the browser for a page. A phone shell (Android, iOS) hands every
 * navigation to another host to the system without needing a tap, so there it
 * is a navigation and may follow an `await`. Anywhere else it is a new tab,
 * which a browser allows only during a tap or shortly after one.
 *
 * @param {string} url
 * @returns {void}
 */
export const openOutside = (url) => {
  const native = /** @type {Record<string, { platform?: unknown } | undefined>} */ (/** @type {unknown} */ (globalThis))[NATIVE_GLOBAL];
  if (PHONE_SHELLS.has(String(native?.platform))) globalThis.location.assign(url);
  else globalThis.open(url, "_blank", "noopener");
};

/**
 * Resolve a root-absolute app URL against the running app's base path.
 * Every framework fetch of an app-owned asset (`/schemas.js`,
 * `/.bootstrapp.json`, `/content/...`, the worker) goes through this, so a
 * subpath deploy needs no per-callsite knowledge.
 *
 * @param {string} path
 * @returns {string}
 */
export const appUrl = (path) => withBase(basePath(), path);

/**
 * The key a root-absolute app URL is written under in the build output. The
 * deploy is a flat file map (`/vendor/x.js` is emitted as `vendor/x.js`), so
 * this is the inverse of the leading slash `appUrl` speaks in.
 *
 * Protocol-relative URLs pass through untouched, the same stance `withBase`
 * takes: `//cdn/x.js` names an external origin, not a file this deploy owns,
 * and stripping its slashes would turn it into a plausible-looking local key.
 *
 * @param {string} path
 * @returns {string}
 */
export const deployKey = (path) => (path.startsWith("//") ? path : path.replace(/^\//, ""));

/**
 * Drop a deploy's base path from a root-absolute app URL: the inverse of
 * `withBase`, and idempotent, so a path that never carried the base passes
 * through. Anything the base does not own is returned as it came, including
 * protocol-relative URLs.
 *
 * @param {string} base
 * @param {string} path
 * @returns {string}
 */
export const stripBase = (base, path) => {
  const prefix = normalizeBasePath(base);
  if (!prefix || !path.startsWith("/") || path.startsWith("//")) return path;
  if (path === prefix) return "/";
  return path.startsWith(`${prefix}/`) ? path.slice(prefix.length) : path;
};
