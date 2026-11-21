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
| `src/app.ts` or `src/app.js` | `defineApp({ name, host, theme, scheme, locale, url, base, prerender, transitions, stores, root, args })` | reads it first |
| `src/models/<name>.ts` | one model, default-exported | opens its store with every model |
| `src/controllers/<name>.ts` | one controller, default-exported | names each, starts it and waits for `$ready`, each after the controllers it imports |
| `src/views/<tag>.ts` | one view, registering its tag | imports them all, so every tag exists |
| `src/routes.ts` | optional: `{ "/path": { view: "<tag>", name?, title?, layout?, props?, routes? } }` | follows them on every host; `<app-container>` draws the view, wrapped in its layout |
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
    cache: { adapter: "memory" },
    user: { at: (args) => `${args.string("dir") ?? "notes"}/user` },
  },
});
```

| Field | Default | What |
|---|---|---|
| `name` | required | The stores' default name and the document's title |
| `title` | none | The site's display name, the suffix of every page title (`<page> · <title>`); the home page, or a page without a title, is the title alone. Without it the document title keeps the page's title and `name` as before, separated by a vertical bar |
| `host` | required | The host's name: `"web"` or `"tui"` (`@lightstart/app/<host>`) |
| `theme` | `"default"` | A preset name, applied by the web host |
| `scheme` | `"system"` | The page's color scheme: `"dark"` or `"light"` pins it, `"system"` follows the reader's preference; the web host applies it before the theme |
| `locale` | `"en"` | The default language the app's words are in |
| `url` | none | The site's address (`https://lightstart.dev`), which the build's sitemap is written against; its path is the base the app is served under (`https://user.github.io/budget` lives under `/budget`) |
| `base` | the `url`'s path | The path the app lives under, overriding the path `url` names; `/` means the root |
| `prerender` | `false` | Render every concrete route into its own `index.html` during `light build`: `true` or `"markup"` renders in node, `"browser"` through Playwright |
| `worker` | `false` | Run the whole web model layer in one worker: every declared store opens there and the page reaches it over `@lightstart/rpc` |
| `transitions` | `false` | Run every web route change inside `document.startViewTransition` where the browser has it |
| `focusOnNavigate` | `true` | Move focus to the new view's first `h1`, else the view itself, after a route change that is not the first load |
| `stores` | `{ main: {} }` | The stores by name, several at once: `{ adapter?, at? }` each |
| `root` | `"app-root"` | The root view's tag |
| `layout` | none | The layout tag a top-level route wraps its view in unless the route declares its own `layout` |
| `args` | `{}` | The arguments the app takes, as a `@lightstart/cli` schema |

`defineApp` makes the app, an `App`: the config's fields, `args` (an `AppArgs` the host fills) and `restart` and `quit`, which reach the run. A controller imports the app and reads an argument by name: `app.args.string("dir")` for an option (`undefined` when it was not given and has no default), `app.args.flag("trust")` for a flag, `app.args.list("files")` for a rest positional. The app is one instance, the one the generated manifest holds and the host writes, so what a controller reads is what the host filled, natively as under node (a shape scriptc would convert is a copy).

## Stores

An app keeps rows in stores by name, several at once. A model picks one through its schema's `$store` (the store's name) and gets `main` when it names none; `main` is always there, of the host's default adapter unless the app says otherwise. One run opens them all over one engine store, which routes each model to its store.

