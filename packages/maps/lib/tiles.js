/**
 * Tile arithmetic for a camera: which zoom level draws, which tiles it needs,
 * which it may drop, where its pane sits, and the URL each tile loads from.
 * Every level keeps an integer origin tile so its tiles are placed at whole
 * pixel offsets from it, and one transform moves the whole level.
 */
import { TILE_SIZE, worldSize } from "../mercator.js";
import { clampZoom } from "./camera.js";

/** @import { MapCamera, MapLimits, MapViewport, TileRange } from "../types.ts" */

export const MAX_TILES_PER_LEVEL = 350;
export const EVICT_MARGIN = 2;

/**
 * The integer zoom whose tiles draw at the camera's zoom.
 * @param {MapCamera} camera
 * @param {MapLimits} limits
 * @returns {number}
 */
export const activeLevel = (camera, limits) => Math.round(clampZoom(camera.zoom, limits));

/**
 * The tile under the camera's centre at level `z`, which the level's tiles
 * are placed from.
 * @param {MapCamera} camera
 * @param {number} z
 * @returns {{ ox: number, oy: number }}
 */
export const levelOrigin = (camera, z) => {
  const n = 2 ** z;
  return { ox: Math.floor(camera.cx * n), oy: Math.floor(camera.cy * n) };
};

/**
 * The tiles of level `z` the viewport shows, inside the world and inside
 * `clamp` when the map is bounded.
 * @param {MapCamera} camera
 * @param {MapViewport} viewport
 * @param {number} z
 * @param {TileRange | null} clamp
 * @returns {TileRange}
 */
export const visibleRange = (camera, viewport, z, clamp) => {
  const s = worldSize(camera.zoom);
  const n = 2 ** z;
  let x0 = Math.floor((camera.cx - viewport.w / 2 / s) * n);
  let x1 = Math.floor((camera.cx + viewport.w / 2 / s) * n);
  let y0 = Math.floor((camera.cy - viewport.h / 2 / s) * n);
  let y1 = Math.floor((camera.cy + viewport.h / 2 / s) * n);
  if (clamp) {
    x0 = Math.max(x0, clamp.x0);
    x1 = Math.min(x1, clamp.x1);
    y0 = Math.max(y0, clamp.y0);
    y1 = Math.min(y1, clamp.y1);
  }
  return { x0: Math.max(0, x0), x1: Math.min(n - 1, x1), y0: Math.max(0, y0), y1: Math.min(n - 1, y1) };
};

/**
 * Whether a tile lies more than `EVICT_MARGIN` tiles outside a range.
 * @param {TileRange} range
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export const outsideMargin = (range, x, y) =>
  x < range.x0 - EVICT_MARGIN || x > range.x1 + EVICT_MARGIN || y < range.y0 - EVICT_MARGIN || y > range.y1 + EVICT_MARGIN;

/**
 * A tile's key within its level, a number so a frame builds no string per
 * tile; `tileX`/`tileY` read it back.
 * @param {number} z
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export const tileKey = (z, x, y) => y * 2 ** z + x;

/**
 * @param {number} z
 * @param {number} key
 * @returns {number}
 */
export const tileX = (z, key) => key % 2 ** z;

/**
 * @param {number} z
 * @param {number} key
 * @returns {number}
 */
export const tileY = (z, key) => Math.floor(key / 2 ** z);

/**
 * The CSS transform that places level `z`, whose origin tile is (`ox`, `oy`),
 * under the camera.
 * @param {MapCamera} camera
 * @param {MapViewport} viewport
 * @param {{ z: number, ox: number, oy: number }} level
 * @returns {string}
 */
export const levelTransform = (camera, viewport, { z, ox, oy }) => {
  const s = worldSize(camera.zoom);
  const n = 2 ** z;
  const px = (ox / n - camera.cx) * s + viewport.w / 2;
  const py = (oy / n - camera.cy) * s + viewport.h / 2;
  return `translate3d(${px}px,${py}px,0) scale(${2 ** (camera.zoom - z)})`;
};

/**
 * A tile's URL from an `{z}/{x}/{y}` template; `{s}` takes the first
 * subdomain and `{r}` the standard-resolution suffix.
 * @param {string} template
 * @param {number} z
 * @param {number} x
 * @param {number} y
 * @returns {string}
 */
export const tileSrc = (template, z, x, y) =>
  template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)).replace("{s}", "a").replace("{r}", "");

/**
 * A tile's pixel offset within its level along one axis.
 * @param {number} t
 * @param {number} origin
 * @returns {number}
 */
export const tileOffset = (t, origin) => (t - origin) * TILE_SIZE;
