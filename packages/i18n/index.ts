/**
 * `@lightstart/i18n`: the one translation instance a light app reads from, given
 * to light as its translation (`@lightstart/light/i18n`, as a router is given as
 * its navigation), and the language helpers a view or controller uses.
 */

import { configureTranslation } from "@lightstart/light/i18n";
import { registerQueryHook } from "@lightstart/light/model";
import type { Translation } from "@lightstart/light/i18n";
import { localStorage } from "@lightstart/light/controller/storage";
import { currentI18n, useI18n } from "./current.ts";
import { createLocaleQueryHook, createLocalizedQueryHook } from "./query-hook.ts";
import { I18n } from "./i18n.ts";
import { pick } from "./translate.ts";
import type { I18nWarning, TranslationTree } from "./types.ts";

const LOCALE_KEY = "i18n:currentLocale";

export interface ConfigureI18nOptions {
  locales?: string[];
  defaultLocale?: string;
  dictionaries?: Record<string, TranslationTree | null | undefined>;
  onWarn?: (warning: I18nWarning) => void;
}

/** The locale kept from the last visit, or null when none was or storage is unavailable. */
const savedLocale = (): string | null => {
  try {
    const stored = localStorage.get(LOCALE_KEY);
    return typeof stored === "string" ? stored : null;
  } catch {
    return null;
  }
};

let queriesHooked = false;

/** A model whose schema declares `$i18n` is read in the current language (once, whichever instance is in use). */
const hookQueries = (): void => {
  if (queriesHooked) return;
  queriesHooked = true;
  registerQueryHook(createLocaleQueryHook({ getLanguage: () => currentI18n().getLanguage(), savedLocale }));
  registerQueryHook(createLocalizedQueryHook({ getLanguage: () => currentI18n().getLanguage(), defaultLocale: () => currentI18n().getDefaultLocale() }));
};

/**
 * Make the one instance, merge the dictionaries it starts with, give it to
 * light as its translation (`configureTranslation`, so a component's words and
 * a view's `t()` follow the language), and read a model whose schema declares
 * `$i18n` in the current language.
 */
export const configureI18n = (options: ConfigureI18nOptions = {}): I18n => {
  const defaultLocale = options.defaultLocale ?? "en";
  const instance = new I18n({ fallbackLocale: defaultLocale, defaultLocale, locales: options.locales, onWarn: options.onWarn });
  useI18n(instance);

  for (const [locale, dictionary] of Object.entries(options.dictionaries ?? {})) instance.addTranslations(locale, dictionary);

  const saved = savedLocale();
  instance.currentLocale = saved && pick(instance.translations, saved, defaultLocale) ? saved : defaultLocale;
  configureTranslation(new I18nTranslation());
  hookQueries();

  return instance;
};

/** The translation for `key`, or the key itself when there is none. */
export const t = (key: string, params?: Record<string, unknown>): string => currentI18n().t(key, params);

/** The language the reader is in, as `t()` answers in and an `Intl` formatter is given. */
export const language = (): string => currentI18n().getLanguage();

/** Load a language's registered dictionaries, make it current, and keep it for the next visit. */
export const setLanguage = async (locale: string): Promise<string> => {
  const set = await currentI18n().setLanguage(locale);
  try {
    localStorage.set(LOCALE_KEY, set);
  } catch {
    // Storage can be unavailable (private mode, disabled): the language still changes for this page.
  }
  return set;
};

/**
 * This package as light's translation: the sentences, the language and the
 * languages of the instance in use, its language signal followed. `t` answers
 * the key when it has no sentence; light reads that as "keep the component's
 * own words".
 */
export class I18nTranslation implements Translation {
  translate(key: string, params?: Record<string, unknown>): string | undefined {
    const text = currentI18n().t(key, params);
    return text === key ? undefined : text;
  }

  language(): string {
    return currentI18n().getLanguage();
  }

  languages(): string[] {
    return currentI18n().getAvailableLocales();
  }

  setLanguage(locale: string): Promise<string> {
    return setLanguage(locale);
  }

  subscribe(fn: () => void): () => void {
    return currentI18n().language.subscribe(() => fn());
  }
}

/** Merge a dictionary into a language, keeping the keys it already had. */
export const addDictionary = (locale: string, dictionary: TranslationTree | null | undefined): void => {
  currentI18n().addTranslations(locale, dictionary);
};

export { I18n } from "./i18n.ts";
export { createLocaleQueryHook, createLocalizedQueryHook } from "./query-hook.ts";
export type { LocaleQueryHookSource, LocalizedQueryHookSource } from "./query-hook.ts";
export { createI18nHooks, generateCanonicalId, generateUniqueSlugForLocale, i18nPublishingHooks, i18nSlugHooks } from "./model-hooks.ts";
export { localizedUrl, translationsOf } from "./urls.ts";
export { interpolate, isPluralTree, lookup, pick, pluralCategory, resolve, selectPlural, translate } from "./translate.ts";
export type { I18nOptions, I18nWarning, LocaleBundle, LocaleLoader, ResolveOptions, ResolveResult, TranslationMiss, TranslationTree, TranslationValue } from "./types.ts";
