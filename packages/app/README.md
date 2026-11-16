# @lightstart/app

A project's folders are its app. `src/app.ts` names the few choices, `src/models/`, `src/controllers/` and `src/views/` hold the pieces, and `src/routes.ts` maps paths to view tags when the app has routes. Light writes the wiring into `.light/app.ts` and `.light/main.ts`; the host reads the manifest and fills in the rest.

```bash
light app                  # generate .light/app.ts and .light/main.ts now
light serve --watch        # generate first, then serve
light build                # generate as the build's first step
```

## The folders

| Path | Holds | The app does |
|---|---|---|
| `src/app.ts` | `defineApp({ name, host, theme, storage, root })` | reads it first |
| `src/models/<name>.ts` | one model, default-exported | opens the store with every model |
| `src/controllers/<name>.ts` | one controller, default-exported | names each, starts it and waits for `$ready` |
| `src/views/<tag>.ts` | one view, registering its tag | imports them all, so every tag exists |
| `src/routes.ts` | optional: `{ "/path": { view: "<tag>", name?, title? } }` | builds the router and configures navigation |
| `src/modes/<name>.ts` | optional: `main(argv)` and maybe `matches(argv)` | runs before the terminal host when `argv` matches |

A file's name is its name in the manifest, without the extension and unchanged: `src/models/note.ts` is the model `note`, `src/controllers/notes.ts` is the controller `notes`. `.ts` and `.js` files are read the same way, in sorted order; `.d.ts` and `*.test.*` are skipped. Keep a model's file name equal to the name it passes `defineModel`, and a controller's file name equal to the name its controller carries.

## defineApp

```ts
import { defineApp } from "@lightstart/app";

export default defineApp({
  name: "notes",
  host: "web",
  theme: "default",
  storage: { kind: "indexeddb" },
  root: "app-root",
});
```

| Field | Default | What |
|---|---|---|
| `name` | required | The store's name and the document's title |
| `host` | required | `"web"` or `"tui"` |
| `theme` | `"default"` | A preset name, applied by the web host |
| `storage` | `{ kind: "indexeddb" }` on the web | `indexeddb`, `memory`, or `jsonl` for the terminal |
| `root` | `"app-root"` | The root view's tag |
| `args` | `{}` | The arguments the app takes, as a `@lightstart/cli` schema |

`defineApp` returns the config with an `args` record the host fills, and with `restart` and `quit` calls the host installs. Its argument values keep the schema's types, so a controller reads `app.args.dir` directly. A storage folder or a mode's `matches` sees the same record.

```ts
import { defineApp } from "@lightstart/app";

export default defineApp({
  name: "notes",
  host: "tui",
  args: { dir: { default: "notes", description: "The notes folder" } },
  storage: {
    kind: "jsonl",
    databases: { user: { kind: "jsonl", dir: (args) => `${String(args.dir)}/user` } },
  },
});
```

