/**
 * @lightstart/router/locale: the locale prefix of a route path.
 * `/pt-BR/places` is `/places` read in `pt-BR`. The default locale never
 * carries a prefix. The helpers are pure so a router, an i18n module and a
 * build step answer the same question the same way.
 */

const PREFIX = /^\/([a-z]{2}(?:-[A-Z]{2})?)(?=\/|$)/;

const splitQuery = (path: string): [string, string] => {
  const at = path.search(/[?#]/);
  return at === -1 ? [path, ""] : [path.slice(0, at), path.slice(at)];
};

/** The locale a path is prefixed with, when it is one the app declares. */
export const localeOfPath = (path: string, locales: readonly string[]): string | null => {
  const match = PREFIX.exec(splitQuery(path)[0]);
  return match !== null && locales.includes(match[1]) ? match[1] : null;
};

/** The path with its locale prefix removed; a path with none is returned as is. */
export const stripLocale = (path: string, locales: readonly string[]): string => {
  const locale = localeOfPath(path, locales);
  if (locale === null) return path;
  const parts = splitQuery(path);
  return `${parts[0].slice(locale.length + 1) || "/"}${parts[1]}`;
};

/** The path read in a locale: bare for the default, prefixed otherwise. */
export const withLocale = (path: string, locale: string | null | undefined, locales: readonly string[], defaultLocale: string): string => {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  const bare = stripLocale(path, locales);
  if (!locale || locale === defaultLocale) return bare;
  const parts = splitQuery(bare);
  return `/${locale}${parts[0] === "/" ? "" : parts[0]}${parts[1]}`;
};
