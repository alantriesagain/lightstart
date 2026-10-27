/**
 * Pure rect math and persistence for `lc-float-panel`: DOM-free so node
 * tests can exercise clamping and storage round-trips directly.
 */

const HANDLE_VISIBLE_PX = 48;

/**
 * Clamp a rect to the viewport, honouring min sizes and keeping at least 48px of the handle reachable.
 * @param {{ x: number, y: number, w: number, h: number }} rect
 * @param {{ width: number, height: number }} viewport
 * @param {{ minWidth?: number, minHeight?: number }} [mins]
 */
export const clampRect = (rect, viewport, mins = {}) => {
  const minW = mins.minWidth ?? 0;
  const minH = mins.minHeight ?? 0;
  const w = Math.min(Math.max(rect.w, minW), Math.max(viewport.width, minW));
  const h = Math.min(Math.max(rect.h, minH), Math.max(viewport.height, minH));
  const x = Math.min(Math.max(rect.x, HANDLE_VISIBLE_PX - w), Math.max(0, viewport.width - HANDLE_VISIBLE_PX));
  const y = Math.min(Math.max(rect.y, 0), Math.max(0, viewport.height - HANDLE_VISIBLE_PX));
  return { x, y, w, h };
};

/**
 * Read a persisted `{x,y,w,h}` rect; corrupt JSON, missing keys, or non-finite members fall back.
 * @param {{ getItem: (key: string) => string | null }} storage
 * @param {string} key
 * @param {{ x: number, y: number, w: number, h: number }} fallback
 */
export const loadRect = (storage, key, fallback) => {
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? "");
    if (!parsed || typeof parsed !== "object") return { ...fallback };
    const { x, y, w, h } = /** @type {Record<string, unknown>} */ (parsed);
    if (typeof x !== "number" || typeof y !== "number" || typeof w !== "number" || typeof h !== "number" || ![x, y, w, h].every(Number.isFinite)) return { ...fallback };
    return { x, y, w, h };
  } catch {
    return { ...fallback };
  }
};

/**
 * Persist a rect as `{x,y,w,h}` JSON; storage failures are swallowed.
 * @param {{ setItem: (key: string, value: string) => void }} storage
 * @param {string} key
 * @param {{ x: number, y: number, w: number, h: number }} rect
 */
export const saveRect = (storage, key, rect) => {
  try {
    storage.setItem(key, JSON.stringify({ x: rect.x, y: rect.y, w: rect.w, h: rect.h }));
  } catch { }
};
