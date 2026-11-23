/**
 * Backend selection: the one seam that makes the native swap a contained change.
 *
 * The UI only ever talks to the object returned by createCamera() in camera.js,
 * which wraps whatever backend selectBackend() returns: the web backend
 * (getUserMedia) in a browser, the native backend (CameraX over the mobile
 * shell's bridge) inside a light mobile shell.
 */

import { createWebBackend, isSupported } from "./web-backend.js";
import { createNativeBackend } from "./native-backend.js";
import { createLinkBackend } from "./lib/link-backend.js";
import { linkSlot } from "./lib/link-slot.js";
import { mobile } from "@lightstart/mobile/page";

/** @import { CameraBackend } from "./types.ts" */

/** True when running inside a light mobile shell. */
export const isNativeShell = () => mobile.present;

/** True when the surrounding shell declares the `camera` capability. */
export const hasNativeCamera = () => mobile.can("camera");

/**
 * Pick the backend for this environment. `backend: "web"` keeps getUserMedia
 * inside a native shell too, for a caller that needs the stream in the page
 * (sending it to another phone); the native preview is a surface behind the
 * page and has none. `source: { kind: "device", id }` is another camera a
 * devices package would run, which light has no backend for yet;
 * `source: { kind: "link" }` is another phone that opened this app's camera
 * link, the `cameraLink` controller's slot read lazily.
 * @param {Record<string, unknown>} [opts]
 * @returns {CameraBackend}
 */
export const selectBackend = (opts = {}) => {
  const source = /** @type {{ kind?: string, id?: string } | undefined} */ (opts.source);
  if (source?.kind === "device") throw new Error("camera: a devices backend isn't available yet");
  if (source?.kind === "link") return createLinkBackend({ link: linkSlot });
  if (opts.backend !== "web" && hasNativeCamera()) return createNativeBackend(/** @type {{ frames?: { width?: number, fps?: number } }} */ (opts));
  return createWebBackend();
};

export { isSupported };
