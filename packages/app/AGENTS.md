# Working on @lightstart/app

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | `defineApp`, `AppConfig` (including the site's `title`, how it `prerender`s, its `focusOnNavigate` and its `url`), `PrerenderRenderer`, `StoreConfig`, the `App` and `AppArgs` classes, `AppLifecycle` |
| `head.ts` | `pageHead`, `currentHead` and the head shape: the route's title, description and path, the app's display title, the computed document title, canonical and absolute image |
| `manifest.ts` | `AppManifest`, `AppModel`, `AppController`, `AppSeeds`: the plain records `.light/app.ts` (or `.js`) exports |
| `stores.ts` | `StoreKind`, `MemoryKind`, `registerStoreKind`, `schemasOf` and `openStores`: every declared store opened by its kind over one engine store, checked against the host's kinds and the models' `$adapter` |
| `memory.ts` | `MemoryAdapter`, the in-memory storage adapter |
| `controllers.ts` | `startControllers` and `stopControllers`: name, start, await `$ready`, dispose |
| `run.ts` | `AppHost` (the host contract, with a surface-less default for each method, `transition(apply)` and `routeChanged(run, first)` among them), `AppRun` (the run: arguments, stores, seeds, controllers, routes, mount; `stop`, `restart`, `quit`), `currentView` and `navigate` |
| `web/index.ts` | The web host: `WebHost`, the URL-query arguments, the browser history, the theme, `<app-container>` as a component, the root mount, the view-transition `transition`, the page head and its tags, focus and the live region after a route change, scroll restoration, `start` |
| `web/indexeddb.ts` | `IndexedDBKind`, kept apart from the host's DOM pieces so the worker entry can open it |
| `web/test.ts` | `openPage(manifest, { path, args, kinds })`: the web host's root mount, theme and routed links over memory stores and a history in memory, and `OpenedPage` (`run`, `root`, `find`, `text`, `shows`, `navigate`, `settle`, `stop`) |
| `web/generate.ts` | The web host's part of the generation: `.light/main.ts` (or `.js`), `.light/worker.js` when a store declares `worker: true`, and `.light/components.ts` (or `.js`) and `.light/components.css` for a project on `@lightstart/components` |
| `web/worker.ts` | `WorkerAdapter` (the page's `StorageAdapter` over one worker request per method, with `store.open` in its `init`) and `WorkerConnection` (one rpc client and diagnostic relay per worker) |
| `web/worker-entry.ts` | `serveStores(app, models)`: the worker's `store.open` and one `store.<method>` per adapter method, relayed diagnostics, and the kinds it runs |
| `static/index.ts` | `renderApp(manifest, { path, args, kinds })` and `renderPage(manifest, page, options)`: the app's root view rendered on light's markup host over memory stores and a history in memory, with `<app-container>` as a markup view, and that markup put in a built page with the prerender marker |
| `tui/index.ts` | The terminal host: `TuiHost`, `JsonlKind`, `hostArgs` (`--data`, `--scheme`, `--route`), argv, the history in memory, `<app-container>` as a terminal view, the baked table, `runApp`, `start` |
| `tui/generate.ts` | The terminal host's part of the generation: the modes dispatch in `.light/main.ts`, `.light/classes.baked.ts`, and `.light/models.ts` |
| `tui/models.ts` | The row classes `.light/models.ts` holds: each model's fields typed by its schema, and a `static of` reading a row once and skipping a damaged one |
| `tui/container.ts` | `AppContainer`: `<app-container>` as a terminal view, defined on import |
| `tui/root.ts` | `handlerOf` and `callMounted`: the root view's `onKey` and `mounted(renderer)`, for the terminal host and its test mount |
| `tui/file.ts` | `fileIO`: the JSONL adapter's files through `node:fs`, the folder made on the first write |
| `tui/test.ts` | `mountApp`: the root view on a `TestTerminal` over an opened app |
| `test/index.ts` | `openApp(manifest, { args })`: a run over memory stores with no surface, and `OpenedApp` |
| `node/generate.ts` | The generator's core: find `src/app.ts` or `src/app.js` (its exported `appOf`), read it (its exported `infoOf`) and the routes (its exported `routesOf`, `routesPathOf`) without their views, read the folders and `src/seed` (with `src/seed.dev` unless a release build passes `{ dev: false }`), write `.light/app.ts` (or `.js`) and, for a project on `@lightstart/i18n`, `.light/locales.ts` (or `.js`), then hand `.light/main.ts` (or `.js`) to the host's `generate.ts` (`HostGeneration`) |
| `cli/commands/app.ts` | `light app` |
| `cli/hooks/serve.before.ts` | Generate before `light serve` starts |
| `cli/hooks/serve.file-changed.ts` | Regenerate when a named source is added, removed or renamed |
| `cli/extend/build.ts` | A build step before `page` that generates, a step after `html` that writes `404.html`, `sitemap.xml`, `robots.txt` and `_headers` for a static host, and a step after that which prerenders with the app's or `--renderer`'s choice (`markup` by default, `browser` for Playwright) |
| `cli/extend/test.ts` | Generate before `light test` picks its files |
| `test/routes.test.ts`, `test/tui-routes.test.ts` | Routes without a page, and drawn by the terminal's `<app-container>`, under node and scriptc |
| `test/fixtures/web/` | The fixture app: an app config, a note model, a notes controller, three views, two routes and a browser test that opens it with `openPage` |
| `test/fixtures/tui/` | The terminal fixture app: a `native` block, an argument, two models in two stores, a notes controller, a root view, a row view and a `hello` mode |

## Rules the sources keep

- The core names no host. What only one host does (its store kinds, where its arguments come from, its history, its surface, its generated entry and files) is that host's subpath; the core reaches it through `AppHost` and `HostGeneration`.
- The web host applies the app's `scheme` before the theme: `"dark"` and `"light"` pin the `dark` class on `<html>` and stop following the preference, `"system"` follows as before, and `color-scheme` matches. `renderPage` writes `class="dark"` on a dark app's `<html>`, and `openPage` restores the page's scheme on `stop`.
- A route change applies inside the host's `transition(apply)`: the run calls it when `app.transitions` is on or `navigate(path, { transition: true })` asks, and the web host wraps it in `document.startViewTransition` where the browser has it and waits for `<app-container>` to draw; every other host and `openApp` run `apply` as it is. `navigate(path, { transition: false })` runs plainly.
- One run, the same on every host: arguments, stores, seeds into empty stores, controllers in import order, routes, mount. `stop` is the reverse: unmount, routes, controllers in reverse, stores. `restart` and `quit` are the run's, installed on `app` by every host and by `openApp`; they reject with "the app is not running" before a run.
- `AppHost` is a class whose methods all have a default, not an abstract class, and a method answering a promise is not `async`: scriptc does not dispatch an abstract method's override reliably, nor an async override. A `StoreKind`'s `open` follows the same rule.
- Stores: `main` is always declared, of the host's default kind unless the app says. A store's kind must be one the host runs, a project's registered one, or `memory`; a model's `$adapter` must name a declared store. Both are errors before anything opens. A test opens every store in memory. A worker store is the same kind opened in the worker behind a `StorageAdapter` proxy; the model layer runs once, on the page.
- The manifest lists the controllers in the order they start: taken by name, each after the controllers it imports for their values (`import type` does not count), read from its relative imports. A cycle is an error that names it.
- A file name is the manifest name: without the extension and unchanged (kebab-case stays). `.ts` and `.js` are read, `.d.ts` and `*.test.*` are not. Generation sorts its input and its output.
- The app module is `src/app.ts` or `src/app.js`, exactly one (both is an error naming both). A `.js` app gets `.light/app.js`, `.light/main.js`, `.light/components.js` and `.light/locales.js`, with `.js` imports between them and no TypeScript syntax; a terminal app keeps `.ts` generated files.
- `.light/app.ts` uses static imports only: relative from `.light/`, one per file, views side-effect only, the same for every host but `rootView`, which a host that makes the root view (`HostGeneration.rootView`) gets, the core's `.light/locales.ts` (or `.js`) for a project on `@lightstart/i18n`, and the host's own side-effect imports (`HostGeneration.prepare`), all before the views. A file is rewritten only when its content changes.
- A folder with no `src/app.ts` or `src/app.js` is untouched by every entry point: the command, both serve hooks, the build steps and the test extension.
- The manifest is a plain typed record of arrays, never a `Map` of functions. Controllers cross as `unknown` and are narrowed by the run.
- Routes are the core's on every host: the router's core (`@lightstart/router/core`) over the host's `history()`; `currentView` follows the match and is null once a run stops; `<app-container>` is each host's. The browser adapter and `configureNavigation` stay the web host's.
- The terminal host takes argv with its own `--data` (default `.data`), `--scheme` (default `dark`) and `--route` (default `/`) merged in, an app declaring those names keeping its own; an `ArgError` prints its message and exits 2. Without a TTY it exits 2. Keys go to the root view's `onKey` when it has one, and its `mounted(renderer)` is called once `runApp` answers.
- A mode file exports `main(argv)` (answering the exit code) and may export `matches(argv)`. The terminal generation imports modes with `import * as modeN`, checks the optional export with `Reflect.get` and `typeof` (scriptc rejects a direct optional property read), runs the first match before the host and exits with its code.
- The app is one `App` instance and its arguments are read by name through `AppArgs`: a host writes `app.args.values`, never replaces `app` or casts it to another shape, because scriptc copies a value it converts and the controllers would read the copy. `test/tui-args.test.ts` and `test/routes.test.ts` run natively for that reason.
- A terminal app's code follows light's scriptc rules: erasable TypeScript, classes for identity, no computed imports, no `Map` of functions, and `unknown` narrowed with `typeof`, `instanceof` or `Array.isArray`. Its `package.json` `native.entry` is `.light/main.ts`.
- `openApp` and `mountApp` import no IndexedDB and no node-only module, so both run natively.
- `openPage` and `OpenedPage` are the web host's and the page's DOM, so they run in a browser test.
- `static` renders on light's markup host: a caller imports `@lightstart/light/markup` before the app's manifest, the root view and `<app-container>` are markup-host views, the markup carries the engine's markers, and a root view the markup registry does not know is a clear error. `renderPage` replaces the root placeholder and puts the prerender marker first in `<head>`.
- The build's static files read the app's `url` and the routes through the generator's `infoOf` and `routesOf`, never the generated manifest (which imports the views): `404.html` is the built page, the sitemap leaves out a path with a parameter or wildcard, and `_headers` caches the hashed `.js` and `.css` outputs but not the pages.
- Prerendering defaults to the markup renderer in `node/prerender.ts`: it imports `@lightstart/light/markup` from the project before its generated `.light/app.ts` (or `.js`), renders each path with `renderPage` one after another, fails naming the path whose render throws, and passes a view's error to the build as a warning with the path. `--renderer browser` (or `defineApp({ prerender: "browser" })`) keeps the Playwright path.
- `.light/` is not committed; the fixture's `.gitignore` names it beside `.deployed/`.
- Tests are plain scripts on `@lightstart/test/assert.ts`, not a test framework. Most are node-only because they walk the disk and spawn the CLI.
- Comments are a JSDoc module header and JSDoc on exported symbols, nothing else.
- TypeScript with erasable syntax only; the package ships its sources and needs no build step.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `defineApp`, `AppConfig` and its fields (`name`, `title`, `host`, `theme`, `scheme`, `locale`, `url`, `prerender`, `transitions`, `focusOnNavigate`, `stores`, `root`, `args`), `PrerenderRenderer`, `StoreConfig` (`kind`, `at`, either a function of the arguments), and `App`'s `args` (`string`, `flag`, `list`), `restart` and `quit` | project `src/app.ts` files, controllers, the generator and the build's static and prerender steps |
| `pageHead` and `PageHead` | a view setting its page's title, description and image |
| A route's `title` and `description` as strings or functions of its params | a project's `src/routes.ts` and the run's head |
| `StoreKind` and `registerStoreKind` | a project bringing a store kind of its own |
| `AppHost` and `HostGeneration` | the hosts, and a host a project would bring later |
| `AppManifest` and its records (`app`, `rootView`, `models`, `seeds`, `controllers`, `routes`, `views`) | the generated `.light/app.ts` (or `.js`) and the run |
| The file-name rule and the default exports of models, controllers, the root view and routes | project folders and the generator |
| `.light/app.ts` (or `.js`), `.light/main.ts` (or `.js`) and, for a terminal, `.light/classes.baked.ts` and `.light/models.ts` | `light serve`, `light build`, `light test`, `light app`, and a project's page or native entry |
| `.light/components.ts` (or `.js`) and `.light/components.css` | a web project on `@lightstart/components`, imported by `.light/app.ts` (or `.js`) and its own stylesheet |
| `.light/locales.ts` (or `.js`) | a project on `@lightstart/i18n`, imported by `.light/app.ts` (or `.js`) before the views |
| `currentView`, `navigate` and `<app-container>` | root views and controllers of web and terminal apps |
| `start(manifest)` and `{ stop() }` | web apps |
| `start(manifest, { classes, argv, term })` and `{ stop() }` | terminal apps and their generated entry |
| `openApp(manifest, { args, kinds })` and `mountApp(manifest, opened, { cols, rows, classes })` | a project's tests |
| `openPage(manifest, { path, args, kinds })` and `OpenedPage` | a web project's tests |
| `renderApp(manifest, { path, args, kinds })` and `renderPage(manifest, page, options)` | the build's prerenderer and a server rendering a page in node |
| A mode's `main(argv: readonly string[])` and optional `matches(argv)` | the terminal generation and `.light/main.ts` |

## Gates

From the repository root:

```bash
light check --all
light typecheck @lightstart/app
light test @lightstart/app
npx eslint packages/app
```
