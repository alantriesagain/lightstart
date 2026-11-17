/** @file I18n: the dictionaries a language answers from, the language signal, and the warnings a miss makes. */
import { assert, done, same, test } from "./check.ts";
import { I18n } from "../i18n.ts";
import type { I18nWarning, LocaleBundle, TranslationTree } from "../types.ts";

const withTree = (locale: string, tree: TranslationTree, fallback = "en"): I18n => {
  const i18n = new I18n();
  i18n.fallbackLocale = fallback;
  i18n.addTranslations(locale, tree);
  i18n.currentLocale = locale;
  return i18n;
};

const tree = (value: TranslationTree): LocaleBundle => ({ default: value });

test("a key with no value answers the key, so a caller cannot tell a miss from a value", () => {
  const i18n = withTree("en", { a: { b: "B" } });
  assert.equal(i18n.t("a.b"), "B");
  assert.equal(i18n.t("a.nope"), "a.nope");
});

test("tOr answers the fallback on a miss, which is what a relative date needs", () => {
  const i18n = withTree("en", { a: { b: "B" } });
  assert.equal(i18n.tOr("a.b", "fallback"), "B");
  assert.equal(i18n.tOr("a.nope", "fallback"), "fallback");
  assert.equal(i18n.tOr("relative.daysAgo", "3 days ago", { n: 3 }), "3 days ago");
});

test("a plural object selects by count and warns rather than guessing without one", () => {
  const i18n = withTree("en", { n: { one: "{count} night", other: "{count} nights" } });
  assert.equal(i18n.t("n", { count: 1 }), "1 night");
  assert.equal(i18n.t("n", { count: 3 }), "3 nights");
  assert.equal(i18n.t("n"), "n", "no count is a miss, not a silent 'other'");
});

test("a value the active locale lacks falls back to the declared fallback locale", () => {
  const i18n = new I18n();
  i18n.fallbackLocale = "en";
  i18n.addTranslations("en", { only: { here: "English" } });
  i18n.addTranslations("pt-BR", {});
  i18n.currentLocale = "pt-BR";
  assert.equal(i18n.t("only.here"), "English");
});

test("a miss is collected and handed to onWarn", () => {
  const seen: I18nWarning[] = [];
  const i18n = new I18n({ onWarn: (warning) => seen.push(warning) });
  i18n.addTranslations("en", { a: "A" });
  i18n.currentLocale = "en";

  assert.equal(i18n.t("nope"), "nope");
  same(i18n.warnings, [{ type: "translation_not_found", key: "nope", locale: "en" }]);
  same(seen, i18n.warnings);
});

await test("the language signal carries the current language a view follows", async () => {
  const i18n = new I18n();
  assert.equal(i18n.language.value, "en");
  await i18n.setLanguage("pt-BR");
  assert.equal(i18n.language.value, "pt-BR");
  assert.equal(i18n.getLanguage(), "pt-BR");
});

await test("a locale loads from every contributor, in the order they registered", async () => {
  const i18n = new I18n();
  const seen: string[] = [];
  i18n.registerLocale("en", async () => { seen.push("lc"); return tree({ "lc-form": { required: "{label} is required" } }); });
  i18n.registerLocale("en", async () => { seen.push("project"); return tree({ nav: { map: "Map" } }); });

  await i18n.setLanguage("en");

  same(seen, ["lc", "project"], "every loader runs, package first");
  assert.equal(i18n.t("nav.map"), "Map");
  assert.equal(i18n.t("lc-form.required", { label: "Email" }), "Email is required");
});

await test("the last contributor wins a collision, which is how a project overrides a package", async () => {
  const i18n = new I18n();
  i18n.registerLocale("pt-BR", async () => tree({ "lc-form": { required: "{label} é obrigatório", loadFailed: "Falhou" } }));
  i18n.registerLocale("pt-BR", async () => tree({ "lc-form": { required: "Preencha {label}" } }));

  await i18n.setLanguage("pt-BR");

  assert.equal(i18n.t("lc-form.required", { label: "Email" }), "Preencha Email", "the project's wording");
  assert.equal(i18n.t("lc-form.loadFailed"), "Falhou", "and the package's other keys survive");
});

await test("an eager contribution does not cancel the lazy ones", async () => {
  const i18n = new I18n();
  let ran = false;
  i18n.registerLocale("en", async () => { ran = true; return tree({ nav: { map: "Map" } }); });
  i18n.addTranslations("en", { "lc-modal": { close: "Close" } });

  await i18n.setLanguage("en");

  assert.equal(ran, true, "the registered loader still runs");
  assert.equal(i18n.t("nav.map"), "Map", "and its keys resolve");
  assert.equal(i18n.t("lc-modal.close"), "Close", "alongside the eager ones");
});

await test("a locale already loaded is not fetched twice", async () => {
  const i18n = new I18n();
  let runs = 0;
  i18n.registerLocale("en", async () => { runs += 1; return tree({ nav: { map: "Map" } }); });

  await i18n.setLanguage("en");
  await i18n.setLanguage("pt-BR");
  await i18n.setLanguage("en");

  assert.equal(runs, 1);
});

await test("one failing contributor does not take the others down", async () => {
  const i18n = new I18n();
  i18n.registerLocale("en", async () => { throw new Error("404"); });
  i18n.registerLocale("en", async () => tree({ nav: { map: "Map" } }));

  await i18n.setLanguage("en");

  assert.equal(i18n.t("nav.map"), "Map");
});

await test("a failed contributor is reported as a warning", async () => {
  const seen: I18nWarning[] = [];
  const i18n = new I18n({ onWarn: (warning) => seen.push(warning) });
  i18n.registerLocale("en", async () => { throw new Error("404"); });

  await i18n.setLanguage("en");

  same(seen.map((warning) => warning.type), ["locale_load_failed"]);
});

done();
