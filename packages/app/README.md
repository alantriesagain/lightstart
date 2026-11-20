# @lightstart/app

A project's folders are its app, whatever it runs on. `src/app.ts` (or `src/app.js`) names the few choices, `src/models/`, `src/controllers/` and `src/views/` hold the pieces, and `src/routes.ts` (or `src/routes.js`) maps paths to view tags when the app has routes. Light writes the wiring into `.light/`; one run opens the stores, starts the controllers and the routes, and a host puts the view on its surface: `@lightstart/app/web` in a page, `@lightstart/app/tui` on a terminal.

light's engine is the MVC (models, controllers and views, usable in any project); this package is the framework that composes them: the folder convention, the generated wiring, one lifecycle, and the hosts.

```bash
light app                  # generate .light/ now
light serve --watch        # generate first, then serve (web)
light build                # generate as the build's first step
```

## The folders

| Path | Holds | The app does |
|---|---|---|
| `src/app.ts` or `src/app.js` | `defineApp({ name, host, theme, scheme, locale, url, prerender, transitions, stores, root, args })` | reads it first |
| `src/models/<name>.ts` | one model, default-exported | opens its store with every model |
| `src/controllers/<name>.ts` | one controller, default-exported | names each, starts it and waits for `$ready`, each after the controllers it imports |
| `src/views/<tag>.ts` | one view, registering its tag | imports them all, so every tag exists |
| `src/routes.ts` | optional: `{ "/path": { view: "<tag>", name?, title? } }` | follows them on every host; `<app-container>` draws the view |
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
| `scheme` | `"system"` | The page's color scheme: `"dark"` or `"light"` pins it, `"system"` follows the reader's preference; the web host applies it before the theme |
| `locale` | `"en"` | The default language the app's words are in |
| `url` | none | The site's address (`https://lightstart.dev`), which the build's sitemap is written against |
| `prerender` | `false` | Render every concrete route into its own `index.html` during `light build`: `true` or `"markup"` renders in node, `"browser"` through Playwright |
| `transitions` | `false` | Run every web route change inside `document.startViewTransition` where the browser has it |
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
- A store declared `worker: true` opens in a worker the web host spawns on the first such store, over `@lightstart/rpc`. It is the same kind, opened inside the worker; the page's engine store keeps every model semantic (validation, ids, hooks and `modelChanged`), so a write announces once, on the page, and `onChange`, `liveRows` and `modelQuery` work unchanged. The terminal host has no worker and ignores the flag; `openApp` keeps every store in memory on the page, as today. A kind the worker does not run is an error naming the kinds it has; `main` is not special, and a store may be `worker: true` too. Seeds load through the page's engine store, so a worker model's seed crosses the channel as rows and loads once; the worker does not seed. The project lists `@lightstart/rpc` in its dependencies: the page loads it when the first worker store opens, and the generated `.light/worker.js` imports it. A test passes `worker: () => new Worker(new URL("../.light/worker.js", import.meta.url), { type: "module" })` to `openPage` to run the worker too (the others stay in memory on the page).

## Seeds

A project may start with data. `src/seed.ts` (or `src/seed.js`) default-exports rows keyed by model name; `src/seed.dev.ts` (or `.js`) holds demo rows, loaded by `light serve`, `light test` and the test helpers, and left out of a release build (`light build`):

```ts
export default {
  note: [{ text: "A first note" }],
};
```

The generation imports both files into the manifest (`.light/app.ts` or `.js`), `src/seed` before `src/seed.dev`. A run adds a model's seed after the stores open and before the controllers start, so a controller's first query already sees the rows (and a prerender draws them). It adds them only when the model's store is empty, so a later run over the same rows adds nothing. A name with no such model is an error naming it; a row the model rejects is an error naming the model and the row's index. `openApp` and `openPage` load the seeds too; pass `{ seed: false }` to skip them.

## Routes and views

