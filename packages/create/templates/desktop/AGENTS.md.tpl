# Working in __TITLE__

A light desktop app: a page in the system's web view and a backend compiled by `scriptc` into a native executable with no JavaScript engine. They talk over one typed contract. Light's packages are linked from a checkout, so their READMEs are the reference.

## Scripts

| Command | Does |
|---|---|
| `pnpm dev` | `light desktop run backend.ts --web web --out dist`: build, stage the page and open the window |
| `pnpm build` | `light desktop build backend.ts --web web --out dist`: `dist/backend` and `dist/web/` |
| `pnpm test` | `node --test test/*.test.ts`: the backend's logic under node, no window |
| `pnpm check` | `light check`: light's conventions over the sources |
| `pnpm lint` | `light lint`: eslint with the project's config |
| `pnpm typecheck` | `light typecheck`: `tsc --noEmit` over the backend and its tests |
| `pnpm verify` | `light verify`: check, lint, typecheck and test in order |

Run `pnpm verify` before committing.

`dev` and `build` pass `--npm-static @lightstart/light` so `scriptc` compiles light's native desktop modules as program source instead of treating the bare import as an npm package. The first build needs WebKitGTK's development package, `pkg-config`, `g++`, `cc` and `ar` (see `README.md`); once the shim archive exists, later builds reuse it.

## Layout

| Path | What |
|---|---|
| `backend.ts` | Entry compiled by `scriptc`; it owns `main()`, so it runs its top-level code |
| `system.ts` | Pure backend logic; importable under node, so the test never opens a window |
| `contract.ts` | `Api`, `Events`, `PageEvents`: the types both sides import, nothing more |
| `web/main.ts` | Registers the `lc-*` components and imports `web/app.js` |
| `web/app.js` | The view: `connect()`, the calls, the listeners, `html` |
| `web/index.html` | The page; keep `<!--importmap-->` in `<head>` |
| `web/styles.css` | Theme and component stylesheets from the staged `light/` and `components/` folders |
| `test/` | Node tests, `*.test.ts` |

The build copies `web/` into `dist/web/` unchanged. It does not strip types, so every file the page loads must be plain JavaScript: `web/main.ts` and `web/app.js` use JSDoc for types, never TypeScript syntax. Only `backend.ts`, `system.ts`, `contract.ts` and `test/` are compiled or run elsewhere.

## The backend

```ts
import { DesktopApp, num } from "@lightstart/light/native/desktop";

const app = new DesktopApp({ title: "My App", width: 820, height: 560 });
app.handle("add", (args) => Promise.resolve(num(args, 0) + num(args, 1)));
app.handle("quit", () => {
  setTimeout(() => app.quit(), 0);
  return Promise.resolve(null);
});
app.onConnect = () => app.emit("tick", 1);
app.start();
```

- An argument from the page is `unknown` until narrowed with `typeof`, `Array.isArray` or `instanceof`; `str`, `num`, `bool` and `arr` narrow one level.
- A handler's value is `unknown` before it is wrapped: `const info: unknown = machine(); return Promise.resolve(info);`. A `Promise` of a record literal invoked through the route throws natively.
- `app.emit(name, value)` reaches the page's listeners; `app.on(name, receive)` hears the page's. `emitJson(name, json)` sends JSON text it already holds.
- A function assigned to a nullable function field goes through a const typed with the field's function type; an arrow assigned straight to the field is inferred without its parameter types natively.
- Anything that runs a nested native loop stalls timers and replies until it returns; dialogs are non-modal and pumped like everything else.
- The backend owns `main()`: no import of it may run under node. Put testable logic in `system.ts`.

## The page

```js
import View from "@lightstart/light";
import { html } from "@lightstart/light/html";
import { connect } from "@lightstart/light/native/desktop/client.js";

/** @import { Api, Events, PageEvents } from "../contract.ts" */

/** @type {import("@lightstart/light/native/desktop/types.ts").Desktop<Api, Events, PageEvents>} */
const desktop = connect();

View.define("app-page", {
  props: { ticks: 0 },
  async connected() {
    desktop.on("tick", (n) => { this.ticks = n; });
    await desktop.ready();
    await desktop.emit("hello", "from the page");
  },
  render() {
    return html`<p>${this.ticks} ticks</p>`;
  },
});
```

`connect()` needs the webview's `window.__desktop` binding, so the page cannot be opened in a normal browser. Register listeners before `desktop.ready()`, or an event pushed on connect is queued until a listener arrives. `desktop.log(level, text)` is the page's console: the webview's own console is invisible to the backend.

A view renders into the light DOM and is a `View.define` object with reactive `props` and lifecycle hooks; `render()` returns an `html` template. `lc-*` components come from `@lightstart/components`: import the module, its stylesheet, and register it with `View.define(component)`.

`lc-title-bar` draws the title bar of the frameless window (drag, double-click to maximize, minimize/maximize/close); `DesktopApp` opens frameless by default. `window.__desktopWindow` (`env.window` in light) carries the window's state and controls; see `native/desktop/README.md`.

## The bridge

One typed call and two event directions:

| Page | Backend |
|---|---|
| `desktop.call.<method>(…)` | `app.handle("<method>", (args) => Promise<unknown>)` |
| `desktop.on("<event>", fn)` | `app.emit("<event>", value)` |
| `desktop.emit("<event>", value)` | `app.on("<event>", fn)` |

All three are typed from `contract.ts`. Replies may arrive out of order; an error becomes the page's rejected Promise with the error's message. There is one window per process.

## Tests

`test/` holds node tests (`*.test.ts`) on `node:test` and `node:assert/strict`. They must not import `backend.ts`, which starts the app; test `system.ts` and other pure modules instead.

## Read more

| Package | README |
|---|---|
| `@lightstart/light` | The engine, `View.define`, props, signals, the theme |
| `@lightstart/light/native/desktop` | The backend, the bridge, the window, the page's files, the frameless title bar |
| `@lightstart/light/native/probes` | The forms `scriptc` compiles natively, and the rules they set |
| `@lightstart/components` | Every `lc-*` tag and its stylesheet |
| `@lightstart/cli` | `light`: commands, hooks, routes, extensions |
| `@lightstart/server` | The loopback asset server the shell runs on |
