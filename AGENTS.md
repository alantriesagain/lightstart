# Working in this repository

Each package has its own rules where it has an `AGENTS.md` (`packages/server/AGENTS.md`, `packages/components/AGENTS.md`); this file holds what applies to all of them.

## Using light

Start every new project with `light new <kind> <name>`, run from a light checkout. The generator links that checkout because the packages are not on npm yet; `--light <path>` names another checkout, and `--npm` writes published version ranges once they exist.

| Kind | What it gives |
|---|---|
| `web` | A web app on `@lightstart/app`: views, a model, a controller and routes, served by `light serve`; JavaScript typed with JSDoc, or TypeScript with `--ts` |
| `tui` | A terminal app on `@lightstart/app`: a model, a controller and views, compiled by `scriptc` |
| `desktop` | A light page in the desktop shell, with a backend `scriptc` compiles |
| `package` | A light package: modules, tests, a README and the pack script |

The project's own `AGENTS.md` is the reference for its kind: where files go, what each script does, how to test and what the host expects. Read it before changing code.

A web or terminal project is an app on `@lightstart/app`: `src/app.js` (`src/app.ts` in a TypeScript app) names its host, `src/models/`, `src/controllers/` and `src/views/` hold its pieces, and `src/routes.js` maps paths to view tags on the web. Light writes the wiring into `.light/`, which is generated and never committed or edited. A view imports its controller, a controller imports its models, and one controller reaches another by name with `sync:`.

The everyday commands are `pnpm dev` (web, tui, desktop), `pnpm build`, `pnpm test`, `pnpm check`, `pnpm lint`, `pnpm typecheck` and `pnpm verify` (all four gates). A project's own scripts are the source of truth.

Conventions every kind shares:

