/**
 * A camera that is another device: any driver `@lightstart/devices` runs,
 * behind the same `CameraBackend` contract as the phone's lens, so the
 * readout, the dial and the lesson work on it unchanged. The picture is the
 * shell's own surface behind the page; the page gets no stream. A press keeps
 * the preview's frame at once and asks the camera for the full-size file,
 * which stays on it until an import brings it over.
 */

import devices from "@lightstart/devices/controllers/devices.js";

/** @import { CameraBackend, CameraCapabilities, CameraSettings, DevicesSlot, LensDevice, PhotoResult, RecordingResult, StartResult } from "../types.ts" */

const LENS_MM = /** @type {Record<string, number>} */ ({ hyperview: 12, "max superview": 13, superview: 13, wide: 16, linear: 24, "linear + horizon lock": 24, "linear + horizon leveling": 24, narrow: 34 });

const KEY_OF = /** @type {Record<string, string>} */ ({ iso: "iso", isomax: "iso", "iso max": "iso", shutter: "exposureTime", wb: "colorTemperature", "white balance": "colorTemperature", ev: "exposureCompensation", "ev comp": "exposureCompensation", lens: "lens" });

/** @param {string} label */
const numberOf = (label) => {
  const s = label.trim().toLowerCase();
  if (s === "auto") return "auto";
  const frac = s.match(/^1\/(\d+)/);
  if (frac) return 1 / Number(frac[1]);
  const k = s.match(/^(\d+)\s*k$/);
  if (k) return Number(k[1]);
  const n = s.match(/-?\d+(\.\d+)?/);
  return n ? Number(n[0]) : null;
};

/** @param {string} url @returns {Promise<Blob | null>} */
const blobOf = async (url) => {
  try {
    return await (await fetch(url)).blob();
  } catch {
    return null;
  }
};

/**
 * @param {{ id?: string }} [source]
 * @param {{ devices?: DevicesSlot, wait?: (ms: number) => Promise<void> }} [deps] `devices` is the `devices` controller handle, injected so a test can drive a fake
 * @returns {CameraBackend}
 */
