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
 * A device backend whose module, and so `@lightstart/devices`, loads only
 * when a device source is asked for. Its synchronous readings answer before
 * the module lands; everything that starts or asks the camera awaits it.
 * @param {{ id?: string }} source
 * @returns {CameraBackend}
 */
const createDeferredDeviceBackend = (source) => {
  /** @type {CameraBackend | null} */
  let backend = null;
  /** @type {HTMLVideoElement | null} */
  let attached = null;
  let starts = 0;
  /** @type {Map<string, Set<(data: unknown) => void>>} */
  const listeners = new Map();
  /** @type {Set<string>} */
  const wired = new Set();
  /** @param {string} type @param {unknown} data */
  const emit = (type, data) => { for (const cb of listeners.get(type) ?? []) cb(data); };
  /** @param {CameraBackend} b */
  const wire = (b) => {
    for (const type of listeners.keys()) {
      if (wired.has(type)) continue;
      wired.add(type);
      b.on(type, (data) => emit(type, data));
    }
    if (attached) b.attachTo(attached);
  };
  const ready = /** @type {Promise<CameraBackend>} */ (import("./lib/device-backend.js").then((module) => {
    const b = module.createDeviceBackend(source);
    backend = b;
    wire(b);
    return b;
  }));
  ready.catch(() => {});
  return {
    kind: "device",
    isSupported: () => !!backend?.isSupported(),
    on: (type, cb) => {
      const set = listeners.get(type) ?? new Set();
      set.add(cb);
      listeners.set(type, set);
      if (backend) wire(backend);
      return () => { set.delete(cb); };
    },
    start: async (constraints) => {
      const mine = ++starts;
      const b = await ready;
      if (mine !== starts) throw new Error("the camera was stopped before it started");
      return b.start(constraints);
    },
    stop: () => {
      starts++;
      return backend?.stop();
    },
    attachTo: (el) => { attached = el; backend?.attachTo(el); },
    getStream: () => backend?.getStream() ?? null,
    getCapabilities: () => backend?.getCapabilities() ?? /** @type {import("./types.ts").CameraCapabilities} */ ({}),
    getSettings: () => backend?.getSettings() ?? {},
    applyControl: async (key, value) => (await ready).applyControl(key, value),
    capturePhoto: async (opts) => (await ready).capturePhoto(opts),
    startRecording: async (opts) => (await ready).startRecording(opts),
    stopRecording: async () => (await ready).stopRecording(),
    listLenses: async () => (await ready).listLenses(),
    switchLens: async (deviceId) => (await ready).switchLens(deviceId),
    setBounds: (rect) => backend?.setBounds?.(rect),
  };
};

/**
 * Pick the backend for this environment. `backend: "web"` keeps getUserMedia
 * inside a native shell too, for a caller that needs the stream in the page
 * (sending it to another phone); the native preview is a surface behind the
 * page and has none. `source: { kind: "device", id }` is a camera a
 * `@lightstart/devices` driver runs, its module loaded on demand;
 * `source: { kind: "link" }` is another phone that opened this app's camera
 * link, the `cameraLink` controller's slot read lazily.
 * @param {Record<string, unknown>} [opts]
 * @returns {CameraBackend}
 */
export const selectBackend = (opts = {}) => {
  const source = /** @type {{ kind?: string, id?: string } | undefined} */ (opts.source);
  if (source?.kind === "device") return createDeferredDeviceBackend(source);
  if (source?.kind === "link") return createLinkBackend({ link: linkSlot });
  if (opts.backend !== "web" && hasNativeCamera()) return createNativeBackend(/** @type {{ frames?: { width?: number, fps?: number } }} */ (opts));
  return createWebBackend();
};

export { isSupported };
