# Working on @lightstart/mobile

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | `defineMobile`, `MobileConfig`, `MobileAddonsConfig`, `ResolvedMobile`, `MobileVersion`, `MobileOrientation`, `MobileShareTarget`, `MobileResultTarget`, and the page API's types re-exported |
| `page.ts` | `mobile`, `MobileApi`, `MobileReady`, the share out types, `MobileShared`, `MobileReminder`, `MobileCaptureOptions`, `MobileResultRequest`, `MobileResultApi`: the request protocol, capabilities, events, `shared()`, reminders, results and the web fallbacks |
| `node/config.ts` | `mobilePathOf`, `appPathOf`, `readMobile`, `appIdentityOf`, `resolveMobile`: read `src/mobile` and `src/app` without their views, and validate the share targets, result target, camera app and add-on opt-out |
| `node/addons.ts` | `discoverAddons`, `mergeAddonUses`, `MobileAddon`, `MobileAddonPermission`, `MobileAddonFeature`, `MobileAddonService`, `AddonUses`, `AddonDiscovery`: find packages that declare `light.android`, validate them, sort them, apply `addons.disable` and merge their manifest lines |
| `node/template.ts` | `androidDir`, `assetsDir`, `sdkDirOf`, `targetSdkOf`, `writeAndroid`, `rewriteAndroid`, `writeAddons`, `writeLocalProperties`: the template and the config-derived files, including the share and result intent filters, reminder receiver, camera query and add-on sources, `Addons.kt`, manifest lines and Gradle dependencies |
| `templates/android/` | The Gradle project: `MainActivity.kt`, `ResultActivity.kt`, `Bridge.kt`, `MobileAddon.kt`, `Reminders.kt`, `Notifications.kt`, the manifest, resources and the cached wrapper |
| `cli/commands/mobile/init.ts` | `light mobile:init` |
| `cli/commands/mobile/sync.ts` | `light mobile:sync` |
| `cli/commands/mobile/build.ts` | `light mobile:build`, `apkPath` |
| `cli/commands/mobile/run.ts` | `light mobile:run` |
| `test/` | Plain node-only scripts on `@lightstart/test/assert.ts`; `test/fixtures/app` is the fixture, with `@fixture/echo-addon`, `@fixture/gradle-addon` and `@fixture/bad-addon` under its `node_modules` |

## Rules the sources keep

