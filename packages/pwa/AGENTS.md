# Working on @lightstart/pwa

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | `definePwa`, `PwaConfig`, `PwaManifest`, `PwaIcon`, `PwaShortcut`, `PwaScreenshot` and `PwaUpdate`, and the page API's types re-exported |
| `page.ts` | `registerPwa`, the shared `pwa` (`update`, `apply`, `check`), the `PwaPage`/`PwaUpdateState`/`PwaPageOptions` types and the update policy; web-only |
| `manifest.ts` | `manifestOf(app, pwa)`: the manifest object, the app's name/title/base filling its defaults |
| `base.ts` | `normalizeBase`, `withBase`, `basedPath` and `baseScope`: the one place the deploy base is read and applied |
| `html.ts` | `injectPwaTags` and `noCacheHeaders`: the page tags and the `_headers` rules a build writes |
| `views/update-toast.ts` | `<pwa-update-toast>`: the waiting-worker bar and its own stylesheet |
| `tags.json` | The package's tag table, named by `package.json`'s `light.tags` |
| `worker/logic.ts` | The worker's pure decisions: `precacheList`, `cacheVersion`, `routeOf`, what the shell is and the size cap |
| `worker/worker.ts` | The service worker itself, bundled to `sw.js` with its values baked in |
| `node/config.ts` | `pwaPathOf`, `appPathOf`, `readPwa` and `appIdentityOf`: read `src/pwa` and `src/app` without their views |
| `node/bundle.ts` | `workerSource`: esbuild over `worker/worker.ts` with splitting off, and the values passed through `define` |
| `cli/extend/build.ts` | The `pwa` build step after `static` and before `prerender` |
| `cli/extend/serve.ts` | `light serve`'s manifest, unregistering worker, `--pwa` worker and page tags |
| `test/` | Plain scripts on `@lightstart/test/assert.ts`; `test/fixtures/app` is the PWA fixture |

## Rules the sources keep

- `src/pwa.ts` or `src/pwa.js`, exactly one (both is an error naming both), default-exports `definePwa({ ... })`; a project with neither gets no manifest, no worker and no build step output.
- `manifestOf` is pure: the name defaults to the app's `title` then `name`, the short name to the app's `name`, `display` to `"standalone"`, and `start_url` and `scope` to the app's base (`/` at the root). Every icon and screenshot `src`, shortcut `url`, `start_url` and `scope` gets the base, absolute URLs left alone. Optional fields stay out when the config does not name them.
- The build step runs after the app's `static` step (which writes `_headers`, `404.html`, the sitemap and `robots.txt`) and before `prerender`, so the shell it patches is the one prerendering copies. It uses `before("prerender")`; without that step it runs after `static`, and otherwise is added.
- `sw.js` is one self-contained script. The worker is bundled (not written as a second plain-JS copy) so `worker/logic.ts` is the one implementation of the routing and the build's values are baked in by `define`; splitting is off and there are no dynamic imports.
- The precache list is the shell (`index.html`, `404.html`), the hashed bundles, `worker.js`, the manifest and the config's icons, each under 2 MiB, sorted, each with the base before it; a page or asset outside it is kept when the network answers it on a navigation, never precached. The version is a short hash of the precached paths and contents.
- `_headers` is amended in `ctx.outputs` with `Cache-Control: no-cache` for the worker and the manifest, under the base, without duplicates.
- The page tags go into `index.html` and `404.html` in `ctx.outputs`, before `prerender`: the manifest link and the theme colour meta tag when given. Neither page carries a registration script; the generated entry is the one registration.
- A project with `src/pwa.ts` or `.js` and `@lightstart/pwa` gets, in `.light/main`, an import of the config and of `registerPwa` from `@lightstart/pwa/page`, and `registerPwa(config, { base })` once `start` answers. A project with neither file keeps its entry unchanged; one with a file but without the package is a generation error naming `@lightstart/pwa`.
- `registerPwa` registers `<base>/sw.js` with scope `<base>/` and skips when `navigator.serviceWorker` is absent. The shared `pwa.update` is a light signal; `apply` posts `{ type: "pwa:skip-waiting" }` and reloads only on `controllerchange` (so a first install's claim does not reload); `check` calls `registration.update()`, on load, on becoming visible and every 15 minutes.
- The policy is the config's `update`: `off` acts on nothing, `prompt` only signals, `silent` applies at the next `currentRoute` change from `@lightstart/app/web`, and `force` applies when a worker waits.
- `page.ts` is web-only and imports nothing node-only. The toast uses plain markup and its own stylesheet (no `@lightstart/components` dependency), reads `pwa.update`, and takes its words from light's i18n contract with English fallbacks and props to override.
- The worker installs `skipWaiting()` only when no worker is active, activates by deleting other `pwa-*` caches and claiming clients, answers same-origin `GET`s only, and never caches a failed navigation. The routing decision stays in `worker/logic.ts`.
- Development serves a worker that unregisters itself and passes requests through, and a real worker only with `--pwa`; both are `no-store` with `service-worker-allowed: <base>/`.
- The dev page injection goes through the serve extension's `page` renderer, which must reproduce the default shell (`renderShell` with the merged importmap and the watch flag) before adding the PWA tags.
- Comments are a JSDoc module header and JSDoc on exported symbols, nothing else.
- TypeScript with erasable syntax only; no `any`; the package ships its sources and needs no build step.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `definePwa`, `PwaConfig` and its fields (`name`, `short_name`, `description`, `icons`, `theme_color`, `background_color`, `display`, `start_url`, `scope`, `shortcuts`, `screenshots`, `categories`, `update`) | a project's `src/pwa.ts` (or `.js`) |
| `manifestOf(app, pwa)` and the manifest object | the build and serve extensions, and a test of a manifest |
| `registerPwa(config, { base })`, `pwa.update`, `pwa.apply()` and `pwa.check()` | the generated `.light/main`, an app or a view acting on an update, and `<pwa-update-toast>` |
| `tags.json` and `<pwa-update-toast>` | the web generation, which defines the tag when a view writes it |
| `precacheList(outputs, base, extra)`, `cacheVersion(outputs, extra)` and `routeOf(request, origin, precache, base)` | the worker bundle and the build extension |
| `workerSource({ precache, version, base, minify })` | the build and serve extensions |
| `manifest.webmanifest`, `sw.js`, the page tags and the `_headers` rules | a built app and its host |
| `src/pwa.ts` or `src/pwa.js`, never both | the build extension, the serve extension and `light check` |

## Gates

From the repository root:

```bash
light check --all
light typecheck @lightstart/pwa
light test @lightstart/pwa
light test @lightstart/app
npx eslint packages/pwa
```
