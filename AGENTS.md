# Working in this repository

Each package has its own rules where it has an `AGENTS.md` (`packages/server/AGENTS.md`, `packages/components/AGENTS.md`); this file holds what applies to all of them.

## Using light

Start every new project with `light new <kind> <name>`, run from a light checkout. The generator links that checkout because the packages are not on npm yet; `--light <path>` names another checkout, and `--npm` writes published version ranges once they exist.

| Kind | What it gives |
|---|---|
| `web` | A web app on `@lightstart/app`: views, a model, a controller and routes, served by `light serve` |
| `tui` | A terminal app on `@lightstart/app`: a model, a controller and views, compiled by `scriptc` |
| `desktop` | A light page in the desktop shell, with a backend `scriptc` compiles |
| `package` | A light package: modules, tests, a README and the pack script |

The project's own `AGENTS.md` is the reference for its kind: where files go, what each script does, how to test and what the host expects. Read it before changing code.

A web or terminal project is an app on `@lightstart/app`: `src/app.ts` names its host, `src/models/`, `src/controllers/` and `src/views/` hold its pieces, and `src/routes.ts` maps paths to view tags on the web. Light writes the wiring into `.light/`, which is generated and never committed or edited. A view imports its controller, a controller imports its models, and one controller reaches another by name with `sync:`.

The everyday commands are `pnpm dev` (web, tui, desktop), `pnpm build`, `pnpm test`, `pnpm check`, `pnpm lint`, `pnpm typecheck` and `pnpm verify` (all four gates). A project's own scripts are the source of truth.

Conventions every kind shares:

- TypeScript with erasable syntax: no `enum`, `namespace`, parameter properties or decorators, so node runs the sources after stripping types and `scriptc` can compile them.
- No `any`. Narrow `unknown` with `typeof`, `instanceof` or `Array.isArray`.
- Run `pnpm verify` before committing: `light verify` runs `check`, `lint`, `typecheck` and `test` in order.
- Test with `light test` in a web app, and with `node --test` (or the project's test script) elsewhere.
- Never hand-write an importmap. `light serve` builds it from `package.json`.
- Light's package READMEs are the reference for an API; every package under `packages/` has one.

## What light has

Reach for these before writing your own; each package's README is its reference.

| A project needs | Package | The part to know |
|---|---|---|
| The app's folders, wiring and run | `@lightstart/app` | `defineApp`, stores by name (`memory`, `indexeddb`, `jsonl`, `sql`, a `StoreKind` of the project's own), routes, `<app-container>`, `navigate`, `currentView`, `currentParams`; hosts `@lightstart/app/web` and `/tui`, and `@lightstart/app/static` rendering a page in node |
| Views, templates, signals, models, controllers, the theme | `@lightstart/light` | `View`, `html`, `signal`, `defineModel` with `T` fields, `defineController` and the `Controller` class, `liveRows`, `applyTheme` |
| UI components | `@lightstart/components` | the `lc-*` tags; in an app the generation defines the tags a view writes and their stylesheets |
| Forms from a model | `@lightstart/form` | `fieldsForModel(schema)` for `<lc-form .fields>`, `inferFields`, `validateForm` on submit |
| Translations | `@lightstart/i18n` | `configureI18n`, `t`, `setLanguage`; plugs into light's contract `@lightstart/light/i18n`, which any library can implement; `lc-language-switcher` |
| A routes table outside an app | `@lightstart/router` | `RouterCore` over a browser or memory history; light's `Navigation` contract |
| A component catalogue | `@lightstart/showcase` | `showcase-catalogue`, `showcase-component-doc` and the theme tools, over the components' `tags.json` and demos |
| An HTTP backend | `@lightstart/server` | routes, middleware and plugins over one `Context`; node, fetch and lambda adapters |
| SQLite | `@lightstart/sqlite` | one synchronous driver, node's or native |
| Markdown, syntax colours | `@lightstart/markdown`, `@lightstart/highlight` | `parse`; a line tokenizer for terminal views and `lc-code-block` |
| Terminal UI pieces | `@lightstart/tui`, `@lightstart/tui-markdown` | the palette and what package views draw with |
| The `light` commands | `@lightstart/cli` with `@lightstart/dev`, `@lightstart/build`, `@lightstart/native` | `serve`, `build`, `run`, `test`, `check`, `lint`, `typecheck`, `verify`, `new` |
| Tests that run under node and natively | `@lightstart/test` | `ok`, `eq`, `done` in `assert.ts` |

## Patterns an app keeps

Follow the shape `light new` gave the project and the choices it already made (its host, its store kinds, its controller style); extend them rather than introduce a second way.

