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
| `shareTarget` | none | Pass 2: `{ path, types? }`, what the shell accepts from another app's share sheet |
| `cameraApp` | none | Pass 2: an app id the page's file input can shoot with |

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
answers `{ "platform": "android", "capabilities": ["share"] }`; only a
capability the shell actually has is listed, so `mobile.can` stays honest.

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

### share

`mobile.share({ text?, title?, url?, files?, app? })` opens the system share
sheet. `files` are `{ name, type, data }` with `data` base64; they are written
under the app cache and offered through a `FileProvider`
(`${applicationId}.files`) with `ACTION_SEND` or `ACTION_SEND_MULTIPLE`. When
`app` names an installed package the intent goes straight to it, and the sheet
opens when it is not installed. It answers `{ shared: true }`.

Outside the shell the same call uses `navigator.share`, turning each file into
a `File`.

The desktop page client is not reused: it binds `window.__desktop`, has no
request id and knows no capabilities. This package mirrors the shared shape
(signal-free request/reply, events, listeners) over the Android channel.

## Pass 2 and later

Pass 1 is the package, the shell, the bridge, the commands and sharing out.
Pass 2 adds receiving a share (`shareTarget`), reminders and asking another app
for a capture (`cameraApp`), which the config already declares. Later work can
add icons, signing, release bundles and an iOS shell.

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
