/**
 * Devices' observable state and its occurrences.
 *
 * The device a session holds is state: `deviceStatus` is the last status it
 * reported. A link opening, a preview moving, a scan hit and an import moving
 * are occurrences, delivered to every listener. `downloadProgress` is what the
 * native shell reports while it writes a media file. The shell's pushes feed
 * the emitters once, lazily, through `installDeviceSignals`.
 */

import { event, signal } from "@lightstart/light/signals";
import { mobile } from "@lightstart/mobile/page";
import { BLE_NOTIFY, BLE_SCAN_RESULT, BLE_STATE, STREAM_STATE } from "./commands.js";
import { DOWNLOAD_PROGRESS } from "./events.js";

/** @import { Emitter, Signal } from "@lightstart/light/signals" */
/** @import { ConnectedDevice, DeviceControl, DeviceStatus, DownloadProgress, PreviewState, PreviewStats, ScannedDevice } from "./types.ts" */

/** The last status the connected session reported, tagged with its device. */
export const deviceStatus = /** @type {Signal<{ id?: string } & DeviceStatus>} */ (signal({}));

/** A session to a device opened. */
export const deviceConnected = /** @type {Emitter<ConnectedDevice>} */ (event());

/** A session closed, by the user or by the link dropping. */
export const deviceDisconnected = /** @type {Emitter<{ id?: string, reason: string }>} */ (event());

/** A session's control list changed. */
export const deviceControls = /** @type {Emitter<{ id?: string, controls: DeviceControl[] }>} */ (event());

/** The preview moved to a new state. */
export const devicePreview = /** @type {Emitter<PreviewStats & { state: PreviewState }>} */ (event());

/** A recording started or stopped. */
export const deviceRecording = /** @type {Emitter<{ id?: string, recording: boolean, at: string }>} */ (event());

/** A scan found a device a driver answers. */
export const deviceScanResult = /** @type {Emitter<ScannedDevice>} */ (event());

/** A media import moved. */
export const deviceImportProgress = /** @type {Emitter<{ id?: string, done: number, total: number }>} */ (event());

/** The session failed for a named reason. */
export const deviceError = /** @type {Emitter<{ id?: string, code: string }>} */ (event());

/** The native shell wrote more of a downloaded media file. */
export const downloadProgress = /** @type {Emitter<DownloadProgress>} */ (event());

/** One BLE notification from the shell: `{ id, char, data }`. */
export const deviceNotify = /** @type {Emitter<{ id?: string, char?: string, data?: string }>} */ (event());

/** One BLE scan hit pushed by the shell. */
export const deviceScanFound = /** @type {Emitter<Record<string, unknown>>} */ (event());

/** A BLE link's state pushed by the shell (connected, pairing, dropped). */
export const deviceStatePush = /** @type {Emitter<Record<string, unknown>>} */ (event());

/** The preview stream's state pushed by the shell. */
export const streamState = /** @type {Emitter<Record<string, unknown>>} */ (event());

let installed = false;

/**
 * Feed the emitters from the shell's pushes, once. The controller calls this
 * when it starts; `on` is the shell's listener installer, injected so a test
 * can drive a fake shell.
 * @param {(event: string, fn: (payload: unknown) => void) => () => void} [on]
 * @returns {void}
 */
export const installDeviceSignals = (on = (name, fn) => mobile.on(name, fn)) => {
  if (installed) return;
  installed = true;
  on(BLE_NOTIFY, (payload) => deviceNotify.emit(/** @type {{ id?: string, char?: string, data?: string }} */ (payload ?? {})));
  on(BLE_SCAN_RESULT, (payload) => deviceScanFound.emit(/** @type {Record<string, unknown>} */ (payload ?? {})));
  on(BLE_STATE, (payload) => deviceStatePush.emit(/** @type {Record<string, unknown>} */ (payload ?? {})));
  on(STREAM_STATE, (payload) => streamState.emit(/** @type {Record<string, unknown>} */ (payload ?? {})));
  on(DOWNLOAD_PROGRESS, (payload) => {
    const data = /** @type {{ name?: string, bytes?: number, total?: number }} */ (payload ?? {});
    downloadProgress.emit({ name: data.name ?? "", bytes: data.bytes ?? 0, total: data.total ?? 0 });
  });
};
