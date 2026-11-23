/**
 * A camera that is another phone, behind the same `CameraBackend` contract
 * as the lens: the stream, the settings and the shutter `cameraLink` holds
 * once the other phone has opened this app's link. Its capabilities, lenses
 * and settings are the other phone's camera's, in that camera's own units
 * (a web camera's), a control set here is set there, a press answers with
 * the photo the other phone took and sent, and a recording runs there and
 * comes back as the clip when it stops.
 */

/** @import { CameraBackend, CameraCapabilities, CameraLinkSlot, CameraSettings } from "../types.ts" */

const CAPS_WAIT_MS = 6000;

/**
 * @param {{ link: () => CameraLinkSlot | undefined }} deps `link` answers the `cameraLink` controller, read on every call
 * @returns {CameraBackend}
 */
export const createLinkBackend = (deps) => {
  const { link } = deps;
  const need = () => {
    const l = link();
    if (!l) throw new Error("link-unavailable");
    return l;
  };
  /** @type {Map<string, Set<(data: unknown) => void>>} */
  const listeners = new Map();
  /** @param {string} type @param {unknown} data */
  const emit = (type, data) => { for (const cb of listeners.get(type) ?? []) cb(data); };
  /** @type {(() => void) | null} */
  let offStream = null;
  let live = false;

  /** @type {(() => void) | null} */
  let offCaps = null;
  let recStartAt = 0;

  const getSettings = () => /** @type {CameraSettings} */ ({ ...(link()?.settings ?? {}), facingMode: link()?.camera.facing === "user" ? "user" : "environment" });

  const capsKnown = () => Object.keys(link()?.capabilities ?? {}).length > 0;
  const untilCaps = () => new Promise((resolve) => {
    const l = link();
    if (capsKnown() || !l?.$state) return resolve(undefined);
    const timer = setTimeout(() => { off(); resolve(undefined); }, CAPS_WAIT_MS);
    const off = l.$state.subscribe("capabilities", () => { if (capsKnown()) { clearTimeout(timer); off(); resolve(undefined); } });
  });

  /** @param {string} deviceId */
  const untilLens = (deviceId) => new Promise((resolve) => {
    const l = link();
    if (!l?.$state || l.settings.deviceId === deviceId) return resolve(undefined);
    const timer = setTimeout(() => { off(); resolve(undefined); }, CAPS_WAIT_MS);
    const off = l.$state.subscribe("settings", () => { if (l.settings.deviceId === deviceId) { clearTimeout(timer); off(); resolve(undefined); } });
  });

  /** @param {{ deviceId?: string, width?: number, height?: number, frameRate?: number }} [constraints] */
  const start = async (constraints = {}) => {
    const l = need();
    if (!l.isConnected()) throw new Error("link-not-connected");
    offStream?.();
    offStream = l.$state?.subscribe("stream", (stream) => emit("stream", stream)) ?? null;
    offCaps?.();
    offCaps = l.$state?.subscribe("capabilities", () => emit("capabilities", l.capabilities)) ?? null;
    await l.live(true);
    live = true;
    await untilCaps();
    const wanted = constraints.deviceId;
    if (wanted && wanted !== l.settings.deviceId && l.lenses.some((lens) => lens.deviceId === wanted)) {
      await l.selectLens(wanted);
      await untilLens(wanted);
    }
    if (constraints.width && constraints.height) await l.applyControl("video", { width: constraints.width, height: constraints.height, frameRate: constraints.frameRate || 0 });
    emit("started", {});
    return { stream: l.stream, track: l.stream?.getVideoTracks()[0] ?? null };
  };

  const stop = () => {
    offStream?.();
    offStream = null;
    offCaps?.();
    offCaps = null;
    if (live) {
      live = false;
      void Promise.resolve(link()?.live(false)).catch(() => {});
    }
    emit("stopped", {});
  };

  const capturePhoto = async () => {
    const photo = await need().shoot(0);
    return { blob: photo?.blob ?? null, exif: null, settings: getSettings() };
  };

  return {
    kind: "link",
    isSupported: () => !!link(),
    on: (type, cb) => {
      const set = listeners.get(type) ?? new Set();
      set.add(cb);
      listeners.set(type, set);
      return () => set.delete(cb);
    },
    start,
    stop,
    setBounds: () => {},
    attachTo: () => {},
    getStream: () => link()?.stream ?? null,
    getCapabilities: () => /** @type {CameraCapabilities} */ (link()?.capabilities ?? {}),
    getSettings,
    applyControl: async (key, value) => {
      await need().applyControl(key, value);
      return getSettings();
    },
    capturePhoto,
    startRecording: async () => {
      await need().startRecording();
      recStartAt = Date.now();
      emit("recording-started", {});
    },
    stopRecording: async () => {
      const clip = await need().stopRecording();
      const result = clip ? { blob: clip.blob, durationMs: clip.durationMs || Date.now() - recStartAt, mime: clip.mime, ext: clip.ext } : null;
      emit("recording-stopped", result);
      return result;
    },
    listLenses: async () => link()?.lenses ?? [],
    switchLens: (deviceId) => start({ deviceId }),
  };
};
