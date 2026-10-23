/**
 * The geometry of cropping a picture to a square: which square of the
 * picture the frame shows, in the picture's own pixels, and how a drag, a
 * pinch, a wheel turn or a key moves it. A rect is `{ x, y, size }`. The frame
 * is `view` screen pixels wide, so one screen pixel is `size / view` picture
 * pixels.
 *
 * Every answer is clamped to the bounds: the square never leaves the picture,
 * never grows past the shorter side (the frame is always covered) and never
 * shrinks below `minSize`, which is how far in a crop may zoom.
 *
 * Pure, so the component and its tests share one account of it.
 */

/** @import { CropBounds, CropIntent, CropPoint, CropRect } from "../types.ts" */

const WHEEL_PIXELS = 300;
const WHEEL_MAX = 1.5;
const KEY_ZOOM = 1.2;

/**
 * The bounds of a picture `width` by `height`, zoomable to `maxZoom` times
 * the zoom at which it just covers the frame.
 * @param {number} width
 * @param {number} height
 * @param {number} [maxZoom]
 * @returns {CropBounds}
 */
export const boundsOf = (width, height, maxZoom = 4) => ({ width, height, minSize: Math.max(1, Math.min(width, height) / Math.max(1, maxZoom)) });

/**
 * The largest square in the middle of the picture: what a crop opens on.
 * @param {CropBounds} bounds
 * @returns {CropRect}
 */
export const coverRect = ({ width, height }) => {
  const size = Math.min(width, height);
  return { x: (width - size) / 2, y: (height - size) / 2, size };
};

/**
 * @param {CropRect} rect
 * @param {CropBounds} bounds
 * @returns {CropRect}
 */
export const clampRect = (rect, { width, height, minSize }) => {
  const max = Math.min(width, height);
  const size = Math.min(max, Math.max(Math.min(minSize, max), rect.size));
  return { size, x: Math.min(width - size, Math.max(0, rect.x)), y: Math.min(height - size, Math.max(0, rect.y)) };
};

/**
 * The picture dragged by `dx`, `dy` screen pixels: it moves with the finger,
 * so the square moves the other way.
 * @param {CropRect} rect
 * @param {number} dx
 * @param {number} dy
 * @param {number} view
 * @param {CropBounds} bounds
 */
export const panRect = (rect, dx, dy, view, bounds) => {
  const scale = rect.size / view;
  return clampRect({ ...rect, x: rect.x - dx * scale, y: rect.y - dy * scale }, bounds);
};

/**
 * Zoomed by `factor` (above 1 is in) about a point of the frame, which keeps
 * the part of the picture under it where it is.
 * @param {CropRect} rect
 * @param {number} factor
 * @param {number} fx the point, in screen pixels from the frame's left
 * @param {number} fy the point, in screen pixels from the frame's top
 * @param {number} view
 * @param {CropBounds} bounds
 */
export const zoomRectAt = (rect, factor, fx, fy, view, bounds) => {
  const px = rect.x + (fx / view) * rect.size;
  const py = rect.y + (fy / view) * rect.size;
  const { size } = clampRect({ ...rect, size: rect.size / factor }, bounds);
  return clampRect({ size, x: px - (fx / view) * size, y: py - (fy / view) * size }, bounds);
};

/**
 * How far in the frame is: 1 where the picture just covers it.
 * @param {CropRect} rect
 * @param {CropBounds} bounds
 */
export const zoomOf = (rect, { width, height }) => Math.min(width, height) / rect.size;

/**
 * The rect at a zoom, about the middle of the frame: what a slider sets.
 * @param {CropRect} rect
 * @param {number} zoom
 * @param {CropBounds} bounds
 */
export const rectAtZoom = (rect, zoom, bounds) => {
  const size = Math.min(bounds.width, bounds.height) / Math.max(zoom, Number.EPSILON);
  return clampRect({ size, x: rect.x + rect.size / 2 - size / 2, y: rect.y + rect.size / 2 - size / 2 }, bounds);
};

/**
 * One step of a two-finger gesture: how much the fingers spread, where their
 * middle is now and how far it moved.
 * @param {[CropPoint, CropPoint]} before
 * @param {[CropPoint, CropPoint]} after
 */
