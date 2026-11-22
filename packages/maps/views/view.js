import { disposeTree, html, key, nothing, render, unsafeHTML } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { appUrl } from "@lightstart/app";
import { defineComponent } from "@lightstart/light";
import maps from "../controllers/maps.js";
import { locate } from "../locate.js";
import { bboxOfPoints, focusBboxOfPoints } from "../mercator.js";
import { PIN_TIP_Y, clusterCenter, clusterPoints, clusterRing, finitePoints, isActivePin, pinKeys } from "../lib/pins.js";
import { clusterPin, dropPin, initialsPin, photoPin, popupFrame, routeLine, routeMarks, userMarker } from "./view/templates.js";
/** @import { MapHandle, MapPoint, MapRoute, Pin, PinGroup, PopupTemplate, Prop, RouteMark, UserLocation } from "../types.ts" */
/** @import { TemplateValue } from "@lightstart/light/html" */

const TILES_URL = appUrl("/assets/tiles/{z}/{x}/{y}.png");
const MANIFEST_URL = appUrl("/assets/tiles/manifest.json");
const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OSM</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';

const DEFAULT_PIN_COLOR = "var(--maps-pin-color, #14b8a6)";
const OFFSCREEN_PX = 80;
const VIEW_SETTLE_MS = 220;

/**
 * Hand-rolled slippy map over self-hosted raster tiles. Feed it `points`
 * (each `{ lat, lng, ... }`); set a `popup` function property
 * `(point) => html\`...\`` for marker popups; listen for `pin-click`
 * (`detail.point`). Tile source defaults to `/assets/tiles/` with clamping
 * from `/assets/tiles/manifest.json` when present.
 */
