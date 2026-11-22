/**
 * @lightstart/maps: public type declarations.
 */

export type Prop<V> = import("@lightstart/light/types").TypeDefinition<V>;

export type LatLng = [number, number];

export type Bbox = { west: number; south: number; east: number; north: number };

export type MapPoint = {
  lat?: number | string;
  lng?: number | string;
  id?: string | number;
  slug?: string;
  name?: string;
  thumb?: string;
  color?: string;
  badgeColor?: string;
  badgeText?: string;
  count?: number;
  faces?: MapFace[];
  play?: boolean;
  glyph?: string;
  /** The glyph's own colours, where the point wants them apart from the count's. */
  glyphBackground?: string;
  glyphColor?: string;
  /** A name under the pin, with a bold lead before it (an hour). */
  caption?: string;
  captionLead?: string;
  /** Where the faces sit: under the middle (default), or at the foot on the start side. */
  facesAt?: "start";
  /** The photo pin's size in px, where it differs from the map's. */
  size?: number;
  /** Letters drawn in place of a photo the point does not have. */
  initials?: string;
  icon?: string;
  today?: boolean;
  label?: string | number;
  [key: string]: unknown;
};

/** A face drawn under a pin: somebody at that point. */
export type MapFace = { src?: string; name?: string };

export type MapRoute = {
  color?: string;
  stops?: MapPoint[];
};

export type SparseIndex = Record<string, Record<string, Array<[number, number]>>>;

export type TilesManifest = {
  bbox?: Bbox;
  minZoom?: number;
  maxZoom?: number;
  fullZoomMax?: number;
  sparse?: SparseIndex;
};

export type MapEngineOptions = {
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  tileUrl?: string;
  center?: LatLng;
  onFrame?: () => void;
  onRenderScheduled?: () => void;
};

export type MapBoundsOptions = {
  bbox?: Bbox;
  minZoom?: number;
  maxZoom?: number;
  fullZoomMax?: number;
  sparse?: SparseIndex | null;
};

/** A map position: where the world is centred, and how far in. */
export type MapCenterZoom = { cx: number; cy: number; zoom: number };

export type MapLevel = {
  z: number;
  el: HTMLDivElement;
  ox: number;
  oy: number;
  tiles: Map<number, HTMLImageElement>;
  transform?: string;
};

export type MapEngine = ReturnType<typeof import("./engine.js").createMapEngine>;

export type RouteMark = { el: HTMLElement; lat: number; lng: number };

/** The points one pin stands for: one, or a cluster's many. */
export type PinGroup = { points: MapPoint[] };

/** A placed pin: its element, where it sits, and what it draws. */
export type Pin = { el: HTMLElement; pt: MapPoint | null; lat: number; lng: number; kind: "pin" | "photo" | "cluster"; hidden: boolean };

/** Where the reader is, as geolocation answered it. */
export type UserLocation = { lat: number; lng: number; accuracy: number };

/** What a pin's popup shows: the app's template for the point. */
export type PopupTemplate = (point: MapPoint) => import("@lightstart/light/html").TemplateValue;

/** A live engine and the canvas it draws on, held by the `maps` controller and lent to one `<maps-view>` at a time. */
export type MapHandle = {
  engine: MapEngine;
  canvas: HTMLElement;
  tileUrl: string;
  owner: MapOwner | null;
  timer: ReturnType<typeof setTimeout> | null;
  busy: boolean;
};

/** What a map's holder answers to: its frames, and a request to let the engine go to a newcomer. */
export type MapOwner = {
  keepalive: boolean;
  _onFrame(): void;
  _release(): void;
};

export type MapsProvider = {
  search: (query: string) => Promise<unknown[]>;
};

export type NominatimResult = {
  place_id: string | number;
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
};

/** The engine's camera: the world point at the viewport's centre, the zoom now and the zoom it eases to about an anchor. */
export type MapCamera = { cx: number; cy: number; zoom: number; zTarget: number; anchorX: number; anchorY: number };

/** The engine's measured size in CSS pixels. */
export type MapViewport = { w: number; h: number };

/** A rectangle in Web Mercator world coordinates, [0, 1] on both axes. */
export type WorldRect = { x0: number; y0: number; x1: number; y1: number };

export type MapLimits = { minZoom: number; maxZoom: number };

/** A camera animation from one position to another, starting at `t0` and lasting `ms`. */
export type MapFlight = { t0: number; ms: number; from: MapCenterZoom; to: MapCenterZoom };

/** A fling's speed in screen pixels per millisecond. */
export type MapVelocity = { vx: number; vy: number };

/** One pointer step of a drag, stamped with its time. */
export type VelocitySample = { t: number; dx: number; dy: number };

/** One step of a two-finger gesture: the midpoint's travel, where it is now, the spread's growth, and the distance it counts as dragged. */
export type PinchIntent = { dx: number; dy: number; x: number; y: number; scale: number; moved: number };

/** An inclusive range of tile columns and rows at one level. */
export type TileRange = { x0: number; x1: number; y0: number; y1: number };

/** Which tiles a map has: whether one exists, and the range a bounded map clamps a level to. */
export type TileCoverage = { exists(z: number, x: number, y: number): boolean; clamp(z: number): TileRange | null };

/** What the engine's input asks of the camera: stop, drag, pinch, fling, zoom in at a point, or zoom by a wheel step at one. */
export type MapInputHandlers = {
  grab(): void;
  pan(dx: number, dy: number): void;
  pinch(intent: PinchIntent): void;
  fling(velocity: MapVelocity): void;
  doubleTap(px: number, py: number): void;
  wheel(px: number, py: number, deltaZoom: number): void;
};

/** What a Google Maps or Apple Maps URL says about its place (`parseMapsLink` in `links.js`). */
export type MapsLink = {
  provider: "google" | "apple";
  url: string;
  name: string;
  lat: number | null;
  lng: number | null;
  /** A short link (`maps.app.goo.gl`, `goo.gl/maps`, `maps.apple/p`) that only resolving it can read. */
  short: boolean;
};

/** What a fetched maps page shows about its place (`readPreview` in `links.js`). */
export type MapsPreview = {
  title: string;
  image: string;
  url: string;
  lat: number | null;
  lng: number | null;
};

/** The device's position, as `locate()` answers it. */
export type LocateResult = { lat: number; lng: number; accuracy: number };

/** Why `locate()` failed: `1` refused, `2` unavailable, `3` timed out, `0` no geolocation at all. */
export type LocateError = { code: number; message: string };
