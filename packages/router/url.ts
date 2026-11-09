/**
 * @lightstart/router/url: the base-path and query helpers the router
 * needs. They are local copies of Bootstrapp's `bootstrapp/url` behaviour so
 * the router depends on no framework package.
 */

/** The canonical form of a deploy base path: leading slash, no trailing slash. */
export const normalizeBasePath = (base: string | undefined): string => {
  if (!base) return "";
  const lead = base.startsWith("/") ? base : `/${base}`;
  const trimmed = lead.replace(/\/+$/, "");
  return trimmed === "" ? "" : trimmed;
};

/** Prefix a root-absolute path with a base, idempotently. */
export const withBase = (base: string | undefined, path: string): string => {
  const prefix = normalizeBasePath(base);
  if (!prefix || !path.startsWith("/") || path.startsWith("//")) return path;
  if (path === prefix || path.startsWith(`${prefix}/`)) return path;
  return `${prefix}${path}`;
};

/** Drop a base path from a root-absolute path, idempotently. */
export const stripBase = (base: string | undefined, path: string): string => {
  const prefix = normalizeBasePath(base);
  if (!prefix || !path.startsWith("/") || path.startsWith("//")) return path;
  if (path === prefix) return "/";
  return path.startsWith(`${prefix}/`) ? path.slice(prefix.length) : path;
};

/** Append the non-empty values of `params` to `path` as a query string. */
export const withQuery = (path: string, params: Record<string, unknown> | undefined): string => {
  if (!params) return path;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  const string = query.toString();
  return string ? `${path}${path.includes("?") ? "&" : "?"}${string}` : path;
};
