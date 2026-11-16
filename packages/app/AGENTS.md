# Working on @lightstart/app

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | `defineApp`, `AppConfig`, the `App` and `AppArgs` classes, `AppLifecycle`, the host and storage types |
| `args.ts` | `hostArgs`, `argsSchemaOf` and `parseAppArgs`: the host's `--data`/`--scheme` beside the app's schema |
| `manifest.ts` | `AppManifest`, `AppModel`, `AppController`: the plain records `.light/app.ts` exports |
| `storage.ts` | `openStore`: the IndexedDB or memory store over the manifest's models, its named databases, and the `configureModel` request |
| `memory.ts` | `MemoryAdapter`, the in-memory storage adapter tests use |
| `controllers.ts` | `startControllers` and `stopControllers`: name, start, await `$ready`, dispose |
| `web/index.ts` | The web host: `start`, `currentView`, the `<app-outlet>` view and the root mount |
| `tui/index.ts` | The terminal host: `prepare`, `mount`, `start`, the app and host arguments, the JSONL databases, the baked table, `runApp`, and the installed `restart`/`quit` |
| `tui/root.ts` | `handlerOf` and `callMounted`: the root view's `onKey` and `mounted(renderer)`, for both terminal hosts |
| `tui/file.ts` | `fileIO`: the JSONL adapter's files through `node:fs` |
| `test/index.ts` | `openApp(manifest, { args, storage })`, the store and controllers without a mount, and `mountApp` on a `TestTerminal` |
| `node/generate.ts` | The generator: read `src/app.ts`, the folders, the routes and the modes; write `.light/app.ts`, `.light/main.ts` and, for a terminal, `.light/classes.baked.ts` |
| `cli/commands/app.ts` | `light app` |
| `cli/hooks/serve.before.ts` | Generate before `light serve` starts |
| `cli/hooks/serve.file-changed.ts` | Regenerate when a named source is added, removed or renamed |
| `cli/extend/build.ts` | A build step before `page` that generates |
| `cli/extend/test.ts` | Generate before `light test` picks its files |
| `test/fixtures/web/` | The fixture app: an app config, a note model, a notes controller, three views, two routes and a browser test |
| `test/fixtures/tui/` | The terminal fixture app: a `native` block, an argument, two models in two databases, a notes controller, a root view, a row view and a `hello` mode |

## Rules the sources keep

