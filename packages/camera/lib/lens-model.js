/**
 * Lens reasoning for the learning camera.
 *
 * The web platform never hands you a focal length in millimetres. What we have is
 * (1) the device label from enumerateDevices (often naming the physical lens) and
 * (2) the zoom ratio reported by MediaTrackSettings. We map those to an approximate
 * 35mm-equivalent focal length so the UI can teach "1x means ~26mm". It is an
 * estimate for teaching; the ground-truth value comes from EXIF after a capture.
 */

/** @import { LensInfo, ZoomDescription } from "../types.ts" */

/** @param {unknown} n @param {number} [d] @returns {number} */
const round = (n, d = 1) => {
  const f = 10 ** d;
  return Math.round((Number(n) || 0) * f) / f;
};

export const LENS_TYPES = [
  { id: "ultrawide", label: "Ultra-wide", nominalMm: 13, test: /ultra|wide.?angle|0\.5/i },
  { id: "telephoto", label: "Telephoto", nominalMm: 77, test: /tele|periscope/i },
  { id: "front", label: "Front", nominalMm: 24, test: /front|face|user|selfie/i },
  { id: "wide", label: "Main", nominalMm: 26, test: /back|rear|wide|environment|main/i },
];

const DEFAULT_LENS = { id: "unknown", label: "Camera", nominalMm: 26 };

/**
 * Classify a videoinput device label into a lens type with a nominal 35mm-equivalent.
 * @param {string} [label]
 * @returns {LensInfo}
 */
export const classifyLens = (label = "") => {
  for (const t of LENS_TYPES)
    if (t.test.test(label)) return { lensType: t.id, lensLabel: t.label, nominalMm: t.nominalMm };
  return { lensType: DEFAULT_LENS.id, lensLabel: DEFAULT_LENS.label, nominalMm: DEFAULT_LENS.nominalMm };
};

/**
 * Effective 35mm-equivalent focal length for a base lens at a given zoom ratio.
 * @param {number} nominalMm
 * @param {number} [zoomRatio]
 */
export const effectiveMm = (nominalMm, zoomRatio = 1) =>
  Math.round((Number(nominalMm) || 26) * (Number(zoomRatio) || 1));

/**
 * Human description of the current zoom: ratio, computed mm, and a compact label.
 * @param {number} nominalMm
 * @param {number} [zoomRatio]
 * @returns {ZoomDescription}
 */
export const describeZoom = (nominalMm, zoomRatio = 1) => {
  const zoom = round(zoomRatio || 1, 1);
  const mm = effectiveMm(nominalMm, zoom);
  return { zoom, mm, label: `${zoom}× · ${mm}mm` };
};

/**
 * A short note on what a focal length is good for, for the teaching panel.
 * @param {number} mm
 */
export const focalLengthHint = (mm) => {
  if (mm <= 18) return "Very wide: landscapes, tight interiors, dramatic foregrounds.";
  if (mm <= 35) return "Wide: street, vlogging, scenes with context around the subject.";
  if (mm <= 55) return "Natural: looks close to how your eyes see a scene.";
  if (mm <= 105) return "Short telephoto: flattering portraits, gentle background separation.";
  return "Telephoto: distant subjects, compressed backgrounds, isolated details.";
};

/**
 * Classify a lens from its 35mm-equivalent focal length (for native-discovered lenses
 * that arrive as a real mm, not a label).
 * @param {number} mm
 * @returns {LensInfo}
 */
export const lensFromMm = (mm) => {
  const n = Number(mm) || 26;
  if (n <= 18) return { lensType: "ultrawide", lensLabel: "Ultra-wide", nominalMm: n };
  if (n <= 40) return { lensType: "wide", lensLabel: "Main", nominalMm: n };
  if (n <= 70) return { lensType: "telephoto", lensLabel: "Tele", nominalMm: n };
  return { lensType: "telephoto", lensLabel: "Tele+", nominalMm: n };
};

/**
 * Short chip label for a discovered lens: "Ultra-wide" / "Main" / "2×" / "5×"
 * (relative to the main lens via zoomRatio), falling back to the type name.
 * @param {{ nominalMm?: number, zoomRatio?: number, lensLabel?: string }} lens
 */
export const lensChipLabel = (lens) => {
  const ratio = Number(lens?.zoomRatio) || 1;
  if (ratio < 0.8) return "Ultra-wide";
  if (ratio < 1.3) return "Main";
  return `${round(ratio, ratio < 3 ? 1 : 0)}×`;
};