`src/routes.ts` maps paths to view tags on every host. The run makes the router (`@lightstart/router`'s core) over the host's history: the browser's on the web, one in memory on the terminal (starting at `/`, or the path `--route` names). `currentView` is the view tag the path answers, `currentParams` the parameters of its path (`/components/:category` gives `{ category }`), and `navigate(path)` goes to another; all come from the host's subpath. A root view that shows routes writes `<app-container>` (the app's, drawing the routed view; not `lc-app-container`, the components' page layout), which the host gives: a component in the page, a terminal view on the terminal. The container sets the parameters on the view as props, keeping the same element while the tag stays, so a view declares a prop for each parameter its path has. An app without `routes.ts` mounts its root view alone.

With `transitions: true` the web host runs each route change (a `navigate`, a link through the router, the browser's back and forward) inside `document.startViewTransition` where the browser has it, and waits for `<app-container>` to draw the next view, so the browser snapshots the old view and the new one. Light adds no attribute: a view names what morphs with the platform's `view-transition-name` CSS property, the same name on the tile and on the page it opens:

```css
.tile { view-transition-name: note-card; }
.note-header { view-transition-name: note-card; }
```

`navigate(path, { transition: true | false })` overrides the app's choice for one call.

A route with parameters may list their values with `params: () => Array<Record<string, string>>` (or a promise of one), as the site's `/components/:category` does. `pathsOf` (`@lightstart/app/node/paths.ts`) answers every concrete path of a routes table, sorted and unique: a path without parameters is itself, and a path with them is filled from the entries `params` answers, each value URL-encoded, an entry missing a parameter skipped. A wildcard path, a route marked `spa: true` and a redirect are left out, and nested `routes` join their parent's path. The build's sitemap and prerendering read it.

## The run

One run, the same on every host (`run.ts`):

1. Fills the arguments from the host's source (argv, the URL query, a test's values).
2. Opens every store, then adds each empty model's seeds.
3. Names every controller (`nameControllers`, so `sync:` reaches it), starts them in import order and awaits each `$ready`.
4. Follows the routes, when the app has them.
5. Mounts the view on the host's surface.

It installs `app.restart(args?)` (stop, merge the arguments, open, start and mount again) and `app.quit(code?)` (stop, then leave as the host does: a terminal app exits with `code`). Both answer promises, and reject with "the app is not running" before a run. `stop()` takes the view down, stops following the routes, disposes the controllers in reverse order and closes the stores.

A host is an `AppHost`: its name, the store kinds it runs and its default, `args(app)`, `history()`, `mount(run)`, `unmount(run)`, `transition(apply)` and `exit(code)`. Each has what a host with no surface does, and a host overrides what it changes.

## The order controllers start in

The run starts the controllers one after the other, each once the one before it is `$ready`, and disposes them in reverse. A controller starts after every controller it imports (`import folder from "./folder.ts"`), so the one it reads in its `connected()` is already running; an `import type` does not count. Otherwise they go by name. Controllers that import each other in a cycle are an error that names the cycle.

## What is generated

`light app`, `serve:before`, `serve:file-changed`, the build extension and the test extension all call the same generator. It does nothing in a folder without `src/app.ts` or `src/app.js`, and a project with both is an error naming both.

`.light/app.ts` is the same for every host: static imports of every model, controller and view (and `src/routes.ts` when present), plus the manifest:

```ts
import type { AppManifest } from "@lightstart/app/manifest.ts";
import app from "../src/app.ts";
import model0 from "../src/models/note.ts";
import seed0 from "../src/seed.ts";
import controller0 from "../src/controllers/notes.ts";
import routes from "../src/routes.ts";
import "../src/views/app-root.ts";

const manifest: AppManifest = {
  app,
  models: [{ name: "note", model: model0 }],
  seeds: [seed0],
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

On the web, `scheme` is applied before the theme: `"dark"` puts the `dark` class on `<html>` and stops following the preference, `"light"` removes it, and `"system"` follows the reader's choice and the OS. The build writes the class into a prerendered page's `<html>`, so a dark app paints dark on the first frame. The terminal host ignores it.

A web project that declares `@lightstart/components` and writes an `lc-*` tag in `src/` gets two more files. `.light/components.ts` (or `.js`) imports each component module, follows every `extends` and `uses`, and defines each base and used tag before the tag that needs it; `.light/components.css` imports the theme and each component's stylesheet in the same order. `.light/app.ts` (or `.js`) imports `./components.ts` (or `.js`) before the views. A project without the package, or writing no tag, gets neither file.

A project that declares `@lightstart/i18n` gets `.light/locales.ts` (or `.js`), imported by `.light/app.ts` (or `.js`) before the views. It imports `locales/<lang>.js` from every dependency whose `package.json` says `light.locales: true`, and the project's own `src/locales/<lang>.ts`/`.js`, then calls `configureI18n({ locales, defaultLocale, dictionaries })`: every language found, the app's `locale` as the default, and each language's dictionary the packages' merged first with the project's over them (a deep merge, so a key the project writes wins). A project without the package gets no file, and may plug another library into `configureTranslation` itself.

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

## Check rules

A project that depends on `@lightstart/app` gets these rules from `light check`, in `check/rules/`, each an error unless marked:

- `view-writes-no-model`: a module under `src/views/` never calls `add`, `addMany`, `edit`, `remove` or `removeAll` on a model it imports; a view goes through its controller.
- `model-module-shape`: `src/models/<name>.(js|ts)` default-exports `defineModel(...)` (or a name bound to one), with the model named after the file.
- `routes-module-shape`: `src/routes.(js|ts)` default-exports an object literal (or a name bound to one) whose keys are paths starting with `/`.
- `no-view-import-by-hand`: a module imports no view module for its side effect or its default; `.light/` defines the views, and `import type` is fine.
- `no-duplicate-route-path`: two keys of the routes table never name the same path once a trailing slash is ignored.
- `no-server-module-in-page`: in a web app (`host: "web"` in `src/app.*`), nothing under `src/` imports `node:*`, `@lightstart/server` or `@lightstart/sqlite`.
- `test-conventions`: no committed `.only` on `describe`, `it` or `test`.
- `test-touches-browser` (warning): a test that reads `document` or `window` is named `*.browser.test.*` or `*.e2e.*`.
- `controller-has-test` (warning): a controller under `src/controllers/` is named by a file under `test/` or `tests/`, or one that opens the generated app.
- `piece-file-names` (warning): a file under `src/models`, `src/controllers` or `src/views` is kebab-case.

## Building

`public/` is the place for an app's static files, served at the root in development, in a browser test and in the build; `index.html` references them with an absolute path. `light build` runs the same generator before it reads the page, then adds the files a static host needs after it rewrites the page, for a project with `src/app.ts` or `src/app.js`:

- `404.html`, the built page itself (the same contents as `index.html`), so a path the host has no file for still boots the app and its router.
- `sitemap.xml` and `robots.txt` when `defineApp` has a `url`: the sitemap lists every concrete path of `src/routes.ts`, as absolute URLs joined with `url`, sorted. A static route is its own path; a route with parameters (`/notes/:id`) is filled from the values its `params` answers, when it has one (`params: () => [{ id: "1" }, { id: "2" }]`), so a parameter route without `params`, a wildcard, a `spa: true` route and a redirect are left out. `robots.txt` is `User-agent: *`, `Allow: /` and a `Sitemap:` line. Without a `url` there is no sitemap, and `robots.txt` has no `Sitemap:` line.
- `_headers`, the format Cloudflare Pages and Netlify read: the hashed `.js` and `.css` outputs are cached with `Cache-Control: public, max-age=31536000, immutable`, and `/index.html`, `/404.html` and `/` with `Cache-Control: no-cache`.

`light build --prerender` (or `defineApp({ prerender: true | "markup" | "browser" })`) also renders every path the sitemap lists, each into its own `index.html` (`/` stays at the root, `/about` goes to `about/index.html`). The default renderer is `markup`: after the shell is written, the build renders each path in node on light's markup host with `renderPage` from `@lightstart/app/static`, one path after another, and writes the page with a `<script>window.__PRERENDERED__ = true</script>` first in `<head>`. It needs no browser and no Playwright. `light build --prerender --renderer browser` (or `defineApp({ prerender: "browser" })`) keeps the Playwright path instead: the build serves its outputs from memory on a local port, opens each path in headless Chromium (four pages at a time), waits for `networkidle`, two animation frames and a short settle, and keeps the page's `outerHTML` with `<!doctype html>`. That renderer is Playwright found in the project, or beside light: a project using it needs `pnpm add -D playwright` and `npx playwright install chromium`. With either renderer the page's markup is served to a reader, and the web host adopts it instead of replacing the root element; the first client navigation clears the marker. A page that throws fails the build naming its path; a view's error while rendering in node is printed as a warning with its path and the render goes on. `404.html` stays the unrendered shell so the router still boots on a path the static host has no file for.

## The web host

`@lightstart/app/web`'s `start(manifest)` runs the app in the page: its kinds `indexeddb` and `memory`, the arguments from the URL query (`?name=value`, a bare `?flag`; a parameter the app does not declare is left out), the browser's history for the routes with `configureNavigation(router.navigation)`, the app's scheme applied before the theme preset, and the root view mounted (an existing `<app-root>` replaced by a fresh one, another placeholder replaced, or appended to `<body>`). On a prerendered page (`window.__PRERENDERED__ === true` and the root already holding markup) the host keeps that element, so light's views adopt the served DOM, and `<app-container>` keeps the served view of the path. A view's first renders on such a page come before its data, so the host gives light a `settle` hook: a render that does not match the served DOM is held until the run has mounted and the work views handed to `trackWork` is done, then adopts if it matches by then, and renders fresh only if it still differs. The wait also ends at the user's first `input`, `change`, `pointerdown` or `keydown`, so what they asked for shows while loads continue. The first client navigation clears the marker. `<app-container>` is a component drawing `currentView`. It answers `{ stop() }`.

A project on `@lightstart/components` has its tags defined by the generated `.light/components.ts`, which `.light/app.ts` imports before the views, so every component exists before the root view is made. The stylesheets come from `.light/components.css` through the app's own stylesheet.

## The terminal host

`@lightstart/app/tui`'s `start(manifest, { classes, argv?, term? })` runs the app on a terminal: its kinds `jsonl` and `memory`, the arguments from argv (the app's, and the host's own `--data <dir>` (`.data` by default), `--scheme dark|light` and `--route <path>`, each unless the app declares that name; an argument error prints its message and exits 2), a history in memory for the routes, and `<app-container>` as a terminal view. It makes the manifest's root view and runs it with `runApp` and the baked table for the scheme; keys go to the root view's `onKey`, and its `mounted(renderer)` runs once the renderer does, so the view reaches the renderer and its terminal (`renderer.term`). A restart mounts a new root view on the same terminal. It needs a TTY: without one it prints a clear message and exits 2. It answers `{ stop() }`.

A terminal project's `package.json` names the entry and its binary:

```json
"native": { "entry": ".light/main.ts", "binary": "my-app", "prepare": ["light app"] }
```

The views, models and controllers a terminal app ships follow light's scriptc rules (`packages/light/native/README.md`): erasable TypeScript, classes for identity, no computed imports, no `Map` of functions, and `unknown` narrowed with `typeof`/`instanceof`/`Array.isArray`. A view writes its tag with `define(tag, Class)`; the root view default-exports its class.

## Rendering in node

`@lightstart/app/static` renders an app's page in node, without a browser: the build's default markup renderer prerenders from it, and a server can render a page with it. `renderApp` runs the app as `openApp` does (the arguments, every store in memory unless `kinds`, the controllers started and ready) over a history in memory at `path`, and mounts the root view (`app.root`, `"app-root"` by default) on light's markup host. It answers the root element's serialized markup with the engine's markers. `renderPage` puts that markup into the app's built HTML in place of the root placeholder (`<app-root></app-root>`, or the app's own tag) and inserts `<script>window.__PRERENDERED__ = true</script>` first in `<head>`.

```ts
import "@lightstart/light/markup";
import manifest from "./.light/app.ts";
import { renderPage } from "@lightstart/app/static";

const page = await renderPage(manifest, indexHtml, { path: "/about" });
```

Import `@lightstart/light/markup` before the app's manifest: it names the markup element and registry to light's views, and a view registers when its module loads, which the generated manifest does. A root view that is not registered on the markup host is an error naming the tag. A markup host does not have a browser's `document` or `window`, so a view or component that reads one reports its error rather than rendering that part, as `renderToStringAsync` does.

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
import manifest from "../.light/app.ts"; // `../.light/app.js` for a JavaScript app

const page = await openPage(manifest, { path: "/lists", args: { list: "Work" } });

const tasks = await page.find("tasks-page");
await page.navigate("/lists");
await page.shows("0/1 done");
page.text();             // the root view's text now
await page.settle();     // pending updates and microtasks
await page.stop();       // stops the run and removes the root element
```

`openPage` mounts the root view as the web host does, with the theme applied and the routes drawn by `<app-container>` over a history in memory that starts at `path` (`"/"` by default), so the test page's URL is no route of the app's. It takes the app's arguments as `openApp` does (`args`, rather than the URL's) and opens every store in memory unless `kinds` names others. With `worker`, a store declared `worker: true` opens in that worker (still in memory when every store is memory); without it, every store stays on the page. It answers an `OpenedPage`: `run`, `root` (the mounted root element), `find(selector, { timeout })` (waits for the element, waits for its pending update, then answers it), `text()`, `shows(text, { timeout })`, `navigate(path, { transition })`, `settle()` and `stop()`. A helper waits 2 s by default and throws naming what it wanted beside the page's text.

