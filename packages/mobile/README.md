# @lightstart/mobile

A light app as an Android app: one WebView serving the built page from the
APK's assets, a small Kotlin bridge, and the `light mobile:*` commands. A
project opts in with `src/mobile.ts` or `src/mobile.js` default-exporting
`defineMobile`.

```js
// src/mobile.js
import { defineMobile } from "@lightstart/mobile";

export default defineMobile({
  appId: "com.example.budget",
  name: "Budget",
  version: { name: "1.0.0", code: 1 },
  orientation: "portrait",
  minSdk: 26,
  shareTarget: { path: "/capture", types: ["image/*", "video/*", "text/plain"] },
  cameraApp: "com.example.camera",
});
```

Both `src/mobile.ts` and `src/mobile.js` is an error naming both, as an app has
one `src/app` module.

## defineMobile

| Field | Default | What |
|---|---|---|
| `appId` | required | The Android application id, such as `com.example.app`; also the Gradle namespace |
| `name` | the app's `title`, then its `name` | The launcher label |
| `version` | `{ name: "0.1.0", code: 1 }` | `name` is `versionName`, `code` is `versionCode` |
| `orientation` | `"any"` | `"portrait"`, `"landscape"` or `"any"`; held at run time |
| `minSdk` | `26` | The app's minimum Android API |
| `shareTarget` | none | `{ path, types? }` or a list of them, what another app may share into the shell; `types` defaults to `["text/plain"]` |
| `cameraApp` | none | An app id the page's `mobile.capture` asks first, and the manifest queries |

The app's deploy base (`defineApp({ url })`'s path, or `base`) is read at init
and sync time, so a build rooted at `/budget` still resolves inside the shell.

## Commands

`light mobile:init` writes `mobile/android/` from the template with the config
applied. It refuses an existing folder without `--force`.

`light mobile:sync` runs `light build`, copies `.deployed/current` into
`mobile/android/app/src/main/assets/www`, and rewrites the config-derived files
(`settings.gradle`, `app/build.gradle`, `AndroidManifest.xml`, `strings.xml`).
It runs the build rather than reading the last one so the APK never carries a
stale page.

`light mobile:build` runs `mobile:sync`, then `./gradlew assembleDebug
--offline`, and prints the APK path
(`mobile/android/app/build/outputs/apk/debug/app-debug.apk`).

`light mobile:run` runs `mobile:build`, installs on the one device `adb
devices` lists and starts the activity. With no device it says so.

The template ships the Gradle wrapper; its distribution is Gradle 8.11.1, the
one the offline cache holds. The shell builds with AGP 8.9.3 and Kotlin 2.1.20,
`minSdk` from the config and `targetSdk` the newest platform installed under
`ANDROID_HOME`.

## The shell

`MainActivity.kt` is one WebView with JavaScript and DOM storage on. The page
is served from the APK's `assets/www` under `https://appassets.androidplatform.net/`
through `WebViewAssetLoader`; a missing path falls back to `path/index.html`,
`path.html`, `404.html` and `index.html`, so client-side routes and prerendered
pages both resolve. External links open the system browser, and Back walks the
page's history before leaving the app.

`Bridge.kt` installs `window.__lightMobile = { present: true }` at document
start and a `lightMobile` message channel. It uses
`WebViewCompat.addWebMessageListener` rather than `addJavascriptInterface`:
the listener is restricted to the shell's own origin, while a JavaScript
interface is injected into every page and is the discouraged bridge.

### The protocol

The page posts one JSON value per request:

```json
[1, "share", [{ "text": "Hello", "title": "Budget" }]]
```

The shell replies through the channel, in any order:

```json
{ "id": 1, "ok": true, "value": { "shared": true } }
{ "id": 2, "ok": false, "error": "no method camera" }
```

Events travel the other way as `{ "event": "name", "payload": … }`. `$ready`
answers `{ "platform": "android", "capabilities": ["share", "capture",
"reminders", "shareTarget"] }`; only a capability the shell actually has is
listed, so `mobile.can` stays honest. `share` is sharing out, `shareTarget` is
receiving a share and appears only with a configured `shareTarget`; `capture`
and `reminders` are always there.

## The page API

```js
import { mobile } from "@lightstart/mobile/page";
```

