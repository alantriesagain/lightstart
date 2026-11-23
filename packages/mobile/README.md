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
| `resultTarget` | none | `{ capture?, pick?, types? }`, what another app may start this one for a photo, a clip or a file; at least one path, `types` defaults to `["image/*", "video/*"]` |
| `cameraApp` | none | An app id the page's `mobile.capture` asks first, and the manifest queries |
| `addons` | none | `{ disable: ["@scope/package"] }`, the discoverable Android add-ons to leave out |

The app's deploy base (`defineApp({ url })`'s path, or `base`) is read at init
and sync time, so a build rooted at `/budget` still resolves inside the shell.

## Commands

`light mobile:init` writes `mobile/android/` from the template with the config
applied. It refuses an existing folder without `--force`.

`light mobile:sync` runs `light build`, copies `.deployed/current` into
`mobile/android/app/src/main/assets/www`, and rewrites the config-derived files
(`settings.gradle`, `app/build.gradle`, `AndroidManifest.xml`, `strings.xml`).
It also resyncs the add-ons: their Kotlin files and `Addons.kt` are rewritten
and files an add-on no longer provides are removed. It runs the build rather
than reading the last one so the APK never carries a stale page.

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
and `reminders` are always there. An add-on's `families` are added to the list,
so `mobile.can("<family>")` answers true when the shell compiled it in.

## Add-ons

A dependency may ship Kotlin the shell compiles in. It declares the add-on in
its `package.json` under `light.android`:

```json
{
  "name": "@example/location-addon",
  "light": {
    "android": {
      "sources": "android",
      "entry": "LocationAddon",
      "permissions": ["android.permission.ACCESS_FINE_LOCATION", { "name": "android.permission.READ_PHONE_STATE", "maxSdkVersion": 32 }],
      "features": [{ "name": "android.hardware.location.gps", "required": false }],
      "dependencies": ["com.example:location:1.2.3"]
    }
  }
}
```

| Field | What |
|---|---|
| `sources` | A folder relative to the package holding its `.kt` files; defaults to `android` |
| `entry` | The Kotlin class implementing `MobileAddon`, with a no-arg constructor |
| `permissions` | Permission names, or `{ name, maxSdkVersion? }`, written into the manifest |
| `features` | `{ name, required? }`, written as `<uses-feature>` |
| `dependencies` | Gradle coordinates, each written as `implementation '…'` |

`mobile:init` and `mobile:sync` read the project's `dependencies` (not
`devDependencies`), keep the packages that declare `light.android`, sort them by
package name, and copy their `.kt` files into
`app/src/main/java/dev/lightstart/mobile/addons/`. They write `Addons.kt`, add
the permissions, features and Gradle dependencies, and log the add-ons they
found. `sync` also removes the files and lines of an add-on whose dependency is
gone, so an existing shell follows the project.

The add-on's Kotlin files use `package dev.lightstart.mobile.addons` and import
`dev.lightstart.mobile.*`. The interface the shell compiles against is:

```kotlin
interface MobileAddon {
  val families: List<String>
  fun onCreate(activity: MainActivity, root: FrameLayout, webView: WebView) {}
  fun handle(method: String, args: JSONArray, respond: (Any?) -> Unit, fail: (String) -> Unit): Boolean
  fun onDestroy() {}
}
```

`handle` receives the request's method and `args` (`JSONArray`), and owns the
call by returning `true`; it answers through `respond(value)` or
`fail(message)`, which the bridge sends as the usual `{ id, ok, value | error }`.
The first add-on that returns `true` owns the call, so its method names must not
collide with the shell's. `onCreate` runs after the WebView is set up and
`onDestroy` with the activity.

`MainActivity` gives an add-on four helpers:

- `ensurePermissions(permissions, then)` asks for the permissions that are
  missing and calls `then(allGranted)`. A second request before the first
  answers calls the first `then(false)`.
- `emit(event, payload)` sends `{ event, payload }` to the page, which
  `mobile.on(event, fn)` receives; it may be called from any thread.
- `setWebViewTransparent(owner, on)` makes the page transparent while any owner
  wants to draw behind it.
- `nativeFiles` is a folder under `cacheDir`; a file written there is served at
  `/__mobile/native/<name>` with byte ranges, so a player or a map can ask for
  part of a large asset.

The page needs no new API: `mobile.can("location")` follows its `families` and
`mobile.request("location.where")` reaches its `handle`, and `mobile.on`
receives what it passes to `activity.emit`. A fire-and-forget call is not added;
a request replies.

A project opts an add-on out with `defineMobile({ addons: { disable:
["@example/location-addon"] } })`. A name there that matches no discovered
add-on is a warning, not an error.

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
| `mobile.result` | `request()`, `answer(file)` and `cancel()` for another app's capture or pick request |

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

### Answering another app

`resultTarget` makes the app a camera or file source another app can start for
a result, the way it starts the system camera or a file picker:

```js
// src/mobile.js
export default defineMobile({
  appId: "com.example.budget",
  resultTarget: {
    capture: "/camera",
    pick: "/pick",
    types: ["image/*", "image/jpeg", "video/*"],
  },
});
```

`capture` and `pick` are app paths starting with `/`, and at least one is
required. `types` defaults to `["image/*", "video/*"]` and may hold only
`image/*`, `video/*` or specific image and video MIME types. `mobile:init` and
`mobile:sync` add a second activity, `ResultActivity`, with an `IMAGE_CAPTURE`
filter when an image type is allowed and a `VIDEO_CAPTURE` filter when a video
type is, and a `GET_CONTENT` and `PICK` filter over each type for `pick`.
`RESULT_CAPTURE` and `RESULT_PICK` in `BuildConfig` carry the paths, as
`SHARE_TARGETS` does.

A request opens `<capture>?request=capture&type=image%2F*` (or `video%2F*`),
or `<pick>?request=pick&type=<the MIME the caller wants>`. A page reads what
was asked and answers:

```js
import { mobile } from "@lightstart/mobile/page";

const request = await mobile.result.request();
// { kind: "capture" | "pick", type, output } or null
if (request !== null) {
  const shot = await takeTheShot(request.type);
  await mobile.result.answer(shot); // a Blob, or a URL it can fetch
  // or: await mobile.result.cancel();
}
```

`answer(file)` takes a `Blob`, or a string URL the page can fetch (a `data:`,
`blob:` or same-origin URL); the page reads the bytes and sends them base64.
The shell writes them to the caller's `EXTRA_OUTPUT` when the request carried
one (`request.output`), otherwise to a file offered through the `FileProvider`
with a read grant, then finishes with `RESULT_OK`. `cancel()` finishes with
`RESULT_CANCELED`, as Back does when the page has nothing to hand back. Both
reject outside the shell; `request()` answers `null` there.

The desktop page client is not reused: it binds `window.__desktop`, has no
request id and knows no capabilities. This package mirrors the shared shape
(signal-free request/reply, events, listeners) over the Android channel.

## Pass 2 and later

Pass 1 is the package, the shell, the bridge, the commands and sharing out.
Pass 2 adds receiving a share (`shareTarget`), daily reminders, asking another
app for a capture (`cameraApp`) and answering another app's capture or pick
request (`resultTarget`). Later work can add an iOS shell, camera control,
device access, kiosk mode, OTA updates, icons, signing and release bundles.

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
