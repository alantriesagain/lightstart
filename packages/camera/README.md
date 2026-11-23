# @lightstart/camera

A camera for light apps: one `CameraInstance` over the web (`getUserMedia`) and the light mobile shell (CameraX behind a transparent web view), the `<camera-preview>` surface, the control registry and lens and EXIF helpers, and a second phone as the camera.

## The camera

`createCamera(opts)` picks the backend: native inside a light mobile shell that carries the `camera` capability, the web otherwise; `{ backend: "web" }` keeps `getUserMedia` inside the shell for a caller that needs the stream in the page. `start({ facingMode })` answers `{ stream, track, lenses }` (no stream on native: the preview is a surface behind the page and `html.native-camera` clears the page's backgrounds over it), `capturePhoto()` answers `{ blob, exif, settings }`, `stop()` releases it. `<camera-preview .stream ?mirror fit>` draws a stream and owns no camera logic.

`source: { kind: "link" }` wraps the `cameraLink` controller as another phone's camera behind the same `CameraBackend` contract. `source: { kind: "device", id }` shoots through a connected action camera that a driver of [`@lightstart/devices`](../devices/) runs: the shell's preview is the picture behind the page, its controls are the camera's settings, its lens control is the lens strip, and a press keeps the preview's frame while the full-size file stays on the camera until an import brings it over. An app registers the driver once, `registerDriver(goproDriver)`, and the device backend reads the `devices` controller handle; the module (and `@lightstart/devices`) loads only when a device source is asked for.

## On Android

Inside light's mobile shell the package ships a CameraX add-on in `android/CameraAddon.kt`, declared by `package.json`'s `light.android` block. It draws the preview behind the transparent page, answers the `CAMERA:*` requests from `native-backend.js` (start, stop, bounds, controls, capture, recording, lenses, frames, view, diagnostics), and emits `camera:frame`, `camera:meter` and `camera:orientation` for `signals.js`. Captures and clips are written to the shell's native files and answered as `/__mobile/native/<name>`.

`light mobile:init` and `light mobile:sync` discover the add-on from the project's dependencies, copy its Kotlin into the shell, list it in `Addons.kt`, and add the CAMERA and RECORD_AUDIO permissions, the optional camera feature and the CameraX dependencies.

## Another phone as the camera

The package's views are defined from `tags.json` when an app writes them. Nothing pairs until the app asks.

- **The phone with the app** opens `<camera-pair ?open @close>`, a bottom sheet with Show the code. `cameraLink.host()` joins a `@lightstart/p2p` room with `video` and answers a link, `<origin><page>#cam=<payload>`, which the sheet draws as a QR. Once the other phone opens it, `cameraLink.stream` is its camera, `live(on)` turns its camera on and off with the capture screen, `flip()` switches its lens, and `shoot(timer)` answers the photo (`{ blob, facing, at }`) after the other phone counts the self-timer down.
- **The other phone** opens the link with its camera app. An app imports `openCameraLink` from `@lightstart/camera/frontend.js` and calls it once from its own startup (light has no extension boot): it checks `location.hash`, mounts `<camera-link>` over the page when the fragment holds a `#cam=` payload, and answers whether it did. The view calls `cameraLink.serve()`: its camera full screen, the screen kept on, the countdown, and a way out. Nothing is kept there.
- **The other phone running the same app** (two installs of a native app, where the link's origin may serve nothing) taps Broadcast to the other phone in the same sheet. `<camera-scan>` reads the QR with the back camera (`decodeQr` from `@lightstart/qr`) and mounts `<camera-link>` with the link it read. While it looks, `cameraLink.role` is `scanning`, and while it serves, `camera`: an app with its own camera on screen lets go of the lens for both, or the scan cannot open it.
- A camera phone in the mobile shell serves its native camera: `CAMERA:FRAMES { on, width, fps }` has the addon send the preview's frames to the page as `camera:frame` events (JPEG, base64, with the rotation to turn by), the native backend made with `createCamera({ frames: { width, fps } })` draws them on a canvas and answers `getStream()` with its stream, so the viewer gets the phone's real lenses, zoom range, controls and photos. A browser serves its web camera. `CAMERA:VIEW { scale }` magnifies the native preview on its own screen, 1 to 4, for a pinch that must not move the camera (the native backend's `view` control).
- The camera phone's screen can be locked to touch (the lock in its top line, for a phone set down or handed over); a three-second hold on the lock unlocks it. Both screens hold a screen wake lock while a camera runs. The camera phone reports what its camera can set and what it is set to (`cam:caps`, then `cam:settings` every second), and the viewer sets a control or a lens on it (`cam:set`, `cam:lens`); the pair of the last link stays on both phones (`cameraLink.remembered`), so the viewer reopens the same room and the camera phone rejoins without a new code.
- The protocol is `remote.js` (`serveCamera`, `viewCamera`), actions on any room shaped like `RemoteRoom`; a `@lightstart/p2p` `Room` joined with `video: true` satisfies it. The link codec is `lib/pair.js`. Video and photos go phone to phone. Where the phones find each other is the app's `configureP2P` in `@lightstart/p2p` (the dev relay, and public trackers or brokers, which see only the handshake sealed with the link's key), and an app that pairs declares `@lightstart/p2p` and `@lightstart/qr`.

The `cameraLink` controller is a `defineController({ name: "cameraLink", ... })` handle. Its `remembered` prop syncs to the `local` adapter under `camera-link:pair`, so register `local` (`registerAdapter("local", localStorage)`) if you want the last pair kept. Views import the handle directly and bind their `sync:` props to it.

## Signals and events

The native shell's readings follow light's rule: state is a signal, an occurrence is an event. `signals.js` exports:

| Export | Kind | Value |
|---|---|---|
| `cameraOrientation` | signal | the latest `{ rotation }`, how the phone is held |
| `cameraMeter` | signal | the latest sensor reading `{ iso, exposureTime, aperture, luma, aeState }` |
| `cameraFrame` | event | one preview frame `{ data, width, height, rotation }`, every frame delivered |

They are fed from `mobile.on("camera:orientation" | "camera:meter" | "camera:frame", ...)`, installed once, lazily, when the native backend starts (`installCameraSignals()`). Read the signals with `.value`; listen to the frame event with `.on(fn)`.

## Orientation and video quality on native

The addon watches the phone's physical orientation while the camera runs and keeps every capture's `targetRotation` on it, so a photo or clip taken with a portrait-locked app held sideways comes out the right way up. It tells the page too: `camera:orientation`, written to the `cameraOrientation` signal (`{ rotation: 0 | 90 | 180 | 270 }`), once when the camera starts and on every change, which is what a viewfinder guide needs to draw the frame the way it will be captured.

The addon's other shell events are declared in `signals.js` too: `cameraFrame` (one preview frame, `{ data, width, height, rotation }`) and `cameraMeter` (the sensor reading). `start({ width, height, frameRate })` picks the recording quality from the short side (720p, 1080p, 2160p, with CameraX's nearest fallback) and asks for the frame rate when the camera lists a range that holds it.
