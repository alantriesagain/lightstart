# @lightstart/i18n

Translations for a light app, as one implementation of light's translation contract: `@lightstart/light/i18n` is what components read (a sentence for a key, the language, the languages on offer, a change of language), and any library plugs into it with `configureTranslation`, as any router plugs into `@lightstart/light/navigation`. This package is light's own. Dictionaries hold a language's words, `configureI18n` makes the one instance a page reads from, and `t(key, params)` answers a sentence, with plural forms chosen by count and `{name}` holes filled from the params. The current language is a signal, so a view that reads a translation re-renders when `setLanguage` changes it.

| Export | What |
|---|---|
| `configureI18n({ locales?, defaultLocale?, dictionaries?, onWarn? })` | Makes the instance, merges the dictionaries, gives it to light as its translation (`configureTranslation(new I18nTranslation())`), and reads `$i18n` models in the current language; answers the `I18n` |
| `t(key, params?)` | The sentence for a key, or the key itself when there is none |
| `language()` | The current language |
| `setLanguage(locale)` | Loads the locale's registered dictionaries, makes it current, and keeps it in `localStorage`; answers a promise of the locale |
| `addDictionary(locale, dictionary)` | Merges a dictionary into a language, keeping the keys it already had |
| `I18nTranslation` | This package as light's `Translation`: what `configureI18n` hands `configureTranslation` |
| `localizedUrl(url, locale, defaultLocale)` | A path in a locale: prefixed unless the locale is the default one or the path carries a prefix already |
| `translationsOf(model, canonicalId)` | Every locale's row of one record, read past the current-language query |
| `createLocaleQueryHook`, `createLocalizedQueryHook` | The query hooks `configureI18n` registers: a model whose schema declares `$i18n` is read in the current language |
| `i18nSlugHooks(source?, slug?)`, `i18nPublishingHooks()`, `createI18nHooks(source?, slug?)`, `generateCanonicalId()`, `generateUniqueSlugForLocale(...)` | Model hooks for translated records: a slug unique within its locale, a canonical id the translations share, publishing kept in step across them |
| `I18n` | The class behind the instance: `t`, `tOr`, `addTranslations`, `registerLocale`, `setLanguage`, `language` (a `Signal<string>`), `warnings` |
| `translate`, `resolve`, `pick`, `lookup`, `interpolate`, `selectPlural`, `pluralCategory`, `isPluralTree` | The pure functions, for code that runs with no app at all |

A dictionary is a tree of strings, nested by namespace. A group whose keys are plural categories (`zero`, `one`, `two`, `few`, `many`, `other`) is a plural tree, and the form is chosen from the count under the language that answered.

```ts
import { configureI18n, setLanguage, t } from "@lightstart/i18n";

configureI18n({
  locales: ["en", "pt"],
  defaultLocale: "en",
  dictionaries: {
    en: {
      greeting: "Hello, {name}",
      nights: { one: "{count} night", other: "{count} nights" },
    },
    pt: {
      greeting: "Olá, {name}",
      nights: { one: "{count} noite", other: "{count} noites" },
    },
  },
});

t("greeting", { name: "Mika" });   // "Hello, Mika"
t("nights", { count: 1 });         // "1 night"
t("nights", { count: 3 });         // "3 nights"

setLanguage("pt");                 // persists "pt"; t() now answers Portuguese
t("greeting", { name: "Mika" });   // "Olá, Mika"
```

A light view reads `t()` in its render; because `t` reads the language signal, switching the language re-renders it:

```ts
import { View } from "@lightstart/light";
import { html } from "@lightstart/light/html";
import { t } from "@lightstart/i18n";

export default View.define("lc-hello", {
  render() {
    return html`<h1>${t("greeting", { name: "Mika" })}</h1>`;
  },
});
```

`configureI18n` gives the instance to light as its translation, so a component's own words (`@lightstart/components`' `lcText`, `lc-language-switcher`) resolve through the same dictionaries and draw again when the language changes. A key with no sentence answers the key, which light reads as "keep the component's own words". Another library takes this package's place by passing its own `Translation` to `configureTranslation`.

## Plurals

Use `n` or `count` to choose the form. The plural categories are this package's own rules for English, Portuguese, French, Spanish, Arabic, Russian and Ukrainian, Polish, Czech and Slovak (scriptc compiles no `Intl.PluralRules`); another language takes English's `one`/`other`, and a fractional count is read as its integer part. A plural tree the answering language lacks is read from the fallback language, and its count is chosen there. A plural with no count is a miss, not a silent `other`.

## Interpolation

`{name}` holes are filled from the params with `String`; a hole with no value stays as written, so a missing variable is visible rather than silently blank.

## Tests

```bash
light test @lightstart/i18n     # under node and natively, the outputs equal
```