- `src/mobile.ts` or `src/mobile.js`, exactly one (both is an error naming both), default-exports `defineMobile({ appId, ... })`. A config without an app id is a clear error.
- Defaults: `name` is the app's `title` then `name`; `version` is `{ name: "0.1.0", code: 1 }`; `orientation` is `"any"`; `minSdk` is `26`. `resolveMobile` refuses values Android cannot use.
- The app id is both `namespace` and `applicationId`. The shell's own Kotlin classes stay in `dev.lightstart.mobile`, and the manifest names the activity fully qualified. No framework name appears in code or resources.
- `targetSdk` is the newest platform under `ANDROID_HOME/platforms`, else the newest build tools, else 36. `minSdk` comes from the config.
- `mobile:init` writes the whole tree and refuses an existing folder without `--force`. `mobile:sync` runs `light build`, copies `.deployed/current` under `assets/www`, and rewrites only the config-derived files, so a project's own edits survive.
- The WebView is served from `assets/www` over `https://appassets.androidplatform.net/` with `WebViewAssetLoader`, resolving `path/index.html`, `path.html`, `404.html` and `index.html`. The app base is stripped before the asset lookup and prefixed on the first load.
- The bridge is `WebViewCompat.addWebMessageListener` restricted to the shell origin, not `addJavascriptInterface`; it is the only channel, and the document-start script only marks presence.
- The protocol is a request `[id, method, args]` and a reply `{ id, ok, value | error }`, out of order allowed; events are `{ event, payload }`. `$ready` answers `{ platform: "android", capabilities: [...] }` with only what the shell has.
- `share` writes files under the cache, exposes them through a `FileProvider`, uses `ACTION_SEND` or `ACTION_SEND_MULTIPLE`, goes straight to `app` when it is installed, and answers `{ shared: true }`. The page falls back to `navigator.share` outside the shell.
- `shareTarget` accepts one `{ path, types? }` or a list; `types` defaults to `["text/plain"]`. The manifest gets an `ACTION_SEND` filter per type and `ACTION_SEND_MULTIPLE` for files; `BuildConfig.SHARE_TARGETS` carries `path|type,type;…`. A share opens `<path>?text=&title=` and, for files, `file=/__mobile/shared/<name>&type=&name=` repeated per file; a running shell also emits the `share` event. The shell serves `/__mobile/shared/` and `/__mobile/capture/` from its cache through the asset loader.
- `cameraApp` reaches `BuildConfig.CAMERA_APP` and a manifest `<queries>` package. `mobile.capture` fires `ACTION_IMAGE_CAPTURE` or `ACTION_VIDEO_CAPTURE` with a `FileProvider` output, at `app`, then `cameraApp`, then the chooser, and answers `{ url, type, name }` or `null`; the web opens a `capture` file input and answers a blob URL.
- `resultTarget` is `{ capture?, pick?, types? }`, at least one path starting with `/`; `types` defaults to `["image/*", "video/*"]` and may hold only `image/*`, `video/*` or specific image/video MIME types. The manifest gets a second exported activity, `ResultActivity` (a `MainActivity` subclass with `forResult`, standard launch mode so it runs in the caller's task and can `setResult`), with `IMAGE_CAPTURE`/`VIDEO_CAPTURE` when `capture` is set and an image/video type is allowed, and `GET_CONTENT` (with OPENABLE) plus `PICK` over each type when `pick` is set. `BuildConfig.RESULT_CAPTURE` and `RESULT_PICK` carry the paths. A request opens `<path>?request=capture|pick&type=<mime>`; `Bridge` answers `result.request` (`{ kind, type, output }` or null), `result.answer` (`[{ data, type, name }]`, base64 bytes written to the caller's `EXTRA_OUTPUT` or a `FileProvider` file, then `RESULT_OK`) and `result.cancel` (`RESULT_CANCELED`). Back with no answer cancels.
- An add-on is a project dependency (not devDependency) whose `package.json` carries `light.android` with `sources` (default `android`), `entry` (a Kotlin class name), `permissions`, `features`, `services` and `dependencies`. Discovery sorts by package name and validates each field with an error naming the package and field. `addons.disable` names packages to leave out; a name that matches no discovered add-on is a warning. Its sources use `package dev.lightstart.mobile.addons` and import `dev.lightstart.mobile.*`.
- A permission is a name or `{ name, maxSdkVersion?, usesPermissionFlags? }`; `usesPermissionFlags` is a `|`-separated list of `[A-Za-z]+` flag names, written as `android:usesPermissionFlags`. `mergeAddonUses` keeps one entry per name and its flags, and refuses two add-ons that declare one permission with different flags or `maxSdkVersion`, naming both.
- A service is `{ name, foregroundServiceType?, exported? }`; `name` is a bare Kotlin class name in the add-on's sources and the manifest writes it as `dev.lightstart.mobile.addons.<name>`. `foregroundServiceType` is a `|`-separated set of Android's types (`camera`, `connectedDevice`, `dataSync`, `location`, `mediaPlayback`, `mediaProjection`, `microphone`, `phoneCall`, `remoteMessaging`, `shortService`, `specialUse`, `systemExempted`, `health`); `exported` defaults to false. Two add-ons declaring one service name is an error naming both.
- `mobile:init` and `mobile:sync` copy each add-on's `.kt` files to `app/src/main/java/dev/lightstart/mobile/addons/`, write `Addons.kt`, merge its permissions, features and services into the manifest and its coordinates into `app/build.gradle`, and log the add-ons found. Sync clears the add-on folder first, so removing a dependency removes its files and lines.
- `MobileAddon.handle` runs before the bridge's own `when`; the first add-on returning true owns the call and answers through `respond`/`fail` as `{ id, ok, value | error }`. Its `families` join `$ready`'s capabilities. `MainActivity` holds the WebView in a root `FrameLayout`, calls `onCreate`/`onDestroy` on each add-on, and offers `ensurePermissions` (its own request code), `emit` (the bridge's event, from any thread), `setWebViewTransparent` and `nativeFiles` (served at `/__mobile/native/<name>` with byte ranges).
- Reminders are a JSON list in `SharedPreferences`, one exact-or-inexact `AlarmManager` alarm each, a `ReminderReceiver` posting on the `reminders` channel and re-arming after `BOOT_COMPLETED`; the first `set` asks for `POST_NOTIFICATIONS` on API 33+. The page's `mobile.reminders` answers `{ supported: false }` outside the shell.
- `mobile.shared()` reads `text`, `title` and repeated `file`/`type`/`name` from the current URL on both the shell and the web; it answers `null` when none is present.
- TypeScript with erasable syntax only; no `any`. Kotlin in the template. Comments are a JSDoc module header and JSDoc on exported symbols in TypeScript, and short KDoc headers in Kotlin.
- The Gradle wrapper's distribution, AGP and Kotlin versions are the ones the offline cache can build, and the template resolves the coroutines JVM artifact explicitly because the multiplatform metadata is not cached; tests never go online. A build test that lacks an artifact skips itself and names it.
- Tests are plain node-only scripts; the fixture carries `node_modules` symlinks and its `.gitignore` keeps `node_modules/`.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `defineMobile`, `MobileConfig` and its fields (`appId`, `name`, `version`, `orientation`, `minSdk`, `shareTarget`, `resultTarget`, `cameraApp`, `addons`) | a project's `src/mobile.ts` (or `.js`) |
| `readMobile`, `appIdentityOf`, `resolveMobile` | every `mobile:*` command |
| `discoverAddons`, `mergeAddonUses` and the `light.android` declaration (`sources`, `entry`, `permissions`, `features`, `services`, `dependencies`) | init, sync and a package shipping Kotlin |
| `writeAndroid`, `rewriteAndroid`, `writeAddons`, `targetSdkOf`, `writeLocalProperties` | init and sync |
| `MobileAddon`, `Addons.kt` and the `/__mobile/native/` path | a package's Kotlin sources and the page |
| The request protocol and `$ready`'s capability list (`share`, `shareTarget`, `result`, `capture`, `reminders`, then each add-on's `families`) | `page.ts` and `Bridge.kt` |
| `mobile.present`, `mobile.ready`, `mobile.can`, `mobile.request`, `mobile.on`, `mobile.share`, `mobile.shared`, `mobile.reminders`, `mobile.capture`, `mobile.result` | an app's page |
| `mobile/android/app/src/main/assets/www` | sync, build and the shell |

## Gates

From the repository root:

```bash
light check --all
light typecheck @lightstart/mobile
light test @lightstart/mobile
npx eslint packages/mobile
```
