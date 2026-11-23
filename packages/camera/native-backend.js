/**
 * Native camera backend: drives real hardware through the light mobile shell
 * bridge (`mobile.request`, CameraX + Camera2 interop on Android).
 *
 * Implements the same CameraBackend interface as the web backend, so the UI
 * never changes. The preview is a native surface rendered BEHIND a transparent
 * WebView: `getStream()` returns null, `attachTo()` is a no-op, and this backend
 * toggles `html.native-camera` so app CSS can open a transparent hole for the
 * feed. Captures are written natively and served at `/__mobile/native/<file>`,
 * then fetched into a Blob so EXIF parsing and IndexedDB storage work unchanged.
 *
 * Unit contract with the shell addon (mirrors the MediaTrack-style keys read by
 * `resolveControls`): zoom = ratio, exposureCompensation = EV, iso = ISO,
 * exposureTime = seconds, colorTemperature = Kelvin, focusDistance = diopters
 * (0 = infinity), torch = boolean, keep = `jpeg` or `raw` (a DNG written beside
 * the JPEG, where the camera lists the RAW output format), view = the preview
 * magnified on the screen (1 to 4), which touches nothing of the camera.
 *
 * With `frames: { width, fps }` the backend also asks the addon for the
 * preview's frames (`CAMERA:FRAMES`, JPEG at that width and rate), draws
 * each on a canvas turned the right way up, and answers `getStream()` with
 * the canvas's stream: a real `MediaStream` of the native camera, for a page
 * that sends its picture to another phone.
 */

import { parseExif } from "./lib/exif.js";
import {
  CAMERA_START, CAMERA_BOUNDS, CAMERA_STOP, CAMERA_SET,
  CAMERA_CAPTURE, CAMERA_RECORD_START, CAMERA_RECORD_STOP, CAMERA_LENSES, CAMERA_FRAMES, CAMERA_VIEW,
} from "./commands.js";
import { cameraFrame, installCameraSignals } from "./signals.js";
import { mobile } from "@lightstart/mobile/page";

/** @import { CameraStartOptions, RecordingOptions, CameraBackend, CameraCapabilities, CameraSettings } from "./types.ts" */
/** @import { MobileApi } from "@lightstart/mobile/page" */

export const isNativeCameraSupported = () => mobile.present && mobile.can("camera");

const REQUEST_TIMEOUT = 10000;
const SLOW_TIMEOUT = 30000;

/** @param {string} url @returns {Promise<Blob>} */
const fetchServed = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`capture fetch failed (${res.status})`);
  return res.blob();
};

/**
 * @param {{ frames?: { width?: number, fps?: number } }} [opts]
 * @param {MobileApi} [mobileApi] the shell bridge, injected so a test can drive a fake
 * @returns {CameraBackend}
 */