export const pinchStep = (before, after) => {
  /** @param {[CropPoint, CropPoint]} p */
  const spread = (p) => Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
  /** @param {[CropPoint, CropPoint]} p */
  const middle = (p) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 });
  const from = middle(before);
  const to = middle(after);
  const was = spread(before);
  return { factor: was > 0 ? spread(after) / was : 1, x: to.x, y: to.y, dx: to.x - from.x, dy: to.y - from.y };
};

/**
 * The rect after one step of a pinch: the picture follows the fingers'
 * middle and grows with their spread.
 * @param {CropRect} rect
 * @param {[CropPoint, CropPoint]} before
 * @param {[CropPoint, CropPoint]} after
 * @param {number} view
 * @param {CropBounds} bounds
 */
export const pinchRect = (rect, before, after, view, bounds) => {
  const step = pinchStep(before, after);
  return zoomRectAt(panRect(rect, step.dx, step.dy, view, bounds), step.factor, step.x, step.y, view, bounds);
};

/**
 * How much one wheel event zooms: a trackpad's small deltas and a mouse's
 * notches come out as the same smooth factor, never more than half again.
 * @param {number} deltaY
 * @param {number} [deltaMode] 0 pixels, 1 lines, 2 pages
 */
export const wheelFactor = (deltaY, deltaMode = 0) => {
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 400 : 1);
  return Math.min(WHEEL_MAX, Math.max(1 / WHEEL_MAX, Math.exp(-pixels / WHEEL_PIXELS)));
};

/**
 * What a key asks of the crop. The arrows move the picture the way a drag
 * does, Shift moving it further; plus and minus zoom; 0 opens it out again.
 * @param {string} key
 * @param {{ step?: number, shift?: boolean }} [options]
 * @returns {CropIntent | null}
 */
export const keyIntent = (key, { step = 16, shift = false } = {}) => {
  const by = shift ? step * 4 : step;
  if (key === "ArrowLeft") return { pan: [-by, 0] };
  if (key === "ArrowRight") return { pan: [by, 0] };
  if (key === "ArrowUp") return { pan: [0, -by] };
  if (key === "ArrowDown") return { pan: [0, by] };
  if (key === "+" || key === "=") return { zoom: KEY_ZOOM };
  if (key === "-" || key === "_") return { zoom: 1 / KEY_ZOOM };
  if (key === "0") return { reset: true };
  return null;
};

/**
 * The square to draw, in whole pixels inside the picture.
 * @param {CropRect} rect
 * @param {CropBounds} bounds
 */
export const sourceRect = (rect, { width, height }) => {
  const size = Math.max(1, Math.min(Math.round(rect.size), width, height));
  return {
    sx: Math.min(Math.max(0, Math.round(rect.x)), width - size),
    sy: Math.min(Math.max(0, Math.round(rect.y)), height - size),
    size,
  };
};

/**
 * A picture's size scaled down to at most `maxPixels`, for the canvas it is
 * worked on: a phone's full-size photo can be more than some browsers draw.
 * @param {number} width
 * @param {number} height
 * @param {number} maxPixels
 */
export const fitWithin = (width, height, maxPixels) => {
  const scale = Math.min(1, Math.sqrt(maxPixels / Math.max(1, width * height)));
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), scale };
};

/**
 * The qualities to encode at, best first, until one comes out light enough.
 * @param {number} [start]
 * @param {number} [floor]
 * @param {number} [step]
 */
export const qualitySteps = (start = 0.9, floor = 0.5, step = 0.1) => {
  /** @type {number[]} */
  const steps = [];
  for (let q = start; q >= floor - 1e-9; q -= step) steps.push(Math.round(q * 100) / 100);
  return steps;
};

/**
 * The sizes to draw through when shrinking a square, no step more than
 * halving, so a large crop comes out smooth rather than grainy.
 * @param {number} from
 * @param {number} to
 */
export const halvingSteps = (from, to) => {
  /** @type {number[]} */
  const steps = [];
  let size = from;
  while (size / 2 > to) {
    size = Math.round(size / 2);
    steps.push(size);
  }
  steps.push(to);
  return steps;
};
