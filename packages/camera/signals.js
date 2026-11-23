/**
 * `@lightstart/camera` readings from the native addon: the preview's frames,
 * the sensor's meter reading and the phone's held orientation. State is a
 * signal (the latest reading); an occurrence is an event. The shell's events
 * feed them once, lazily, when the native backend starts.
 */

import { event, signal } from "@lightstart/light/signals";
import { mobile } from "@lightstart/mobile/page";

/** @import { Emitter, Signal } from "@lightstart/light/signals" */

/** One frame of the native preview: `{ data, width, height, rotation }`. */
export const cameraFrame = /** @type {Emitter<{ data?: string, width?: number, height?: number, rotation?: number }>} */ (event());

/** The sensor's own reading, the latest one: `{ iso, exposureTime, aperture, luma, aeState }`. */
export const cameraMeter = /** @type {Signal<Record<string, unknown>>} */ (signal({}));

/** How the phone is held, the latest reading: `{ rotation: 0 | 90 | 180 | 270 }`. */
export const cameraOrientation = /** @type {Signal<{ rotation?: number }>} */ (signal({}));

let installed = false;

/**
 * Feed the signals from the shell's camera events, once. The native backend
 * calls this when it starts; `on` is the shell's listener installer, injected
 * so a test can drive a fake shell.
 * @param {(event: string, fn: (payload: unknown) => void) => () => void} [on]
 * @returns {void}
 */
export const installCameraSignals = (on = (name, fn) => mobile.on(name, fn)) => {
  if (installed) return;
  installed = true;
  on("camera:frame", (payload) => cameraFrame.emit(/** @type {{ data?: string, width?: number, height?: number, rotation?: number }} */ (payload)));
  on("camera:meter", (payload) => { cameraMeter.value = /** @type {Record<string, unknown>} */ (payload ?? {}); });
  on("camera:orientation", (payload) => { cameraOrientation.value = /** @type {{ rotation?: number }} */ (payload ?? {}); });
};
