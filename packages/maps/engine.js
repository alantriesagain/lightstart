import { lngLatToWorld, worldToLngLat, bboxToWorld, tileRange } from "./mercator.js";
import { appUrl } from "@lightstart/app";
import { sparseTileExists } from "./coverage.js";
import {
  approachZoomTarget,
  clampCenter,
  clampNum,
  clampZoom,
  createFlight,
  fitCamera,
  flightAt,
  panBy,
  pinchZoom,
  screenToWorld,
  worldToScreen,
  zoomTarget,
} from "./lib/camera.js";
import { stepInertia } from "./lib/inertia.js";
import { activeLevel } from "./lib/tiles.js";
import { createTileLayer } from "./engine/tiles.js";
import { attachInput } from "./engine/input.js";
/** @import { Bbox, LatLng, MapBoundsOptions, MapCamera, MapEngineOptions, MapFlight, MapLimits, MapVelocity, MapViewport, SparseIndex, TileCoverage, TileRange, WorldRect } from "./types.ts" */

/**
 * Framework-free slippy-map engine: DOM <img> tiles in per-zoom level panes,
 * pointer pan/pinch/inertia, anchored wheel zoom, flyTo/fitBounds animation.
 * Coordinates: public API speaks (lat, lng); internal state is Web Mercator
 * world coords in [0,1] plus a fractional zoom.
 * @param {HTMLElement} container
 * @param {MapEngineOptions} [opts]
 */
