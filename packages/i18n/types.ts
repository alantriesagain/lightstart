/** One node of a translation bundle: a string, or a nested group (a namespace, or the plural forms). */
export type TranslationValue = string | TranslationTree;

export interface TranslationTree {
  [key: string]: TranslationValue;
}

/** A locale bundle as a loader answers it: the tree, or an ES module wrapping it in `default`. */
export type LocaleBundle = TranslationTree | { default: TranslationTree };

/** What `registerLocale` stores: a function answering a locale's bundle. */
export type LocaleLoader = () => Promise<LocaleBundle>;

/** Why a lookup found no sentence to answer with. */
export type TranslationMiss = "not_found" | "plural_missing_count" | "not_string";

/** The sentence and the locale that answered it, or the reason there is none. */
export type ResolveResult = { value: string; locale: string } | { miss: TranslationMiss };

export interface ResolveOptions {
  fallback?: string;
}

/** A warning the instance collected or handed to its `onWarn`. */
export type I18nWarning =
  | { type: "translation_not_found"; key: string; locale: string }
  | { type: "plural_missing_count"; key: string }
  | { type: "translation_not_string"; key: string }
  | { type: "locale_load_failed"; locale: string; error: unknown };

export interface I18nOptions {
  fallbackLocale?: string;
  defaultLocale?: string;
  locales?: string[];
  onWarn?: (warning: I18nWarning) => void;
}
