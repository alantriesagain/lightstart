# Working on @lightstart/app

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | `defineApp`, `AppConfig`, `StoreConfig`, the `App` and `AppArgs` classes, `AppLifecycle` |
| `manifest.ts` | `AppManifest`, `AppModel`, `AppController`: the plain records `.light/app.ts` exports |
| `stores.ts` | `StoreKind`, `MemoryKind`, `registerStoreKind`, `schemasOf` and `openStores`: every declared store opened by its kind over one engine store, checked against the host's kinds and the models' `$adapter` |
| `memory.ts` | `MemoryAdapter`, the in-memory storage adapter |
| `controllers.ts` | `startControllers` and `stopControllers`: name, start, await `$ready`, dispose |
| `run.ts` | `AppHost` (the host contract, with a surface-less default for each method), `AppRun` (the run: arguments, stores, controllers, routes, mount; `stop`, `restart`, `quit`), `currentView` and `navigate` |
| `web/index.ts` | The web host: `WebHost`, `IndexedDBKind`, the URL-query arguments, the browser history, the theme, `<app-outlet>` as a component, the root mount, `start` |
| `web/test.ts` | `openPage(manifest, { path, args, kinds })`: the web host's root mount, theme and routed links over memory stores and a history in memory, and `OpenedPage` (`run`, `root`, `find`, `text`, `shows`, `navigate`, `settle`, `stop`) |
| `web/generate.ts` | The web host's part of the generation: `.light/main.ts`, and `.light/components.ts` and `.light/components.css` for a project on `@lightstart/components` |
| `tui/index.ts` | The terminal host: `TuiHost`, `JsonlKind`, `hostArgs` (`--data`, `--scheme`, `--route`), argv, the history in memory, `<app-outlet>` as a terminal view, the baked table, `runApp`, `start` |
| `tui/generate.ts` | The terminal host's part of the generation: the modes dispatch in `.light/main.ts`, and `.light/classes.baked.ts` |
| `tui/outlet.ts` | `AppOutlet`: `<app-outlet>` as a terminal view, defined on import |
| `tui/root.ts` | `handlerOf` and `callMounted`: the root view's `onKey` and `mounted(renderer)`, for the terminal host and its test mount |
| `tui/file.ts` | `fileIO`: the JSONL adapter's files through `node:fs`, the folder made on the first write |
| `tui/test.ts` | `mountApp`: the root view on a `TestTerminal` over an opened app |
| `test/index.ts` | `openApp(manifest, { args })`: a run over memory stores with no surface, and `OpenedApp` |
| `node/generate.ts` | The generator's core: read `src/app.ts`, the folders and the routes, write `.light/app.ts` and, for a project on `@lightstart/i18n`, `.light/locales.ts`, then hand `.light/main.ts` to the host's `generate.ts` (`HostGeneration`) |
| `cli/commands/app.ts` | `light app` |
| `cli/hooks/serve.before.ts` | Generate before `light serve` starts |
| `cli/hooks/serve.file-changed.ts` | Regenerate when a named source is added, removed or renamed |
| `cli/extend/build.ts` | A build step before `page` that generates |
| `cli/extend/test.ts` | Generate before `light test` picks its files |
| `test/routes.test.ts`, `test/tui-routes.test.ts` | Routes without a page, and drawn by the terminal's `<app-outlet>`, under node and scriptc |
| `test/fixtures/web/` | The fixture app: an app config, a note model, a notes controller, three views, two routes and a browser test that opens it with `openPage` |
| `test/fixtures/tui/` | The terminal fixture app: a `native` block, an argument, two models in two stores, a notes controller, a root view, a row view and a `hello` mode |

## Rules the sources keep

