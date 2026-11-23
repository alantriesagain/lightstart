# Working on @lightstart/devices

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | The typed public surface: registry, frame helpers, transport selection and the types |
| `types.ts` | The public types: `Transport`, its four families, drivers, sessions, controls, status, preview |
| `signals.js` | `deviceStatus` and the typed occurrences, fed lazily from the shell by `installDeviceSignals` |
| `commands.js`, `events.js`, `capabilities.js` | Plain constants: the bridge command names, the download event, the capability table |
| `controllers/devices.js` | The `devices` controller: scan, connect, preview, record, import, and the remembered list |
| `controllers/devices/select-transport.js` | `hasNativeDevices` and `selectTransport` |
| `controllers/devices/transport-native.js` | `createNativeTransport`: the four families over `mobile.request` and `mobile.on` |
| `lib/registry.js` | The driver registry |
| `lib/frame.js` | The hex codec and ATT chunking |
| `lib/transport-null.js` | The transport outside a shell |
| `views/` | `devices-manager`, `devices-connect`, `devices-controls`, `devices-status` |
| `tags.json` | The package's tag table, named by `package.json`'s `light.tags` |
| `android/` | The mobile add-on, declared by `light.android` |
| `test/` | Plain node scripts, the Gradle add-on tests, and one Chromium test |

## Rules the sources keep

- The mobile shell is the environment seam: `mobile.present`, `mobile.can("devices")`, `mobile.request(method, [payload])`, `mobile.on(name, fn)` from `@lightstart/mobile/page`. There is no bridge global.
- A request has a timeout wrapper; a fire-and-forget post does not.
- State is a signal and an occurrence is an event. The connection, the scan results, the status and the controls are controller props; a link opening, a scan hit and an import moving are emitters.
- The controller is a `defineController({ name: "devices", ... })` literal. Views import its handle directly and bind `sync:` props to it.
- Remembered devices are a `sync: { to: "local", key: "devices:known" }` controller prop, not a model: an app's generation reads `src/models/` only.
- A driver registers explicitly with `registerDriver(goproDriver)`; nothing registers on import.
- No `any`. Narrow `unknown` with `typeof`, `instanceof` or `Array.isArray`.
- Every command in `commands.js` has a `handle` branch in `DevicesAddon`, and every event the JS listens to is emitted by it. Keep the two lists in step.

## The Android add-on

- Package `dev.lightstart.mobile.addons`, implementing `MobileAddon`: `families = listOf("devices")`, `handle(method, args, respond, fail)` reading `args.optJSONObject(0)`, `onCreate` and `onDestroy`.
- Events through `activity.emit`; permissions through `activity.ensurePermissions`; downloads in `activity.nativeFiles`, answered as `/__mobile/native/<name>`; the live stream behind a transparent page with `setWebViewTransparent("devices", on)`.
- `DevicesCommands` mirrors `commands.js` and `events.js`.
- The foreground service is the `light.android.services` entry; the manifest wants `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_CONNECTED_DEVICE`, `BLUETOOTH_SCAN` with `neverForLocation`, and the source's `maxSdkVersion` entries.
- Gradle runs offline only. `test/addon-build.test.ts` skips only when a cached artifact is missing and names it; any other failure fails the test.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `registerDriver`, `driverFor`, `scanServices` | a driver package and the controller |
| `Transport` and its four families | a driver's `connect` |
| The `commands.js` names and `download:progress` | `transport-native.js` and `DevicesCommands.kt` |
| `deviceStatus` and the occurrences | an app's own device screen |
| `tags.json` and the `devices-*` tags | the web generation and an app's views |
| The `devices` controller's props and methods | a view's `sync:` and an app's capture screen |
| `/__mobile/native/<name>` | `DevicesDownloader` and `DevicesStreamPlayer` |

## Gates

From the repository root:

```bash
light check --all
light typecheck @lightstart/devices
light test @lightstart/devices
npx eslint packages/devices
# from packages/devices, one browser file per run:
light test test/manager.browser.test.js
```
