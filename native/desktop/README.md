# light desktop

A desktop shell for light apps: the app's backend is JavaScript compiled by scriptc into a
native executable with no JavaScript engine; its UI is a light web page shown in the operating
system's own web view (WebKitGTK on Linux, WKWebView on macOS, WebView2 on Windows). Nothing is
bundled: no Node, no Chromium. The two halves talk over one typed bridge declared by the app as
a contract. Think Electron without the Node and without shipping the browser.

The backend keeps everything scriptc gives a native program: timers, child processes, sockets,
files. The page keeps everything the browser gives: light's DOM host, CSS, the engine's layout.
An app that needs a service (the writing harness runs a Claude Code sidecar) registers it on the
backend; the shell itself knows nothing about it.

## Try it

```
node native/desktop/build.js run native/desktop/demo/backend.js      # a window, ticks, a round trip
node native/desktop/smoke.js                                        # the same, unattended: prints "smoke ok"
node native/desktop/coverage.js                                     # the demo backend must compile fully static
```

`light desktop run|build|shim|smoke …` is the same tool through the CLI. The first build compiles
the vendored webview library and the shim into `out/<target>/libdesktop.a` and writes the FFI
manifest beside it; later builds reuse the archive until a shim source changes.

On Linux the build needs `pkg-config`, `g++`, `cc`, `ar` and the development package of WebKitGTK
(`libwebkit2gtk-4.1-dev` on Debian and Ubuntu, which brings GTK 3). A built app needs only the
runtime libraries, which a desktop already has (`libwebkit2gtk-4.1-0`).

## An app

Three files: the contract, the backend, the page.

```ts
// contract.ts: both sides import it
export interface Api {
  add(a: number, b: number): number;
  quit(): void;
}
export interface Events {
  tick: number;
}
```

```js
// backend.js: compiled by scriptc, never run under node
import { DesktopApp, num } from "@bootstrapp/light/native/desktop";

const app = new DesktopApp({ title: "my app", width: 640, height: 400 });
app.handle("add", (args) => Promise.resolve(num(args, 0) + num(args, 1)));
app.handle("quit", () => {
  setTimeout(() => app.quit(), 0);
  return Promise.resolve(null);
});
app.onConnect = () => app.emit("tick", 1);
app.start();
```

```js
// web/app.js: a light page, loaded by web/index.html
import View from "@bootstrapp/light";
import { html } from "@bootstrapp/light/html";
import { connect } from "@bootstrapp/light/native/desktop/client.js";

/** @type {import("@bootstrapp/light/native/desktop/types.ts").Desktop<Api, Events>} */
const desktop = connect();
View.define("my-page", {
  props: { ticks: 0, sum: 0 },
  async connected() {
    desktop.on("tick", (n) => { this.ticks = n; });
    await desktop.ready();
    this.sum = await desktop.call.add(2, 3);
  },
  render() {
    return html`<p>${this.ticks} ticks, 2 + 3 = ${this.sum}</p>`;
  },
});
```

`light desktop build backend.js --web web --out dist/my-app --name my-app` leaves `dist/my-app/my-app`
(the executable) and `dist/my-app/web/` (the page, light's own files under `web/light/`, and the
import map that maps `@bootstrapp/light…` onto them). The executable looks for `web/` beside
itself; `--web <dir>` on its command line points it elsewhere.

### The backend

`DesktopApp` (`host.js`):

| Member | What it does |
|---|---|
| `new DesktopApp({ title, width, height, web, debug, pumpMs })` | Options only; nothing opens yet. `web` defaults to `--web` on the command line, then `web/` beside the executable. `debug` opens the engine's developer tools. |
| `handle(name, invoke)` | Registers a method: `invoke(args)` gets the page's arguments parsed from JSON as `unknown[]` and answers a Promise; its value goes back as JSON. A rejection becomes the page's rejection with the error's message. |
| `emit(name, value)` | Pushes an event to the page's listeners. Nothing is pushed before the page said it is ready. |
| `start()` | Opens the window, serves the page, starts pumping. |
| `quit()` | Closes the window and exits; the user closing the window does the same. |
| `onConnect`, `onClose`, `onLog` | Nullable callback fields: the page is up (push initial state here), the window is going away (stop children here), a line the page logged (stderr by default). |
| `str(args, i)`, `num(args, i)`, `bool(args, i)`, `arr(args, i)` | Narrowing helpers for arguments: the value when it has that type, else `""`, `0`, `false`, `[]`. |