- A file name is the manifest name: without the extension and unchanged (kebab-case stays). `.ts` and `.js` are read, `.d.ts` and `*.test.*` are not. Generation sorts its input and its output.
- `.light/app.ts` uses static imports only: relative from `.light/`, one per file, views side-effect only. `.light/main.ts` imports the host's `start`, and a terminal's modes beside it. A file is rewritten only when its content changes.
- A folder with no `src/app.ts` is untouched by every entry point: the command, both serve hooks, the build step and the test extension.
- The manifest is a plain typed record of arrays, never a `Map` of functions; a terminal host reads the same shape. Controllers cross as `unknown` and are narrowed by the host.
- The web host's order is store, controllers, theme, router, root view. Views are already imported by the generated manifest. It answers `{ stop() }` that unsubscribes the router, disposes controllers and closes the store.
- The terminal host's `prepare` parses the app's `args` schema with the host's `--data` (default `.`) and `--scheme` (default `dark`) merged in, writes the values into `manifest.app.args.values`, opens the store and starts the controllers. An app declaring those names keeps its own; an `ArgError` prints its message and exits 2. `start` adds the TTY check (exit 2 without one) and `mount` makes the root view from `manifest.rootView` and runs it with `runApp` and the baked table. Keys go to the root view's `onKey` when it has one, and its `mounted(renderer)`, when it has one, is called once `runApp` answers (`tui/root.ts` reads both, for the test host too). `start` answers `{ stop() }` that stops the renderer, disposes controllers and closes the store.
- The terminal store is one `createStore` over the default JSONL database (folder from `storage.dir`, else `--data`) and each named database in the app's `storage.databases`: `JsonlAdapter` registered once, one `createAdapter("jsonl", { name, dir, io: fileIO(dir) })` per JSONL database, and `configureModel`'s request as `openJsonl` sets it. A model picks a database through its schema's `$adapter`. A test maps every named database to its own memory adapter through `openStore`.
- A mode file exports `main(argv)` (answering the exit code) and may export `matches(argv)`. The generation imports modes with `import * as modeN`, checks the optional export with `Reflect.get` and `typeof` (scriptc rejects a direct optional property read), runs the first match before the host and exits with its code. The web host ignores modes.
- `app.restart(args?)` stops the renderer and controllers, closes the store, merges the new arguments into `app.args`, opens and starts again, then mounts a fresh root view on the same terminal. `app.quit(code?)` stops the renderer and controllers, closes the store and exits with `code ?? 0`. Both reject with "the app is not running" until `prepare` or `openApp` sets `app.lifecycle`. Both answer promises.
- A terminal generation reads the root view from `src/views/<root>.ts` (the app config's `root`, `app-root` by default) as a default export, puts it in the manifest as `rootView`, writes `.light/main.ts` with the mode dispatch before `start(manifest, { classes })`, and bakes `.light/classes.baked.ts` from the entry into typed `BakedEntry[]` tables for `dark` and `light`.
- The app is one `App` instance and its arguments are read by name through `AppArgs`: a host writes `app.args.values`, never replaces `app` or casts it to another shape, because scriptc copies a value it converts and the controllers would read the copy. `test/tui-args.test.ts` runs natively for that reason.
- A terminal app's code follows light's scriptc rules: erasable TypeScript, classes for identity, no computed imports, no `Map` of functions, and `unknown` narrowed with `typeof`, `instanceof` or `Array.isArray`. Its `package.json` `native.entry` is `.light/main.ts`.
- `openApp` opens the same store and controllers as the web host but mounts nothing, uses memory storage by default, and parses `args` (an argv list, or a record merged over the defaults) into `app.args`. It sets `app.lifecycle` too. `mountApp` runs the root view on light's `TestTerminal` and answers `{ term, renderer, root, settle, text, stop }`. Neither imports IndexedDB or a node-only module, so both run natively.
- `.light/` is not committed; the fixture's `.gitignore` names it beside `.deployed/`.
- Tests are plain scripts on `@lightstart/test/assert.ts`, not a test framework. Most are node-only because they walk the disk and spawn the CLI; `test/tui-args.test.ts` runs under node and scriptc both, so the app instance a controller imports is proved the one the host writes, natively too.
- Comments are a JSDoc module header and JSDoc on exported symbols, nothing else.
- TypeScript with erasable syntax only; the package ships its sources and needs no build step.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `defineApp`, `AppConfig` and the field names (`name`, `host`, `theme`, `storage`, `root`, `args`), and `App`'s `args` (`string`, `flag`, `list`), `restart` and `quit` | project `src/app.ts` files, controllers and the generator |
| `StorageConfig`'s `dir` and `databases`, and `DatabaseConfig` | a project's `src/app.ts` and the terminal host |
| `AppManifest` and its records (`app`, `rootView`, `models`, `controllers`, `routes`, `views`) | the generated `.light/app.ts`, the web host and the terminal host |
| The file-name rule and the default exports of models, controllers, the root view and routes | project folders and the generator |
| `.light/app.ts`, `.light/main.ts` and, for a terminal, `.light/classes.baked.ts` | `light serve`, `light build`, `light test`, `light app`, and a project's page or native entry |
| `start(manifest)` and `{ stop() }`, `currentView` and `<app-outlet>` | web apps and their root views |
| `start(manifest, { data, scheme, classes, argv })`, `prepare(manifest, options)` and `mount(manifest, prepared, { term, classes, scheme })` | terminal apps and their generated entry |
| `openApp(manifest, { args, storage })` and `mountApp(manifest, opened, { cols, rows, classes })` | a project's tests |
| A mode's `main(argv: readonly string[])` and optional `matches(argv)` | the generator and `.light/main.ts` |

## Gates

From the repository root:

```bash
light check --all
light typecheck @lightstart/app
light test @lightstart/app
npx eslint packages/app
```
