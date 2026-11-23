# @lightstart/devices

Connected devices for light apps: a driver registry, the `devices` controller, generic BLE, Wi-Fi, download and preview transports over the light mobile shell, and the `devices-*` views. A driver package (such as [`@lightstart/gopro`](../gopro/)) supplies the protocol.

## Registering a driver

Nothing is registered on import. An app names the driver once:

```js
import { registerDriver } from "@lightstart/devices";
import { goproDriver } from "@lightstart/gopro";

registerDriver(goproDriver);
```

`registerDriver` keeps drivers in a module-scope registry, so registration order and controller creation order are independent. `getDrivers`, `driverById`, `driverFor` and `scanServices` read it; the controller scans for every registered driver's services and matches each advertisement with `driverFor`.

## The controller

`controllers/devices.js` is a `defineController({ name: "devices", ... })` literal. Views import its handle directly and bind `sync:` props to it. It carries `available`, `connectionState`, `scanned`, `device`, `status`, `busy`, `previewState`, `controls`, `progress`, `error` and `known`, and its methods are `scan`, `stopScan`, `connect`, `disconnect`, `forget`, `refreshStatus`, `refreshControls`, `setControl`, `startRecording`, `stopRecording`, `startPreview`, `stopPreview`, `isPreviewing`, `setPreviewBounds`, `capturePreviewFrame`, `capturePhoto`, `listMedia`, `importMedia`, plus `can(capability)`, `isReady()`, `drivers()` and `registerDriver(driver)`.

The remembered devices live in `known`, a controller prop bound to the local adapter under `devices:known`:

```js
sync: { known: { to: "local", key: "devices:known" } }
```

Register the adapter (`registerAdapter("local", localStorage)`) in the app if the list should persist. A package cannot ship a model: an app's generation reads `src/models/` only, so a remembered device is controller state rather than a row. This is the one change from the package's earlier model-backed form.

## Transports

`selectTransport()` picks the native transport inside a mobile shell that declares the `devices` capability (`mobile.present && mobile.can("devices")`) and a null transport everywhere else. `createNativeTransport(mobileApi = mobile)` speaks the four families over `mobile.request`:

| Family | Commands |
|---|---|
| BLE | `BLE:SCAN_START`, `BLE:SCAN_STOP`, `BLE:CONNECT`, `BLE:DISCONNECT`, `BLE:SUBSCRIBE`, `BLE:WRITE`, `BLE:READ` |
| Wi-Fi | `WIFI:JOIN` → `{ handle }`, `WIFI:LEAVE` |
| Stream | `STREAM:START`, `STREAM:BOUNDS`, `STREAM:SNAPSHOT`, `STREAM:STOP` |
| Download | `DOWNLOAD:GET`, `DOWNLOAD:FETCH`, `DOWNLOAD:CANCEL` |

Pushes are `BLE:NOTIFY`, `BLE:SCAN_RESULT`, `BLE:STATE`, `STREAM:STATE` and the `download:progress` event. `Transport` is the seam: `createNullTransport` rejects every call with `no-transport` so a view can say "open the phone app". The command names are constants in `commands.js`.

## Signals and events

State is a signal; an occurrence is an event. `signals.js` exports:

| Export | Kind |
|---|---|
| `deviceStatus` | signal: the last status the connected session reported, tagged with its device |
| `deviceConnected`, `deviceDisconnected`, `deviceControls`, `devicePreview`, `deviceRecording`, `deviceScanResult`, `deviceImportProgress`, `deviceError` | occurrences |
| `downloadProgress`, `deviceNotify`, `deviceScanFound`, `deviceStatePush`, `streamState` | the shell's pushes as occurrences |

`installDeviceSignals(on = mobile.on)` feeds them from the shell once, lazily; the controller calls it when it starts.

## Views

`tags.json` names the views the generation defines: `<devices-manager>` (the remembered list, add panel and the `camera` event for an app's capture screen), `<devices-connect>` (one device block), `<devices-controls>` (a pure presenter for a device's controls) and `<devices-status>` (a battery/recording badge).

## On Android

`android/` holds the add-on, declared by `package.json`'s `light.android` block: `DevicesAddon` implements `MobileAddon` with `families = listOf("devices")`, and `DevicesBleManager`, `DevicesWifiJoiner`, `DevicesDownloader`, `DevicesUdpDataSource`, `DevicesStreamPlayer`, `DevicesCommands` and `DeviceLinkService` do the work. The live stream draws behind a transparent page (`setWebViewTransparent("devices", on)`); downloads land in `activity.nativeFiles`, answered as `/__mobile/native/<name>`; events go through `activity.emit`; permissions through `activity.ensurePermissions`. The foreground service is the `services` entry, and `BLUETOOTH_SCAN` carries `neverForLocation`. `light mobile:init` and `mobile:sync` copy the Kotlin, list the add-on in `Addons.kt`, and write the permissions, service and media3 dependencies.

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
