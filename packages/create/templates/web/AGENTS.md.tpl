# Working in __TITLE__

__LANGUAGE_INTRO__A web app on `@lightstart/app`: the folders are the app, and light writes the wiring. `src/app.__EXT__` names the few choices, the models, controllers and views live in their folders, and `src/routes.__EXT__` maps paths to view tags. `light` generates `.light/app.__EXT__` and `.light/__MAIN__`; `index.html` loads `.light/__MAIN__`.

## The folders

| Path | Holds |
|---|---|
| `src/app.__EXT__` | `defineApp({ name, host: "web", theme?, stores?, root?, args?, url?, locale? })`: `url` is the site's address (the build's sitemap), `locale` the default language; `stores` by name (`main` is IndexedDB unless it names another kind, `{ cache: { kind: "memory" } }` beside it), `args` read from the URL query |
| `src/models/<name>.__EXT__` | One model, default-exported; the file name is the model's name |
| `src/seed.__EXT__` | Optional: rows by model name (`{ note: [{ text: "…" }] }`), added once into an empty store before the controllers start; `src/seed.dev.__EXT__` holds demo rows `light build` leaves out |
| `src/controllers/<name>.__EXT__` | One controller, default-exported; the file name is its name |
| `src/views/<tag>.__EXT__` | One view, registering its tag; the file name is the tag |
| `src/routes.__EXT__` | Optional: `{ "/path": { view: "<tag>", name?, title? } }`; `/notes/:id` sets `id` on the view as a prop |
| `src/locales/<lang>.__EXT__` | With `@lightstart/i18n` installed: the app's words, read with `t(key)`, merged over the words its packages ship |
| `src/styles.css` | The generated components' stylesheet, then the app's own rules |
| `test/` | Browser tests, run by `light test` |

A view reaches its controller with an import, `import notes from "../controllers/notes.__EXT__"`. A controller imports its models the same way, `import note from "../models/note.__EXT__"`. __ROW_TYPE__ One controller reaches another by name with `sync:` (the file name is the name), never by importing its instance.

## Generated files

`.light/app.__EXT__`, `.light/__MAIN__` and the manifest are written by `light app` (and by `serve`, `build` and `test` before they start). Never edit them, and never commit them: `.light/` is in `.gitignore` beside `.deployed/`.

The app layer opens the stores (a model picks one with its schema's `$adapter`, `main` when it names none), names and starts the controllers, applies the theme, builds the router from `src/routes.__EXT__` and mounts the root view. It also writes `.light/components.__EXT__` and `.light/components.css` for a project on `@lightstart/components`: the views write `lc-*` tags and the generation defines them and imports their stylesheets, so a view imports no component and calls no `View.define`.

## Scripts

| Command | Does |
|---|---|
| `pnpm dev` | `light serve --watch`: the app on the first free port from 3000, reloading on a change |
| `pnpm build` | `light build`: bundles into `.deployed/builds/<id>`, with `404.html`, `robots.txt`, `_headers` and (given `url`) `sitemap.xml` for a static host, and points `.deployed/current` at it |
| `pnpm test` | `light test test/*.test.*`: the browser tests in headless Chromium (`pnpm exec playwright install chromium` once) |
| `pnpm test:e2e` | `node --test test/*.e2e.*`: builds the app, then opens the built pages in headless Chromium |
| `pnpm check` | `light check`: light's conventions over the sources |
| `pnpm lint` | `light lint`: eslint with the project's config |
| `pnpm typecheck` | `light typecheck`: `tsc --noEmit` over `src/`, `test/` and the generated `.light/` |
| `pnpm verify` | `light verify`: check, lint, typecheck and test in order |

Run `pnpm verify` before committing.

The dev server builds the page's importmap from `package.json`; the build resolves bare specifiers through `node_modules`. Never write an importmap in `index.html`.

## A view

A view is a `View` subclass whose `render()` returns an `html` template. Reading a signal in `render()` subscribes the view to it.

__VIEW_EXAMPLE__

## Routes, tests, forms and words

`<app-container>` in the root view draws the view the path answers; `navigate(path)` from `@lightstart/app/web` goes to another, and a plain `<a href="/path">` does too. A view that a path with parameters answers declares a prop for each one.

A test opens the app in the page with `openPage(manifest, { path, args })` from `@lightstart/app/web/test` (stores and history in memory): `await page.find(selector)`, `await page.shows(text)`, `await page.navigate(path)`, then `await page.stop()`.

`pnpm test:e2e` tests the build itself: it runs `light build`, then opens `/` and each concrete route with `openBuilt(latestBuild("."), path)` and fails on a page error or a failed request. Run it before publishing or after changing the build, prerendering or the routes; `pnpm test` stays fast and does not run it.

A form over a model is `<lc-form .fields=${fieldsForModel(schema)}>` with `@lightstart/form`, its submit checked with `validateForm`. Words go through `t(key)` from `@lightstart/i18n`, and `<lc-language-switcher>` changes the language.

A `View` subclass's render follows the signals it reads. A view written as a definition (`View.define({ tag, props, render })`) does not: it reads a `defineController`'s state through props declared `sync: "<controller>"`, which needs `View.use(syncPlugin)` from `@lightstart/light/controller/view` in `src/app.__EXT__`.

## Read more

| What | Where |
|---|---|
| The app layer: `defineApp`, the folders, the generated wiring, the web host, the test helper | `@lightstart/app`'s README |
| Views, `html`, signals, props, models, controllers, the theme | `@lightstart/light`'s README |
| Every `lc-*` tag, its props and its stylesheet | `@lightstart/components`'s README |
| Forms from a model; translations | `@lightstart/form`'s and `@lightstart/i18n`'s READMEs |
| `light serve`, `light build`, `light test`, `light check` | `@lightstart/dev`, `@lightstart/build`, `@lightstart/cli` |
