/**
 * The engine's tile layer: one pane per zoom level holding `<img>` tiles,
 * created as the camera needs them, evicted once a level holds too many,
 * and dropped when another level has settled on top. It counts the tiles
 * still loading so the engine knows when the map is idle.
 */
import { TILE_SIZE } from "../mercator.js";
import { MAX_TILES_PER_LEVEL, activeLevel, levelOrigin, levelTransform, outsideMargin, tileKey, tileOffset, tileSrc, tileX, tileY, visibleRange } from "../lib/tiles.js";

/** @import { MapCamera, MapLevel, MapLimits, MapViewport, TileCoverage } from "../types.ts" */

/**
 * @param {HTMLElement} pane
 * @param {{ tileUrl: string, onTileSettled: () => void }} options
 */
export const createTileLayer = (pane, { tileUrl, onTileSettled }) => {
  /** @type {Map<number, MapLevel>} */
  const levels = new Map();
  let template = tileUrl;
  let pending = 0;

  /**
   * @param {MapCamera} camera
   * @param {number} z
   * @returns {MapLevel}
   */
  const makeLevel = (camera, z) => {
    const el = document.createElement("div");
    el.style.cssText = "position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform";
    pane.appendChild(el);
    const { ox, oy } = levelOrigin(camera, z);
    /** @type {MapLevel} */
    const level = { z, el, ox, oy, tiles: new Map() };
    levels.set(z, level);
    return level;
  };

  /**
   * @param {MapLevel} level
   * @param {number} tx
   * @param {number} ty
   * @returns {HTMLImageElement}
   */
  const makeTile = (level, tx, ty) => {
    const tile = document.createElement("img");
    tile.decoding = "async";
    tile.draggable = false;
    tile.alt = "";
    tile.style.cssText = `position:absolute;left:${tileOffset(tx, level.ox)}px;top:${tileOffset(ty, level.oy)}px;width:${TILE_SIZE}px;height:${TILE_SIZE}px;max-width:none;max-height:none;opacity:0;transition:opacity .18s linear`;
    pending++;
    tile.onload = () => {
      tile.dataset.ok = "1";
      tile.style.opacity = "1";
      pending--;
      onTileSettled();
    };
    tile.onerror = () => {
      tile.dataset.ok = "1";
      tile.style.display = "none";
      pending--;
      onTileSettled();
    };
    tile.src = tileSrc(template, level.z, tx, ty);
    level.el.appendChild(tile);
    level.tiles.set(tileKey(level.z, tx, ty), tile);
    return tile;
  };

  /**
   * @param {MapLevel} level
   * @param {MapCamera} camera
   * @param {MapViewport} viewport
   * @param {TileCoverage} coverage
   * @returns {boolean} whether every tile the level shows has loaded or failed
   */
  const ensureTiles = (level, camera, viewport, coverage) => {
    const { z } = level;
    const r = visibleRange(camera, viewport, z, coverage.clamp(z));
    let settled = true;
    for (let ty = r.y0; ty <= r.y1; ty++)
      for (let tx = r.x0; tx <= r.x1; tx++) {
        if (!coverage.exists(z, tx, ty)) continue;
        const img = level.tiles.get(tileKey(z, tx, ty)) || makeTile(level, tx, ty);
        if (!img.dataset.ok) settled = false;
      }
    if (level.tiles.size > MAX_TILES_PER_LEVEL)
      for (const [key, img] of level.tiles)
        if (outsideMargin(r, tileX(z, key), tileY(z, key))) {
          img.remove();
          level.tiles.delete(key);
        }
    return settled;
  };

  return {
    /**
     * Brings the tiles and level transforms up to the camera.
     * @param {MapCamera} camera
     * @param {MapViewport} viewport
     * @param {MapLimits} limits
     * @param {TileCoverage} coverage
     */
    draw(camera, viewport, limits, coverage) {
      const zi = activeLevel(camera, limits);
      const active = levels.get(zi) || makeLevel(camera, zi);
      if (pane.lastElementChild !== active.el) pane.appendChild(active.el);
      const settled = ensureTiles(active, camera, viewport, coverage);
      for (const level of levels.values()) {
        const transform = levelTransform(camera, viewport, level);
        if (level.transform !== transform) {
          level.transform = transform;
          level.el.style.transform = transform;
        }
      }
      if (settled)
        for (const level of levels.values())
          if (level.z !== zi) {
            level.el.remove();
            levels.delete(level.z);
          }
    },
    /**
     * Switches to another tile template, dropping every level drawn from the
     * old one.
     * @param {string} url
     * @returns {boolean} whether the template changed
     */
    setTileUrl(url) {
      if (!url || url === template) return false;
      template = url;
      for (const level of levels.values()) level.el.remove();
      levels.clear();
      return true;
    },
    /** @returns {number} the tiles still loading */
    pending: () => pending,
    destroy() {
      for (const level of levels.values()) level.el.remove();
      levels.clear();
    },
  };
};
