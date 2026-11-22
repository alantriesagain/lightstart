# Working on @lightstart/maps

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | `createMapsClient`, `registerProvider`, the Nominatim provider and the links re-exported |
| `types.ts` | The public types: points, routes, tiles manifest, engine options, handles, providers and link results |
| `geocode.js` | `geocode` and `foldKey`: the query list, the provider throttle, the centroid floor |
| `locate.js` | `locate`: the device's position once, coarse and recent by default |
| `links.js` | `findMapsLink`, `parseMapsLink`, `readPreview`: Google and Apple Maps links read without a network |
| `lib/meta.js` | `metaTags`: a page's OpenGraph and Twitter tags, entities decoded |
| `mercator.js` | Web Mercator math, bbox helpers and great-circle distance |
| `coverage.js` | `coverageTiles`, `sparseTileExists`, `manifestZooms`: the arithmetic the bake and the offline packs share |
| `offline.js` | `tileKeys`, `estimatePack`, `packUrls`, `downloadPack`: an offline pack |
| `engine.js` | `createMapEngine`: the framework-free core |
| `engine/tiles.js` | `createTileLayer`: level panes, `<img>` tiles and the loading count |
| `engine/input.js` | `attachInput`: pointers, wheel, double click and gestures read into intents |
| `lib/camera.js` | The camera without the DOM: pan, anchored and pinch zoom, flights, fits |
| `lib/gestures.js` | A pinch step, a double tap, a wheel step's zoom, the tap threshold |
| `lib/inertia.js` | A drag's samples, the release velocity and its decay |
| `lib/tiles.js` | The active level, visible range, eviction, level transforms and tile URLs |
| `lib/pins.js` | What a pin is made of, without the DOM: geometry, clusters, rings, keys |
| `points.js` | `pointKey`, `withCoords` and `mapPointsResource`: the app's points feed |
| `controllers/maps.js` | The `maps` controller: live engines, the parked one, engine work tracking, the manifest cache |
| `views/view.js` | `<maps-view>`: its properties, events, methods and per-frame positioning |
| `views/view.css` | Its stylesheet and every `--maps-*` token |
| `views/view/templates.js` | The DOM the view draws |
| `tags.json` | The package's tag table, named by `package.json`'s `light.tags` |
| `cli/commands/maps/tiles.ts` | `light maps:tiles` |
| `test/` | Plain node scripts on `@lightstart/test/assert.ts`, the two Chromium tests, and the generation fixture |

## The language choice

The framework-free modules stay JavaScript with JSDoc types, as light's components are. `index.ts`, `types.ts` and the CLI command are TypeScript, as every package entry and command in light is; `index.ts` is the one typed face of the JavaScript barrel's API. Tests that run under node are `.ts` plain scripts so `light test` finds them; the Chromium tests are `.js` on `node:test`, as light's component browser tests are.

## Rules the sources keep

- No `any`, in TypeScript or JSDoc. Narrow `unknown` with `typeof`, `instanceof` or `Array.isArray`.
- Comments are a module header and doc comments on exported symbols, nothing else.
- The view module default-exports `defineComponent({ tag: "maps-view", ... })` and imports the `maps` controller handle directly; the generation defines the tag from `tags.json` when a view writes `<maps-view>`, so the module never registers itself.
- The controller is a `defineController` handle named `maps`; it builds on first reach, owns every live engine, parks a `keepalive` engine for 1.5 s, adopts it for the next map on the same `tileUrl`, and tracks each engine burst with `trackWork` from `@lightstart/light`.
- `appUrl` comes from `@lightstart/app`: the default tile and manifest URLs, the offline pack's tile base. A caller may pass an absolute URL or its own template instead.
- `links.js` reads entities through `@lightstart/light/html/tokenizer.js`; `lib/meta.js` is the only meta-tag reader.
- `points.js` names its source explicitly: `load` answers rows, or `url` fetches the baked index; there is no content cache and no global content event. `refreshOn` is an occurrence or a list the app passes to `resource()`'s `invalidateOn`.
- `light maps:tiles` reads `src/models/*.js|ts`, keeps the models whose `.schema.$mapIndexable` is truthy, and reads `content/<model>/*.md` through `@lightstart/content`'s `collect`. Coverage is `coverage.js`'s, so the bake and the offline packs agree.
- The engine defaults `tileUrl` to `appUrl("/assets/tiles/{z}/{x}/{y}.png")`; its `lib/` modules stay DOM-free and pure.
- The package ships its sources and needs no build step.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `createMapsClient`, `registerProvider` and the provider shape | an app's geocoding |
| `geocode(query, options)` and `foldKey` | an app resolving a place, a script using `centroids` as a floor |
| `locate(options?)` and its `{ lat, lng, accuracy }` / `{ code, message }` | `<maps-view>`'s locate button and an app's distance list |
| `findMapsLink`, `parseMapsLink`, `readPreview` and their result types | an app reading a shared maps link |
| `mercator.js`, `coverage.js` and `offline.js` | `maps:tiles`, an offline pack and engine bounds |
| `createMapEngine` and its options and methods | `<maps-view>` and a page driving an engine directly |
| `mapPointsResource({ url, load, filterPoint, devRows, refreshOn })`, `pointKey`, `withCoords` | an app's controller feeding `<maps-view>` |
| `tags.json`, `<maps-view>` and its props, events and methods | the web generation and an app's views |
| `$mapIndexable` on a model schema | `light maps:tiles` |
| The `maps` controller's `count()` and `manifest(url)` | a test or a page checking engines or reading a manifest |
| `manifest.json`'s `bbox`, `minZoom`, `maxZoom`, `fullZoomMax`, `sparse`, `attribution` | `maps-view`, the engine and offline packs |

## Gates

From the repository root:

```bash
light check --all
light typecheck @lightstart/maps
light test @lightstart/maps
npx eslint packages/maps
# from packages/maps, one browser file per run:
light test test/engine.browser.test.js
light test test/view.browser.test.js
```
