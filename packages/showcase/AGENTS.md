# Working on @lightstart/showcase

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | The data and loaders, re-exported from `lib/` |
| `lib/load.ts` | `componentTags()` (the components' `tags.json`), `loadDemo`, `loadComponent`, `modulePath`, `stylePath`: a component's files, found through the tag table, cached |
| `lib/registry.ts`, `lib/categories.ts`, `lib/example-parser.ts` | The components by category, a definition and its doc comment read |
| `lib/skins.ts`, `lib/theme-vars.ts`, `lib/starter-theme.ts`, `lib/collect.ts`, `lib/demos.ts` | Skins, stylesheet variables, the starter theme, theme tokens, an example's markup |
| `views/` | The views, JavaScript with JSDoc as `@lightstart/components` writes components; each defines its tag and the components it draws |
| `check/rules/` | `pages-through-components`, loaded by `light check` from this package |
| `test/` | `lib/`'s tests on `@lightstart/test/assert.ts` through `test/check.ts`, under node and natively; `views/*.browser.test.js` in Chromium |

## Rules the sources keep

- The component list is the tag table, never a list kept here: a component the components package gains shows up by itself.
- A component's files are found through `modulePath`/`stylePath`, never a path written by hand.
- The views read no host: a link to another page is a `showcase-open` event, and the host navigates.
- A fallback array is typed (`const xs: string[] = … : []`), since an untyped `[]` cannot stand in for a typed one under scriptc.