- A store's `adapter` is an adapter type: light has `memory`, `indexeddb`, `jsonl` and `sql` (SQLite over `@lightstart/sqlite`). The host says which it runs and which is its default: the web host runs `indexeddb` and `memory`, the terminal host `jsonl` (its default) and `memory`; every host runs `memory`, and a test opens every store in memory. On the web a store with no `adapter` means IndexedDB: the generated entry imports that adapter type, so it is in the page's bundle. An app whose every store names `memory` carries neither the adapter type nor its implementation. The terminal host's default is `jsonl`.
- A store of an adapter type its host cannot run is an error naming the host and the adapter types it has; so is a model naming a store the app does not declare, before anything opens.
- `adapter` may be a function of the arguments, as `at` may: `adapter: (args) => (args.flag("ephemeral") ? "memory" : "jsonl")` keeps nothing for a run that asks so.
- `at` is what the adapter type opens: a folder for `jsonl` (the terminal's `--data` when absent), a database's name for `indexeddb` (the app's name for `main`, `<name>:<store>` for another), nothing for `memory`. It may be a function of the arguments.
- A project brings an adapter type of its own (an adapter over its server's API, SQLite with its driver) by registering an `AdapterType` before the run: `registerAdapterType(new MyAdapterType())`. Its `open(app, store, at, models, main)` answers the opened adapter.
- `defineApp({ worker: true })` runs the whole model layer in one web worker: every declared store opens there, over one engine store the worker owns. The page sends each model api through `configureModel({ request })` over `@lightstart/rpc`, so `onChange`, `liveRows` and `modelQuery` work unchanged while queries, relationships, validation, hooks and ids run in the worker. The worker relays `modelChanged` and the model diagnostics to the page, so a write announces once, on the page. A `ValidationError` reaches the page with its `name` and `errors`. The terminal host has no worker and ignores `worker: true`; `openApp` keeps every store in memory on the page, as today. An adapter type the worker does not run is an error naming the adapter types it has. Seeds load through the worker's engine store, so they cross the channel as rows and land once. The project lists `@lightstart/rpc` in its dependencies: the page loads it when the run opens its stores, and the generated `.light/worker.js` imports it. The page bundles no engine store: a worker app's page carries no query builder, relationship loader or validation. A test passes `worker: () => new Worker(new URL("../.light/worker.js", import.meta.url), { type: "module" })` to `openPage` to run the worker too (every store still in memory).

A `worker: true` app may keep more than the model layer in its worker. `src/worker.ts` (or `src/worker.js`), optional, default-exports `defineWorker({ serve, relay, mirror, opened })` from `@lightstart/app/web/worker-entry`, and the generated `.light/worker.js` imports it before `serveModels` and passes it, so its top level runs first (an adapter type it registers there is there for the stores). `serve` adds request handlers beside light's (a name light uses is an error), `relay` adds events to `modelChanged` and the diagnostics (a name light relays is an error), and `mirror` names signals the worker owns or follows with `{ signal, owner }`. `opened({ app, store, request, serve })` runs after the stores open and before the page's `open` answers: `store` is the worker's engine store, `request(name, payload)` reaches a handler the page serves, and `serve(handlers)` adds handlers from then on (what a worker loads later serves too); an error there rejects the run.

The page declares its side on `worker` from `@lightstart/app/web/worker.ts`: `worker.request(name, payload)` (waiting until the stores have opened), `worker.relay(emitters)`, `worker.mirror(name, signal, { owner })` and `worker.serve(handlers)` for the worker's requests. Calls made before a connection are applied when it opens, and one made after it is open re-installs the merged tables. `WorkerStores` takes a factory answering a `Worker` or a `MessagePort`: a backend that is not a dedicated worker serves the same channel, and only a `Worker` is terminated when the run stops.

## Seeds

A project may start with data. `src/seed.ts` (or `src/seed.js`) default-exports rows keyed by model name; `src/seed.dev.ts` (or `.js`) holds demo rows, loaded by `light serve`, `light test` and the test helpers, and left out of a release build (`light build`):

```ts
export default {
  note: [{ text: "A first note" }],
};
```

The generation imports both files into the manifest (`.light/app.ts` or `.js`), `src/seed` before `src/seed.dev`. A run adds a model's seed after the stores open and before the controllers start, so a controller's first query already sees the rows (and a prerender draws them). It adds them only when the model's store is empty, so a later run over the same rows adds nothing. A name with no such model is an error naming it; a row the model rejects is an error naming the model and the row's index. `openApp` and `openPage` load the seeds too; pass `{ seed: false }` to skip them.

## Content

A project that depends on `@lightstart/content` keeps a model's rows as Markdown files, one per
row, in `content/<model>/` at the project's root, beside `src/` and `public/`. The folder names the model, the file name fills `slug` when the
frontmatter has none, and the frontmatter holds the model's other fields. The model declares a
body as `body: T.array()`, since a body is a JSON block list rather than a string.

The generation writes `.light/content.ts` (or `.js`), exporting `{ <model>: [rows] }`, and
imports it into `.light/app.ts` (or `.js`) as one seed before `src/seed`. A folder naming a model
the app does not have is an error naming both. The dev server regenerates when a file under
`content/` is added, removed or renamed.

Content and `src/seed` are additive: with both, a model's content rows load first and its seed
rows after. Remove the seed entry for a model that moved to `content`, so it does not load
twice. [@lightstart/content](../content/README.md) documents the frontmatter subset, `collect`
and `renderContent`.

## Icons

Icons come from an Iconify set, `lucide` unless `defineApp({ icons: "lucide" })` names another. Its collection is the npm package `@iconify-json/<set>`, a devDependency of the app: versioned, in the lockfile, and offline once installed, with no Iconify API request at run time.

The generation, in the same pass that finds the `lc-*` tags, reads the icon names the app's own `src/` and the source of every component it uses carry: `<lc-icon name="x">`, `icon="x"`, `icon: "x"`, `iconName: "x"`, and a module's `icons: ["x", ...]` array. It keeps the `solid` and `bold` variants an element asks for and the numeric `size`s, then writes `.light/icons.css` from the collection with one CSS mask rule per name; `.light/components.css` imports it, so development, tests, the build and a prerendered page draw the same icons without a loader. A project that names no icon gets no file, and a project without the set installed gets none either (`light check` reports it).

An app can also draw its own icons from `icons/<name>.svg` at the project root, beside `content/` and `public/`. The file name is the icon name (lower-case kebab-case), so a file `icons/brand-mark.svg` is drawn by `<lc-icon name="brand-mark">` or `icon="brand-mark"` like a set's icon. Its root `<svg>` gives the `viewBox` and the markup inside is the body; the generation writes every app icon into `.light/icons.css` whether or not a source names it, and an app icon wins over a set icon of the same name. Draw one at 24×24, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, round caps and joins, with no text and no colour other than `currentColor` or `none`: a mask keeps only the shape. Start with `light new icon <name>`, which writes that scaffold, then replace its shapes. `light check` reports an icon file with an invalid name, a missing `viewBox`, a `<script>`, an event attribute, an external `href`, an `<image>`, a `<foreignObject>` or a colour, and an app icon that shadows the set's name.

A name built at run time, `<lc-icon name=${name}>` or `icon=${name}`, cannot be read by the generator, so the names it can take must be written as literals somewhere it reads: usually they already are (`icon: "house"` in a list the module or one it imports holds). A name that is only a bare string (`{ checking: "landmark" }`) is declared in a module-level `icons: ["x", ...]`, the components' own convention, or a class's `static icons = [...]`. Names in data count too, `content/` frontmatter (`icon: zap`) included. `light check` reports a binding only when the app names no icon anywhere (no literal, no data field, no declaration, no icon of its own); which name a binding takes is only known on the page, so what the check cannot see, a bare string in a map, `lc-icon` reports once on the page: a name no stylesheet draws, with no loader configured, warns naming itself. `light check` also fails a name the set does not have, and a project that uses icons without `@iconify-json/<set>`, naming the `pnpm add -D @iconify-json/<set>` to run. `configureIcons` stays for a page outside an app that loads its own icons.

## Routes and views

`src/routes.ts` maps paths to view tags on every host. The run makes the router (`@lightstart/router`'s core) over the host's history: the browser's on the web, one in memory on the terminal (starting at `/`, or the path `--route` names). `currentView` is the view tag the path answers, `currentParams` the parameters of its path (`/components/:category` gives `{ category }`), and `navigate(path)` goes to another; all come from the host's subpath. A root view that shows routes writes `<app-container>` (the app's, drawing the routed view; not `lc-app-container`, the components' page layout), which the host gives: a component in the page, a terminal view on the terminal. The container sets the parameters on the view as props, keeping the same element while the tag stays, so a view declares a prop for each parameter its path has:

```js
import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class NotePage extends View.props({ slug: "" }) {
  render() {
    return html`<h1>${this.slug}</h1>`;
  }
}

View.register("app-note", NotePage);
```

A plain class may keep `static props = { slug: "" }` instead. An app without `routes.ts` mounts its root view alone. A deploy base never reaches a view: the router adds it to its own `href` and strips it from the location, so a route matches the same `/accounts` under `/budget`.

A route may declare `layout`, the tag of an ordinary view (in `src/views`) that holds an `<app-container>` where the routed view goes. `defineApp({ layout })` names the default for top-level routes only, and `layout: null` opts a route out. While a navigation keeps the layout tag, the layout element stays (its state survives) and only its container's view changes; a parameter change keeps the view element too.

```js
export default {
  "/settings": {
    view: "app-settings",
    layout: "app-shell",
    routes: {
      "/profile": { view: "app-profile", title: "Profile" },
      "/billing": { view: "app-billing", title: "Billing" },
    },
  },
  "/plain": { view: "app-plain", layout: null },
  "/notes/:id": { view: "app-note", props: { tab: "body" } },
};
```

Nested `routes` join their parent's path, and the chain is drawn one level at a time. The root's `<app-container>` draws level 0: its layout holding its view. An `<app-container>` inside a layout draws the view that layout wraps; one inside a routed view draws the next level (with that route's own `layout`, the app default not applying below the top). A route with no `view` only groups its children: it takes no level, and its `layout` wraps the next view. A container with no level left draws nothing.

A route's `props` sets fixed values on its view, and a path or query parameter of the same name wins. A parameter reaches the view as the type it declares for that prop: `T.number()` gets a number (left as the string when it is not finite), a boolean gets `true` for `""`, `"true"` and `"1"` and `false` for `"false"` and `"0"`, and other types arrive as strings. A route's own `props` values are set as written.

With `transitions: true` the web host runs each route change (a `navigate`, a link through the router, the browser's back and forward) inside `document.startViewTransition` where the browser has it, and waits for `<app-container>` to draw the next view, so the browser snapshots the old view and the new one.

Paths are the app's own, without the base: `navigate("/accounts")`, `currentView`, route params and `currentParams` all see `/accounts`, whether the app is at the root or under `/budget`. The web host puts the base before every root-relative `<a href>` in the app's DOM (a link drawn later too), leaving a link with `data-no-router` or `rel="external"` alone; a middle-click or a crawler sees the right URL too. `appUrl(path)` from `@lightstart/app` puts the running app's base before a root-relative path (`appUrl("/rates.json")` is `/budget/rates.json`), for code that fetches its own files.

### Route names and links

`currentRoute` is the matched route as a signal: `{ name, path, params, query, route }`, where `path` is the app path without the base and the query, `params` the path params only, `query` the query params, and `route` the matched leaf config. It is null before a run and after it stops, and follows the same update as `currentView` and `currentParams`.

`href(target, options?)` builds a link: `target` is an app path (`"/places/x"`) or a route name (`"place-detail"`), `options.params` fills the name's `:params` (each URL-encoded, a missing one an error naming the route and the param) and `options.query` is appended, with the app's base before the answer. `url(target, options?)` is the same address made absolute from the app's `url` origin, else the browser's location. `navigate(target, options?)` follows either, plus `transition` and `from`, navigating with the app path without the base, which the router adds once.

```js
import { currentRoute, href, navigate } from "@lightstart/app/web";

const places = href("places");
const detail = href("place-detail", { params: { id: 7 }, query: { tab: "map" } });
const active = currentRoute.value?.name === "places";
navigate("place-detail", { params: { id: 7 } });
```

A route change that comes from a link click, or from `navigate(path, { from: element })`, morphs that element into the next view: the host gives the clicked element the transition name `morph` for the old snapshot, and the next view's first `[data-morph]` element (the view element itself when none is marked) the same name for the new one. Only one element carries the name at a time, so a site with many links leading to one page has no names to collide. Going back reverses it: the host remembers, per history entry, the path a morph-forward navigation led to, and on a history navigation to that page names the current view's `[data-morph]` element before the update and, on the restored page, the first link whose `href` is the path being left (preferring one marked `data-morph-source`) after it; when there is none, the change cross-fades.

Light installs default rules for the `morph` group: the snapshots are not scaled (`object-fit: none`, anchored top left, clipped by the growing box), the old one fades out in the first 40% while the new one fades in, the group takes 420ms on `cubic-bezier(0.2, 0, 0, 1)`, and the root cross-fades in 220ms. The rules live in the `light` cascade layer, so an app overrides any of them with its own `::view-transition-*(morph)` rules, and a fixed `view-transition-name` an app sets itself keeps working. Under `prefers-reduced-motion: reduce` the host sets no `morph` name at all, so only the root cross-fade runs.

```css
.note-header { view-transition-name: note-card; }
.note-tile { view-transition-name: note-card; }
```

`navigate(path, { transition: true | false })` overrides the app's choice for one call, and `navigate(path, { from: element })` starts its morph from the element named rather than from a click.

A route with parameters may list their values with `params: () => Array<Record<string, string>>` (or a promise of one), as the site's `/components/:category` does. `pathsOf` (`@lightstart/app/node/paths.ts`) answers every concrete path of a routes table, sorted and unique: a path without parameters is itself, and a path with them is filled from the entries `params` answers, each value URL-encoded, an entry missing a parameter skipped. A wildcard path, a route marked `spa: true` and a redirect are left out, and nested `routes` join their parent's path. The build's sitemap and prerendering read it.

A route's `title` and `description` may be a string or a function of the matched parameters: `"/p/:slug": { view: "app-project", title: ({ slug }) => slug, description: ({ slug }) => \`About ${slug}\` }`. The function is read on every navigation, so a page titled by its data says so.

### The page head

A page's head is one value the run keeps: a route change resets it from the route, and a view patches what only its own data knows with `pageHead` from `@lightstart/app`, during its render (or in `connected`):

```js
import { pageHead } from "@lightstart/app";

pageHead({ title: this.note.title, description: `Notes about ${this.note.title}`, image: "/notes/cover.png" });
```

A field left out keeps the route's value until the next route change. With `defineApp({ title })`, the document title is `<page title> · <title>`; the home route (`/`) or a page without a title is the app's title alone. Without `title`, the app's `name` is the suffix as before (`<page title> | <name>`). The web host follows the head into `<title>`, `<meta name="description">`, the canonical link (from `defineApp({ url })` and the path), `og:title`, `og:description`, `og:url`, `og:type`, `og:image` and `twitter:card`, updating each tag in place. A prerendered page carries the same tags in its `<head>`.

### Navigation and focus

After a route change that is not the first load, the web host moves focus to the new view's first `h1`, else to the view element itself (given `tabindex="-1"` and stripped of it on blur) with `{ preventScroll: true }`, and writes the new document title into a visually hidden polite live region, so a keyboard user and a screen reader start at the new page. `defineApp({ focusOnNavigate: false })` keeps focus where it is. A new navigation scrolls to the top, or to the element its `#hash` names (which then takes the focus instead of the `h1`), and a first load scrolls to that element once the page has drawn; the browser's back and forward restore the scroll position the page had, and the web host sets `history.scrollRestoration = "manual"` to keep it.

## The run

One run, the same on every host (`run.ts`):

1. Fills the arguments from the host's source (argv, the URL query, a test's values).
2. Opens every store, then adds each empty model's seeds.
3. Names every controller (`nameControllers`, so `sync:` reaches it), starts them in import order and awaits each `$ready`.
4. Follows the routes, when the app has them.
5. Mounts the view on the host's surface.

It installs `app.restart(args?)` (stop, merge the arguments, open, start and mount again) and `app.quit(code?)` (stop, then leave as the host does: a terminal app exits with `code`). Both answer promises, and reject with "the app is not running" before a run. `stop()` takes the view down, stops following the routes, disposes the controllers in reverse order and closes the stores.

A host is an `AppHost`: its name, the store adapter types it runs and its default, `args(app)`, `history()`, `mount(run)`, `unmount(run)`, `transition(apply)` and `exit(code)`. Each has what a host with no surface does, and a host overrides what it changes.

## The order controllers start in

The run starts the controllers one after the other, each once the one before it is `$ready`, and disposes them in reverse. A controller starts after every controller it imports (`import folder from "./folder.ts"`), so the one it reads in its `connected()` is already running; an `import type` does not count. Otherwise they go by name. Controllers that import each other in a cycle are an error that names the cycle.

A `Controller` subclass follows a model with `liveRows`, which needs nothing registered. A `defineController` literal or a view whose `sync:` names a model api (`sync: { rows: { to: transaction, query } }`) needs light's model binder. The generation installs it for the app: when any file under `src/` declares a `sync:`, the entry imports `.light/sync.ts` (or `.js`) before the views, which calls `View.use(syncPlugin)` (`@lightstart/light/controller/view`) and, when a target is a model api imported from `src/models/`, `registerSyncBinder(modelBinder)` (`@lightstart/light/controller` and `@lightstart/light/model/binder`). A page with no such binding bundles neither, and calling either again is harmless.

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
import { LocalStores } from "@lightstart/app/web/local.ts";
import { Transitions } from "@lightstart/app/web/transitions.ts";
import { queryArgs } from "@lightstart/app/web/args.ts";

await start(manifest, {
  stores: new LocalStores(),
  transitions: new Transitions(),
  args: queryArgs,
});
```

For `worker: true` the entry passes `stores: new WorkerStores(() => new Worker(new URL("./worker.js", import.meta.url), { type: "module" }))` instead, and imports no IndexedDB adapter type on the page: the worker opens them. `.light/worker.js` also imports the project's `src/worker.ts` or `src/worker.js` when it has one and passes it to `serveModels`; a project with both is an error naming both.

The generator reads `src/app.ts` and writes only the imports the config uses: `web/local.ts` or, for `worker: true`, `web/worker.ts` for the run's stores; `web/indexeddb.ts` when a non-worker store names `indexeddb` or names no adapter (the web default); `web/transitions.ts` with `transitions: true`; and `web/args.ts` when `args` is not empty. A store whose `adapter` is a function may return any web adapter type, so the entry imports the IndexedDB adapter type too. Everything else stays out of the bundle by construction. A hand-written entry passes its own stores feature; without one the run rejects, naming the generated entry.

On the web, `scheme` is applied before the theme: `"dark"` puts the `dark` class on `<html>` and stops following the preference, `"light"` removes it, and `"system"` follows the reader's choice and the OS. The build writes the class into a prerendered page's `<html>`, so a dark app paints dark on the first frame. The terminal host ignores it.

A web project that declares `@lightstart/components` and writes an `lc-*` tag in `src/` gets two more files. `.light/components.ts` (or `.js`) imports each component module, follows every `extends` and `uses`, and defines each base and used tag before the tag that needs it; `.light/components.css` imports the theme and each component's stylesheet in the same order. When a source names an icon, it also gets `.light/icons.css` (see [Icons](#icons)), which `.light/components.css` imports. `.light/app.ts` (or `.js`) imports `./components.ts` (or `.js`) before the views. A project without the package, or writing no tag, gets none of them.

A project that declares `@lightstart/i18n` gets `.light/locales.ts` (or `.js`), imported by `.light/app.ts` (or `.js`) before the views. It imports `locales/<lang>.js` from every dependency whose `package.json` says `light.locales: true`, and the project's own `src/locales/<lang>.ts`/`.js`, then calls `configureI18n({ locales, defaultLocale, dictionaries })`: every language found, the app's `locale` as the default, and each language's dictionary the packages' merged first with the project's over them (a deep merge, so a key the project writes wins). A project without the package gets no file, and may plug another library into `configureTranslation` itself.

A project whose `src/` declares a `sync:` gets `.light/sync.ts` (or `.js`), imported by `.light/app.ts` (or `.js`) before the views: it calls `View.use(syncPlugin)` so every view prop declared with `sync:` follows its target. When a `sync:` target is a model api imported from `src/models/`, it also calls `registerSyncBinder(modelBinder)`. A project with no such declaration gets no file.

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
- `icons-known`: an icon name is one the app's set or its `icons/` folder has, a binding has names somewhere to take, and each `icons/*.svg` is a safe mask; a project that uses icons installs `@iconify-json/<set>`.
- `no-server-module-in-page`: in a web app (`host: "web"` in `src/app.*`), nothing under `src/` imports `node:*`, `@lightstart/server` or `@lightstart/sqlite`.
- `page-test-name`: a `*.test.*` file that imports `@lightstart/app/web/test` is named `*.browser.test.*`, since a page test needs Chromium.
- `test-conventions`: no committed `.only` on `describe`, `it` or `test`.
- `test-touches-browser` (warning): a test that reads `document` or `window` is named `*.browser.test.*` or `*.e2e.*`.
- `controller-has-test` (warning): a controller under `src/controllers/` is named by a file under `test/` or `tests/`, or one that opens the generated app.
- `piece-file-names` (warning): a file under `src/models`, `src/controllers` or `src/views` is kebab-case.

## Deploying under a path

An app deployed to a project page lives under its path. `defineApp({ url: "https://user.github.io/budget" })` makes `/budget` the base (or name one with `base`; `"/"` means the root). The web host hands the base to the router, so views keep writing app paths; it builds the canonical link from the app's `url` and app path without adding the base twice. `light serve` answers the app at `/budget/`, redirects `/` there, resolves `/budget/src/styles.css` like `/src/styles.css`, and keeps the unprefixed paths working for the page's root-relative imports. `light build` writes the files at the build folder's root (the folder is deployed at the base) and puts the base before every root-relative URL in the built HTML.

## Building

`public/` is the place for an app's static files, served at the root in development, in a browser test and in the build; `index.html` references them with an absolute path. `light build` runs the same generator before it reads the page, then adds the files a static host needs after it rewrites the page, for a project with `src/app.ts` or `src/app.js`. The build folder's files stay at its root, since the folder is deployed at the app's base: every root-relative URL in the built HTML (bundles, stylesheets, preloads, the favicon and anchors) carries it, as do `404.html`, the sitemap, `robots.txt` and `_headers`.

- `404.html`, the built page itself (the same contents as `index.html`), so a path the host has no file for still boots the app and its router.
- `sitemap.xml` and `robots.txt` when `defineApp` has a `url`: the sitemap lists every concrete path of `src/routes.ts`, as absolute URLs joined with `url`, sorted. A static route is its own path; a route with parameters (`/notes/:id`) is filled from the values its `params` answers, when it has one (`params: () => [{ id: "1" }, { id: "2" }]`), so a parameter route without `params`, a wildcard, a `spa: true` route and a redirect are left out. `robots.txt` is `User-agent: *`, `Allow: /` and a `Sitemap:` line. Without a `url` there is no sitemap, and `robots.txt` has no `Sitemap:` line.
- `_headers`, the format Cloudflare Pages and Netlify read: the hashed `.js` and `.css` outputs are cached with `Cache-Control: public, max-age=31536000, immutable`, and `/index.html`, `/404.html` and `/` with `Cache-Control: no-cache`.

`light build --prerender` (or `defineApp({ prerender: true | "markup" | "browser" })`) also renders every path the sitemap lists, each into its own `index.html` (`/` stays at the root, `/about` goes to `about/index.html`). The default renderer is `markup`: after the shell is written, the build renders each path in node on light's markup host with `renderPage` from `@lightstart/app/static`, one path after another, and writes the page with a `<script>window.__PRERENDERED__ = true</script>` first in `<head>`. It needs no browser and no Playwright. `light build --prerender --renderer browser` (or `defineApp({ prerender: "browser" })`) keeps the Playwright path instead: the build serves its outputs from memory on a local port, opens each path in headless Chromium (four pages at a time), waits for `networkidle`, two animation frames and a short settle, and keeps the page's `outerHTML` with `<!doctype html>`. That renderer is Playwright found in the project, or beside light: a project using it needs `pnpm add -D playwright` and `npx playwright install chromium`. With either renderer the page's markup is served to a reader, and the web host adopts it instead of replacing the root element; the first client navigation clears the marker. A page that throws fails the build naming its path; a view's error while rendering in node is printed as a warning with its path and the render goes on. `404.html` stays the unrendered shell so the router still boots on a path the static host has no file for.

## The web host

`@lightstart/app/web`'s `start(manifest, features)` runs the app in the page. `memory` is always there; the generated entry passes the optional features the config uses as module objects: the stores feature (`LocalStores`, or `WorkerStores` for `worker: true`), extra store adapter types, the transition feature and the URL-query arguments (`?name=value`, a bare `?flag`; a parameter the app does not declare is left out). Without them the host opens no stores, answers no arguments and its `transition` just runs `apply`. It follows the browser's history for the routes with `configureNavigation(router.navigation)`, applies the app's scheme before the theme preset, and mounts the root view (an existing `<app-root>` replaced by a fresh one, another placeholder replaced, or appended to `<body>`). On a prerendered page (`window.__PRERENDERED__ === true` and the root already holding markup) the host keeps that element, so light's views adopt the served DOM, and `<app-container>` keeps the served view of the path. A view's first renders on such a page come before its data, so the host gives light a `settle` hook: a render that does not match the served DOM is held until the run has mounted and the work views handed to `trackWork` is done, then adopts if it matches by then, and renders fresh only if it still differs. The wait also ends at the user's first `input`, `change`, `pointerdown` or `keydown`, so what they asked for shows while loads continue. The first client navigation clears the marker. `<app-container>` is a component drawing `currentView`. It answers `{ stop() }`.

A project on `@lightstart/components` has its tags defined by the generated `.light/components.ts`, which `.light/app.ts` imports before the views, so every component exists before the root view is made. The stylesheets come from `.light/components.css` through the app's own stylesheet.

## The terminal host

`@lightstart/app/tui`'s `start(manifest, { classes, argv?, term? })` runs the app on a terminal: its adapter types `jsonl` and `memory`, the arguments from argv (the app's, and the host's own `--data <dir>` (`.data` by default), `--scheme dark|light` and `--route <path>`, each unless the app declares that name; an argument error prints its message and exits 2), a history in memory for the routes, and `<app-container>` as a terminal view. It makes the manifest's root view and runs it with `runApp` and the baked table for the scheme; keys go to the root view's `onKey`, and its `mounted(renderer)` runs once the renderer does, so the view reaches the renderer and its terminal (`renderer.term`). A restart mounts a new root view on the same terminal. It needs a TTY: without one it prints a clear message and exits 2. It answers `{ stop() }`.

A terminal project's `package.json` names the entry and its binary:

```json
"native": { "entry": ".light/main.ts", "binary": "my-app", "prepare": ["light app"] }
```

The views, models and controllers a terminal app ships follow light's scriptc rules (`packages/light/native/README.md`): erasable TypeScript, classes for identity, no computed imports, no `Map` of functions, and `unknown` narrowed with `typeof`/`instanceof`/`Array.isArray`. A view writes its tag with `define(tag, Class)`; the root view default-exports its class.

## Rendering in node

`@lightstart/app/static` renders an app's page in node, without a browser: the build's default markup renderer prerenders from it, and a server can render a page with it. `renderApp` runs the app as `openApp` does (the arguments, every store in memory unless `adapters`, the controllers started and ready) over a history in memory at `path`, and mounts the root view (`app.root`, `"app-root"` by default) on light's markup host. It answers the root element's serialized markup with the engine's markers. `renderPage` puts that markup into the app's built HTML in place of the root placeholder (`<app-root></app-root>`, or the app's own tag) and inserts `<script>window.__PRERENDERED__ = true</script>` first in `<head>`.

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

`openApp` fills the arguments (an array of `argv` tokens, or a record merged over the defaults), opens every store in memory (or, given `adapters: [new JsonlAdapterType()]`, with the adapter types a test names, so what lands on disk can be checked), starts the controllers and the routes (in memory), and answers an `OpenedApp`: `run`, `store`, `controllers`, `restart`, `quit` and `stop`. In an app, `light test` gives a node test the generated manifest: it loads `@lightstart/light/markup` before the node run, so a test importing `../.light/app.ts` (or `.js`) registers the app's views without a browser. Name a test that opens a page `*.browser.test.*`; every other `*.test.*` file runs under node, and a file that is neither (such as `*.e2e.*`) keeps the browser runner. `light test` reports both parts and fails if either fails. A web test opens the page itself with `@lightstart/app/web/test`'s `openPage`:

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

`openPage` mounts the root view as the web host does, with the theme applied and the routes drawn by `<app-container>` over a history in memory that starts at `path` (`"/"` by default), so the test page's URL is no route of the app's. It takes the app's arguments as `openApp` does (`args`, rather than the URL's) and opens every store in memory unless `adapters` names others. With `stores: new WorkerStores(spawn)` (from `@lightstart/app/web/worker.ts`), a `worker: true` app runs its model layer in the worker `spawn` starts (every store still in memory); without it, every store opens on the page through `LocalStores`. It answers an `OpenedPage`: `run`, `root` (the mounted root element), `find(selector, { timeout })` (waits for the element, waits for its pending update, then answers it), `text()`, `shows(text, { timeout })`, `navigate(path, { transition })`, `settle()` and `stop()`. A helper waits 2 s by default and throws naming what it wanted beside the page's text.

A test of the build itself serves a build folder and opens it in a fresh headless Chromium context with `openBuilt`:

```ts
import { latestBuild, openBuilt } from "@lightstart/app/web/test";

const dir = await latestBuild("."); // .deployed/current, else .deployed/builds/<id>
const page = await openBuilt(dir, "/about", { timeoutMs: 30_000 });

page.errors; // page errors and console errors
page.failed; // same-origin 4xx/5xx and failed requests
await page.text(); // document.body.innerText
await page.click('a[href="/"]'); // as a reader clicks: a link goes through the router
await page.shows("Home"); // waits for the text (2 s by default), else throws with the page's text
await page.back(); // the browser's back, then forward()
await page.path(); // location.pathname
await page.evaluate(() => document.title); // run a script in the page
await page.close();
```

`openBuilt(dir, path, { timeoutMs, base })` serves `dir` as a static host does: the file, else `<path>/index.html`, else `404.html` with status 404 (the SPA fallback). It reads the app's base from the project when `dir` is under its `.deployed` folder (or takes `base`), serves the build under that base, and takes the app path without it. It waits for `load` and the network to go idle (Playwright's `networkidle`, 500 ms quiet) plus two animation frames before answering. The document's own 404 is not reported when `404.html` answered it, since that is the expected fallback; every other failed same-origin request, page error and console error is. It needs Playwright and a built folder; `latestBuild` reads `.deployed`, in the test that has the disk.

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
