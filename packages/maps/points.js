/**
 * The generic points feed for a content-backed map: read the baked
 * `/map_index.json` the `$mapIndexable` pipeline produces, or a source the
 * app gives, falling back to app-supplied rows in development, as a
 * `resource()` that re-derives when the app's `refreshOn` says so. The app
 * supplies what is its own: `filterPoint` (section/community gating) and
 * `devRows`.
 */

import { resource } from "@lightstart/light/controller/resource";
import { appUrl } from "@lightstart/app";
/** @import { MapPoint } from "./types.ts" */
/** @import { Occurrence } from "@lightstart/light/controller" */

/**
 * The identity a pin, a like and a panel share: `<type>:<slug>`.
 * @param {MapPoint} pt
 */
export const pointKey = (pt) => `${pt.type || pt.targetType || "place"}:${pt.slug || pt.targetSlug || ""}`;

/**
 * The rows that carry a finite latitude and longitude, with both as numbers.
 * @param {MapPoint[]} rows
 * @param {(d: MapPoint) => boolean} [filterPoint]
 * @returns {MapPoint[]}
 */
export const withCoords = (rows, filterPoint = () => true) =>
  (rows || [])
    .filter((d) => Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lng)) && filterPoint(d))
    .map((d) => ({ ...d, lat: Number(d.lat), lng: Number(d.lng) }));

/**
 * The rows a baked document holds: an array, or the `documents` a baked map
 * index wraps them in.
 * @param {unknown} data
 * @returns {MapPoint[] | null}
 */
const rowsOf = (data) => {
  if (Array.isArray(data)) return /** @type {MapPoint[]} */ (data);
  if (typeof data === "object" && data !== null && "documents" in data && Array.isArray(data.documents))
    return /** @type {MapPoint[]} */ (data.documents);
  return null;
};

/**
 * @param {{ url?: string | (() => string), load?: () => Promise<MapPoint[]> }} source
 * @returns {Promise<MapPoint[]>}
 */
const sourceRows = async ({ url, load }) => {
  if (load) return (await load()) ?? [];
  if (url === undefined) return [];
  try {
    const response = await fetch(appUrl(typeof url === "function" ? url() : url));
    if (!response.ok) return [];
    return rowsOf(await response.json()) ?? [];
  } catch {
    return [];
  }
};

/**
 * The map points as a resource. Its source is explicit: `load` answers the
 * rows, or `url` fetches the baked index (a function read on every load, for
 * an index with a variant per language). `devRows` fills in when the source
 * answers nothing, and `refreshOn` lists the occurrences that make it re-read
 * (a language change, say).
 * @param {{ url?: string | (() => string), load?: () => Promise<MapPoint[]>, name?: string,
 *   filterPoint?: (d: MapPoint) => boolean, devRows?: () => Promise<MapPoint[]>,
 *   refreshOn?: Occurrence | Occurrence[] }} [options]
 */
export const mapPointsResource = ({
  url,
  load,
  name = "mapPoints",
  filterPoint,
  devRows,
  refreshOn = [],
} = {}) =>
  resource(
    async () => {
      const rows = await sourceRows({ url: load ? undefined : (url ?? "/map_index.json"), load });
      const chosen = rows.length ? rows : devRows ? await devRows() : [];
      return withCoords(chosen, filterPoint);
    },
    { name, ready: false, invalidateOn: refreshOn },
  );
