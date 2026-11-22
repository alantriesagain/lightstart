# @lightstart/pwa

An app's web manifest, service worker and page update policy. A project opts in
with `src/pwa.ts` or `src/pwa.js` default-exporting `definePwa`; the generated
entry registers the worker, and `light build` writes `manifest.webmanifest` and
`sw.js` beside the page. `light serve` answers both while developing.

```js
// src/pwa.js
import { definePwa } from "@lightstart/pwa";

export default definePwa({
  short_name: "Budget",
  description: "Where the money goes",
  theme_color: "#123456",
  background_color: "#ffffff",
  icons: [
    { src: "/icons/192.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  update: "prompt",
});
```

Both `src/pwa.ts` and `src/pwa.js` is an error naming both, as an app has one
`src/app` module.

## definePwa

| Field | Default | What |
|---|---|---|
| `name` | the app's `title`, then its `name` | The manifest's name |
| `short_name` | the app's `name` | The name an installed app shows |
| `description` | none | The manifest's description |
| `icons` | none | `{ src, sizes, type?, purpose? }[]`; `purpose` may be `maskable` |
| `theme_color` | none | The manifest's theme colour, and the page's `<meta name="theme-color">` |
| `background_color` | none | The manifest's background colour |
| `display` | `"standalone"` | The manifest's display mode |
| `start_url` | the app's base, or `/` at the root | Where an installed app starts |
| `scope` | the app's base, or `/` at the root | The paths the app owns |
| `shortcuts` | none | `{ name, short_name?, description?, url, icons? }[]` |
| `screenshots` | none | `{ src, sizes?, type?, form_factor?, label? }[]` |
| `categories` | none | The manifest's categories |
| `update` | `"prompt"` | `"off"`, `"silent"`, `"prompt"` or `"force"`; see [The update policy](#the-update-policy) |

The app's base is `defineApp({ url })`'s path or `defineApp({ base })` (`""` at
the root). Every icon and screenshot `src`, every shortcut `url`, `start_url`
and `scope` gets the base before it, unless it is an absolute URL.

## What `light build` writes

The build extension runs after the app's `static` step and before its
`prerender` step. It does nothing for a project with no `src/pwa`.

- `manifest.webmanifest`, the manifest `manifestOf` answers from the app and the
  config.
- `sw.js`, one self-contained script: the worker source in `worker/` bundled by
  esbuild with splitting off, with the precache list, the cache version and the
  base baked in. A service worker cannot dynamically import, so it must be one
  file.
- The precache list is small on purpose: the shell (`index.html`, `404.html`),
  the hashed bundles (`-<hash>.js`, `-<hash>.css`), `worker.js`, the manifest and
  the icons the config names, each under 2 MiB, each with the app's base before
  it. A prerendered page, a content file or a public asset is kept when a reader
  first opens it, so a site of thousands of pages is still one small install.
- The version is a short hash of the precached outputs' paths and contents, so
  an unchanged build keeps the same cache and a changed one gets a new cache.
- `_headers` gains `Cache-Control: no-cache` for `<base>/sw.js` and
  `<base>/manifest.webmanifest`.
- `index.html` and `404.html` gain `<link rel="manifest">` and the theme colour
  meta tag when the config names one. They carry no registration script: the
  generated entry registers the worker.

## Registration

A project with `src/pwa.ts` or `src/pwa.js` and `@lightstart/pwa` in its
dependencies gets the registration in its generated entry. `.light/main` imports
the config and `registerPwa` from `@lightstart/pwa/page`, and once `start`
answers it calls:

```ts
registerPwa(pwaConfig, { base: "" });
```

`base` is the app's deploy base (`""` at the root). A project with neither
`src/pwa.*` file gets the same entry as before. A project with one but without
the package is a generation error naming `@lightstart/pwa`.

`registerPwa` registers `<base>/sw.js` with scope `<base>/`, and does nothing
when the page has no `navigator.serviceWorker`. It answers the same `pwa` the
toast and the app reach from `@lightstart/pwa/page`.

## The page API

```ts
import { pwa } from "@lightstart/pwa/page";
```

| Member | What |
|---|---|
| `pwa.update` | A light signal (`@lightstart/light/signals`) of `{ waiting: boolean }`: true while a new worker is installed and waiting |
| `pwa.apply()` | Send `{ type: "pwa:skip-waiting" }` to the waiting worker and reload once `controllerchange` fires, so the page runs the new worker |
| `pwa.check()` | Ask the browser for a new worker now (`registration.update()`) |

The page checks on load, when it becomes visible again, and every 15 minutes.
`pwa.apply()` reloads only after `controllerchange`; a first install claims the
page without a reload.

### The update policy

`definePwa({ update })` chooses what the page does when a worker waits:

| Policy | What happens |
|---|---|
| `"off"` | Nothing automatic; `pwa.update` still follows the waiting worker |
| `"prompt"` (default) | Only the signal; the app or `<pwa-update-toast>` calls `pwa.apply()` |
| `"silent"` | Applies at the next route change: it follows `currentRoute` from `@lightstart/app/web`, so the reload lands on the new route |
| `"force"` | Applies as soon as an update is waiting |

### `<pwa-update-toast>`

The package ships a small toast that shows while `pwa.update.value.waiting` is
true, with a Reload action calling `pwa.apply()` and a dismiss. Write the tag in
a view:

```html
<pwa-update-toast></pwa-update-toast>
```

It uses plain markup and its own stylesheet, so the package needs neither
`@lightstart/components` nor that package's generated tags. Its words go through
light's i18n contract (`translate("pwa-update-toast.<key>")`) and fall back to
English; `message`, `reload-label` and `dismiss-label` override them.

The package declares its tag table in `package.json` (`"light": { "tags":
"tags.json" }`), in the format [@lightstart/app](../app/README.md#a-packages-tag-table)
documents: each tag names its `module`, `style`, `extends`, `uses` and `loads`.
Writing `<pwa-update-toast>` makes the generation import its module and
stylesheet and define the tag.

## The worker

The worker's cache is named `pwa-<version>`.

- `install` precaches the list. It calls `skipWaiting()` only on the very first
  install, when no worker is active; an update waits for the page to ask.
- `activate` deletes every other `pwa-*` cache and calls `clients.claim()`.
- `fetch` handles same-origin `GET` requests only:
  - a precached asset (a hashed bundle, an icon) is cache-first;
  - a navigation is network-first with a three-second timeout, and the worker
    keeps each page the network answers; offline it answers the kept page for
    that path, then its folder's `index.html`, then the cached shell
    `<base>/index.html`;
  - everything else passes through untouched.
- a message `{ type: "pwa:skip-waiting" }` calls `skipWaiting()`.

The routing decision, the precache list and the version are pure functions in
`worker/logic.ts`; the build bundles that module into `sw.js`.

## Development

`light serve` answers `<base>/manifest.webmanifest` from the config and
`<base>/sw.js` with a worker that unregisters itself on activate and passes
every request through, both with `cache-control: no-store` and
`service-worker-allowed: <base>/`. The page gets the same manifest link through
the dev server's page renderer; the generated entry does the registration.

`light serve --pwa` serves the real worker in development, built from the
current sources with an empty precache list, so registration and the update
message can be tried without a production build. It is still built at server
start, so a change to the worker needs a restart.
