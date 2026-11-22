/**
 * @file The deploy-base helpers this package shares between the manifest, the
 * worker and the build: a base is `""` at the root, else a leading slash and no
 * trailing slash, and a root-relative path gets it once.
 */

/** The canonical form of a deploy base path: leading slash, no trailing slash, `""` at the root. */
export const normalizeBase = (base: string | undefined): string => {
  if (!base) return "";
  const lead = base.startsWith("/") ? base : `/${base}`;
  const trimmed = lead.replace(/\/+$/, "");
  return trimmed === "" ? "" : trimmed;
};

/** Put `base` before a root-relative path, once; an absolute URL is left as it is. */
export const withBase = (base: string | undefined, path: string): string => {
  const prefix = normalizeBase(base);
  if (!prefix || !path.startsWith("/") || path.startsWith("//")) return path;
  if (path === prefix || path.startsWith(`${prefix}/`)) return path;
  return `${prefix}${path}`;
};

/** Put `base` before a path that may be relative as well as root-relative; an absolute URL is left as it is. */
export const basedPath = (base: string | undefined, path: string): string => {
  const prefix = normalizeBase(base);
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("//")) return path;
  if (path.startsWith("/")) return withBase(prefix, path);
  return prefix === "" ? path : `${prefix}/${path}`;
};

/** The app's base with a trailing slash, for a service worker's scope. */
export const baseScope = (base: string | undefined): string => `${normalizeBase(base)}/`;