- The core names no host. What only one host does (its store kinds, where its arguments come from, its history, its surface, its generated entry and files) is that host's subpath; the core reaches it through `AppHost` and `HostGeneration`.
- One run, the same on every host: arguments, stores, controllers in import order, routes, mount. `stop` is the reverse: unmount, routes, controllers in reverse, stores. `restart` and `quit` are the run's, installed on `app` by every host and by `openApp`; they reject with "the app is not running" before a run.
- `AppHost` is a class whose methods all have a default, not an abstract class, and a method answering a promise is not `async`: scriptc does not dispatch an abstract method's override reliably, nor an async override. A `StoreKind`'s `open` follows the same rule.
- Stores: `main` is always declared, of the host's default kind unless the app says. A store's kind must be one the host runs, a project's registered one, or `memory`; a model's `$adapter` must name a declared store. Both are errors before anything opens. A test opens every store in memory.
- The manifest lists the controllers in the order they start: taken by name, each after the controllers it imports for their values (`import type` does not count), read from its relative imports. A cycle is an error that names it.
- A file name is the manifest name: without the extension and unchanged (kebab-case stays). `.ts` and `.js` are read, `.d.ts` and `*.test.*` are not. Generation sorts its input and its output.
- `.light/app.ts` uses static imports only: relative from `.light/`, one per file, views side-effect only, the same for every host but `rootView`, which a host that makes the root view (`HostGeneration.rootView`) gets, the core's `.light/locales.ts` for a project on `@lightstart/i18n`, and the host's own side-effect imports (`HostGeneration.prepare`), all before the views. A file is rewritten only when its content changes.
- A folder with no `src/app.ts` is untouched by every entry point: the command, both serve hooks, the build step and the test extension.
- The manifest is a plain typed record of arrays, never a `Map` of functions. Controllers cross as `unknown` and are narrowed by the run.
- Routes are the core's on every host: the router's core (`@lightstart/router/core`) over the host's `history()`; `currentView` follows the match and is null once a run stops; `<app-outlet>` is each host's. The browser adapter and `configureNavigation` stay the web host's.
- The terminal host takes argv with its own `--data` (default `.data`), `--scheme` (default `dark`) and `--route` (default `/`) merged in, an app declaring those names keeping its own; an `ArgError` prints its message and exits 2. Without a TTY it exits 2. Keys go to the root view's `onKey` when it has one, and its `mounted(renderer)` is called once `runApp` answers.
- A mode file exports `main(argv)` (answering the exit code) and may export `matches(argv)`. The terminal generation imports modes with `import * as modeN`, checks the optional export with `Reflect.get` and `typeof` (scriptc rejects a direct optional property read), runs the first match before the host and exits with its code.
- The app is one `App` instance and its arguments are read by name through `AppArgs`: a host writes `app.args.values`, never replaces `app` or casts it to another shape, because scriptc copies a value it converts and the controllers would read the copy. `test/tui-args.test.ts` and `test/routes.test.ts` run natively for that reason.
- A terminal app's code follows light's scriptc rules: erasable TypeScript, classes for identity, no computed imports, no `Map` of functions, and `unknown` narrowed with `typeof`, `instanceof` or `Array.isArray`. Its `package.json` `native.entry` is `.light/main.ts`.
- `openApp` and `mountApp` import no IndexedDB and no node-only module, so both run natively.
- `openPage` and `OpenedPage` are the web host's and the page's DOM, so they run in a browser test.
- `.light/` is not committed; the fixture's `.gitignore` names it beside `.deployed/`.
- Tests are plain scripts on `@lightstart/test/assert.ts`, not a test framework. Most are node-only because they walk the disk and spawn the CLI.
- Comments are a JSDoc module header and JSDoc on exported symbols, nothing else.
- TypeScript with erasable syntax only; the package ships its sources and needs no build step.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `defineApp`, `AppConfig` and its fields (`name`, `host`, `theme`, `locale`, `stores`, `root`, `args`), `StoreConfig` (`kind`, `at`, either a function of the arguments), and `App`'s `args` (`string`, `flag`, `list`), `restart` and `quit` | project `src/app.ts` files, controllers and the generator |
| `StoreKind` and `registerStoreKind` | a project bringing a store kind of its own |
| `AppHost` and `HostGeneration` | the hosts, and a host a project would bring later |
| `AppManifest` and its records (`app`, `rootView`, `models`, `controllers`, `routes`, `views`) | the generated `.light/app.ts` and the run |
| The file-name rule and the default exports of models, controllers, the root view and routes | project folders and the generator |
| `.light/app.ts`, `.light/main.ts` and, for a terminal, `.light/classes.baked.ts` | `light serve`, `light build`, `light test`, `light app`, and a project's page or native entry |
| `.light/components.ts` and `.light/components.css` | a web project on `@lightstart/components`, imported by `.light/app.ts` and its own stylesheet |
| `.light/locales.ts` | a project on `@lightstart/i18n`, imported by `.light/app.ts` before the views |
| `currentView`, `navigate` and `<app-outlet>` | root views and controllers of web and terminal apps |
| `start(manifest)` and `{ stop() }` | web apps |
| `start(manifest, { classes, argv, term })` and `{ stop() }` | terminal apps and their generated entry |
| `openApp(manifest, { args, kinds })` and `mountApp(manifest, opened, { cols, rows, classes })` | a project's tests |
| `openPage(manifest, { path, args, kinds })` and `OpenedPage` | a web project's tests |
| A mode's `main(argv: readonly string[])` and optional `matches(argv)` | the terminal generation and `.light/main.ts` |

## Gates

From the repository root:

```bash
light check --all
light typecheck @lightstart/app
light test @lightstart/app
npx eslint packages/app
```
