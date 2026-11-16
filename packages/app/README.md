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

`defineApp` returns the config unchanged; it only keeps the literal's types.

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

`openApp` uses memory storage by default and answers `{ store, controllers, stop }`. A terminal test then makes the root view and runs it on light's `TestTerminal`:

```ts
import { frames, runApp } from "@lightstart/light/native/tui";
import { TestTerminal } from "@lightstart/light/native/tui/test-terminal.ts";
import AppRoot from "../src/views/app-root.ts";

const app = await openApp(manifest);
const term = new TestTerminal();
const root = new AppRoot();
const renderer = runApp({ app: root, term, onKey: (r, e) => root.onKey(r, e) });
```

## The terminal host

`@lightstart/app/tui` reads the same manifest on a terminal. `start(manifest, options?)`:

1. Reads `--data <dir>` (the current folder by default) and `--scheme dark|light` (dark by default) from `process.argv`.
2. Opens the store over JSONL files in that folder with every model of the manifest, through light's `openJsonl` and the package's `fileIO` (`tui/file.ts`).
3. Names and starts every controller, as the web host does.
4. Makes the manifest's root view (`rootView`, the default export of `src/views/<root>.ts`) and runs it with `runApp`; keys go to the root view's `onKey` when it has one.
5. Uses the baked class table the generation wrote for the scheme, so the binary carries the table and not the classes engine.

It needs a TTY: without one it prints a clear message and exits 2. It answers `{ stop() }`, which stops the renderer, disposes the controllers and closes the store. There is no router; `src/routes.ts` is ignored on the terminal.

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
