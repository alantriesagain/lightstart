# Working on @lightstart/mobile

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | `defineMobile`, `MobileConfig`, `ResolvedMobile`, `MobileVersion`, `MobileOrientation`, `MobileShareTarget`, and the page API's types re-exported |
| `page.ts` | `mobile`, `MobileApi`, `MobileReady`, `MobileShareFile`, `MobileShareOptions`, `MobileShareResult`: the request protocol, capabilities, events and the `navigator.share` fallback |
| `node/config.ts` | `mobilePathOf`, `appPathOf`, `readMobile`, `appIdentityOf`, `resolveMobile`: read `src/mobile` and `src/app` without their views |
| `node/template.ts` | `androidDir`, `assetsDir`, `sdkDirOf`, `targetSdkOf`, `writeAndroid`, `rewriteAndroid`, `writeLocalProperties`: the template and the config-derived files |
| `templates/android/` | The Gradle project: `MainActivity.kt`, `Bridge.kt`, the manifest, resources and the cached wrapper |
| `cli/commands/mobile/init.ts` | `light mobile:init` |
| `cli/commands/mobile/sync.ts` | `light mobile:sync` |
| `cli/commands/mobile/build.ts` | `light mobile:build`, `apkPath` |
| `cli/commands/mobile/run.ts` | `light mobile:run` |
| `test/` | Plain node-only scripts on `@lightstart/test/assert.ts`; `test/fixtures/app` is the fixture |

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
- TypeScript with erasable syntax only; no `any`. Kotlin in the template. Comments are a JSDoc module header and JSDoc on exported symbols in TypeScript, and short KDoc headers in Kotlin.
- The Gradle wrapper's distribution, AGP and Kotlin versions are the ones the offline cache can build, and the template resolves the coroutines JVM artifact explicitly because the multiplatform metadata is not cached; tests never go online. A build test that lacks an artifact skips itself and names it.
- Tests are plain node-only scripts; the fixture carries `node_modules` symlinks and its `.gitignore` keeps `node_modules/`.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `defineMobile`, `MobileConfig` and its fields (`appId`, `name`, `version`, `orientation`, `minSdk`, `shareTarget`, `cameraApp`) | a project's `src/mobile.ts` (or `.js`) |
| `readMobile`, `appIdentityOf`, `resolveMobile` | every `mobile:*` command |
| `writeAndroid`, `rewriteAndroid`, `targetSdkOf`, `writeLocalProperties` | init and sync |
| The request protocol and `$ready`'s capability list | `page.ts` and `Bridge.kt` |
| `mobile.present`, `mobile.ready`, `mobile.can`, `mobile.request`, `mobile.on`, `mobile.share` | an app's page |
| `mobile/android/app/src/main/assets/www` | sync, build and the shell |

## Gates

From the repository root:

```bash
light check --all
light typecheck @lightstart/mobile
light test @lightstart/mobile
npx eslint packages/mobile
```
