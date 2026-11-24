# Working on @lightstart/i18n

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `translate.ts` | The pure functions: `lookup`, `isPluralTree`, `pluralCategory`, `selectPlural`, `interpolate`, `pick`, `resolve`, `translate` |
| `i18n.ts` | `I18n`: dictionaries per language, the `language` signal, `t(key, params)`, locale loaders and warnings |
| `index.ts` | `configureI18n`, `t`, `language`, `setLanguage`, `applyLanguage`, `onLanguageSet`, `addDictionary`, and `I18nTranslation`, this package as light's `Translation` |
| `current.ts` | The instance in use, read by `index.ts` and the model hooks |
| `query-hook.ts` | The query hooks reading an `$i18n` model in the current language, registered by `configureI18n` |
| `model-hooks.ts` | Slugs unique per locale, the canonical id, publishing across translations |
| `urls.ts` | `localizedUrl` over `@lightstart/router`'s `localeOfPath`, and `translationsOf` |
| `types.ts` | `TranslationTree`, `TranslationValue`, `LocaleLoader`, `I18nWarning` and the rest |
| `check/rules/` | `locale-imports-nothing`, which light loads from a dependency's `check/rules/` |
| `test/` | Plain scripts on `@lightstart/test/assert.ts` through `test/check.ts`, run under node and natively, the outputs equal |
| `scripts/pack.js` | What npm gets: JavaScript with a `.d.ts` per module, and the check rule as written (`npm run pack`, into `dist/`) |

## Rules the sources keep

- `translate.ts` is pure: dictionaries in, a result out, nothing read off an app or a signal.
- The current language is the `language` signal, never a separate field; `t()` reads it so a view that calls `t()` follows it. `applyLanguage` sets it at once for a route change; `onLanguageSet` is the hook `setLanguage` calls after a successful change, which the generated `.light/locales.ts` uses to navigate. Neither imports `@lightstart/app`: the generation wires the two, and the app's run imports no i18n.
- A miss warns through `warnings` and `onWarn`, then answers the key, so a caller can tell a miss from a value by comparing.
- Components never import this package: they read light's contract (`@lightstart/light/i18n`), which `configureI18n` plugs this package into, so another library can replace it. A view of its own (the language switcher) lives in `@lightstart/components` on the contract.
- There is no app object or event bus here: what the source read from one is a parameter, the instance in use (`current.ts`), or light's contract.
- A fallback array is typed (`const seen: string[] = … : []`), since an untyped `[]` cannot stand in for a typed one under scriptc.
