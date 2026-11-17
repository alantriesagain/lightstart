/**
 * The language a path is read in, and every locale's row for one canonical
 * content record. A default-locale path stays canonical; another locale is
 * carried as its prefix. The sibling rows carry `locale` and `canonicalId`
 * from an `$i18n` model, read past the active-locale query hook.
 */

import { localeOfPath } from "@lightstart/router/locale";
import type { ModelApi, Row } from "@lightstart/light/model/types.ts";

/** A path read in a locale: prefixed unless it is the default one or already carries a prefix. */
export const localizedUrl = (url: string, locale: string | null | undefined, defaultLocale: string): string => {
  if (!locale || locale === defaultLocale) return url;
  if (localeOfPath(url, [locale, defaultLocale]) !== null) return url;
  if (url === "/") return `/${locale}`;
  return `/${locale}${url.startsWith("/") ? url : `/${url}`}`;
};

/** Every locale's row for one canonical content record, the active-locale hook aside. */
export const translationsOf = async (model: ModelApi, canonicalId: string): Promise<Row[]> =>
  model.getAll({ where: { canonicalId }, ignoreLocale: true });