- TypeScript with erasable syntax (light's own packages, a `--ts` app, terminal apps): no `enum`, `namespace`, parameter properties or decorators, so node runs the sources after stripping types and `scriptc` can compile them. A web app defaults to JavaScript typed with JSDoc, checked by `light typecheck`; `--ts` writes TypeScript instead.
- No `any`. Narrow `unknown` with `typeof`, `instanceof` or `Array.isArray`.
- Run `pnpm verify` before committing: `light verify` runs `check`, `lint`, `typecheck` and `test` in order.
- Test with `light test` in a web app, and with `node --test` (or the project's test script) elsewhere.
- Never hand-write an importmap. `light serve` builds it from `package.json`.
- Light's package READMEs are the reference for an API; every package under `packages/` has one.

## What light has

Reach for these before writing your own; each package's README is its reference.

| A project needs | Package | The part to know |
|---|---|---|
| The app's folders, wiring and run | `@lightstart/app` | `defineApp`, extensions and slots (`defineExtension`, `defineSlot`, `<app-slot>`), stores by name (`memory`, `indexeddb`, `jsonl`, `sql`, an `AdapterType` of the project's own, `worker: true` running the model layer in a worker), routes, `<app-container>`, `navigate`, `href`, `url`, `currentRoute`, `currentView`, `currentParams`; hosts `@lightstart/app/web` and `/tui`, and `@lightstart/app/static` rendering a page in node |
| Views, templates, signals, models, controllers, the theme | `@lightstart/light` | `View`, `html`, `signal`, `event`, `defineModel` with `T` fields, `defineController` and the `Controller` class, `liveRows`, `applyTheme` |
| UI components | `@lightstart/components` | the `lc-*` tags; in an app the generation defines the tags a view writes and their stylesheets |
| Forms from a model | `@lightstart/form` | `fieldsForModel(schema)` for `<lc-form .fields>`, `inferFields`, `validateForm` on submit |
| A channel to a worker or another runtime | `@lightstart/rpc` | `serve` and `client` for requests, `relay` for a declared set of events, `mirror` for an owner's signal |
| Translations | `@lightstart/i18n` | `configureI18n`, `t`, `setLanguage`; plugs into light's contract `@lightstart/light/i18n`, which any library can implement; `lc-language-switcher` |
| A routes table outside an app | `@lightstart/router` | `RouterCore` over a browser or memory history; light's `Navigation` contract |
| A component catalogue | `@lightstart/showcase` | `showcase-catalogue`, `showcase-component-doc` and the theme tools, over the components' `tags.json` and demos |
| An HTTP backend | `@lightstart/server` | routes, middleware and plugins over one `Context`; node, fetch and lambda adapters |
| An app's server models over HTTP | `@lightstart/api` | a store with `adapter: "api"`; `crudApp` answers `/api/<model>` over a D1-shaped database with each schema's `$permissions` (`public`, `auth`, `owner`, `none`); `light db:migrate`; `configureApi({ token })` on the page |
| Sign-in and the session | `@lightstart/auth` | a code mailed to an address and an HS256 JWT: `authEndpoints`, `authModels`, `callerFromRequest` on `@lightstart/api`'s server; the page's `auth` controller (`sync: "auth"`), which hands the token to the `api` store; `safeNext` for a `next` after sign-in |
| Who a request came from | `@lightstart/visitor` | `clientIp(request, { trusted, ip })` (Cloudflare's header only on Cloudflare, else `TrustProxy`'s `c.ip`, never raw `X-Forwarded-For`), a salted daily pseudonym, `detectBot`, `perAddress` limits over the `visits` table its server contribution adds |
| Image variants | `@lightstart/images` | `variantUrl`/`thumbUrl` for a photo's `_thumb`/`_card` siblings, `imageSize`, `resizeImage` in the page, `light images:normalize` (headless Chromium) |
| An inbox | `@lightstart/notifications` | the `notifications` controller over the `notificationSources` slot (`{ id, list() }`), the per-device read state, `<notifications-bell>`, `-list`, `-row`, `-sheet` |
| SQLite | `@lightstart/sqlite` | one synchronous driver, node's or native |
| Markdown, syntax colours | `@lightstart/markdown`, `@lightstart/highlight` | `parse`; a line tokenizer for terminal views and `lc-code-block` |
| Markdown files as an app's content | `@lightstart/content` | `content/<model>/*.md`, frontmatter and a body; `collect` at build, `renderContent` on the page with no parser; a read-only `content` store for a large catalogue, built to `content/<model>.json` and read by `where`/`order`/`fields`/`count` |
| A web manifest, service worker and update policy | `@lightstart/pwa` | `src/pwa.js` with `definePwa`; the generated entry registers it, `light build` writes `manifest.webmanifest` and `sw.js`, `light serve` answers both, and `@lightstart/pwa/page` has `pwa.update`, `pwa.apply()`, `pwa.check()` and `<pwa-update-toast>` |
| An Android app | `@lightstart/mobile` | `src/mobile.js` with `defineMobile`; `light mobile:init`, `mobile:sync`, `mobile:build` and `mobile:run` scaffold, sync and build the shell, and `@lightstart/mobile/page` has `mobile.present`, `mobile.ready`, `mobile.can`, `mobile.request`, `mobile.on` and `mobile.share` |
| Deploying to Cloudflare Pages | `@lightstart/cloudflare` | `light cf:deploy` uploads `.deployed/current` to the Pages project (the package's name, or `src/cloudflare.js`'s `defineCloudflare({ project })`), a preview unless `--production`; `CF_ACCOUNT_ID`/`CF_API_TOKEN` from the environment or `.env` |
| Maps over self-hosted raster tiles | `@lightstart/maps` | `<maps-view>` for pan, pinch, fly, pins, clusters and popups; `createMapEngine`, `mercator`, `coverage`, `offline`, `locate`, `geocode`, `findMapsLink`/`parseMapsLink`/`readPreview`, `mapPointsResource`; `light maps:tiles` bakes coverage from the models declaring `$mapIndexable` |
| QR codes | `@lightstart/qr` | `encode`, `decodeQr`, `readMatrix` and `perspective`; `toSvg`, `toDataUrl`, `toPath` and `toTerminal`; `<qr-code>` draws a symbol in `currentColor` |
| A camera | `@lightstart/camera` | `createCamera` over the web or the mobile shell, `<camera-preview>`, the control registry and lens/EXIF helpers; `serveCamera`/`viewCamera` make another phone the camera over a peer room, `<camera-pair>`/`<camera-scan>`/`<camera-link>` pair it, and `openCameraLink()` boots a `#cam=` page |
| Connected devices | `@lightstart/devices` | `registerDriver`, the `devices` controller (scan, connect, preview, record, import), generic BLE/Wi-Fi/download/preview transports over the mobile shell, `<devices-manager>`/`<devices-connect>`/`<devices-controls>`/`<devices-status>`, and its Android add-on |
| GoPro cameras | `@lightstart/gopro` | `goproDriver`, Open GoPro BLE control and Wi-Fi media import over `@lightstart/devices`; register it once with `registerDriver(goproDriver)` |
| Peer-to-peer rooms and device pairing | `@lightstart/p2p` | `joinRoom`, `createRoom`, `randomId`; relay, torrent and MQTT signalers; room crypto and the `#peer=` pairing payload; `configureP2P` and `resolveSignalers`; `light serve` hosts the relay hub at `/_relay` for a project that declares the package |
| Design canvases | `@lightstart/design` | `design/<canvas>/` with a `canvas.json` index and its `*.dc.html` boards: `light design`, `design:build`, `design:serve`, `design:render`, and `layoutCanvas` for the band layout |
| Terminal UI pieces | `@lightstart/tui`, `@lightstart/tui-markdown` | the palette and what package views draw with |
| The `light` commands | `@lightstart/cli` with `@lightstart/dev`, `@lightstart/build`, `@lightstart/design`, `@lightstart/native` | `serve`, `build`, `run`, `test`, `check`, `lint`, `typecheck`, `verify`, `new`, `design` |
| Tests that run under node and natively | `@lightstart/test` | `ok`, `eq`, `done` in `assert.ts` |

## Patterns an app keeps

Follow the shape `light new` gave the project and the choices it already made (its host, its store adapter types, its controller style); extend them rather than introduce a second way.

- **One file, one piece.** `src/models/<name>.js`, `src/controllers/<name>.js`, `src/views/<tag>.js` (`.ts` in a TypeScript app): the file name is the name, a view module defines its tag (`View.register(tag, Class)` or `View.define(definition)`), and `.light/` picks them all up. Never import a view's module by hand to make it exist.
- **Seeds.** `src/seed.js` (or `.ts`) default-exports rows by model name; a run adds them once into an empty store before the controllers start, and `src/seed.dev.js` (or `.ts`) holds demo rows a release build leaves out. `openApp` and `openPage` load them; `{ seed: false }` skips them.
- **Content.** With `@lightstart/content`, `content/<model>/*.md` is that model's rows: frontmatter holds its fields, the file name fills `slug`, the body becomes JSON and the model declares `body: T.array()`. The generation writes `.light/content` and seeds it before `src/seed`; a view draws a body with `renderContent`, which ships no parser. A model that moved to content drops its seed entry so its rows load once. A model whose store's `adapter` is `content` is not seeded: the build writes `content/<model>.json` and `content/<model>/<slug>.json` instead, and the store reads them read-only; list files leave the schema's `$heavy` fields out, and `get` by id or slug reads the whole row. `light serve` answers those paths from the Markdown with no cache.
- **Controllers.** A `Controller` subclass compiles natively and follows a model with `readonly rows = liveRows<Row>(this, model, () => query)`, which starts with the controller and comes back after a restart. A `defineController` literal is a sync target: a view's prop declared `T.string({ sync: "<controller>" })` follows it, and the generation installs `View.use(syncPlugin)` (`@lightstart/light/controller/view`) before the views, plus `registerSyncBinder(modelBinder)` when a `sync:` names a model api, so the app does neither by hand. Its own `sync: { prop: "local" }` needs the page to `registerAdapter("local", localStorage)`.
- **Extensions.** An app leaves places open with `defineSlot<Item>(name)` handles its own modules export; a package (`"light": { "extension": "./extension.js" }`) or the app's `src/extensions/<name>.js` default-exports `defineExtension({ name, fills, controllers, routes, connected, disconnected })`, which the generation finds. A view draws a UI slot with `<app-slot .slot=${handle} .context=${...}>` and code reads a data slot's `handle.items` signal; `defineApp({ extensions: { off } })` leaves one out, and `openApp`/`openPage` take `{ extensions: false }` for a public suite.
- **State, occurrences and a child's news.** State is a signal: what a view or a controller reads now (the route, the language, a list, a setting), never a "changed" event someone fires beside it. An occurrence is an event, each one delivered (a request opened, a message about to be sent). A component telling its parent something happened is a DOM event through `$emit` (`form-submit`, `field-change`), its public boundary. A global "something changed, go and look" event is the one shape to avoid: make the state a signal instead.
- **Views and signals.** A `View` subclass's render follows the signals it reads. A definition view (`defineComponent` then `View.define`) does not: it reads shared state through `sync:` props, or it is written as a class.
- **Routes.** `src/routes.js` (or `.ts`) maps a path to a view tag; `/notes/:id` sets `id` on the view as a prop (declare it, and type it with `T.number()` or the like to receive a number or boolean rather than the string), and the same view updates when only a parameter changes. A route's `layout` (or the app's default `defineApp({ layout })`, `layout: null` to opt out) wraps its view in an ordinary view holding `<app-container>`; nested `routes` join their parent's path, a routed view holds an `<app-container>` for the next level, and a route with no `view` only groups its children. A route's `props` sets fixed values, a param of the same name winning. Paths are the app's own, without the deploy base: `navigate("/accounts")`, `currentView` and `currentRoute` work the same under `/budget`. `currentRoute` names the matched route, `href(pathOrName, { params, query })` and `url(pathOrName, { params, query })` build a link or an absolute address, and `navigate` takes either an app path or a route name. An app declaring `locales` answers each route in each language, the default bare and the others under `/<lang>` (a `localized: false` route keeps one shape); `currentRoute` adds `locale` and the unprefixed `routePath`, and `href`/`url`/`navigate` keep the current locale unless `{ locale }` switches it. Go with `navigate(path)`; a plain `<a href>` to an app path goes through the router too; `defineApp({ transitions: true })` puts each web route change in the browser's view transition, and `navigate(path, { transition })` overrides that once.
- **Icons.** `defineApp({ icons })` names an Iconify set (`lucide` by default) installed as `@iconify-json/<set>`; the generation writes `.light/icons.css` from the names the sources and used components carry and from every icon in `icons/<name>.svg`, and a name built at run time that no literal names (a bare string in a map) is declared in the module's `icons: [...]`. Draw an app icon with `light new icon <name>` and edit its shapes in the set's style.
- **Components.** A web view writes `<lc-*>` tags and imports nothing; `src/styles.css` starts with `@import "../.light/components.css"`. A package's own views are defined the same way when its `package.json` says `"light": { "tags": "<its tags.json>" }`: writing one of its tags in a view registers that module too, and a tag two packages define is an error. `index.html` loads `/src/styles.css` and `/.light/main.ts` from the root, so nested routes and a built `404.html` find them. The theme's CSS is in the `light` cascade layer, so the app's own `:root` tokens win; `defineApp({ scheme: "dark" | "light" | "system" })` pins or follows the color scheme. An app written with the theme's utility classes (`px-4`, `text-primary`) sets `defineApp({ utilities: true })`, so the host compiles them from the theme before the first view draws.
- **A worker app's worker.** With `defineApp({ worker: true })`, `src/worker.js` (or `.ts`) is optional and default-exports `defineWorker({ serve, relay, mirror, opened })` from `@lightstart/app/web/worker-entry`; the page declares its side on `worker` from `@lightstart/app/web/worker.ts`, and both cross one channel beside light's model layer.
- **A PWA.** With `@lightstart/pwa` installed, `src/pwa.js` (or `.ts`) default-exports `definePwa({ ..., update })`; the generated entry registers the worker, `update` chooses `"off"`, `"prompt"`, `"silent"` or `"force"`, and `<pwa-update-toast>` shows a waiting worker with a Reload action. `pwa.update` is a signal, `pwa.apply()` and `pwa.check()` are its actions.
- **Words.** With `@lightstart/i18n` installed, `src/locales/<lang>.ts` holds the app's words, merged over the `locales/` of every package that declares `light.locales: true`, and `defineApp({ locale, locales })` names the default and the languages the app ships. With several locales the route's language is applied before its title and views run, and `setLanguage(x)` navigates to the same route path in `x`.
- **Arguments.** `defineApp({ args })` declares them; a controller reads `app.args.string("name")`. The web host fills them from the URL query, the terminal from argv (with its own `--data`, `.data` by default, `--scheme` and `--route`).
- **Checks.** `light check` enforces these patterns for an app on `@lightstart/app`: a view writes no model, a model and the routes keep their shape, no view is imported by hand, routes have no duplicate path, a view reads the route from `currentRoute` rather than `location.pathname`, a web page reaches no server module, a page test is named `*.browser.test.*`, tests carry no `.only`, and `src/locales` stays in parity (with warnings for a controller no test names and a file name that is not kebab-case).

