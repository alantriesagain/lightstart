/**
 * Web camera backend: drives real hardware through getUserMedia, MediaStreamTrack
 * capabilities/constraints, ImageCapture (stills) and MediaRecorder (video).
 *
 * It implements the CameraBackend interface (see select-backend.js); the native
 * backend implements the same shape so the UI never changes.
 */

import { parseExif } from "./lib/exif.js";
import { classifyLens } from "./lib/lens-model.js";

/** @import { CameraStartOptions, RecordingOptions, CameraBackend } from "./types.ts" */

const MIME_CANDIDATES = [
  { mime: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", ext: "mp4" },
  { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
  { mime: "video/webm;codecs=vp8,opus", ext: "webm" },
  { mime: "video/webm", ext: "webm" },
];

const pickMime = () => {
  if (typeof MediaRecorder === "undefined") return null;
  for (const c of MIME_CANDIDATES) if (MediaRecorder.isTypeSupported(c.mime)) return c;
  return { mime: "", ext: "webm" };
};

const nowMs = () =>
  typeof performance !== "undefined" && performance.now ? performance.now() : 0;

export const isSupported = () =>
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

/** @typedef {{ grabFrame?: () => Promise<ImageBitmap>, takePhoto?: () => Promise<Blob> }} Capture */
/** @typedef {OffscreenCanvas | HTMLCanvasElement} AnyCanvas */

/**
 * @returns {CameraBackend}
 */
export const createWebBackend = () => {
  /** @type {MediaStream | null} */
  let stream = null;
  /** @type {MediaStreamTrack | null} */
  let track = null;
  /** @type {Capture | null} */
  let imageCapture = null;
  /** @type {MediaRecorder | null} */
  let recorder = null;
  /** @type {Blob[]} */
  let chunks = [];
  let recMime = "";
  let recExt = "webm";
  let recStartAt = 0;
  /** @type {HTMLVideoElement | null} */
  let attachedEl = null;

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

  /** @param {HTMLVideoElement | null} el */
  const attachTo = (el) => {
    attachedEl = el || null;
    if (attachedEl && stream) {
      attachedEl.srcObject = stream;
      attachedEl.muted = true;
      attachedEl.playsInline = true;
      attachedEl.play?.().catch(() => {});
    }
  };

  const stop = () => {
    try { if (recorder?.state === "recording") recorder.stop(); } catch {}
    try { stream?.getTracks().forEach((t) => t.stop()); } catch {}
    if (attachedEl) attachedEl.srcObject = null;
    stream = null;
    track = null;
    imageCapture = null;
    recorder = null;
    emit("stopped", {});
  };

  /** @param {CameraStartOptions} [opts] */
  const start = async (opts = {}) => {
    if (!isSupported()) throw new Error("camera-unsupported");
    stop();
    const { deviceId, facingMode = "environment", width, height, frameRate, audio = false } = opts;
    /** @type {Record<string, unknown>} */
    const video = deviceId ? { deviceId: { exact: deviceId } } : { facingMode };
    if (width) video.width = { ideal: width };
    if (height) video.height = { ideal: height };
    if (frameRate) video.frameRate = { ideal: frameRate };

    stream = await navigator.mediaDevices.getUserMedia({ video: /** @type {MediaTrackConstraints} */ (video), audio });
    track = stream.getVideoTracks()[0] || null;

    const IC = /** @type {typeof ImageCapture | undefined} */ (globalThis.ImageCapture);
    if (track && typeof IC === "function")
      try { imageCapture = new IC(track); } catch { imageCapture = null; }

    if (attachedEl) attachTo(attachedEl);
    emit("started", { stream, track });
    return { stream, track };
  };

  const getStream = () => stream;

  const getCapabilities = () => {
    try { return track?.getCapabilities?.() || {}; } catch { return {}; }
  };
  const getSettings = () => {
    try {
      const { aspectRatio: _aspectRatio, ...settings } = track?.getSettings?.() ?? {};
      return settings;
    } catch { return {}; }
  };

  /** @param {string} key @param {unknown} value */
  const applyControl = async (key, value) => {
    if (!track?.applyConstraints) throw new Error("constraints-unsupported");
    await track.applyConstraints({ advanced: [/** @type {MediaTrackConstraintSet} */ ({ [key]: value })] });
    return getSettings();
  };

  /** @param {number} w @param {number} h @returns {AnyCanvas} */
  const makeCanvas = (w, h) => {
    if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(w, h);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  };

  /** @param {AnyCanvas} canvas @returns {Promise<Blob | null>} */
  const canvasToBlob = (canvas) => {
    if ("convertToBlob" in canvas) return canvas.convertToBlob({ type: "image/jpeg", quality: 0.95 });
    return new Promise((resolve) =>
      /** @type {HTMLCanvasElement} */ (canvas).toBlob((b) => resolve(b), "image/jpeg", 0.95));
  };

  const grabFrameBlob = async () => {
    if (imageCapture?.grabFrame)
      try {
        const bitmap = await imageCapture.grabFrame();
        const canvas = makeCanvas(bitmap.width, bitmap.height);
        /** @type {OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null} */ (/** @type {AnyCanvas} */ (canvas).getContext("2d"))?.drawImage(bitmap, 0, 0);
        return canvasToBlob(canvas);
      } catch {}
    if (!track) return null;
    const v = document.createElement("video");
    v.srcObject = new MediaStream([track]);
    v.muted = true;
    v.playsInline = true;
    await v.play().catch(() => {});
    if (v.readyState < 2)
      await new Promise((r) => v.addEventListener("loadeddata", () => r(null), { once: true }));
    const w = v.videoWidth || 1280;
    const h = v.videoHeight || 720;
    const canvas = makeCanvas(w, h);
    /** @type {OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null} */ (/** @type {AnyCanvas} */ (canvas).getContext("2d"))?.drawImage(v, 0, 0, w, h);
    v.srcObject = null;
    return canvasToBlob(canvas);
  };

  const capturePhoto = async () => {
    if (!track) throw new Error("not-started");
    /** @type {Blob | null} */
    let blob = null;
    if (imageCapture?.takePhoto)
      try { blob = await imageCapture.takePhoto(); } catch { blob = null; }
    if (!blob) blob = await grabFrameBlob();
    const exif = blob ? await parseExif(blob).catch(() => null) : null;
    return { blob, exif, settings: getSettings() };
  };

  /** @param {RecordingOptions} [recOpts] */
  const startRecording = async (recOpts = {}) => {
    if (!stream) throw new Error("not-started");
    const picked = pickMime();
    if (!picked) throw new Error("recorder-unsupported");
    chunks = [];
    recMime = picked.mime;
    recExt = picked.ext;
    recorder = new MediaRecorder(stream, picked.mime ? { mimeType: picked.mime } : undefined);
    recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    recStartAt = nowMs();
    recorder.start(recOpts.timeslice || 250);
    emit("recording-started", {});
  };

  const stopRecording = () =>
    new Promise((resolve) => {
      if (!recorder) return resolve(null);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recMime || "video/webm" });
        const durationMs = nowMs() - recStartAt;
        recorder = null;
        emit("recording-stopped", { blob, durationMs, ext: recExt });
        resolve({ blob, durationMs, mime: recMime, ext: recExt });
      };
      try {
        if (recorder.state === "recording") recorder.stop();
        else resolve(null);
      } catch { resolve(null); }
    });

  const listLenses = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    return devices
      .filter((d) => d.kind === "videoinput")
      .map((d) => ({ deviceId: d.deviceId, label: d.label, ...classifyLens(d.label) }));
  };

  /** @param {string} deviceId */
  const switchLens = (deviceId) => start({ deviceId });

  return {
    kind: "web",
    isSupported,
    on,
    start,
    stop,
    setBounds: () => {},
    attachTo,
    getStream,
    getCapabilities,
    getSettings,
    applyControl,
    capturePhoto,
    startRecording,
    stopRecording,
    listLenses,
    switchLens,
  };
};
