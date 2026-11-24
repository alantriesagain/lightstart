// node-only
/** @file The seam a localized route uses: `applyLanguage` sets the language at once, and `setLanguage` tells the handler that moves the URL. */
import { assert, done, same, test } from "./check.ts";
import { applyLanguage, configureI18n, onLanguageSet, setLanguage, t } from "../index.ts";

await test("applyLanguage makes a language current at once, and setLanguage tells its handler", async () => {
  const instance = configureI18n({ locales: ["en", "pt"], defaultLocale: "en", dictionaries: { en: { hi: "Hello" }, pt: { hi: "Olá" } } });
  const seen: string[] = [];
  onLanguageSet((locale) => seen.push(locale));

  applyLanguage("pt");
  assert.equal(instance.getLanguage(), "pt");
  assert.equal(t("hi"), "Olá");

  await setLanguage("en");
  assert.equal(instance.getLanguage(), "en");
  same(seen, ["en"]);

  onLanguageSet(null);
  await setLanguage("pt");
  same(seen, ["en"], "a cleared handler hears nothing");
});

done();