A test of the build itself serves a build folder and opens it in a fresh headless Chromium context with `openBuilt`:

```ts
import { latestBuild, openBuilt } from "@lightstart/app/web/test";

const dir = await latestBuild("."); // .deployed/current, else .deployed/builds/<id>
const page = await openBuilt(dir, "/about", { timeoutMs: 30_000 });

page.errors; // page errors and console errors
page.failed; // same-origin 4xx/5xx and failed requests
await page.text(); // document.body.innerText
await page.close();
```

`openBuilt(dir, path, { timeoutMs })` serves `dir` as a static host does: the file, else `<path>/index.html`, else `404.html` with status 404 (the SPA fallback). It waits for `load` and the network to go idle (Playwright's `networkidle`, 500 ms quiet) plus two animation frames before answering. The document's own 404 is not reported when `404.html` answered it, since that is the expected fallback; every other failed same-origin request, page error and console error is. It needs Playwright and a built folder; `latestBuild` reads `.deployed`, in the test that has the disk.

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

The generator (`node/generate.ts`, and each host's `generate.ts`) reads the disk. The core, the hosts and `openPage`/`mountApp` are plain modules the browser and the terminal compile. `static/index.ts` is node-only: it renders on light's markup host, and its prerender marker is the build's. `openBuilt` and `latestBuild` are node-only too: they serve a build folder and drive headless Chromium.
