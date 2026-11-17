import { assert, done, same, test } from "./check.ts";
import { createLocaleQueryHook, createLocalizedQueryHook } from "../query-hook.ts";
import type { ModelSchema, QueryHook, QueryHookContext, QueryOptions } from "@lightstart/light/model/types.ts";

const schemaOf = (value: Record<string, unknown>): ModelSchema => value as unknown as ModelSchema;

const localeHook = (language = "pt", saved: unknown = null, enabled = true): QueryHook =>
  createLocaleQueryHook({ getLanguage: () => language, savedLocale: () => saved, enabled });

const localeCtx = (opts: QueryOptions, i18n = true): QueryHookContext => ({
  model: "posts",
  schema: schemaOf(i18n ? { $i18n: true } : {}),
  opts,
});

const options = (hook: QueryHook, context: QueryHookContext): QueryOptions => hook(context) ?? {};

test("a $i18n model is scoped to the active language", () => {
  const result = options(localeHook(), localeCtx({ limit: 2 }));
  same(result.limit, 2);
  same(result.where, { locale: "pt" });
});

test("an explicit locale, ignoreLocale, a plain model and a disabled i18n leave the options alone", () => {
  assert.equal(localeHook()(localeCtx({ where: { locale: "es" } })), undefined);
  assert.equal(localeHook()(localeCtx({ ignoreLocale: true })), undefined);
  assert.equal(localeHook()(localeCtx({}, false)), undefined);
  assert.equal(localeHook("pt", null, false)(localeCtx({})), undefined);
});

test("the saved locale overrides the default English", () => {
  same(options(localeHook("en", "fr"), localeCtx({})).where, { locale: "fr" });
  same(options(localeHook("", null), localeCtx({})).where, { locale: "en" });
});

const localizedHook = (language = "pt-BR", fallback = "en", enabled = true): QueryHook =>
  createLocalizedQueryHook({ getLanguage: () => language, defaultLocale: () => fallback, enabled });

const localizedCtx = (opts: QueryOptions, fields: string[] | null = ["name"]): QueryHookContext => ({
  model: "place",
  schema: schemaOf(fields ? { $localized: fields } : {}),
  opts,
});

test("a $localized model is read in the active language, as an option rather than a where", () => {
  const result = options(localizedHook(), localizedCtx({ where: { slug: "x" }, limit: 1 }));
  same(result.where, { slug: "x" });
  same(result.limit, 1);
  same(result.locale, "pt-BR");
});

test("the default locale, an explicit locale, an empty list, a plain model and a disabled i18n leave the options alone", () => {
  assert.equal(localizedHook("en")(localizedCtx({})), undefined);
  assert.equal(localizedHook()(localizedCtx({ locale: "es" })), undefined);
  assert.equal(localizedHook()(localizedCtx({ locale: "" })), undefined, "an empty locale is the caller asking for the canonical");
  assert.equal(localizedHook()(localizedCtx({}, [])), undefined);
  assert.equal(localizedHook()(localizedCtx({}, null)), undefined);
  assert.equal(localizedHook("pt-BR", "en", false)(localizedCtx({})), undefined);
});

done();