export default defineComponent({
  tag: "maps-view",
  icons: ["map-pin"],
  style: true,
  props: {
    points: /** @type {Prop<MapPoint[]>} */ (T.array({ defaultValue: [] })),
    route: /** @type {Prop<MapPoint[]>} */ (T.array({ defaultValue: [] })),
    routeColor: "",
    routeLine: true,
    routes: /** @type {Prop<MapRoute[]>} */ (T.array({ defaultValue: [] })),
    center: /** @type {Prop<number[]>} */ (T.array({ defaultValue: [] })),
    zoom: 4,
    tileUrl: T.string({ defaultValue: TILES_URL }),
    manifestUrl: T.string({ defaultValue: MANIFEST_URL }),
    attribution: T.string({ defaultValue: OSM_ATTR }),
    markerColor: "",
    fit: true,
    activeId: "",
    noframe: false,
    locate: false,
    locateIcon: "locate",
    zoomButtons: true,
    popups: true,
    keepalive: false,
    popup: /** @type {Prop<PopupTemplate | null>} */ (T.function({ defaultValue: null, hasChanged: () => false })),
    controls: /** @type {Prop<(() => TemplateValue) | null>} */ (T.function({ defaultValue: null, hasChanged: () => false })),
    _locating: T.boolean({ defaultValue: false, attribute: false }),
    _map: /** @type {Prop<MapHandle | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _ready: /** @type {Prop<Promise<void> | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _initStarted: T.boolean({ reactive: false, defaultValue: false }),
    _didFit: T.boolean({ reactive: false, defaultValue: false }),
    _lastZi: /** @type {Prop<number | null>} */ (T.number({ reactive: false, defaultValue: null })),
    _pins: /** @type {Prop<Pin[] | null>} */ (T.array({ reactive: false, defaultValue: null })),
    _markersPane: /** @type {Prop<HTMLElement | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _popupEl: /** @type {Prop<HTMLElement | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _popupPt: /** @type {Prop<MapPoint | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _routeLine: /** @type {Prop<SVGPolylineElement | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _routeLayer: /** @type {Prop<HTMLElement | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _routeMarks: /** @type {Prop<RouteMark[] | null>} */ (T.array({ reactive: false, defaultValue: null })),
    _routesLayer: /** @type {Prop<HTMLElement | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _routesMarks: /** @type {Prop<RouteMark[] | null>} */ (T.array({ reactive: false, defaultValue: null })),
    _userEl: /** @type {Prop<HTMLElement | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _userRing: /** @type {Prop<HTMLElement | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _userLoc: /** @type {Prop<UserLocation | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _brokenThumbs: /** @type {Prop<Set<string>>} */ (T.object({ reactive: false, defaultValue: () => new Set() })),
    _xy: /** @type {Prop<number[]>} */ (T.array({ reactive: false, defaultValue: () => [0, 0] })),
    _moved: T.boolean({ reactive: false, defaultValue: false }),
    _viewTimer: /** @type {Prop<ReturnType<typeof setTimeout> | null>} */ (T.object({ reactive: false, defaultValue: null })),
  },
  events: {
    "pin-click": T.object(),
    "map-tap": T.object(),
    "view-change": T.object(),
    "locate-result": T.object(),
    "locate-error": T.object(),
  },
  connected() {
    if (this.$hasUpdated && !this._map) return (this._ready = this._init());
  },
  disconnected() {
    if (this._viewTimer) clearTimeout(this._viewTimer);
    const map = this._map;
    this._release();
    if (!map) return;
    if (this.keepalive) maps.park(map);
    else maps.destroy(map);
  },
  get engine() {
    return this._map?.engine ?? null;
  },
  firstUpdated() {
    return (this._ready = this._init());
  },
  whenReady() {
    return this._ready ?? Promise.resolve();
  },
  updated(/** @type {{ changedProps: Map<string, unknown> }} */ { changedProps }) {
    const engine = this.engine;
    if (!engine) return;
    if (changedProps.has("points")) {
      this._rebuildMarkers();
      if (this.fit && !this._didFit && this.points.length) {
        this._fit();
        this._didFit = true;
      }
    } else if (changedProps.has("center") || changedProps.has("zoom"))
      if (this.center.length === 2) engine.setView(/** @type {[number, number]} */ (this.center), this.zoom);

    if (changedProps.has("route")) {
      this._buildRoute();
      if (this.fit && !this._didFit && this.route.length && !this.points.length) {
        this._fitRoute();
        this._didFit = true;
      }
    }
    if (changedProps.has("routeColor") || changedProps.has("routeLine")) this._buildRoute();
    if (changedProps.has("routes")) this._buildRoutes();
    if (changedProps.has("activeId") || changedProps.has("markerColor")) this._rebuildMarkers();
    if (changedProps.has("tileUrl")) engine.setTileUrl(this.tileUrl);
  },
  async _init() {
    const stage = this.querySelector(".maps-view-stage");
    if (!stage || this._initStarted) return;
    this._initStarted = true;
    this._lastZi = null;
    this._popupPt = null;
    this._didFit = false;
    const adopted = this.keepalive ? maps.adopt(this.tileUrl, this) : null;
    if (adopted) {
      stage.replaceChildren(adopted.canvas);
      adopted.engine.resize();
      this._didFit = true;
      return this._attach(adopted);
    }
    const canvas = Object.assign(document.createElement("div"), { className: "maps-view-canvas" });
    stage.replaceChildren(canvas);
    const manifest = await maps.manifest(this.manifestUrl);
    if (!canvas.isConnected || this._map) return;
    const map = maps.createMap(canvas, {
      center: this.center.length === 2 ? [this.center[0], this.center[1]] : [0, 0],
      zoom: this.zoom,
      tileUrl: this.tileUrl,
    });
    if (manifest?.bbox)
      map.engine.setBounds({
        bbox: manifest.bbox,
        minZoom: manifest.minZoom,
        maxZoom: manifest.maxZoom,
        fullZoomMax: manifest.fullZoomMax,
        sparse: manifest.sparse,
      });
    this._attach(map);
    if (this.fit && this.points.length) {
      this._fit();
      this._didFit = true;
    } else if (this.fit && this.route.length) {
      this._fitRoute();
      this._didFit = true;
    }
  },
  /** @param {MapHandle} map */
  _attach(map) {
    maps.claim(map, this);
    this._map = map;
    this._mountOverlays(map.canvas);
    this._rebuildMarkers();
    if (this.route.length) this._buildRoute();
    if (this.routes.length) this._buildRoutes();
  },
  _release() {
    this._unmountOverlays();
    this._map = null;
    this._initStarted = false;
  },
  /** @param {HTMLElement} canvas */
  _mountOverlays(canvas) {
    const pane = (/** @type {string} */ className) => Object.assign(document.createElement("div"), { className });
    this._markersPane = pane("maps-view-markers");
    this._routeLayer = pane("maps-view-route");
    this._routesLayer = pane("maps-view-route maps-view-route-many");
    this._popupEl = pane("maps-view-popup");
    this._popupEl.hidden = true;
    canvas.append(pane("maps-view-tint"), this._markersPane, this._routeLayer, this._routesLayer, this._popupEl);
    this._pins = [];
    canvas.addEventListener("pointerdown", this);
    canvas.addEventListener("click", this);
    canvas.addEventListener("wheel", this, { passive: true });
  },
  _unmountOverlays() {
    const canvas = this._map?.canvas;
    if (canvas) {
      canvas.removeEventListener("pointerdown", this);
      canvas.removeEventListener("click", this);
      canvas.removeEventListener("wheel", this);
    }
    for (const pane of [this._markersPane, this._routeLayer, this._routesLayer, this._popupEl]) {
      if (!pane) continue;
      disposeTree(pane);
      pane.remove();
    }
    this._markersPane = null;
    this._popupEl = null;
    this._popupPt = null;
    this._routeLine = null;
    this._routeLayer = null;
    this._routeMarks = null;
    this._routesLayer = null;
    this._routesMarks = null;
    this._userEl = null;
    this._userRing = null;
    this._pins = null;
    this._lastZi = null;
  },
  /** @param {Event} e */
  handleEvent(e) {
    if (e.type === "pointerdown" || e.type === "wheel") this._moved = true;
    if (e.type === "wheel") return;
    if (/** @type {Element} */ (e.target).closest(".maps-view-pin, .maps-view-popup")) return;
    if (e.type === "pointerdown") return this._closePopup();
    if (!this.engine?.wasDragged()) this.$emit("map-tap", {});
  },
  _fit() {
    const engine = this.engine;
    if (!engine) return;
    const bbox = focusBboxOfPoints(this.points);
    if (bbox) engine.fitBounds(bbox, { padding: 24, maxZoom: 15 });
    else if (this.center.length === 2) engine.setView(/** @type {[number, number]} */ (this.center), this.zoom);
  },
  _fitRoute() {
    const bbox = bboxOfPoints(this.route);
    if (bbox) this.engine?.fitBounds(bbox, { padding: 44, maxZoom: 16 });
  },
  fitRoute() {
    const bbox = bboxOfPoints(this.route);
    const engine = this.engine;
    if (!bbox || !engine) return false;
    engine.fitBounds(bbox, { padding: 50, maxZoom: 15, animate: true });
    return engine.whenIdle();
  },
  /** @param {MapPoint[]} stops */
  fitStops(stops) {
    const bbox = bboxOfPoints(stops);
    const engine = this.engine;
    if (!bbox || !engine) return false;
    engine.fitBounds(bbox, { padding: 60, maxZoom: 15, animate: true });
    return engine.whenIdle();
  },
  _buildRoutes() {
    const pane = this._routesLayer;
    if (!this.engine || !pane) return;
    const groups = this.routes.map((r) => ({ color: r.color, stops: finitePoints(r.stops ?? []) }));
    render(groups.map((g) => routeMarks(g.stops, g.color)), pane);
    this._routesMarks = this._zipMarks(pane, groups.flatMap((g) => g.stops));
    this._positionMarks(this._routesMarks);
  },
  _buildRoute() {
    const pane = this._routeLayer;
    if (!this.engine || !pane) return;
    const stops = finitePoints(this.route);
    render([routeLine(this.routeColor, !this.routeLine), routeMarks(stops, this.routeColor)], pane);
    this._routeLine = pane.querySelector("polyline");
    this._routeMarks = this._zipMarks(pane, stops);
    this._positionRoute();
  },
  /**
   * @param {HTMLElement} pane
   * @param {MapPoint[]} stops
   * @returns {RouteMark[]}
   */
  _zipMarks(pane, stops) {
    const els = pane.querySelectorAll(".maps-view-route-mark");
    return stops.map((s, i) => ({ el: /** @type {HTMLElement} */ (els[i]), lat: Number(s.lat), lng: Number(s.lng) }));
  },
  /** @param {RouteMark[] | null} marks */
  _positionMarks(marks) {
    const engine = this.engine;
    if (!engine || !marks) return;
    const xy = this._xy;
    for (let i = 0; i < marks.length; i++) {
      engine.project(marks[i].lat, marks[i].lng, xy);
      marks[i].el.style.translate = `${xy[0]}px ${xy[1]}px`;
    }
  },
  _positionRoute() {
    const engine = this.engine;
    const marks = this._routeMarks;
    if (!engine || !marks) return;
    this._positionMarks(marks);
    if (!this._routeLine) return;
    const xy = this._xy;
    let points = "";
    for (let i = 0; i < marks.length; i++) {
      engine.project(marks[i].lat, marks[i].lng, xy);
      points += `${i ? " " : ""}${xy[0]},${xy[1]}`;
    }
    this._routeLine.setAttribute("points", points);
  },
  _settleView() {
    if (this._viewTimer) clearTimeout(this._viewTimer);
    this._viewTimer = setTimeout(() => {
      const engine = this.engine;
      if (!engine) return;
      if (engine.isInteracting()) return this._settleView();
      this._moved = false;
      this.$emit("view-change", { center: engine.getCenter(), zoom: engine.getZoom() });
    }, VIEW_SETTLE_MS);
  },
  _onFrame() {
    const engine = this.engine;
    if (!engine) return;
    if (this._moved) this._settleView();
    if (Math.round(engine.getZoom()) !== this._lastZi) this._rebuildMarkers();
    else {
      this._positionPins();
      this._positionUserLoc();
    }
    this._positionPopup();
    this._positionRoute();
    this._positionMarks(this._routesMarks);
  },
  _rebuildMarkers() {
    const engine = this.engine;
    const pane = this._markersPane;
    if (!engine || !pane) return;
    const zi = Math.round(engine.getZoom());
    const groups = clusterPoints(finitePoints(this.points), zi);
    const keys = pinKeys(groups);
    const items = groups.map((group, i) => key(keys[i], this._pinTemplate(group)));
    if (this._userLoc) items.push(key("user", userMarker()));
    render(items, pane);
    const els = pane.querySelectorAll(":scope > .maps-view-pin");
    this._pins = groups.map((group, i) => {
      const el = /** @type {HTMLElement} */ (els[i]);
      const single = group.points.length === 1 ? group.points[0] : null;
      const at = single ? { lat: Number(single.lat), lng: Number(single.lng) } : clusterCenter(group.points);
      /** @type {Pin["kind"]} */
      const kind = !single ? "cluster" : el.classList.contains("maps-view-pin-photo") ? "photo" : "pin";
      return { el, pt: single, lat: at.lat, lng: at.lng, kind, hidden: Boolean(el.hidden) };
    });
    this._userEl = /** @type {HTMLElement | null} */ (pane.querySelector(":scope > .maps-view-user"));
    this._userRing = /** @type {HTMLElement | null} */ (this._userEl?.querySelector(".maps-view-user-ring") ?? null);
    this._lastZi = zi;
    this._positionPins();
    this._positionUserLoc();
  },
  /** @param {PinGroup} group */
  _pinTemplate({ points }) {
    if (points.length > 1)
      return clusterPin(points.length, {
        ring: clusterRing(points, this.markerColor || DEFAULT_PIN_COLOR),
        onClick: (e) => this._onClusterClick(e, points),
      });
    const pt = points[0];
    const active = isActivePin(pt, this.activeId);
    /** @param {MouseEvent} e */
    const onClick = (e) => this._onPinClick(e, pt);
    const thumb = pt.thumb;
    if (thumb && !this._brokenThumbs.has(thumb))
      return photoPin(pt, { active, onClick, onError: () => this._onThumbError(thumb) });
    if (pt.initials) return initialsPin(pt, { active, onClick });
    return dropPin(pt, { color: pt.color || this.markerColor, active, onClick });
  },
  /**
   * @param {MouseEvent} e
   * @param {MapPoint} pt
   */
  _onPinClick(e, pt) {
    e.stopPropagation();
    if (this.engine?.wasDragged()) return;
    this.$emit("pin-click", { point: pt });
    this._openPopup(pt);
  },
  /**
   * @param {MouseEvent} e
   * @param {MapPoint[]} points
   */
  _onClusterClick(e, points) {
    e.stopPropagation();
    const engine = this.engine;
    if (!engine || engine.wasDragged()) return;
    const bbox = bboxOfPoints(points);
    if (bbox) engine.fitBounds(bbox, { padding: 60, maxZoom: 16, animate: true });
  },
  /** @param {string} thumb */
  _onThumbError(thumb) {
    this._brokenThumbs.add(thumb);
    this._rebuildMarkers();
  },
  _positionPins() {
    const engine = this.engine;
    const pins = this._pins;
    if (!engine || !pins) return;
    const xy = this._xy;
    const right = engine.getWidth() + OFFSCREEN_PX;
    const bottom = engine.getHeight() + OFFSCREEN_PX;
    for (let i = 0; i < pins.length; i++) {
      const pin = pins[i];
      engine.project(pin.lat, pin.lng, xy);
      const hidden = xy[0] < -OFFSCREEN_PX || xy[1] < -OFFSCREEN_PX || xy[0] > right || xy[1] > bottom;
      if (hidden !== pin.hidden) pin.el.hidden = pin.hidden = hidden;
      if (!hidden) pin.el.style.translate = `${xy[0]}px ${xy[1]}px`;
    }
  },
  /** @param {MapPoint} pt */
  _openPopup(pt) {
    const popup = this._popupEl;
    if (!this.popups) return;
    const content = this.popup ? this.popup(pt) : pt.name || "";
    if (!popup || !content || content === nothing) return;
    this._popupPt = pt;
    render(popupFrame(content, () => this._closePopup()), popup);
    popup.hidden = false;
    this._positionPopup();
  },
  _closePopup() {
    this._popupPt = null;
    const popup = this._popupEl;
    if (!popup || popup.hidden) return;
    render(nothing, popup);
    popup.hidden = true;
  },
  _positionPopup() {
    const engine = this.engine;
    if (!this._popupPt || !this._popupEl || !engine) return;
    const xy = engine.project(Number(this._popupPt.lat), Number(this._popupPt.lng), this._xy);
    this._popupEl.style.translate = `${xy[0]}px ${xy[1] - PIN_TIP_Y - 4}px`;
  },
  /**
   * @param {MapPoint | null | undefined} pt
   * @param {number} [zoom]
   */
  flyToPoint(pt, zoom) {
    const lat = Number(pt?.lat);
    const lng = Number(pt?.lng);
    const engine = this.engine;
    if (!engine || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const z = zoom !== undefined && Number.isFinite(zoom) ? zoom : Math.max(engine.getZoom(), 15);
    engine.flyTo([lat, lng], z);
    return engine.whenIdle();
  },
  _locate() {
    if (this._locating) return;
    this._locating = true;
    locate({ maximumAge: 30000 }).then(
      ({ lat, lng, accuracy }) => {
        this._locating = false;
        const first = !this._userLoc;
        this._userLoc = { lat, lng, accuracy };
        if (first) this._rebuildMarkers();
        else this._positionUserLoc();
        const engine = this.engine;
        engine?.flyTo([lat, lng], Math.max(engine.getZoom(), 15));
        this.$emit("locate-result", { lat, lng, accuracy });
      },
      (/** @type {import("../types.ts").LocateError} */ err) => {
        this._locating = false;
        this.$emit("locate-error", { code: err.code, message: err.message });
      },
    );
  },
  _positionUserLoc() {
    const engine = this.engine;
    const user = this._userEl;
    const loc = this._userLoc;
    if (!engine || !user || !loc) return;
    const xy = engine.project(loc.lat, loc.lng, this._xy);
    const x = xy[0];
    const y = xy[1];
    const w = engine.getWidth();
    const h = engine.getHeight();
    const hidden = x < -OFFSCREEN_PX || y < -OFFSCREEN_PX || x > w + OFFSCREEN_PX || y > h + OFFSCREEN_PX;
    if (user.hidden !== hidden) user.hidden = hidden;
    if (hidden) return;
    user.style.translate = `${x}px ${y}px`;
    const ring = this._userRing;
    if (!ring) return;
    const sized = Number.isFinite(loc.accuracy) && loc.accuracy > 0;
    if (ring.hidden === sized) ring.hidden = !sized;
    if (!sized) return;
    const y2 = engine.project(loc.lat + loc.accuracy / 111320, loc.lng, xy)[1];
    const size = `${2 * Math.max(10, Math.min(Math.abs(y - y2), Math.min(w, h) * 0.4))}px`;
    ring.style.width = size;
    ring.style.height = size;
  },
  render() {
    return html`
      <div class="maps-view-frame">
        <div class="maps-view-stage"></div>
        <div class="maps-view-controls">
          ${this.zoomButtons
            ? html`<lc-button glass iconOnly size="sm" class="maps-view-zoom" aria-label="Zoom in" @click=${() => this.engine?.zoomBy(1)}>
                <lc-icon name="plus" size="18"></lc-icon>
              </lc-button>
              <lc-button glass iconOnly size="sm" class="maps-view-zoom" aria-label="Zoom out" @click=${() => this.engine?.zoomBy(-1)}>
                <lc-icon name="minus" size="18"></lc-icon>
              </lc-button>`
            : nothing}
          ${this.locate
            ? html`<lc-button glass iconOnly size="sm" class="maps-view-locate" aria-label="Center on my location" ?disabled=${this._locating} @click=${() => this._locate()}>
                <lc-icon name=${this._locating ? "loader" : this.locateIcon} size="18" class=${this._locating ? "maps-view-spin" : ""}></lc-icon>
              </lc-button>`
            : nothing}
          ${this.controls ? this.controls() : nothing}
        </div>
        <div class="maps-view-attr">${unsafeHTML(this.attribution)}</div>
      </div>`;
  },
});
