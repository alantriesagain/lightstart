# __TITLE__

A desktop app on [light](https://lightstart.dev): a light page in the operating system's own web view, and a backend compiled by `scriptc` into a native executable with no JavaScript engine. The two halves talk over one typed contract, and nothing ships a browser or Node. The shell needs WebKitGTK on Linux, WKWebView on macOS or WebView2 on Windows.

## Start

```bash
pnpm install
pnpm dev
```

`pnpm dev` runs `light desktop run backend.ts --web web --out dist`: it builds the backend, stages the page beside it, and opens the window. Close the window (or the page's quit button) to stop it.

| Script | Runs |
|---|---|
| `dev` | `light desktop run backend.ts --web web --out dist` |
| `build` | `light desktop build backend.ts --web web --out dist` |
| `test` | `node --test test/*.test.ts`: the backend's logic, without a window |
| `check` | `light check` |

`build` leaves `dist/backend` (the executable) and `dist/web/` (the page, light's own files under `web/light/`, the components under `web/components/`, and the import map that maps the bare `@lightstart/…` specifiers onto them). The executable looks for `web/` beside itself.

The first build compiles light's vendored webview library and the C shim into `out/<target>/libdesktop.a`; later builds reuse the archive until a shim source changes. On Linux that needs `pkg-config`, `g++`, `cc`, `ar` and the WebKitGTK development package (`libwebkit2gtk-4.1-dev` on Debian and Ubuntu, which brings GTK 3). A built app needs only the runtime libraries a desktop already has. `scriptc` installs a native compiler and Node 24 or later runs the test; if pnpm blocks install scripts, approve them once with `pnpm approve-builds`.

## Where things are

| Path | What |
|---|---|
| `backend.ts` | The native side: opens the window, answers the page's calls, pushes ticks, quits |
| `system.ts` | What the backend reads from the machine, kept separate so the test can run it under node |
| `contract.ts` | The typed messages between page and backend: `Api`, `Events`, `PageEvents` |
| `web/index.html` | The page: `<lc-title-bar>`, `<app-page>` and `web/main.ts` |
| `web/main.ts` | Registers the components and the app's view |
| `web/app.js` | The view: connects to the backend, shows its answer, sends events |
| `web/styles.css` | The theme and the components' stylesheets |
| `test/system.test.ts` | The backend logic under node |

The page's files are served exactly as they ship, so `web/main.ts` and `web/app.js` are plain JavaScript with JSDoc types (`.ts` is only a name there). The backend is compiled by `scriptc` and may use TypeScript's type syntax; its types are erased. Change `web/main.ts` to `web/main.js` and the `index.html` script tag if you prefer the extension to match.

## The contract

`contract.ts` is imported by both sides for types only:

```ts
export interface Api {
  machine(): Machine;
  add(a: number, b: number): number;
  quit(): void;
}
export interface Machine { platform: string; home: string; }
export interface Events { tick: number; }
export interface PageEvents { hello: string; }
```

The backend registers the methods with `app.handle(name, invoke)` and pushes `tick`; the page calls them as `desktop.call.machine()`, `desktop.call.add(2, 3)` and listens with `desktop.on("tick", …)`. The page's own events go the other way with `desktop.emit("hello", …)` and `app.on("hello", …)`.

A handler answers a `Promise` of `unknown`: the page's arguments are untyped until narrowed, and an object must reach `Promise.resolve` as `unknown` (`const info: unknown = machine(); return Promise.resolve(info);`). Use `str`, `num`, `bool` and `arr` for one-level narrowing. `native/probes/README.md` in the light checkout lists the forms `scriptc` accepts.

## Light

The packages are linked from a light checkout (`link:` with pnpm, `file:` with npm). A project started with `--npm` names published versions instead. `AGENTS.md` has the conventions, `native/desktop/README.md` in the light checkout covers the backend, the bridge and the window, and `@lightstart/components/README.md` lists every `lc-*` tag.