export const createNativeBackend = (opts = {}, mobileApi = mobile) => {
  /** @type {CameraCapabilities} */
  let capabilities = {};
  /** @type {CameraSettings} */
  let settings = {};
  let started = false;
  let recStartAt = 0;
  const frames = opts.frames ? { width: opts.frames.width || 640, fps: opts.frames.fps || 15 } : null;
  /** @type {HTMLCanvasElement | null} */
  let canvas = null;
  /** @type {MediaStream | null} */
  let stream = null;
  /** @type {(() => void) | null} */
  let offFrames = null;

  /** @param {unknown} type @param {unknown} payload @param {number} [timeout] @returns {Promise<unknown>} */
  const request = (type, payload, timeout = REQUEST_TIMEOUT) => {
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timer;
    const late = new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`the shell did not answer ${String(type)} within ${String(timeout)} ms`)), timeout);
    });
    return Promise.race([mobileApi.request(String(type), [payload]), late]).finally(() => clearTimeout(timer));
  };

  /** @param {unknown} type @param {unknown} payload @returns {void} */
  const post = (type, payload) => { void mobileApi.request(String(type), [payload]).catch(() => {}); };

  /** @param {{ data?: string, width?: number, height?: number, rotation?: number }} frame */
  const draw = async (frame) => {
    if (!canvas || !frame.data) return;
    const text = atob(frame.data);
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" })).catch(() => null);
    if (!bitmap || !canvas) return;
    const rotation = Number(frame.rotation) || 0;
    const turned = rotation === 90 || rotation === 270;
    const w = turned ? bitmap.height : bitmap.width;
    const h = turned ? bitmap.width : bitmap.height;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    ctx.restore();
    bitmap.close();
  };

  const startFrames = async () => {
    if (!frames) return;
    installCameraSignals(mobileApi.on);
    canvas ??= document.createElement("canvas");
    canvas.width = frames.width;
    canvas.height = Math.round((frames.width * 4) / 3);
    stream ??= canvas.captureStream(frames.fps);
    offFrames?.();
    offFrames = cameraFrame.on((frame) => { void draw(frame); });
    await request(CAMERA_FRAMES, { on: true, width: frames.width, fps: frames.fps });
  };

  const stopFrames = () => {
    if (!frames) return;
    offFrames?.();
    offFrames = null;
    post(CAMERA_FRAMES, { on: false });
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = null;
  };

  /** @type {Map<string, Array<(data: unknown) => void>>} */
  const listeners = new Map();
  /** @param {string} type @param {unknown} data */
  const emit = (type, data) => (listeners.get(type) || []).forEach((cb) => cb(data));
  /** @param {string} type @param {(data: unknown) => void} cb */
  const on = (type, cb) => {
    const arr = listeners.get(type) || [];
    arr.push(cb);
    listeners.set(type, arr);
    return () => listeners.set(type, (listeners.get(type) || []).filter((f) => f !== cb));
  };

  /** @param {boolean} active */
  const setNativeClass = (active) => {
    try { document.documentElement.classList.toggle("native-camera", active); }
    catch {}
  };

  /** @param {CameraStartOptions} [opts] */
  const start = async (opts = {}) => {
    const res = /** @type {{ capabilities?: CameraCapabilities, settings?: CameraSettings } | null} */ (await request(CAMERA_START, {
      deviceId: opts.deviceId || null,
      facingMode: opts.facingMode || "environment",
      width: opts.width || 0,
      height: opts.height || 0,
      frameRate: opts.frameRate || 0,
      keep: opts.keep || "jpeg",
      orientation: opts.orientation || "",
    }, SLOW_TIMEOUT));
    capabilities = res?.capabilities || {};
    settings = res?.settings || {};
    started = true;
    setNativeClass(true);
    await startFrames();
    const track = stream?.getVideoTracks()[0] ?? null;
    emit("started", { stream, track });
    return { stream, track };
  };

  /** @param {{ x?: number, y?: number, width?: number, height?: number } | null} rect */
  const setBounds = (rect) => {
    post(CAMERA_BOUNDS, rect ?? {});
  };

  const stop = () => {
    if (!started) return;
    started = false;
    stopFrames();
    setNativeClass(false);
    post(CAMERA_STOP, {});
    emit("stopped", {});
  };

  /** @param {string} key @param {unknown} value */
  const applyControl = async (key, value) => {
    if (key === "view") {
      await request(CAMERA_VIEW, { scale: Number(value) || 1 });
      return settings;
    }
    const res = /** @type {{ settings?: CameraSettings } | null} */ (await request(CAMERA_SET, { key, value }));
    settings = res?.settings || settings;
    return settings;
  };

  /** @param {{ keep?: import("./types.ts").KeepFormat }} [opts] */
  const capturePhoto = async (opts = {}) => {
    const res = /** @type {{ url?: string, rawUrl?: string, width?: number, height?: number } | null} */ (await request(CAMERA_CAPTURE, { keep: opts.keep || "jpeg" }, SLOW_TIMEOUT));
    const blob = res?.url ? await fetchServed(res.url) : null;
    const raw = res?.rawUrl ? await fetchServed(res.rawUrl).catch(() => null) : null;
    const exif = blob ? await parseExif(blob).catch(() => null) : null;
    return {
      blob,
      raw,
      exif,
      served: res?.url || "",
      settings: { ...settings, width: res?.width || settings.width, height: res?.height || settings.height },
    };
  };

  /** @param {RecordingOptions} [recOpts] */
  const startRecording = async (recOpts = {}) => {
    await request(CAMERA_RECORD_START, { audio: recOpts.audio !== false });
    recStartAt = Date.now();
    emit("recording-started", {});
  };

  const stopRecording = async () => {
    const res = /** @type {{ url?: string, durationMs?: number, mime?: string, ext?: string } | null} */ (await request(CAMERA_RECORD_STOP, {}, SLOW_TIMEOUT));
    if (!res?.url) {
      emit("recording-stopped", null);
      return null;
    }
    const blob = await fetchServed(res.url);
    const result = {
      blob,
      served: res.url,
      durationMs: res.durationMs || Date.now() - recStartAt,
      mime: res.mime || "video/mp4",
      ext: res.ext || "mp4",
    };
    emit("recording-stopped", result);
    return result;
  };

  const listLenses = async () => {
    const res = /** @type {{ lenses?: import("./types.ts").LensDevice[] } | null} */ (await request(CAMERA_LENSES, {}));
    return Array.isArray(res?.lenses) ? res.lenses : [];
  };

  /** @param {string} deviceId */
  const switchLens = (deviceId) => start({ deviceId });

  return {
    kind: "native",
    isSupported: () => mobileApi.present && mobileApi.can("camera"),
    on,
    start,
    stop,
    setBounds,
    attachTo: (el) => { if (el && stream && el.srcObject !== stream) el.srcObject = stream; },
    getStream: () => stream,
    getCapabilities: () => capabilities,
    getSettings: () => settings,
    applyControl,
    capturePhoto,
    startRecording,
    stopRecording,
    listLenses,
    switchLens,
  };
};
