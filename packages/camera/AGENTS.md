# Working on @lightstart/camera

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `camera.js` | `createCamera`, the backend-free helpers and the control/lens exports |
| `index.ts` | The typed public surface: the entry's exports, the stops/bodies/exposure/explain helpers, EXIF, sounds and the signals |
| `types.ts` | The public types: controls, lenses, capture results, the remote room and the link slot |
| `select-backend.js` | `selectBackend`, `isSupported`, `isNativeShell`, `hasNativeCamera` |
| `web-backend.js` | `createWebBackend`: getUserMedia, ImageCapture and MediaRecorder |
| `native-backend.js` | `createNativeBackend`: the mobile shell bridge, the preview frames on a canvas |
| `android/CameraAddon.kt` | The CameraX add-on the mobile shell compiles: the preview and its controls, captures, clips, frames, meter and orientation, over the `CAMERA:*` commands |
| `remote.js` | `serveCamera`, `viewCamera`: one phone as another's camera over a `RemoteRoom` |
| `signals.js` | `cameraOrientation` and `cameraMeter` signals, the `cameraFrame` event, the one-time installer |
| `frontend.js` | `openCameraLink()` (imported from `@lightstart/camera/frontend.js`): mounts `<camera-link>` on a `#cam=` page |
| `commands.js`, `capabilities.js`, `events.js` | Plain constants: the native command names, the capability table, the frame event name |
| `lib/controls.js` | The control registry and its teaching copy |
| `lib/lens-model.js` | Lens classification and the 35mm-equivalent zoom math |
| `lib/stops.js`, `lib/bodies.js`, `lib/exposure-modes.js`, `lib/explain.js` | The body's printed stops, its words, the mode table and the lesson |
| `lib/exif.js`, `lib/downscale.js` | A JPEG's EXIF tags, and a photo shrunk with its orientation baked in |
| `lib/sound.js` | The shutter and self-timer tones, Web Audio only |
| `lib/pair.js` | The `#cam=` v1 payload codec |
| `lib/link-backend.js` | Another phone's camera behind `CameraBackend` |
| `lib/link-slot.js` | Where the controller leaves its handle for the link backend |
| `lib/device-backend.js` | A connected action camera behind `CameraBackend`: the `devices` controller handle's preview, controls, lenses and shutter |
| `controllers/link.js` | The `cameraLink` controller: host, serve, scan, shoot, controls, the remembered pair |
| `views/preview.js`, `views/preview.css` | `<camera-preview>` and its stylesheet |
| `views/pair.js`, `views/scan.js`, `views/link.js` | The pairing sheet, the QR scanner and the serving screen |
| `tags.json` | The package's tag table, named by `package.json`'s `light.tags` |
| `test/` | Plain node scripts on `@lightstart/test/assert.ts`, and the Chromium tests |

## The language choice

The framework-free modules stay JavaScript with JSDoc types, as light's components are. `index.ts` and `types.ts` are TypeScript, as every package entry in light is. Tests that run under node are `.ts` plain scripts so `light test` finds them; the Chromium tests are `.js` on `node:test`.

## Rules the sources keep

- No `any`, in TypeScript or JSDoc. Narrow `unknown` with `typeof`, `instanceof` or `Array.isArray`.
- Comments are a module header and doc comments on exported symbols, nothing else.
- The mobile shell is the environment seam: `mobile.present`, `mobile.can("camera")`, `mobile.request(type, [payload])`, `mobile.on(name, fn)` from `@lightstart/mobile/page`. There is no `$APP`.
- The native file URLs the shell answers are fetched as URLs (`/__mobile/native/<file>`); the backend does not rebuild paths.
- State is a signal and an occurrence is an event: `cameraOrientation` and `cameraMeter` are signals holding the latest reading, `cameraFrame` is an event. `installCameraSignals` installs the shell listeners once, lazily, when the native backend starts.
- The device source is loaded on demand: `select-backend.js` imports `lib/device-backend.js` dynamically, so an app that never asks for a device does not load `@lightstart/devices`. The backend reads the `devices` controller handle, and its options take another handle so a test drives a fake.
- The peer room is structural: `remote.js` imports nothing of `@lightstart/p2p`, and a `Room` joined with `video: true` satisfies `RemoteRoom`. `controllers/link.js` uses `joinRoom`, `randomId`, `resolveSignalers` and `p2pConfig`.
- The pairing payload (`lib/pair.js`) is unchanged: the v1 `#cam=` codec.
- The controller is a `defineController({ name: "cameraLink", ... })` literal; views import its handle directly and bind `sync:` props to it. `remembered` syncs to the `local` adapter under `camera-link:pair`.
- A view module default-exports `defineComponent({ tag: "camera-*", ... })`; `tags.json` makes the generation define it. `views/scan.js` and `views/link.js` append `<camera-link>` elements rather than defining tags by hand, except `openCameraLink`, which defines the view module if the generation did not.
- The lock is on-screen only: there is no volume-key chord.
- The package ships its sources and needs no build step.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `createCamera(opts)` and the `CameraInstance` methods | an app's capture screen |
| `selectBackend`, `isSupported`, `isNativeShell`, `hasNativeCamera` | an app choosing a backend and the link controller |
| `CameraBackend` and its result shapes | the web, native, link and device backends |
| `createDeviceBackend`, `DevicesSlot` and the device source | an app's capture screen and a test's fake devices handle |
| `serveCamera` / `viewCamera` and `RemoteRoom` | an app's own pair flow and the link controller |
| `cameraOrientation`, `cameraMeter`, `cameraFrame` and `installCameraSignals` | a viewfinder guide and a native-frame consumer |
| `openCameraLink()` | an app booting from a `#cam=` link |
| The `CAMERA:*` command names and the `camera:frame`, `camera:meter`, `camera:orientation` events | `commands.js`, `signals.js` and `android/CameraAddon.kt` |
| `/__mobile/native/<name>` for captures and clips | `native-backend.js` fetching a capture |
| `tags.json`, `<camera-preview>`, `<camera-pair>`, `<camera-scan>`, `<camera-link>` | the web generation and an app's views |
| `encodePair`, `decodePair`, `isFresh` and `CameraPair` | the link codec |
| The `cameraLink` controller's props and methods | a view's `sync:` and an app's capture screen |

## Gates

From the repository root:

```bash
light check --all
light typecheck @lightstart/camera
light test @lightstart/camera
npx eslint packages/camera
# from packages/camera, one browser file per run:
light test test/preview.browser.test.js
```