| Member | What |
|---|---|
| `mobile.present` | `true` only inside the shell |
| `mobile.ready` | A promise of `{ platform, capabilities }` inside the shell, `null` outside; await it before `can` |
| `mobile.can(name)` | Whether the shell listed the capability |
| `mobile.request(method, args)` | Send one request; rejects outside the shell |
| `mobile.on(event, fn)` | Listen for a shell event; answers the unsubscribe |
| `mobile.share(options)` | Share through the shell, or through `navigator.share` on the web |
| `mobile.shared()` | The share the current URL carries, or `null`; works on the web too |
| `mobile.reminders` | `set(list)`, `get()` and `clear()` daily reminders |
| `mobile.capture(options)` | Ask another app for a photo or a clip, or open a file input on the web |

### share

`mobile.share({ text?, title?, url?, files?, app? })` opens the system share
sheet. `files` are `{ name, type, data }` with `data` base64; they are written
under the app cache and offered through a `FileProvider`
(`${applicationId}.files`) with `ACTION_SEND` or `ACTION_SEND_MULTIPLE`. When
`app` names an installed package the intent goes straight to it, and the sheet
opens when it is not installed. It answers `{ shared: true }`.

Outside the shell the same call uses `navigator.share`, turning each file into
a `File`.

### Receiving a share

`shareTarget` makes the app a target of another app's share sheet. Each entry
is `{ path, types? }` and `types` defaults to `["text/plain"]`; an object and a
list of them are both accepted. `mobile:init` and `mobile:sync` add one
`ACTION_SEND` intent filter per type, and `ACTION_SEND_MULTIPLE` as well for
everything but text, plus `SHARE_TARGETS` in `BuildConfig`.

A text share opens `<path>?text=<text>&title=<title>`, both URL-encoded and
either empty when the sender left it out. A file share copies the file (or
files) under the app's cache and adds `file=<url>&type=<mime>&name=<display
name>` for each, where `<url>` is `/__mobile/shared/<name>` and readable with
`fetch` from the page. `mobile.shared()` reads it back:

```js
import { mobile } from "@lightstart/mobile/page";

const incoming = mobile.shared();
// { text?, title?, files?: [{ url, type, name }] } or null
```

On a cold start the share is the first page; while the app runs the shell
navigates the page to the same path and query and emits a `share` event with
the same fields (`mobile.on("share", fn)`). Use the event when the page should
not leave where it is. A PWA with a GET `share_target` lands on the same query
shape, so one `mobile.shared()` serves both.

### Reminders

```js
await mobile.reminders.set([
  { id: "morning", hour: 7, minute: 30, title: "Time to lift", body: "One session.", path: "/" },
]);
const { reminders } = await mobile.reminders.get();
await mobile.reminders.clear();
```

The shell keeps the list in its preferences and arms one `AlarmManager` alarm
per reminder: exact when the system permits it and inexact otherwise. A firing
posts a notification on the `reminders` channel, re-arms the next day, and
opens `path` (default `/`) when tapped. `BOOT_COMPLETED` and a package update
arm every alarm again. On Android 13+ the first `set` asks for
`POST_NOTIFICATIONS`. Each call answers `{ supported: true }`, or `{ supported:
false }` on the web, where `mobile.get()` also answers `reminders: []` and
`mobile.can("reminders")` is false.

### Capture

`mobile.capture({ kind?: "image" | "video", app?: string })` asks another app
for a picture or a clip. It fires `ACTION_IMAGE_CAPTURE` or
`ACTION_VIDEO_CAPTURE` with an output URI of this app's, straight at `app` when
it is installed, else at `cameraApp` when configured and installed, else at the
chooser. It answers `{ url, type, name }` with the shot served under
`/__mobile/capture/`, or `null` when cancelled. On the web it opens
`<input type="file" accept="image/*" capture>` (or `video/*`) and answers a
blob URL in the same shape.

The desktop page client is not reused: it binds `window.__desktop`, has no
request id and knows no capabilities. This package mirrors the shared shape
(signal-free request/reply, events, listeners) over the Android channel.

## Pass 2 and later

Pass 1 is the package, the shell, the bridge, the commands and sharing out.
Pass 2 adds receiving a share (`shareTarget`), daily reminders and asking
another app for a capture (`cameraApp`). Answering another app's capture or
pick request (`resultTarget`) is not in this pass. Later work can add
`resultTarget`, an iOS shell, camera control, device access, kiosk mode, OTA
updates, icons, signing and release bundles.

## Tests

The package's tests are plain node-only scripts on `@lightstart/test/assert.ts`.
The Gradle test runs offline and skips itself, naming the artifact, when the
cache cannot build. From the repository root:

```bash
light check --all
light typecheck @lightstart/mobile
light test @lightstart/mobile
npx eslint packages/mobile
```