- **One file, one piece.** `src/models/<name>.ts`, `src/controllers/<name>.ts`, `src/views/<tag>.ts`: the file name is the name, a view module defines its tag (`View.register(tag, Class)` or `View.define(definition)`), and `.light/` picks them all up. Never import a view's module by hand to make it exist.
- **Controllers.** A `Controller` subclass compiles natively and follows a model with `readonly rows = liveRows<Row>(this, model, () => query)`, which starts with the controller and comes back after a restart. A `defineController` literal is a sync target: a view's prop declared `T.string({ sync: "<controller>" })` follows it, once the page installs `View.use(syncPlugin)` (`@lightstart/light/controller/view`) before its views are defined. Its own `sync: { prop: "local" }` needs the page to `registerAdapter("local", localStorage)`.
- **State, occurrences and a child's news.** State is a signal: what a view or a controller reads now (the route, the language, a list, a setting), never a "changed" event someone fires beside it. An occurrence is an event, each one delivered (a request opened, a message about to be sent). A component telling its parent something happened is a DOM event through `$emit` (`form-submit`, `field-change`), its public boundary. A global "something changed, go and look" event is the one shape to avoid: make the state a signal instead.
- **Views and signals.** A `View` subclass's render follows the signals it reads. A definition view (`defineComponent` then `View.define`) does not: it reads shared state through `sync:` props, or it is written as a class.
- **Routes.** `src/routes.ts` maps a path to a view tag; `/notes/:id` sets `id` on the view as a prop (declare it), and the same view updates when only a parameter changes. Go with `navigate(path)`; a plain `<a href>` to an app path goes through the router too.
- **Components.** A web view writes `<lc-*>` tags and imports nothing; `src/styles.css` starts with `@import "../.light/components.css"`. `index.html` loads `/src/styles.css` and `/.light/main.ts` from the root, so nested routes and a built `404.html` find them.
- **Words.** With `@lightstart/i18n` installed, `src/locales/<lang>.ts` holds the app's words, merged over the `locales/` of every package that declares `light.locales: true`, and `defineApp({ locale })` names the default.
- **Arguments.** `defineApp({ args })` declares them; a controller reads `app.args.string("name")`. The web host fills them from the URL query, the terminal from argv (with its own `--data`, `.data` by default, `--scheme` and `--route`).

## Testing

- An app's logic: `openApp(manifest, { args, kinds })` from `@lightstart/app/test`, over memory stores.
- A terminal app's screen: `mountApp(manifest, opened, { cols, rows })` from `@lightstart/app/tui/test`, keys through `renderer.decoder.pushText`.
- A web app's page: `openPage(manifest, { path, args })` from `@lightstart/app/web/test`, in headless Chromium: `find`, `shows`, `navigate`, `stop`. It mounts in the test page with memory stores and a history in memory; link the app's stylesheet when a test measures layout.
- A package's tests are plain scripts on `@lightstart/test/assert.ts` (`ok`, `eq`, `done`) that `light test` runs under node and natively, the outputs equal: no `node:test` reporter (its timings differ), no `assert.deepEqual` (compare JSON), typed fallback arrays (`const xs: string[] = c ? a : []`). `// node-only` as a test's first line skips the native run.

## Building and publishing

`light build` bundles the page into `.deployed/builds/<id>`. For an app it also writes `404.html` (so a static host boots the app on any path), `robots.txt`, `_headers` (hashed bundles cached for good) and, given `defineApp({ url })`, `sitemap.xml` from the routes' concrete paths (a `params` route filled from its values, `spa: true`, wildcards and redirects left out). `light build --prerender` (or `defineApp({ prerender: true })`) renders each of those paths into its own `index.html` with Playwright in headless Chromium, and the web host adopts the served DOM on a `__PRERENDERED__` page; `404.html` stays the shell. A terminal app's `light run` is a dev build (`dist/dev/`, fast when nothing changed); `light build` makes the release binary.

To get `light` on PATH from a checkout, link its binary:

```bash
ln -s "$PWD/packages/cli/bin/light.js" ~/.local/bin/light
```

## Packages

A new module is its own scoped package, `@lightstart/<name>` in `packages/<name>/`, as `@lightstart/server`, `@lightstart/sqlite` and `@lightstart/cli` are. Never add a subpath to light for it (`@lightstart/light/<name>`): `@lightstart/light` holds the engine, and what is built on it ships beside it.

## Workflow

A big change reaches `main` through an issue and a pull request on GitHub, so each one is visible and linked to why it was made. A change is big when it adds a package or a module, changes or removes a public API, moves code across packages, needs another repository to follow, or spans more than a few files. A small change (a typo, a doc fix, a fix confined to a file or two with its test) is committed on `main` directly.

1. Open an issue first: what changes and why, and what is left for later.
2. Branch from the latest `origin/main` (`git fetch origin && git switch -c <area>/<name> origin/main`). Commits keep the `<area>: <summary>` form.
3. Open the pull request with `Closes #<issue>` on its first line, an explanation of the implementation, and the gates that were run with their results: pass and fail counts, and any failure that predates the change, named.
4. Before merging, rebase on the latest `main` (`git fetch origin && git rebase origin/main`), rerun the gates the rebase can affect, and push with `git push --force-with-lease`.
5. Merge with "Rebase and merge", the repository's default, and delete the branch. Then reset the local `main` to `origin/main`: a rebase merge rewrites the commits, so a local copy of them no longer matches.