export const createDeviceBackend = (source = {}, deps = {}) => {
  const real = /** @type {DevicesSlot} */ (/** @type {unknown} */ (devices));
  const slot = deps.devices ?? real;
  const need = () => {
    if (!slot) throw new Error("devices-unavailable");
    return slot;
  };
  const wait = deps.wait ?? ((/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms)));
  /** @type {Map<string, Set<(data: unknown) => void>>} */
  const listeners = new Map();
  /** @param {string} type @param {unknown} data */
  const emit = (type, data) => { for (const cb of listeners.get(type) ?? []) cb(data); };
  /** @type {(() => void) | null} */
  let offControls = null;
  let recStartAt = 0;

  const deviceId = () => String(source.id || slot?.device?.id || "device");
  /** @returns {Array<{ id: string, label: string, options: Array<{ value: number | string, label: string }>, value: number | string | null }>} */
  const controls = () => slot?.controls ?? [];
  /** @param {string} key */
  const controlFor = (key) => controls().find((c) => KEY_OF[c.id.toLowerCase()] === key || KEY_OF[c.label.toLowerCase()] === key) ?? null;

  const getCapabilities = () => {
    /** @type {Record<string, unknown>} */
    const caps = {};
    for (const c of controls()) {
      const key = KEY_OF[c.id.toLowerCase()] ?? KEY_OF[c.label.toLowerCase()];
      if (!key || key === "lens") continue;
      caps[key] = { options: c.options.map((o) => ({ value: numberOf(o.label), label: o.label, raw: o.value })) };
    }
    return /** @type {CameraCapabilities} */ (caps);
  };

  const getSettings = () => {
    /** @type {Record<string, unknown>} */
    const s = { deviceId: `device:${deviceId()}` };
    for (const c of controls()) {
      const key = KEY_OF[c.id.toLowerCase()] ?? KEY_OF[c.label.toLowerCase()];
      if (!key || key === "lens" || c.value == null) continue;
      const current = c.options.find((o) => o.value === c.value);
      const n = current ? numberOf(current.label) : null;
      if (typeof n === "number") s[key] = n;
    }
    return /** @type {CameraSettings} */ (s);
  };

  const listLenses = async () => {
    const lens = controlFor("lens");
    if (!lens) return [];
    return lens.options.map((o) => {
      const name = o.label.toLowerCase();
      const mm = LENS_MM[name] ?? (Object.entries(LENS_MM).find(([k]) => name.includes(k))?.[1] ?? 16);
      return /** @type {LensDevice} */ ({ deviceId: `lens:${o.value}`, label: o.label, lensType: name, lensLabel: o.label, nominalMm: mm, zoomRatio: 1 });
    });
  };

  const start = async () => {
    const d = need();
    if (!d.isReady?.()) throw new Error("device-not-ready");
    const ok = await d.startPreview({ fit: "contain", expires: false });
    if (!ok) throw new Error(d.error || "preview-failed");
    for (let i = 0; i < 200 && d.previewState !== "live"; i++) {
      if (d.previewState === "error" || d.previewState === "off") throw new Error(d.error || "preview-lost");
      await wait(100);
    }
    offControls?.();
    offControls = d.$state?.subscribe?.("controls", () => emit("capabilities", getCapabilities())) ?? null;
    const result = /** @type {StartResult} */ ({ stream: null, track: null });
    emit("started", result);
    return result;
  };

  const stop = () => {
    offControls?.();
    offControls = null;
    void slot?.stopPreview?.();
    emit("stopped", {});
  };

  return {
    kind: "device",
    isSupported: () => !!slot?.available,
    on: (type, cb) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      /** @type {Set<(data: unknown) => void>} */ (listeners.get(type)).add(cb);
      return () => { listeners.get(type)?.delete(cb); };
    },
    start,
    stop,
    attachTo: () => {},
    getStream: () => null,
    getCapabilities,
    getSettings,
    async applyControl(key, value) {
      const control = controlFor(key);
      if (!control) throw new Error(`control-unsupported:${key}`);
      const wanted = value === "auto" || value === 0 ? "auto" : Number(value);
      let best = control.options[0];
      let bestD = Infinity;
      for (const o of control.options) {
        const n = numberOf(o.label);
        const d = wanted === "auto" ? (n === "auto" ? 0 : Infinity) : typeof n === "number" && typeof wanted === "number" ? Math.abs(Math.log2(Math.max(n, 1e-9) / Math.max(wanted, 1e-9))) : Infinity;
        if (d < bestD) { best = o; bestD = d; }
      }
      const d = need();
      const ok = await d.setControl(control.id, best.value);
      if (!ok) throw new Error(d.error || "control-refused");
      return getSettings();
    },
    async capturePhoto() {
      const d = need();
      const frame = await d.capturePreviewFrame();
      const url = typeof frame === "string" ? frame : frame?.url ?? null;
      const blob = url ? await blobOf(url) : null;
      const at = new Date().toISOString();
      void Promise.resolve(d.capturePhoto?.()).catch(() => {});
      return /** @type {PhotoResult} */ ({ blob, exif: null, settings: getSettings(), pending: { deviceId: deviceId(), at } });
    },
    async startRecording() {
      await need().startRecording();
      recStartAt = Date.now();
      emit("recording-started", {});
    },
    async stopRecording() {
      await need().stopRecording();
      const result = /** @type {RecordingResult} */ ({ blob: null, durationMs: Date.now() - recStartAt, mime: "video/mp4", ext: "mp4", pending: { deviceId: deviceId(), at: new Date(recStartAt).toISOString() } });
      emit("recording-stopped", result);
      return result;
    },
    listLenses,
    async switchLens(id) {
      const lens = controlFor("lens");
      if (!lens) throw new Error("control-unsupported:lens");
      const value = id.replace(/^lens:/, "");
      const option = lens.options.find((o) => String(o.value) === value);
      if (!option) throw new Error(`lens-unknown:${id}`);
      await need().setControl(lens.id, option.value);
      return { stream: null, track: null };
    },
    setBounds(rect) {
      slot?.setPreviewBounds?.(rect ? { ...rect, fit: "contain" } : null);
    },
  };
};
