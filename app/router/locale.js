/**
 * The locale prefix of a route path: `/pt-BR/places` is `/places` read in
 * `pt-BR`. Pure, so the router, the i18n module and a build step all answer
 * the same question the same way. The default locale never carries a prefix.
 */

const PREFIX = /^\/([a-z]{2}(?:-[A-Z]{2})?)(?=\/|$)/;

/** @type {(path: string) => [string, string]} */
const splitQuery = (path) => {
  const at = path.search(/[?#]/);
  return at === -1 ? [path, ""] : [path.slice(0, at), path.slice(at)];
};

/**
 * The locale a path is prefixed with, when it is one the app declares.
 * @param {string} path
 * @param {readonly string[]} locales
 * @returns {string | null}
 */
export const localeOfPath = (path, locales) => {
  const m = PREFIX.exec(splitQuery(path)[0]);
  return m && locales.includes(m[1]) ? m[1] : null;
};

/**
 * The path with its locale prefix removed; a path with none is returned as is.
 * @param {string} path
 * @param {readonly string[]} locales
 * @returns {string}
 */
export const stripLocale = (path, locales) => {
  const locale = localeOfPath(path, locales);
  if (!locale) return path;
  const [pathname, rest] = splitQuery(path);
  return `${pathname.slice(locale.length + 1) || "/"}${rest}`;
};

/**
 * The path read in a locale: the bare path for the default locale, the
 * prefixed one otherwise. A path already carrying a prefix is re-pointed.
 * Anything that is not a root-relative path (an absolute URL, a hash, a
 * protocol-relative href) is left alone.
 * @param {string} path
 * @param {string | null | undefined} locale
 * @param {readonly string[]} locales
 * @param {string} defaultLocale
 * @returns {string}
 */
export const withLocale = (path, locale, locales, defaultLocale) => {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  const bare = stripLocale(path, locales);
  if (!locale || locale === defaultLocale) return bare;
  const [pathname, rest] = splitQuery(bare);
  return `/${locale}${pathname === "/" ? "" : pathname}${rest}`;
};
