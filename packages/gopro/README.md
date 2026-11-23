# @lightstart/gopro

A pure-JS GoPro driver for `@lightstart/devices`: Open GoPro BLE control and Wi-Fi media import over the generic device transports.

## Registering the driver

The package registers nothing on import. An app names the driver once, with `@lightstart/devices`'s registry:

```js
import { registerDriver } from "@lightstart/devices";
import { goproDriver } from "@lightstart/gopro";

registerDriver(goproDriver);
```

`goproDriver` is also the package's default export and is exported as `driver`. Registration is idempotent and by `id`, so an app that calls it twice is fine. `@lightstart/devices`'s `devices` controller then matches GoPro advertisements and opens a session with `driver.connect`.

## The driver

`goproDriver` carries:

- `id: "gopro"`, `label: "GoPro"`, and capabilities `telemetry`, `shutter`, `media-import`, `wifi-ap`, `preview` and `controls`;
- `matches(advertisement)`, true for the GoPro control service or a GoPro name;
- `scanFilter`, the control service UUID;
- `connect(transport, device)`, answering a `DriverSession`.

The session reads and writes status, controls and the camera's own presets, records and captures photos, joins the camera's access point for media and preview, lists and imports clips, and emits `status`, `recording`, `state`, `credentials` and `controls`. The access point is reference-counted, so an import does not tear down a live preview and a preview does not keep the phone off the internet.

## Pure protocol modules

`lib/protocol.js` (framing, status maps, capabilities), `lib/settings.js` (our names for the camera's numbers), `lib/presets.js` (the camera's own named presets), `lib/media.js` (URLs and the media list) and `lib/constants.js` are pure and exported from the entry. They are what the driver tests drive without a camera.

`types.ts` holds the preset and media-list reply shapes; `index.ts` is the typed public surface.

## Gates

From the repository root:

```bash
light check --all
light typecheck @lightstart/gopro
light test @lightstart/gopro
npx eslint packages/gopro
```
