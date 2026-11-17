/**
 * The two locale scopes a model's query hooks give a schema: `$i18n` rows are
 * pinned to the active language through `where.locale` unless the caller named
 * a locale, asked for every one (`ignoreLocale`), or the host turned i18n off;
 * a `$localized` model is read with the `locale` option. The default locale is
 * the canonical itself, so nothing is stamped for it.
 */

import type { ModelSchema, QueryHook } from "@lightstart/light/model/types.ts";

export interface LocaleQueryHookSource {
  getLanguage(): string | undefined;
  savedLocale(): unknown;
  enabled?: boolean;
}

export interface LocalizedQueryHookSource {
  getLanguage(): string | undefined;
  defaultLocale(): string;
  enabled?: boolean;
}

const directive = (schema: ModelSchema | undefined, name: string): unknown => {
  if (schema === undefined) return undefined;
  const record: Record<string, unknown> = schema;
  return record[name];
};

const hasI18n = (schema: ModelSchema | undefined): boolean => Boolean(directive(schema, "$i18n"));

const localizedFields = (schema: ModelSchema | undefined): string[] => {
  const value = directive(schema, "$localized");
  const values: unknown[] = Array.isArray(value) ? value : [];
  return values.filter((field): field is string => typeof field === "string");
};

/** A hook that scopes a `$i18n` model's reads to the active language. */
export const createLocaleQueryHook = ({ getLanguage, savedLocale, enabled = true }: LocaleQueryHookSource): QueryHook =>
  ({ schema, opts }) => {
    if (!enabled || !hasI18n(schema) || opts.ignoreLocale || opts.where?.locale) return;
    let locale = getLanguage();
    const saved = savedLocale();
    if ((!locale || locale === "en") && typeof saved === "string" && saved) locale = saved;
    return { ...opts, where: { ...opts.where, locale: locale || "en" } };
  };

/** A hook that reads a `$localized` model in the active language through `locale`. */
export const createLocalizedQueryHook = ({ getLanguage, defaultLocale, enabled = true }: LocalizedQueryHookSource): QueryHook =>
  ({ schema, opts }) => {
    if (!enabled || localizedFields(schema).length === 0 || opts.locale !== undefined) return;
    const locale = getLanguage();
    if (!locale || locale === defaultLocale()) return;
    return { ...opts, locale };
  };