export const createMapEngine = (container, opts = {}) => {
  /** @type {MapCamera} */
  let camera = { cx: 0.5, cy: 0.5, zoom: opts.zoom ?? 2, zTarget: opts.zoom ?? 2, anchorX: 0, anchorY: 0 };
  /** @type {MapViewport} */
  const viewport = { w: 0, h: 0 };
  /** @type {MapLimits} */
  const limits = { minZoom: opts.minZoom ?? 2, maxZoom: opts.maxZoom ?? 18 };
  /** @type {{ bbox: Bbox, world: WorldRect } | null} */
  let bounds = null;
  /** @type {number | null} */
  let fullZoomMax = null;
  /** @type {SparseIndex | null} */
  let sparse = null;
  if (Array.isArray(opts.center) && opts.center.length === 2) {
    const [cx, cy] = lngLatToWorld(opts.center[1], opts.center[0]);
    camera = { ...camera, cx, cy };
  }

  if (getComputedStyle(container).position === "static") container.style.position = "relative";
  container.style.overflow = "hidden";
  container.style.touchAction = "none";

  const pane = document.createElement("div");
  pane.style.cssText = "position:absolute;inset:0;overflow:hidden";
  container.appendChild(pane);

  /** @type {Map<number, TileRange>} */
  const clampCache = new Map();
  /** @type {MapVelocity | null} */
  let velocity = null;
  /** @type {MapFlight | null} */
  let anim = null;
  let raf = 0;
  let lastT = 0;
  let destroyed = false;
  /** @type {Array<() => void>} */
  let idleWaiters = [];

  const measure = () => {
    viewport.w = container.clientWidth || 1;
    viewport.h = container.clientHeight || 1;
  };
  measure();

  /** @type {TileCoverage} */
  const coverage = {
    exists: (z, x, y) => sparseTileExists(sparse, fullZoomMax, z, x, y),
    clamp(z) {
      if (!bounds) return null;
      let range = clampCache.get(z);
      if (!range) clampCache.set(z, (range = tileRange(bounds.bbox, z)));
      return range;
    },
  };

  const tiles = createTileLayer(pane, {
    tileUrl: opts.tileUrl || appUrl("/assets/tiles/{z}/{x}/{y}.png"),
    onTileSettled: () => requestRender(),
  });

  const requestRender = () => {
    if (raf || destroyed) return;
    raf = requestAnimationFrame(frame);
    opts.onRenderScheduled?.();
  };

  /** @param {number} t */
  const frame = (t) => {
    raf = 0;
    if (destroyed) return;
    const dt = clampNum(t - (lastT || t), 0, 50);
    lastT = t;
    let animating = false;
    if (anim) {
      const at = flightAt(anim, t);
      camera = { ...camera, cx: at.cx, cy: at.cy, zoom: at.zoom, zTarget: at.zoom };
      if (at.done) anim = null;
      else animating = true;
    } else {
      camera = approachZoomTarget(camera, viewport, dt);
      if (camera.zTarget !== camera.zoom) animating = true;
      if (velocity && !input.active()) {
        camera = panBy(camera, velocity.vx * dt, velocity.vy * dt);
        velocity = stepInertia(velocity, dt);
        if (velocity) animating = true;
      }
    }
    camera = clampCenter(camera, viewport, bounds && bounds.world);
    tiles.draw(camera, viewport, limits, coverage);
    opts.onFrame?.();
    if (animating) requestRender();
    else if (tiles.pending() === 0 && idleWaiters.length) {
      const waiters = idleWaiters;
      idleWaiters = [];
      for (const resolve of waiters) resolve();
    }
  };

  const stopMotion = () => {
    anim = null;
    velocity = null;
    if (camera.zTarget !== camera.zoom) camera = { ...camera, zTarget: camera.zoom };
  };

  /**
   * @param {number} z
   * @param {number} px
   * @param {number} py
   */
  const zoomAt = (z, px, py) => {
    anim = null;
    camera = zoomTarget(camera, limits, z, px, py);
    requestRender();
  };

  const input = attachInput(container, {
    grab: stopMotion,
    pan(dx, dy) {
      camera = panBy(camera, dx, dy);
      requestRender();
    },
    pinch(intent) {
      camera = pinchZoom(camera, viewport, limits, intent);
      requestRender();
    },
    fling(v) {
      velocity = v;
      requestRender();
    },
    doubleTap: (px, py) => zoomAt(activeLevel(camera, limits) + 1, px, py),
    wheel(px, py, deltaZoom) {
      anim = null;
      velocity = null;
      camera = zoomTarget(camera, limits, camera.zTarget + deltaZoom, px, py);
      requestRender();
    },
  });

  const ro = new ResizeObserver(() => {
    measure();
    requestRender();
  });
  ro.observe(container);

  requestRender();

  return {
    /**
     * @param {LatLng} center
     * @param {number} zoom
     */
    setView(center, zoom) {
      stopMotion();
      if (Array.isArray(center) && center.length === 2) {
        const [cx, cy] = lngLatToWorld(center[1], center[0]);
        camera = { ...camera, cx, cy };
      }
      if (Number.isFinite(zoom)) {
        const z = clampZoom(zoom, limits);
        camera = { ...camera, zoom: z, zTarget: z };
      }
      requestRender();
    },
    /**
     * @param {LatLng} center
     * @param {number} zoom
     * @param {number} [ms]
     */
    flyTo(center, zoom, ms = 450) {
      const [cx, cy] = lngLatToWorld(center[1], center[0]);
      velocity = null;
      anim = createFlight(camera, { cx, cy, zoom: clampZoom(Number.isFinite(zoom) ? zoom : camera.zoom, limits) }, performance.now(), ms);
      requestRender();
    },
    /**
     * @param {Bbox | null | undefined} bbox
     * @param {{ padding?: number, maxZoom?: number, animate?: boolean }} [options]
     */
    fitBounds(bbox, { padding = 40, maxZoom = 15, animate = false } = {}) {
      if (!bbox) return;
      const fit = fitCamera(bbox, viewport, limits, { padding, maxZoom });
      if (animate) {
        velocity = null;
        anim = createFlight(camera, fit, performance.now(), 450);
      } else {
        stopMotion();
        camera = { ...camera, cx: fit.cx, cy: fit.cy, zoom: fit.zoom, zTarget: fit.zoom };
      }
      requestRender();
    },
    /** @param {number} delta */
    zoomBy(delta) {
      zoomAt(Math.round(clampZoom(camera.zTarget, limits)) + delta, viewport.w / 2, viewport.h / 2);
    },
    /** @param {MapBoundsOptions} [options] */
    setBounds({ bbox, minZoom, maxZoom, fullZoomMax: full, sparse: index } = {}) {
      if (typeof minZoom === "number" && Number.isFinite(minZoom)) limits.minZoom = minZoom;
      if (typeof maxZoom === "number" && Number.isFinite(maxZoom)) limits.maxZoom = maxZoom;
      if (typeof full === "number" && Number.isFinite(full)) fullZoomMax = full;
      sparse = index || null;
      bounds = bbox ? { bbox, world: bboxToWorld(bbox) } : null;
      clampCache.clear();
      const z = clampZoom(camera.zoom, limits);
      camera = { ...camera, zoom: z, zTarget: z };
      requestRender();
    },
    /**
     * @param {number} lat
     * @param {number} lng
     * @param {number[]} [out] written into and returned when given, so a caller that projects every frame allocates nothing
     * @returns {number[]}
     */
    project(lat, lng, out = [0, 0]) {
      const [wx, wy] = lngLatToWorld(lng, lat);
      return worldToScreen(camera, viewport, wx, wy, out);
    },
    getWidth: () => viewport.w,
    getHeight: () => viewport.h,
    /**
     * @param {number} px
     * @param {number} py
     */
    screenToLatLng(px, py) {
      const [wx, wy] = screenToWorld(camera, viewport, px, py);
      const [lng, lat] = worldToLngLat(wx, wy);
      return [lat, lng];
    },
    getZoom: () => camera.zoom,
    getCenter() {
      const [lng, lat] = worldToLngLat(camera.cx, camera.cy);
      return [lat, lng];
    },
    wasDragged: () => input.wasDragged(),
    /** @param {string} url */
    setTileUrl(url) {
      if (tiles.setTileUrl(url)) requestRender();
    },
    isInteracting: () => input.active() || !!anim || !!velocity,
    /** @returns {Promise<void>} */
    whenIdle() {
      if (destroyed || (!raf && !anim && !velocity && tiles.pending() === 0 && camera.zTarget === camera.zoom))
        return Promise.resolve();
      return new Promise((resolve) => {
        idleWaiters.push(() => resolve());
        requestRender();
      });
    },
    resize() {
      measure();
      requestRender();
    },
    destroy() {
      destroyed = true;
      const waiters = idleWaiters;
      idleWaiters = [];
      for (const resolve of waiters) resolve();
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      input.destroy();
      tiles.destroy();
      pane.remove();
    },
  };
};
