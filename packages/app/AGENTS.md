# Working on @lightstart/app

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | `defineApp`, `AppConfig`, the host and storage types |
| `manifest.ts` | `AppManifest`, `AppModel`, `AppController`: the plain records `.light/app.ts` exports |
| `storage.ts` | `openStore`: the IndexedDB or memory store over the manifest's models, and the `configureModel` request |
| `memory.ts` | `MemoryAdapter`, the in-memory storage adapter tests use |
| `controllers.ts` | `startControllers` and `stopControllers`: name, start, await `$ready`, dispose |
| `web/index.ts` | The web host: `start`, `currentView`, the `<app-outlet>` view and the root mount |
| `tui/index.ts` | The terminal host: `start`, `--data`/`--scheme`, the JSONL store, the baked table and `runApp` |
| `tui/file.ts` | `fileIO`: the JSONL adapter's files through `node:fs` |
| `test/index.ts` | `openApp(manifest, { storage })`, the store and controllers without a mount |
| `node/generate.ts` | The generator: read `src/app.ts`, the three folders and the routes; write `.light/app.ts`, `.light/main.ts` and, for a terminal, `.light/classes.baked.ts` |
| `cli/commands/app.ts` | `light app` |
| `cli/hooks/serve.before.ts` | Generate before `light serve` starts |
| `cli/hooks/serve.file-changed.ts` | Regenerate when a named source is added, removed or renamed |
| `cli/extend/build.ts` | A build step before `page` that generates |
| `cli/extend/test.ts` | Generate before `light test` picks its files |
| `test/fixtures/web/` | The fixture app: an app config, a note model, a notes controller, three views, two routes and a browser test |
| `test/fixtures/tui/` | The terminal fixture app: a `native` block, a note model, a notes controller, a root view and a row view |

## Rules the sources keep

- A file name is the manifest name: without the extension and unchanged (kebab-case stays). `.ts` and `.js` are read, `.d.ts` and `*.test.*` are not. Generation sorts its input and its output.
- `.light/app.ts` uses static imports only: relative from `.light/`, one per file, views side-effect only. `.light/main.ts` imports the host's `start`. A file is rewritten only when its content changes.
- A folder with no `src/app.ts` is untouched by every entry point: the command, both serve hooks, the build step and the test extension.
- The manifest is a plain typed record of arrays, never a `Map` of functions; a terminal host reads the same shape. Controllers cross as `unknown` and are narrowed by the host.
- The web host's order is store, controllers, theme, router, root view. Views are already imported by the generated manifest. It answers `{ stop() }` that unsubscribes the router, disposes controllers and closes the store.
- The terminal host's order is arguments (`--data`, default `.`; `--scheme`, default `dark`), the TTY check (exit 2 without one), the JSONL store, the controllers, the root view made from the manifest's `rootView`, and `runApp` with the baked table. Keys go to the root view's `onKey` when it has one. It answers `{ stop() }` that stops the renderer, disposes controllers and closes the store.
- A terminal generation reads the root view from `src/views/<root>.ts` (the app config's `root`, `app-root` by default) as a default export, puts it in the manifest as `rootView`, writes `.light/main.ts` with `start(manifest, { classes })`, and bakes `.light/classes.baked.ts` from the entry into typed `BakedEntry[]` tables for `dark` and `light`.
- A terminal app's code follows light's scriptc rules: erasable TypeScript, classes for identity, no computed imports, no `Map` of functions, and `unknown` narrowed with `typeof`, `instanceof` or `Array.isArray`. Its `package.json` `native.entry` is `.light/main.ts`.
- `openApp` opens the same store and controllers as the web host but mounts nothing, and uses memory storage by default. A terminal test runs the root view on light's `TestTerminal`.
- `.light/` is not committed; the fixture's `.gitignore` names it beside `.deployed/`.
- Tests are plain scripts on `@lightstart/test/assert.ts`, not a test framework. They are node-only because they walk the disk and spawn the CLI.
- Comments are a JSDoc module header and JSDoc on exported symbols, nothing else.
- TypeScript with erasable syntax only; the package ships its sources and needs no build step.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `defineApp`, `AppConfig` and the field names (`name`, `host`, `theme`, `storage`, `root`) | project `src/app.ts` files and the generator |
| `AppManifest` and its records (`app`, `rootView`, `models`, `controllers`, `routes`, `views`) | the generated `.light/app.ts`, the web host and the terminal host |
| The file-name rule and the default exports of models, controllers, the root view and routes | project folders and the generator |
| `.light/app.ts`, `.light/main.ts` and, for a terminal, `.light/classes.baked.ts` | `light serve`, `light build`, `light test`, `light app`, and a project's page or native entry |
| `start(manifest)` and `{ stop() }`, `currentView` and `<app-outlet>` | web apps and their root views |
| `start(manifest, { data, scheme, classes })` | terminal apps and their generated entry |
| `openApp(manifest, { storage })` | a project's tests |

## Gates

From the repository root:

```bash
light check --all
light typecheck @lightstart/app
light test @lightstart/app
npx eslint packages/app
```
