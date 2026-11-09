# Working on @lightstart/router

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `core.ts` | `RouterCore`: the platform-neutral router, the navigation stack, history, locales, base paths and titles, compiled fully statically by scriptc |
| `matcher.ts`, `locale.ts`, `url.ts`, `click.ts` | The pure helpers: the segment matcher, locale prefixes, base paths and queries, and the click decision |
| `contracts.ts` | The route, matcher, adapter and option shapes; the native graph imports it |
| `navigation.ts` | `NavigationBridge`, the router as light's `Navigation` sees it, with no import from light |
| `adapters/browser.ts`, `adapters/memory.ts` | The platform seams: `window` and `document` in the browser, fields in memory |
| `app.ts` | The convenience constructors: adapter choice, plugin merging and `init`, outside the native core |
| `listen.ts` | The document click interceptor |
| `test/` | Plain scripts on `@light/test/assert.ts`, run under node and natively, the outputs equal |
| `test/navigation-contract.ts` | The type-level check that `router.navigation` is assignable to light's `Navigation` |
| `scripts/pack.js` | What npm gets: JavaScript with a `.d.ts` per module (`npm run pack`, into `dist/`) |

## Rules the sources keep

scriptc compiles the core, the matcher, the adapters, the helpers and the navigation bridge as program source, so they follow light's native rules (`packages/light/native/probes/README.md`) and `packages/server/AGENTS.md` "Rules the sources keep":

- TypeScript with erasable syntax only, no `any`; `unknown` narrowed by `typeof`, `instanceof` on module-level classes, `Array.isArray`.
- Identity lives in classes. A `Map` never holds functions; a function-typed field never shares its name with a method anywhere in the program; empty arrays and maps are typed where they are declared; no write by a computed string key.
- Comments: a JSDoc module header and JSDoc on exported symbols, nothing else.
- `/`-separated matching never uses `URLPattern`; a static pattern is one `Map` lookup and the rest walk a segment trie.
- `Object.assign(router, pluginResult)` has no lowering and makes every method call dynamic (SC2020, SC6901), so plugin merging lives in `app.ts`, which the native graph does not import.
- `MouseEvent` and light's `Navigation` interface are absent from scriptc's type world (SC0001), so the core and the navigation bridge type a click with the local `ClickEvent` shape, which a `MouseEvent` satisfies structurally. `NavigationBridge` keeps no import from light.
- A spread of `RouteValue` (a function or a route record) is refused (SC1090), so `flattenRoutes` narrows the branch and copies through a `RouteConfig` binding.
- `nextFrame` uses `requestAnimationFrame` when it exists and `setTimeout` otherwise, so a host's `track` settles after the frame a route change renders in.
- The router's complaints go through `this.logger` (`logger.ts`), never `console` directly: a test's output must be the same under node and natively, and stderr interleaves with stdout differently on the two, so the tests give every router a `MemoryLogger` and assert on its lines.
- The navigation stack is replaced on every change, never changed in place: a signal holding `router.stack` (bootstrapp's signal plugin) only sees a new array.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `router.navigation` satisfying `@lightstart/light/navigation`'s `Navigation`: `href(path)`, `go(path)`, `click(event, options)`, `path()` and `subscribe(fn)` | light's `configureNavigation`, which components' links and forms go through; `test/navigation-contract.ts` holds the assignment |
| The adapter shape: `getLocation()`, `isSamePath(path)`, `hardNavigate(path)`, `pushState(state, path)`, `replaceState(state, path)`, `back()`, `forward()`, `setTitle(title)`, optionally `clearPrerendered()` and `getHistory()` | `createBrowserAdapter`, `createMemoryAdapter`, and any host adapter such as a server renderer or a native app |
| `createRouter`, `createMemoryRouter`, `createPlatformRouter`, `RouterCore`, `flattenRoutes`, `compileRoutes`, `matchRoute`, `interceptedPath`, `listen`, the locale and URL helpers | the README's entries, the package's tests and the apps that import them by the package name |
| `Logger` with `warn(message)` and `error(message, error?)`, set with the `logger` constructor option or `router.logTo(logger)`; `MemoryLogger.lines` | a host shipping the router's complaints elsewhere, and the tests |
| The `track` option `(work: Promise<unknown>, label: string) => void`, called with the next-frame promise and `router:<path>` after each route change | a host counting work, wiring `trackWork` from `@lightstart/light/view/core` |

## Gates

From the repository root:

```bash
node packages/native/cli/bin/light-native.js test @lightstart/router       # node and native, outputs equal
node packages/native/cli/bin/light-native.js coverage @lightstart/router   # every test fully static, no slow path
node packages/native/cli/bin/light-native.js typecheck @lightstart/router
node packages/native/cli/bin/light-native.js check --all
```

`@lightstart/light` is a devDependency only for the type-level navigation contract; the sources import nothing from it.
