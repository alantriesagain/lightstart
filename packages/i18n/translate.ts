/**
 * The pure half of translation: dictionaries in, a sentence out, nothing read
 * off an app. `I18n` is built on it, and code that runs where there is no app
 * at all imports it directly: a server rendering a notification, a node test
 * reading a tree.
 *
 * `pick` degrades a wanted language to what the dictionaries hold: the exact
 * tag, then any dictionary sharing its two-letter language, then the fallback.
 * `resolve` answers `{ value }` or `{ miss }`, so each caller keeps its own
 * policy for a miss: `I18n.t` warns and echoes the key, a lock-screen line
 * answers nothing.
 */

import type { ResolveOptions, ResolveResult, TranslationTree, TranslationValue } from "./types.ts";

const PLURAL_KEYS: string[] = ["zero", "one", "two", "few", "many", "other"];

/** The value at a dotted `path`, or `undefined` off the tree. */
export const lookup = (tree: TranslationTree | undefined, path: string): TranslationValue | undefined =>
  path.split(".").reduce<TranslationValue | undefined>(
    (node, key) => (node !== undefined && typeof node === "object" ? node[key] : undefined),
    tree,
  );

/** Whether `value` is a group of plural forms rather than a namespace. */
export const isPluralTree = (value: TranslationValue | undefined): value is TranslationTree =>
  value !== undefined && typeof value === "object" && !Array.isArray(value) && Object.keys(value).some((key) => PLURAL_KEYS.includes(key));

/**
 * The CLDR plural category a `count` falls into for `locale`. The native build
 * has no `Intl.PluralRules`, so the common cardinal rule sets are written out;
 * a language not listed uses the English one/other split.
 */
export const pluralCategory = (locale: string, count: number): string => {
  const language = locale.slice(0, 2).toLowerCase();
  const n = Math.abs(Math.trunc(count));
  const mod10 = n % 10;
  const mod100 = n % 100;
  const between = (min: number, max: number): boolean => n >= min && n <= max;

  if (language === "ar") {
    if (n === 0) return "zero";
    if (n === 1) return "one";
    if (n === 2) return "two";
    if (mod100 >= 3 && mod100 <= 10) return "few";
    if (mod100 >= 11 && mod100 <= 99) return "many";
    return "other";
  }
  if (language === "ru" || language === "uk") {
    if (mod10 === 1 && mod100 !== 11) return "one";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
    return "many";
  }
  if (language === "pl") {
    if (n === 1) return "one";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
    return "many";
  }
  if (language === "cs" || language === "sk") {
    if (n === 1) return "one";
    if (between(2, 4)) return "few";
    return "other";
  }
  if (language === "pt" || language === "fr") return Number.isInteger(count) && n <= 1 ? "one" : "other";
  return count === 1 ? "one" : "other";
};

/** The plural form `count` asks for under `locale`, degrading to `other` and then the first form. */
export const selectPlural = (forms: TranslationTree, locale: string, count: number): TranslationValue =>
  forms[pluralCategory(locale, count)] || forms.other || forms[Object.keys(forms)[0]] || "";

/**
 * Fill `{name}` holes from `vars`; a hole with no value stays as written, so a
 * missing variable is visible rather than silently blank.
 */
export const interpolate = (str: string, vars: Record<string, unknown> = {}): string =>
  str.replace(/\{(\w+)\}/g, (match, key: string) => (vars[key] !== undefined ? String(vars[key]) : match));

/**
 * The dictionary to answer a wanted language from: the exact tag, else one
 * sharing its two-letter language (`pt` reads `pt-BR`), else the fallback.
 */
export const pick = (dicts: Record<string, TranslationTree | undefined>, lang: unknown, fallback = "en"): { locale: string; tree: TranslationTree } | null => {
  const want = String(lang || "").trim();
  const language = want.slice(0, 2).toLowerCase();
  const siblings: string[] = language ? Object.keys(dicts).filter((key) => key.slice(0, 2).toLowerCase() === language) : [];
  const found = [want, ...siblings, fallback].find((key) => key && dicts[key]);
  const tree = found ? dicts[found] : undefined;
  return found && tree ? { locale: found, tree } : null;
};

/** A sentence and the locale that answered, or the miss that kept it from answering. */
export const resolve = (dicts: Record<string, TranslationTree | undefined>, lang: unknown, key: string, vars: Record<string, unknown> = {}, { fallback = "en" }: ResolveOptions = {}): ResolveResult => {
  if (!key) return { miss: "not_found" };
  const picked = pick(dicts, lang, fallback);
  let locale = picked ? picked.locale : fallback;
  let found = picked ? lookup(picked.tree, key) : undefined;
  if (found === undefined && locale !== fallback) {
    locale = fallback;
    found = lookup(dicts[fallback], key);
  }
  if (found === undefined) return { miss: "not_found" };
  if (isPluralTree(found)) {
    const count = Number(vars["n"] !== undefined ? vars["n"] : vars["count"]);
    if (!Number.isFinite(count)) return { miss: "plural_missing_count" };
    found = selectPlural(found, locale, count);
  }
  if (typeof found !== "string") return { miss: "not_string" };
  return { value: interpolate(found, vars), locale };
};

/** One sentence, or `undefined` when the dictionaries have nothing to say. */
export const translate = (dicts: Record<string, TranslationTree | undefined>, lang: unknown, key: string, vars: Record<string, unknown> = {}, options: ResolveOptions = {}): string | undefined => {
  const out = resolve(dicts, lang, key, vars, options);
  return "value" in out ? out.value : undefined;
};
