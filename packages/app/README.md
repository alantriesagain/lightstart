# @lightstart/app

A project's folders are its app, whatever it runs on. `src/app.ts` names the few choices, `src/models/`, `src/controllers/` and `src/views/` hold the pieces, and `src/routes.ts` maps paths to view tags when the app has routes. Light writes the wiring into `.light/`; one run opens the stores, starts the controllers and the routes, and a host puts the view on its surface: `@lightstart/app/web` in a page, `@lightstart/app/tui` on a terminal.

light's engine is the MVC (models, controllers and views, usable in any project); this package is the framework that composes them: the folder convention, the generated wiring, one lifecycle, and the hosts.

```bash
light app                  # generate .light/ now
light serve --watch        # generate first, then serve (web)
light build                # generate as the build's first step
```

## The folders

| Path | Holds | The app does |
|---|---|---|
| `src/app.ts` | `defineApp({ name, host, theme, locale, url, stores, root, args })` | reads it first |
| `src/models/<name>.ts` | one model, default-exported | opens its store with every model |
| `src/controllers/<name>.ts` | one controller, default-exported | names each, starts it and waits for `$ready`, each after the controllers it imports |
| `src/views/<tag>.ts` | one view, registering its tag | imports them all, so every tag exists |
| `src/routes.ts` | optional: `{ "/path": { view: "<tag>", name?, title? } }` | follows them on every host; `<app-outlet>` draws the view |
| `src/modes/<name>.ts` | optional, a terminal app's: `main(argv)` and maybe `matches(argv)` | runs before the host when `argv` matches |

A file's name is its name in the manifest, without the extension and unchanged: `src/models/note.ts` is the model `note`, `src/controllers/notes.ts` is the controller `notes`. `.ts` and `.js` files are read the same way, in sorted order; `.d.ts` and `*.test.*` are skipped. Keep a model's file name equal to the name it passes `defineModel`, and a controller's file name equal to the name its controller carries.

## defineApp

```ts
import { defineApp } from "@lightstart/app";

export default defineApp({
  name: "notes",
  host: "tui",
  args: { dir: { default: "notes", description: "The notes folder" } },
  stores: {
    main: { at: (args) => args.string("dir") ?? "notes" },
    cache: { kind: "memory" },
    user: { at: (args) => `${args.string("dir") ?? "notes"}/user` },
  },
});
```

| Field | Default | What |
|---|---|---|
| `name` | required | The stores' default name and the document's title |
| `host` | required | The host's name: `"web"` or `"tui"` (`@lightstart/app/<host>`) |
| `theme` | `"default"` | A preset name, applied by the web host |
| `locale` | `"en"` | The default language the app's words are in |
| `url` | none | The site's address (`https://lightstart.dev`), which the build's sitemap is written against |
| `prerender` | `false` | Render every concrete route into its own `index.html` during `light build` |
| `stores` | `{ main: {} }` | The stores by name, several at once: `{ kind?, at? }` each |
| `root` | `"app-root"` | The root view's tag |
| `args` | `{}` | The arguments the app takes, as a `@lightstart/cli` schema |

`defineApp` makes the app, an `App`: the config's fields, `args` (an `AppArgs` the host fills) and `restart` and `quit`, which reach the run. A controller imports the app and reads an argument by name: `app.args.string("dir")` for an option (`undefined` when it was not given and has no default), `app.args.flag("trust")` for a flag, `app.args.list("files")` for a rest positional. The app is one instance, the one the generated manifest holds and the host writes, so what a controller reads is what the host filled, natively as under node (a shape scriptc would convert is a copy).

## Stores

An app keeps rows in stores by name, several at once. A model picks one through its schema's `$adapter` (the store's name) and gets `main` when it names none; `main` is always there, of the host's default kind unless the app says otherwise. One run opens them all over one engine store, which routes each model to its store.