The backend owns `main()`. The web view's event loop is not run; it is pumped: every `pumpMs`
(8 by default) a timer calls the shim's `desktop_pump`, which handles the platform events that
are pending and returns. scriptc's own loop runs the timers, the asset server, the app's child
processes and sockets between pumps. A method call from the page arrives inside a pump, on the
main thread, and the reply is sent when its Promise settles.

### The page

`connect()` (`client.js`) answers:

| Member | What it does |
|---|---|
| `call.<method>(…args)` | The contract as Promises: `window.__desktop(name, args)` under the hood, the webview's own binding. |
| `on(name, fn)`, `off(name, fn)` | Event listeners. An event emitted before its first listener is queued (up to 256) and delivered when one arrives, so a listener registered at startup misses nothing. |
| `ready()` | Tells the backend the page is up; resolves once it answered. Register listeners before calling it. |
| `log(level, text)` | Writes to the backend's log; the page's own console is invisible in a web view. |

`alert`, `confirm` and `prompt` do nothing in a web view; dialogs are the page's job.

### The bridge, on the wire

One bound function, `__desktop(method, args)`; the page's request is the JSON array
`[method, [args…]]`. The backend replies through `desktop_return` with `{ "ok": true, "value": … }`
or `{ "ok": false, "error": "…" }`, always with status 0, so errors never depend on the engine's
rejection path. Replies may complete out of order. Two methods are reserved: `$ready` and
`$log(level, text)`. Events go the other way as `window.__desktopEmit(name, value)` evaluated in
the page; `init.js` installs that function, the listener table and the queue on every page load,
so a reload keeps working.

### The page's files

The web view has no custom URL scheme and `set_html` has no base URL, so the backend serves the
page itself: an HTTP server on `127.0.0.1` at a port the system picks, under
`/<token>/` with a token drawn at launch, `GET` and `HEAD` only, the `Host` header checked, paths
normalised to inside `web/`, `Cache-Control: no-store`, no directory listing. `index.html` gets
the import map from `importmap.json` injected at `<!--importmap-->` (or before `</head>`).
`web/light/` holds light's package files; the map points `@bootstrapp/light`, every entry in
its `exports`, and the prefix `@bootstrapp/light/` at them.

## Layout

| File | Owns |
|---|---|
| `host.js` | `DesktopApp`, `Route`, the narrowing helpers. |
| `server.js` | The loopback asset server. |
| `client.js` | `connect()` for the page. |
| `init.js` | The script installed into every page load. |
| `types.ts` | `Contract`, `Client`, `Events`, `Desktop`, `Handler`, `DesktopOptions`; re-exports the runtime. |
| `ffi.ts` | The `declare function desktop_*` signatures bound by the manifest. |
| `shim/shim.c` | The C shim over webview: NUL-terminating wrappers, the loop pump, close detection (GTK and Win32). |
| `shim/vendor/webview/` | webview 0.12.0 (MIT), unchanged. |
| `shim/smoke.c` | A C program that opens a window and pumps until it is closed; `build.js smoke`. |
| `build.js` | `shim`, `smoke`, `build`, `run`. |
| `smoke.js`, `coverage.js` | The gates. |
| `demo/` | The demo app. |
| `out/` | Build output (ignored). |

## Platforms

| Target | Engine | Shim build | Status |
|---|---|---|---|
| `linux-x64` | WebKitGTK 4.1 on GTK 3 (or 6.0 on GTK 4, or 4.0 on GTK 3), via `pkg-config` | `g++`, `cc`, `ar` | Works end to end; the gates run here. |
| `mac-arm64` | WKWebView | `clang++`, `clang -fobjc-arc` (Xcode command line tools) | Build branch written, unverified. |
| `win-x64` | WebView2 (its runtime is on every Windows 10 and 11 since 2021; `WebView2.h` is fetched for the build) | `zig cc` targeting `x86_64-windows-gnu` | Build branch written, unverified. |

## Rules

The backend is native code, so light's native rules (`native/probes/README.md`) apply, plus two
of its own:

- A retained FFI callback must be the exact function value the manifest describes: a module
  constant, not a field or a wrapper (scriptc refuses an adapter, since it would change the
  callback's release identity). `host.js` binds one module-level `onCall` and routes it to the
  active app.
- An argument from the page is `unknown` until narrowed; the helpers narrow one level and an
  app checks the rest with `typeof`, `Array.isArray` and `instanceof`.
