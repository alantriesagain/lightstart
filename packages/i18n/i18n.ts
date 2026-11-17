/**
 * The stateful half of translation: the dictionaries a language answers from,
 * the current language as a signal, and the warnings a miss makes. A view
 * that reads `t()` follows the `language` signal, so switching the language
 * re-renders it.
 */

import { signal } from "@lightstart/light/signals";
import type { Signal } from "@lightstart/light/signals";
import { resolve } from "./translate.ts";
import type { I18nOptions, I18nWarning, LocaleBundle, LocaleLoader, TranslationMiss, TranslationTree } from "./types.ts";

/** The tree a loader answered: its `default` when it wrapped one, else the bundle itself. */
const bundleTree = (bundle: LocaleBundle): TranslationTree =>
  "default" in bundle && typeof bundle.default === "object" && bundle.default !== null ? bundle.default : bundle;

const MISSES: Record<TranslationMiss, (key: string, locale: string) => I18nWarning> = {
  not_found: (key, locale) => ({ type: "translation_not_found", key, locale }),
  plural_missing_count: (key) => ({ type: "plural_missing_count", key }),
  not_string: (key) => ({ type: "translation_not_string", key }),
};

export class I18n {
  translations: Record<string, TranslationTree> = {};
  readonly language: Signal<string>;
  fallbackLocale: string;
  defaultLocale: string;
  availableLocales: string[];
  loadedLocales: Set<string> = new Set();
  localeLoaders: Record<string, LocaleLoader[]> = {};
  warnings: I18nWarning[] = [];
  onWarn: ((warning: I18nWarning) => void) | undefined;
  _loadingVersion = 0;

  constructor(options: I18nOptions = {}) {
    this.fallbackLocale = options.fallbackLocale ?? "en";
    this.defaultLocale = options.defaultLocale ?? this.fallbackLocale;
    this.availableLocales = options.locales ? [...options.locales] : [];
    this.language = signal(this.defaultLocale);
    this.onWarn = options.onWarn;
  }

  get currentLocale(): string {
    return this.language.value;
  }

  set currentLocale(locale: string) {
    this.language.value = locale;
  }

  /** Collect a warning, and hand it to `onWarn` when the caller gave one. */
  warn(warning: I18nWarning): void {
    this.warnings.push(warning);
    if (this.onWarn) this.onWarn(warning);
  }

  /**
   * Add a contributor to a locale. A locale is loaded from as many files as
   * declare it, so this appends rather than replaces: a package registers
   * before the project, and the project's keys win the merge.
   */
  registerLocale(locale: string, loader: LocaleLoader): void {
    (this.localeLoaders[locale] ||= []).push(loader);
  }

  /** Merge a dictionary into a locale, keeping the keys it already had. */
  addTranslations(locale: string, translations: TranslationTree | null | undefined): void {
    if (!translations || (typeof translations === "object" && Object.keys(translations).length === 0)) return;

    if (!this.translations[locale]) this.translations[locale] = {};

    this.translations[locale] = this.deepMerge(this.translations[locale], translations);
  }

  deepMerge(target: TranslationTree, source: TranslationTree): TranslationTree {
    const result: TranslationTree = { ...target };
    for (const key in source) {
      const value = source[key];
      if (value !== undefined && typeof value === "object" && !Array.isArray(value)) {
        const current = result[key];
        const base: TranslationTree = current !== undefined && typeof current === "object" && !Array.isArray(current) ? current : {};
        result[key] = this.deepMerge(base, value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Run every contributor registered for a locale, merging each as it answers.
   * One that throws is reported and skipped, so a missing package file cannot
   * cost the project its own translations. The locale counts as loaded once at
   * least one contributor answered, which leaves a total failure retryable.
   */
  async loadLocale(locale: string): Promise<void> {
    if (this.loadedLocales.has(locale)) return;

    const loaders = this.localeLoaders[locale];
    if (!loaders?.length) return;

    let loaded = 0;
    for (const loader of loaders) {
      try {
        const bundle = await loader();
        this.addTranslations(locale, bundleTree(bundle));
        loaded += 1;
      } catch (error: unknown) {
        this.warn({ type: "locale_load_failed", locale, error });
      }
    }

    if (loaded) this.loadedLocales.add(locale);
  }

  async setLanguage(locale: string): Promise<string> {
    const version = ++this._loadingVersion;

    await this.loadLocale(locale);

    if (version !== this._loadingVersion) return this.currentLocale;

    this.currentLocale = locale;

    return locale;
  }

  getLanguage(): string {
    return this.currentLocale;
  }

  getAvailableLocales(): string[] {
    if (this.availableLocales.length) return [...this.availableLocales];

    const locales = new Set<string>([...Object.keys(this.localeLoaders), ...Object.keys(this.translations)]);
    return Array.from(locales);
  }

  getDefaultLocale(): string {
    return this.defaultLocale;
  }

  getBaseLocale(): string {
    return this.defaultLocale;
  }

  /**
   * `t`, but a key with no value answers the fallback rather than the key
   * itself. A host that has not declared a namespace reads English words, not
   * "relative.today".
   */
  tOr(key: string, fallback: string, params: Record<string, unknown> = {}): string {
    const found = this.t(key, params);
    return found === key ? fallback : found;
  }

  t(key: string, params: Record<string, unknown> = {}): string {
    if (!key) return "";
    const out = resolve(this.translations, this.currentLocale, key, params, { fallback: this.fallbackLocale });
    if ("value" in out) return out.value;
    this.warn(MISSES[out.miss](key, this.currentLocale));
    return key;
  }
}