- A store's `kind` is an adapter: light has `memory`, `indexeddb`, `jsonl` and `sql` (SQLite over `@lightstart/sqlite`). The host says which it runs and which is its default: the web host runs `indexeddb` (its default where the page has IndexedDB, else memory) and `memory`; the terminal host runs `jsonl` (its default) and `memory`; every host runs `memory`, and a test opens every store in memory.
- A store whose kind its host cannot run is an error naming the host and the kinds it has; so is a model naming a store the app does not declare, before anything opens.
- `kind` may be a function of the arguments, as `at` may: `kind: (args) => (args.flag("ephemeral") ? "memory" : "jsonl")` keeps nothing for a run that asks so.
- `at` is what the kind opens: a folder for `jsonl` (the terminal's `--data` when absent), a database's name for `indexeddb` (the app's name for `main`, `<name>:<store>` for another), nothing for `memory`. It may be a function of the arguments.
- A project brings a kind of its own (an adapter over its server's API, SQLite with its driver) by registering a `StoreKind` before the run: `registerStoreKind(new MyKind())`. Its `open(app, store, at, models, main)` answers the opened adapter.

## Routes and views

`src/routes.ts` maps paths to view tags on every host. The run makes the router (`@lightstart/router`'s core) over the host's history: the browser's on the web, one in memory on the terminal (starting at `/`, or the path `--route` names). `currentView` is the view tag the path answers, `currentParams` the parameters of its path (`/components/:category` gives `{ category }`), and `navigate(path)` goes to another; all come from the host's subpath. A root view that shows routes writes `<app-outlet>`, which the host gives: a component in the page, a terminal view on the terminal. The outlet sets the parameters on the view as props, keeping the same element while the tag stays, so a view declares a prop for each parameter its path has. An app without `routes.ts` mounts its root view alone.

A route with parameters may list their values with `params: () => Array<Record<string, string>>` (or a promise of one), as the site's `/components/:category` does. `pathsOf` (`@lightstart/app/node/paths.ts`) answers every concrete path of a routes table, sorted and unique: a path without parameters is itself, and a path with them is filled from the entries `params` answers, each value URL-encoded, an entry missing a parameter skipped. A wildcard path, a route marked `spa: true` and a redirect are left out, and nested `routes` join their parent's path. The build's sitemap and prerendering read it.

## The run

One run, the same on every host (`run.ts`):

1. Fills the arguments from the host's source (argv, the URL query, a test's values).
2. Opens every store.
3. Names every controller (`nameControllers`, so `sync:` reaches it), starts them in import order and awaits each `$ready`.
4. Follows the routes, when the app has them.
5. Mounts the view on the host's surface.

It installs `app.restart(args?)` (stop, merge the arguments, open, start and mount again) and `app.quit(code?)` (stop, then leave as the host does: a terminal app exits with `code`). Both answer promises, and reject with "the app is not running" before a run. `stop()` takes the view down, stops following the routes, disposes the controllers in reverse order and closes the stores.

A host is an `AppHost`: its name, the store kinds it runs and its default, `args(app)`, `history()`, `mount(run)`, `unmount(run)` and `exit(code)`. Each has what a host with no surface does, and a host overrides what it changes.

## The order controllers start in

The run starts the controllers one after the other, each once the one before it is `$ready`, and disposes them in reverse. A controller starts after every controller it imports (`import folder from "./folder.ts"`), so the one it reads in its `connected()` is already running; an `import type` does not count. Otherwise they go by name. Controllers that import each other in a cycle are an error that names the cycle.

## What is generated

`light app`, `serve:before`, `serve:file-changed`, the build extension and the test extension all call the same generator. It does nothing in a folder without `src/app.ts`.

`.light/app.ts` is the same for every host: static imports of every model, controller and view (and `src/routes.ts` when present), plus the manifest:

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

The host's own part of the generation (`@lightstart/app/<host>/generate.ts`) writes `.light/main.ts` and any files of its own. On the web:

```ts
import { start } from "@lightstart/app/web";
import manifest from "./app.ts";

await start(manifest);
```

A web project that declares `@lightstart/components` and writes an `lc-*` tag in `src/` gets two more files. `.light/components.ts` imports each component module, follows every `extends` and `uses`, and defines each base and used tag before the tag that needs it; `.light/components.css` imports the theme and each component's stylesheet in the same order. `.light/app.ts` imports `./components.ts` before the views. A project without the package, or writing no tag, gets neither file.

A project that declares `@lightstart/i18n` gets `.light/locales.ts`, imported by `.light/app.ts` before the views. It imports `locales/<lang>.js` from every dependency whose `package.json` says `light.locales: true`, and the project's own `src/locales/<lang>.ts`/`.js`, then calls `configureI18n({ locales, defaultLocale, dictionaries })`: every language found, the app's `locale` as the default, and each language's dictionary the packages' merged first with the project's over them (a deep merge, so a key the project writes wins). A project without the package gets no file, and may plug another library into `configureTranslation` itself.

On the terminal, the manifest also carries the root view's class (`rootView`), `.light/classes.baked.ts` holds the theme's classes the views use baked into a table per scheme, and the entry runs the first run mode that matches before the host (`matches(argv)` when the mode has one, else `argv` holding `--<name>`; it exits with its code):

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

## Building

`light build` runs the same generator before it reads the page, then adds the files a static host needs after it rewrites the page, for a project with `src/app.ts`:

- `404.html`, the built page itself (the same contents as `index.html`), so a path the host has no file for still boots the app and its router.
- `sitemap.xml` and `robots.txt` when `defineApp` has a `url`: the sitemap lists every concrete path of `src/routes.ts`, as absolute URLs joined with `url`, sorted. A static route is its own path; a route with parameters (`/notes/:id`) is filled from the values its `params` answers, when it has one (`params: () => [{ id: "1" }, { id: "2" }]`), so a parameter route without `params`, a wildcard, a `spa: true` route and a redirect are left out. `robots.txt` is `User-agent: *`, `Allow: /` and a `Sitemap:` line. Without a `url` there is no sitemap, and `robots.txt` has no `Sitemap:` line.
- `_headers`, the format Cloudflare Pages and Netlify read: the hashed `.js` and `.css` outputs are cached with `Cache-Control: public, max-age=31536000, immutable`, and `/index.html`, `/404.html` and `/` with `Cache-Control: no-cache`.

`light build --prerender` (or `defineApp({ prerender: true })`) also renders every path the sitemap lists, each into its own `index.html` (`/` stays at the root, `/about` goes to `about/index.html`). After the shell is written, the build serves its outputs from memory on a local port, opens each path in headless Chromium through [Playwright](https://playwright.dev) (four pages at a time), waits for `networkidle`, two animation frames and a short settle, and keeps the page's `outerHTML` with `<!doctype html>` and a `<script>window.__PRERENDERED__ = true</script>` first in `<head>`. The page's markup is then served to a reader, and the web host adopts it instead of replacing the root element; the first client navigation clears the marker. A page that throws fails the build naming its path. The renderer is Playwright found in the project, or beside light: a project using it needs `pnpm add -D playwright` and `npx playwright install chromium`. `404.html` stays the unrendered shell so the router still boots on a path the static host has no file for.

## The web host

`@lightstart/app/web`'s `start(manifest)` runs the app in the page: its kinds `indexeddb` and `memory`, the arguments from the URL query (`?name=value`, a bare `?flag`; a parameter the app does not declare is left out), the browser's history for the routes with `configureNavigation(router.navigation)`, the theme preset applied, and the root view mounted (an existing `<app-root>` replaced by a fresh one, another placeholder replaced, or appended to `<body>`). On a prerendered page (`window.__PRERENDERED__ === true` and the root already holding markup) the host keeps that element, so light's views adopt the served DOM; the first client navigation clears the marker. `<app-outlet>` is a component drawing `currentView`. It answers `{ stop() }`.

A project on `@lightstart/components` has its tags defined by the generated `.light/components.ts`, which `.light/app.ts` imports before the views, so every component exists before the root view is made. The stylesheets come from `.light/components.css` through the app's own stylesheet.

## The terminal host

`@lightstart/app/tui`'s `start(manifest, { classes, argv?, term? })` runs the app on a terminal: its kinds `jsonl` and `memory`, the arguments from argv (the app's, and the host's own `--data <dir>` (`.data` by default), `--scheme dark|light` and `--route <path>`, each unless the app declares that name; an argument error prints its message and exits 2), a history in memory for the routes, and `<app-outlet>` as a terminal view. It makes the manifest's root view and runs it with `runApp` and the baked table for the scheme; keys go to the root view's `onKey`, and its `mounted(renderer)` runs once the renderer does, so the view reaches the renderer and its terminal (`renderer.term`). A restart mounts a new root view on the same terminal. It needs a TTY: without one it prints a clear message and exits 2. It answers `{ stop() }`.

A terminal project's `package.json` names the entry and its binary:

```json
"native": { "entry": ".light/main.ts", "binary": "my-app", "prepare": ["light app"] }
```

The views, models and controllers a terminal app ships follow light's scriptc rules (`packages/light/native/README.md`): erasable TypeScript, classes for identity, no computed imports, no `Map` of functions, and `unknown` narrowed with `typeof`/`instanceof`/`Array.isArray`. A view writes its tag with `define(tag, Class)`; the root view default-exports its class.

## Tests

`@lightstart/app/test` opens a run without a surface:

```ts
import { openApp } from "@lightstart/app/test";

const app = await openApp(manifest, { args: ["--greeting", "hi"] });
await notes.add("first");
const rows = await note.getAll();
await app.stop();
```

`openApp` fills the arguments (an array of `argv` tokens, or a record merged over the defaults), opens every store in memory (or, given `kinds: [new JsonlKind()]`, with the kinds a test names, so what lands on disk can be checked), starts the controllers and the routes (in memory), and answers an `OpenedApp`: `run`, `store`, `controllers`, `restart`, `quit` and `stop`. A web test opens the page itself with `@lightstart/app/web/test`'s `openPage`:

```ts
import { openPage } from "@lightstart/app/web/test";
import manifest from "../.light/app.ts";

const page = await openPage(manifest, { path: "/lists", args: { list: "Work" } });

const tasks = await page.find("tasks-page");
await page.navigate("/lists");
await page.shows("0/1 done");
page.text();             // the root view's text now
await page.settle();     // pending updates and microtasks
await page.stop();       // stops the run and removes the root element
```

`openPage` mounts the root view as the web host does, with the theme applied and the routes drawn by `<app-outlet>` over a history in memory that starts at `path` (`"/"` by default), so the test page's URL is no route of the app's. It takes the app's arguments as `openApp` does (`args`, rather than the URL's) and opens every store in memory unless `kinds` names others. It answers an `OpenedPage`: `run`, `root` (the mounted root element), `find(selector, { timeout })` (waits for the element, waits for its pending update, then answers it), `text()`, `shows(text, { timeout })`, `navigate(path)`, `settle()` and `stop()`. A helper waits 2 s by default and throws naming what it wanted beside the page's text.

A terminal test mounts the root view on light's `TestTerminal` with `@lightstart/app/tui/test`'s `mountApp`:

```ts
import { openApp } from "@lightstart/app/test";
import { mountApp } from "@lightstart/app/tui/test";

const app = await openApp(manifest);
const mounted = mountApp(manifest, app, { cols: 50, rows: 10 });

await mounted.settle();
mounted.text();          // the screen as lines
mounted.renderer.decoder.pushText("a");
mounted.stop();          // stops the renderer
await app.stop();        // disposes the controllers and closes the stores
```

`mountApp` takes the classes styler as `classes` (a baked table, or a theme's `TerminalClasses` in a node-only test; none by default) and answers `{ term, renderer, root, settle, text, stop }`; `root` is the root view it made, already told it is mounted, and `settle()` waits for the queued frames and paints one.

## What is node-only

The generator (`node/generate.ts`, and each host's `generate.ts`) reads the disk. The core, the hosts and the test helpers are plain modules the browser and the terminal compile.