`storage.dir` is the default JSONL folder (the terminal's `--data` when absent), and `storage.databases` names more stores. A model picks one through its schema's `$adapter`; the default database is the one named `jsonl` (or `memory` in a test).

## What is generated

`light app`, `serve:before`, `serve:file-changed`, the build extension and the test extension all call the same generator. It does nothing in a folder without `src/app.ts`.

`.light/app.ts` holds static imports of every model, controller and view (and `src/routes.ts` when present), plus the manifest:

```ts
import type { AppManifest } from "@lightstart/app/manifest.ts";
import app from "../src/app.ts";
import model0 from "../src/models/note.ts";
import controller0 from "../src/controllers/notes.ts";
import routes from "../src/routes.ts";
import "../src/views/app-root.ts";

const manifest: AppManifest = {
  app,
  models: [{ name: "note", model: model0 }],
  controllers: [{ name: "notes", controller: controller0 }],
  routes,
  views: ["app-root"],
};

export default manifest;
```

`.light/main.ts` imports the host named by the app config and starts the manifest:

```ts
import { start } from "@lightstart/app/web";
import manifest from "./app.ts";

await start(manifest);
```

A terminal app with modes gets their static namespace imports and a check before the host. A mode runs when its `matches(argv)` answers true, or, without one, when `argv` contains `--<name>`; the first match exits with its code:

```ts
import { start } from "@lightstart/app/tui";
import manifest from "./app.ts";
import { dark, light } from "./classes.baked.ts";
import * as mode0 from "../src/modes/hello.ts";

const argv = process.argv.slice(2);

const matches0 = Reflect.get(mode0, "matches");

if (typeof matches0 === "function" ? (matches0 as (given: readonly string[]) => boolean)(argv) : argv.includes("--hello")) {
  process.exit(await mode0.main(argv));
}

await start(manifest, { classes: { dark, light } });
```

The output is deterministic (sorted, relative imports from `.light/`) and a file is written only when its content changes. `.light/` is not committed: add it to the project's `.gitignore`, beside `.deployed/`.

## The web host

`start(manifest)` runs in this order:

1. Opens the store over the manifest's models — IndexedDB under the app's name, or memory for a test.
2. Names every controller (`nameControllers`, so `sync:` reaches it), calls `start()` on a `Controller` subclass, and awaits each `$ready`.
3. Imports are already done: the generated manifest imported every view.
4. Applies the theme preset (`applyTheme(await loadPreset(theme))`).
5. With routes, creates the router over the browser adapter, calls `configureNavigation(router.navigation)` and follows the match into the exported `currentView` signal.
6. Mounts the root view: an existing `<app-root>` is used, another placeholder is replaced, and with no placeholder the view is appended to `<body>`.

It answers `{ stop() }`, which stops following the router, disposes the controllers and closes the store.

A root view that renders routes includes the exported `<app-outlet>` tag; it follows `currentView` and creates the matched view tag.

## The test helper

`@lightstart/app/test` opens the store and controllers without a page:

```ts
import { openApp } from "@lightstart/app/test";

const app = await openApp(manifest, { storage: "memory" });
await notes.add("first");
const rows = await note.getAll();
await app.stop();
```

`openApp` uses memory storage by default, parses `args` against the app's schema (an array of `argv` tokens, or a record merged over the defaults), and answers `{ store, controllers, restart, quit, stop }`. `restart(args?)` disposes the controllers, closes the store, writes the merged arguments into `app.args` and opens them again; `quit(code)` is the host's exit. A terminal test then mounts the root view on light's `TestTerminal` with `mountApp`:

```ts
import { mountApp, openApp } from "@lightstart/app/test";

const app = await openApp(manifest, { args: ["--greeting", "hi"] });
const mounted = mountApp(manifest, app, { cols: 50, rows: 10 });

await mounted.settle();
mounted.term.out;        // what the renderer wrote
mounted.text();          // the screen as lines
mounted.renderer.decoder.pushText("a");
mounted.stop();          // stops the renderer
await app.stop();        // disposes the controllers and closes the store
```

`mountApp` takes the classes styler as `classes` (a baked table, or a theme's `TerminalClasses` in a node-only test; none by default) and answers `{ term, renderer, root, settle, text, stop }`; `root` is the root view it made, already told it is mounted, and `settle()` waits for the queued frames and paints one.

## The terminal host

`@lightstart/app/tui` reads the same manifest on a terminal. It is two steps:

- `prepare(manifest, options?)` parses the arguments, opens the store and starts the controllers; it touches no terminal.
- `mount(manifest, prepared, { term, classes, scheme })` makes the root view and runs it on `term`, answers the renderer.

`start(manifest, options?)` does the TTY check and both, and installs `app.restart` and `app.quit`.

1. Reads the app's `args` schema plus `--data <dir>` (the current folder by default) and `--scheme dark|light` (dark by default); an app that declares those names keeps its own. The parsed values land in `manifest.app.args`. An argument error prints its message and exits 2.
2. Opens the default JSONL database (its folder from `storage.dir`, else `--data`) and each named database in `storage.databases`, each through light's `JsonlAdapter` and the package's `fileIO`. A test opens memory adapters instead. A model reaches a named database through its schema's `$adapter`.
3. Names and starts every controller, as the web host does.
4. Makes the manifest's root view (`rootView`, the default export of `src/views/<root>.ts`) and runs it with `runApp`; keys go to the root view's `onKey` when it has one, and its `mounted(renderer)`, when it has one, runs once the renderer does, so the view reaches the renderer and its terminal (`renderer.term`) for focus, size, title or the screen's text. A restart's new root view is told the same.
5. Uses the baked class table the generation wrote for the scheme, so the binary carries the table and not the classes engine.

It needs a TTY: without one it prints a clear message and exits 2. It answers `{ stop() }`, which stops the renderer, disposes the controllers and closes the store. `app.restart(args?)` stops the renderer and controllers, closes the store, merges the new arguments, opens and starts again, then mounts a fresh root view on the same terminal. `app.quit(code?)` stops everything and exits with `code ?? 0`. Both answer promises; `defineApp`'s placeholders throw until a host or `openApp` installs them. There is no router; `src/routes.ts` is ignored on the terminal.

The generation adds the root view's class to `.light/app.ts` as `rootView`, writes `.light/classes.baked.ts` (the same tables `light classes:bake --scheme dark,light` bakes), and starts the host from `.light/main.ts`:

```ts
import { start } from "@lightstart/app/tui";
import manifest from "./app.ts";
import { dark, light } from "./classes.baked.ts";

await start(manifest, { classes: { dark, light } });
```

A terminal project's `package.json` names that entry and its binary:

```json
"native": { "entry": ".light/main.ts", "binary": "my-app", "prepare": ["light app"] }
```

The views, models and controllers a terminal app ships follow light's scriptc rules (`packages/light/native/README.md`): erasable TypeScript, classes for identity, no computed imports, no `Map` of functions, and `unknown` narrowed with `typeof`/`instanceof`/`Array.isArray`. A view writes its tag with `define(tag, Class)`; the root view default-exports its class.

## What is node-only

The generator (`node/generate.ts`) reads the disk. The manifest, the host and the test helper are plain modules the browser and the terminal compile.
