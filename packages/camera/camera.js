/**
 * @lightstart/camera entry.
 *
 * createCamera() wraps the selected hardware backend and layers the learning
 * intelligence on top: it resolves which controls are real on this device versus
 * simulated, and converts zoom + the active lens into an effective focal length.
 */

import { selectBackend, isSupported, isNativeShell } from "./select-backend.js";
import { CONTROLS, controlById } from "./lib/controls.js";
import { classifyLens, describeZoom, effectiveMm, focalLengthHint, lensChipLabel, lensFromMm } from "./lib/lens-model.js";

/** @import { CameraInstance, EnrichedLens, LensDevice, ResolvedControl } from "./types.ts" */

/** @param {unknown} cap @returns {{ min: number, max: number, step: number } | null} */
const normalizeRange = (cap) => {
  if (!cap || typeof cap !== "object" || !("max" in cap)) return null;
  const range = /** @type {{ min?: unknown, max?: unknown, step?: unknown }} */ (cap);
  const min = Number(range.min ?? 0);
  const max = Number(range.max ?? 1);
  const step = range.step != null ? Number(range.step) : (max - min) / 100 || 0.1;
  return { min, max, step };
};

/**
 * @param {Record<string, unknown>} [opts]
 * @returns {CameraInstance}
 */
export const createCamera = (opts = {}) => {
  const backend = selectBackend(opts);
  /** @type {EnrichedLens | null} */
  let activeLens = null;

  /** @param {LensDevice} l @returns {EnrichedLens} */
  const enrichLens = (l) => {
    const info = l.nominalMm ? lensFromMm(l.nominalMm) : classifyLens(l.label || "");
    return { ...info, ...l, chipLabel: lensChipLabel({ ...info, ...l }) };
  };

  /** @param {import("./types.ts").CameraStartOptions} [constraints] */
  const start = async (constraints) => {
    const res = await backend.start(constraints);
    const lenses = (await backend.listLenses().catch(() => [])).map(enrichLens);
    const settings = backend.getSettings();
    activeLens =
      lenses.find((l) => l.deviceId && l.deviceId === settings.deviceId) ||
      lenses.find((l) => Math.abs((l.zoomRatio || 1) - 1) < 0.15) ||
      lenses[0] ||
      enrichLens({ deviceId: "", label: "", lensType: "unknown", lensLabel: "Camera", nominalMm: 26 });
    return { ...res, lenses, activeLens };
  };

  /** @returns {ResolvedControl[]} */
  const resolveControls = () => {
    const caps = backend.getCapabilities();
    return CONTROLS.map((c) => {
      const cap = c.hardwareKey ? caps[c.hardwareKey] : undefined;
      const supported = !c.simulate && cap != null;
      return {
        ...c,
        supported,
        simulated: !supported,
        range: normalizeRange(cap),
        capability: cap ?? null,
      };
    });
  };

  const currentMm = () => {
    const s = backend.getSettings();
    const nominal = activeLens?.nominalMm || 26;
    const desc = describeZoom(nominal, Number(s.zoom) || 1);
    return { ...desc, hint: focalLengthHint(desc.mm) };
  };

  return {
    backend,
    start,
    stop: () => backend.stop(),
    setBounds: (rect) => backend.setBounds?.(rect),
    on: backend.on,
    attachTo: backend.attachTo,
    getStream: backend.getStream,
    getCapabilities: backend.getCapabilities,
    getSettings: backend.getSettings,
    applyControl: backend.applyControl,
    capturePhoto: backend.capturePhoto,
    startRecording: backend.startRecording,
    stopRecording: backend.stopRecording,
    listLenses: backend.listLenses,
    switchLens: backend.switchLens,
    resolveControls,
    currentMm,
    get activeLens() { return activeLens; },
  };
};

export {
  createCamera as default,
  isSupported,
  isNativeShell,
  CONTROLS as controls,
  controlById,
  classifyLens,
  effectiveMm,
  describeZoom,
  focalLengthHint,
  lensChipLabel,
  lensFromMm,
};