## Testing

- An app's logic: `openApp(manifest, { args, adapters })` from `@lightstart/app/test`, over memory stores.
- A terminal app's screen: `mountApp(manifest, opened, { cols, rows })` from `@lightstart/app/tui/test`, keys through `renderer.decoder.pushText`.
- A web app's page: `openPage(manifest, { path, args })` from `@lightstart/app/web/test`, in headless Chromium: `find`, `shows`, `navigate`, `stop`. It mounts in the test page with memory stores and a history in memory; link the app's stylesheet when a test measures layout.
- In an app, `light test` splits the files it is given: `*.browser.test.*` runs in headless Chromium, every other `*.test.*` under node (light's markup host is preloaded, so a test can import the generated manifest and call `openApp`), and a file that is neither, such as `*.e2e.*`, keeps the browser runner. It reports both parts and fails if either fails; a `*.test.*` file that imports `@lightstart/app/web/test` is a `light check` error instead of a node test.
- A web app's build: `openBuilt(latestBuild(projectDir), path)` from `@lightstart/app/web/test` serves `.deployed` as a static host and opens the page in headless Chromium, reporting errors and failed requests; it reads the app's base from the project and takes the app path. `pnpm test:e2e` in a web scaffold does this for every concrete route.
- A package's tests are plain scripts on `@lightstart/test/assert.ts` (`ok`, `eq`, `done`) that `light test` runs under node and natively, the outputs equal: no `node:test` reporter (its timings differ), no `assert.deepEqual` (compare JSON), typed fallback arrays (`const xs: string[] = c ? a : []`). `// node-only` as a test's first line skips the native run.

## Building and publishing

`light build` bundles the page into `.deployed/builds/<id>`. An app deployed under a path (`defineApp({ url: "https://user.github.io/budget" })`, or `base`, overrides it; `base: "/"` means the root) keeps its files at the build folder's root, since that folder is deployed at the base, while every root-relative URL in the built HTML carries the base. For an app it also writes `404.html` (so a static host boots the app on any path), `robots.txt`, `_headers` (hashed bundles cached for good) and, given `defineApp({ url })`, `sitemap.xml` from the routes' concrete paths (a `params` route filled from its values, `spa: true`, wildcards and redirects left out). `appUrl("/rates.json")` from `@lightstart/app` answers the running app's base before a root-relative path, for code that fetches its own files. `light build --prerender` (or `defineApp({ prerender: true })`) renders each of those paths into its own `index.html` with Playwright in headless Chromium, and the web host adopts the served DOM on a `__PRERENDERED__` page; `404.html` stays the shell. `light cf:deploy` (`@lightstart/cloudflare`) uploads `.deployed/current` to a Cloudflare Pages project, a preview unless `--production`, with `CF_ACCOUNT_ID` and `CF_API_TOKEN` from the environment or the project's `.env`. A terminal app's `light run` is a dev build (`dist/dev/`, fast when nothing changed); `light build` makes the release binary.

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
