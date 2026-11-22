# @lightstart/maps

Hand-rolled slippy-map engine over self-hosted raster tiles (no Leaflet, no CDN), plus keyless Nominatim geocoding. Light's tag table defines `<maps-view>` from the package, and `light maps:tiles` bakes the tiles its content needs.

## Capabilities

- `<maps-view>`: DOM-tile slippy map: pointer pan with inertia, pinch/wheel zoom anchored at the cursor, double-tap zoom, flyTo/fitBounds animation, constant-size drop pins with grid clustering, popups from the app's template.
- `mercator.js`: pure Web Mercator math (`lngLatToWorld`, `worldToTile`, `tileRange`, `boundsToCenterZoom`, `bboxOfPoints`). Runtime-agnostic; Node tile-download scripts import it.
- `engine.js`: `createMapEngine(container, opts)`, the framework-free core the view wraps (see [The engine](#the-engine)).
- Geocoding: `createMapsClient` (Nominatim/OSM).
- `locate.js`: `locate(options?)`, the device's position once (coarse, a minute old at most, by default), rejecting with `{ code, message }`. The view's locate button reads it, and so does any list an app sorts by distance; call it only once the person asked for something that needs it, so the system's prompt is the one ask.

The framework-free modules are JavaScript with JSDoc types; `index.ts` is the package's typed entry and `types.ts` its public types.

## `<maps-view>`

The generation defines the tag from `tags.json` when a view writes it; the view module default-exports the definition and imports the `maps` controller handle itself.

| Prop | Default | Notes |
|------|---------|-------|
| `points` | `[]` | `{ lat, lng, name, slug, color?, ... }` |
| `center` / `zoom` | `[]` / `4` | `[lat, lng]`; used when `fit` is off or no points |
| `tileUrl` | `appUrl("/assets/tiles/{z}/{x}/{y}.png")` | self-hosted tile template |
| `manifestUrl` | `appUrl("/assets/tiles/manifest.json")` | `{ bbox, minZoom, maxZoom }` clamps view + requests |
| `fit` | `true` | fitBounds over points (padding 24, maxZoom 15) |
| `markerColor` | `""` (the theme's `--maps-pin-color`, else `#14b8a6`) | per-point override via `pt.color`; any CSS colour, `var()` included |
| `activeId` | `""` | highlights the pin whose `id`/`slug` matches |
| `noframe` | `false` | full-bleed (no radius/min-height) |
| `popups` | `true` | whether a tap opens a popup at all |
| `locate` | `false` | draws the locate button |
| `locateIcon` | `"locate"` | the locate button's glyph |
| `zoomButtons` | `true` | `false` leaves the zoom pair out, for a phone where pinching is the zoom |
| `keepalive` | `false` | hand the engine to the next map on the same tiles |
| `popup` | `null` | ``(pt) => html`...` ``, the app's popup template |
| `controls` | `null` | `() => TemplateValue`, appended to the controls column |
| `route` / `routes` | `[]` | a route's stops, or several coloured routes |
| `routeColor`, `routeLine` | `""`, `true` | the single route's colour and its line |

A point draws as an inline SVG drop whose tip sits on the coordinate: the body in `pt.color` (through the `--maps-pin-color` custom property, so a theme token resolves), its right half a shade darker, a white edge, `pt.icon` in white on the head, and a soft shadow at the tip. A point with a `thumb` draws as a round photo instead, `--maps-pin-photo-size` wide (`size` overrides it for one pin, in px), with a play glyph only when `pt.play` is true; a point with no thumb but `initials` draws the same circle with the letters. Either kind carries its marks: `badgeColor` a dot, `today` the today mark, `badgeText` a short pill under the pin (the hour), `caption` a white pill under it with an optional bold `captionLead`, `count` a number at its shoulder, `glyph` an icon there when there is no count (in `glyphBackground`/`glyphColor` when the point gives them), and `faces` (`[{ src, name }]`, the first three) a row of faces under it, or at its foot on the start side with `facesAt: "start"` when a caption takes the middle. A cluster keeps a frosted centre with the count and a ring split by its points' colours in proportion.

A tint pane sits over the tiles and under the pins: `--maps-tint-background` (transparent by default) blended with `--maps-tint-blend-mode` (multiply), so a theme can warm or cool the map without touching the tiles. The view's stylesheet is `views/view.css`, imported by the generated `.light/components.css`. Every colour and size in it reads a `--maps-*` custom property with a fallback: `--maps-pin-*`, `--maps-cluster-*`, `--maps-route-*`, `--maps-user-*`, `--maps-popup-*`, `--maps-frame-*`, `--maps-attr-*` and `--maps-zoom-*`.

`popups` is whether a tap opens a popup at all: an app whose pins open pages sets `.popups=${false}` and listens for `pin-click` alone. `popup(pt)` returns a template the view renders into the popup above the clicked pin, adds the close control, and falls back to `pt.name` when it is unset. The app's own components work inside it.

Events: `pin-click` (`detail.point`), `map-tap` (a tap on the map itself), `locate-result` (`{ lat, lng, accuracy }`), `locate-error` (`{ code, message }`) and `view-change` (`{ center: [lat, lng], zoom }`), sent once the camera comes to rest after the reader moved it (a drag, a pinch, the wheel), and never for a move the page made on its own.

Methods `flyToPoint(pt, zoom?)`, `fitStops(stops)`, `fitRoute()`. All three return the engine's `whenIdle()` promise, resolved once the camera animation ends and every visible tile has loaded, so a component that RETURNS the call from a lifecycle hook makes the movement settle-visible. The element's `engine` getter answers the engine it currently draws with, or `null` before the first frame and after it leaves the page.

The zoom column (zoom in, zoom out, and locate when `locate` is on) sits at `--maps-zoom-top` / `--maps-zoom-right` and sizes each button from `--maps-zoom-size` (default `2rem`). Function property `controls()` appends the app's own buttons to the bottom of that column; it is held without re-rendering, so whatever it returns owns its own state.

| File | Holds |
|------|-------|
| `views/view.js` | `<maps-view>`: its properties and events, the panes it mounts on the canvas, the per-frame positioning |
| `views/view.css` | its stylesheet and every `--maps-*` token |
| `views/view/templates.js` | the DOM it draws: drop, photo and cluster pins, the reader's dot, route lines and marks, the popup frame |
| `lib/pins.js` | what a pin is made of, without the DOM: the drop's geometry, which points draw, clusters and their rings, the keys pins render under |
| `controllers/maps.js` | the `maps` controller: every live engine, the one parked between routes, work tracking of engine frames, the manifest cache |

The view renders its pins, clusters, routes and popup into panes on the canvas with `render()`; each frame writes only `style.translate` on what moves and toggles `hidden` on what leaves the viewport. A pin's anchor on its point, the selected pin's scale and the popup's offset are CSS.

Tiles ship as static files, so the map works offline and costs nothing to serve. Keep the OSM/CARTO attribution visible (the default `attribution` string): it is a licence condition, not decoration.

## Tiles and the manifest

```bash
light maps:tiles                                    # cover this project's content
light maps:tiles --dry-run                          # report coverage, download nothing
light maps:tiles --style dark --out assets/tiles-dark
light maps:tiles --bbox -43.45,-23.02,-43.10,-22.85 --full-max 15   # a fixed box, for an app whose points are its users' own data
```

Coverage is derived from the project's own data: every model in `src/models/*.js|ts` whose schema declares **`$mapIndexable`**. The command imports each model, reads its `.schema`, and reads that model's `content/<model>/*.md` through `@lightstart/content`'s `collect`. It pads the bounding box of every coordinate it finds (`--pad`), takes the whole box at `--full-min`…`--full-max`, then patches a `--radius` square around each point up to `--near-max`. It skips tiles already on disk, so re-running after adding content downloads only what is new, and writes the `manifest.json` (`bbox`, zoom clamps, `sparse`, `attribution`) that `maps-view` reads. Above `full-max` the manifest indexes which patch tiles exist as y-runs per column, so the engine never requests an unbaked tile.

CARTO answers every tile without a key with an "API key required" image, so the command reads `CARTO_API_KEY` from the project's `.env` (a free key from https://carto.com/basemaps/apikey, commercial use included up to a million requests a month) and adds it to each tile URL. Before downloading it fetches two different tiles, and if both come back as the same image it stops with nothing written.

## The engine

`createMapEngine(container, opts)` (`engine.js`) takes `zoom`, `minZoom`, `maxZoom`, `tileUrl`, `center`, `onFrame` and `onRenderScheduled`, and answers one object for the engine's lifetime: `setView`, `flyTo`, `fitBounds`, `zoomBy`, `setBounds`, `project(lat, lng, out?)`, `screenToLatLng`, `getZoom`, `getCenter`, `getWidth`, `getHeight`, `wasDragged`, `setTileUrl`, `isInteracting`, `whenIdle`, `resize` and `destroy`. The default `tileUrl` is `appUrl("/assets/tiles/{z}/{x}/{y}.png")`. `engine.js` holds the state (camera, viewport, zoom limits, tile coverage, the flight and the fling), the frame loop and the idle waiters; the rest is split by what it is.

| File | Holds |
|------|-------|
| `lib/camera.js` | the camera as world coordinates and a fractional zoom: clamping, screen and world conversion, panning, anchored and pinch zoom, the eased approach to a target zoom, flights, fits |
| `lib/inertia.js` | a drag's samples, the velocity a release flings with, its decay per frame |
| `lib/gestures.js` | a pinch step, a double tap, a wheel step's zoom, the tap threshold |
| `lib/tiles.js` | the active level, the visible tile range, eviction, level transforms, tile URLs from a template |
| `engine/tiles.js` | `createTileLayer`: the level panes and their `<img>` tiles, the count still loading |
| `engine/input.js` | `attachInput`: pointers, wheel, double click and gesture events, read into intents (`grab`, `pan`, `pinch`, `fling`, `doubleTap`, `wheel`) the engine applies |

The `lib/` modules are pure and tested under node; `test/engine.browser.test.js` drives the engine in Chromium. A frame moves the camera (a flight, else the zoom approach and then any fling while no pointer is down), clamps it to the bounds, draws the tiles and calls `onFrame`; it asks for another frame while anything moves, and resolves `whenIdle()` once nothing moves and no tile is loading. `onRenderScheduled` fires when a frame is scheduled, after it is pending, so a `whenIdle()` called from it waits for that frame.

## Geocoding

```js
import { geocode } from "@lightstart/maps/geocode.js";

const coords = await geocode(
  ["Bar Bip Bip, Copacabana, Rio de Janeiro", "Rio de Janeiro, Brazil"],
  { centroids: CITY_CENTROIDS, fallbackKey: place.city },
);   // → { lat, lng, source } | null
```

Queries are tried in order, broadest last, with a static centroid table as the floor. **Requests are spaced automatically**: Nominatim allows one per second and blocks rather than throttles, so the wait belongs to the process, not to each caller. Providers come from the registry in `index.ts` (`registerProvider`).

## Links from maps apps

```js
import { findMapsLink, parseMapsLink, readPreview } from "@lightstart/maps";

const url = findMapsLink("Bar Bip Bip\nhttps://maps.app.goo.gl/q8hS7kJmW3dX2vNb7");
const link = parseMapsLink(url);   // → { provider, url, name, lat, lng, short } | null
const preview = readPreview(html, finalUrl);   // → { title, image, url, lat, lng }
```

`links.js` reads Google Maps and Apple Maps URLs with no network. On a Google place URL the `!3d…!4d…` pair is the place and wins over `@`, which is where the map was looking; `q=` and `query=` carry a name or a coordinate pair, and Apple's `ll=`, `q=` and `address=` the same. A dropped pin names no place. `short: true` marks `maps.app.goo.gl`, `goo.gl/maps` and `maps.apple/p` links, which say nothing until they are resolved. `readPreview` takes the page that resolving gives and reads the OpenGraph and Twitter tags, with coordinates from the final URL, the page's `place:location` tags, or a static map image's `markers=` or `center=`.

## Components

| Tag | File |
|-----|------|
| `<maps-view>` | `./views/view.js` |

`package.json` names the tag table under `light.tags`: `maps-view` -> `views/view.js`, its stylesheet `views/view.css`, and the `lc-button`/`lc-icon` tags it writes under `uses`.

## Exports

- `createMapsClient`, `registerProvider` (`index.ts`)
- `findMapsLink`, `parseMapsLink`, `readPreview` (`links.js`, re-exported from `index.ts`)
- `createMapEngine` (`engine.js`)
- `locate` (`locate.js`)
- Mercator helpers (`mercator.js`)

## Putting an app's content on the map

1. **Declare** `$mapIndexable` on a model in `src/models/`: the build bakes matching rows (finite `lat`/`lng`) into `/map_index.json`.
2. **Bake tiles** with `light maps:tiles`: coverage derives from the same `$mapIndexable` models, into `assets/tiles/` + a manifest with a sparse index the engine consults so unbaked tiles are never requested.
3. **Feed points** with `mapPointsResource({ url, load, filterPoint, devRows, refreshOn })` (`points.js`) inside a controller: a `resource()` over the baked index, or rows the app loads, with a dev fallback. `refreshOn` is an occurrence (a language change, say) or a list of them; the resource re-derives when one fires. `pointKey(pt)` (`<type>:<slug>`) is the identity pins and panels share.
4. **Render** `<maps-view .points=${...} .popup=${(pt) => html}>`. The popup is an app-authored function; that seam stays yours. Point shape: `{ lat, lng, slug, name, color?, thumb?, badgeColor? }`. Popup chrome themes via `--maps-popup-background/color/border-color`.

## Offline packs

`offline.js`: `estimatePack`/`packUrls`/`downloadPack` prefetch a route's tiles plus app-supplied `extraUrls(stop)`: coverage uses the same `coverage.js` arithmetic as the bake, so pack and bake agree. `downloadPack` drains each body, since a cache entry commits only once read, and reports `{ total, ok, failed, complete }`.

## A persistent map across navigations

Give `maps-view` the `keepalive` attribute and render it from one shared template (a single ``html`...` `` factory reused by every route), so the element and its engine survive route changes. The engines belong to the `maps` controller (`defineController`), which the view module imports. A `keepalive` map that leaves the page parks its engine there for 1.5 s, and the next `keepalive` map on the same `tileUrl` adopts it with its camera and loaded tiles; one that is still on the page hands its engine over to the newcomer. The controller's `count()` answers how many engines are alive, and `manifest(url)` fetches a tiles manifest once.

## Dependencies

`@lightstart/app` (the deploy base), `@lightstart/light` (views, controller, tokenizer), `@lightstart/components` (icon names and the tags the view writes), `@lightstart/content` (`maps:tiles` reads `collect`), `@lightstart/cli` (the command).
