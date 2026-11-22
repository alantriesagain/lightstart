import { createMapsClient } from "./index.ts";

const RATE_MS = /** @type {Record<string, number>} */ ({ nominatim: 1100 });
const DEFAULT_RATE_MS = 1100;

const queues = new Map();

/**
 * @param {string} provider
 * @param {() => Promise<unknown>} fn
 * @param {number} [rateMs]
 */
const throttled = (provider, fn, rateMs) => {
  const wait = rateMs ?? RATE_MS[provider] ?? DEFAULT_RATE_MS;
  const prior = queues.get(provider) ?? Promise.resolve();
  const next = prior
    .catch(() => {})
    .then(fn)
    .finally(() => new Promise((r) => setTimeout(r, wait)));
  queues.set(provider, next.catch(() => {}));
  return next;
};

/** @param {unknown} results */
const firstCoords = (results) => {
  if (!Array.isArray(results)) return null;
  for (const r of results)
    if (Number.isFinite(r?.lat) && Number.isFinite(r?.lng))
      return { lat: r.lat, lng: r.lng };
  return null;
};

/**
 * Resolve a place to coordinates, trying each query in turn.
 *
 * @param {string | string[]} query - the query, or an ordered list of
 *   progressively broader ones ("Bar, Lapa, Rio" then "Rio, Brazil").
 * @param {object} [options]
 * @param {string} [options.provider] - a name registered in `index.js`
 * @param {Record<string, [number, number]>} [options.centroids] - last-resort
 *   lookup table, keyed by the accent-folded lowercase `fallbackKey`
 * @param {string} [options.fallbackKey] - the key to look up in `centroids`
 * @param {number} [options.rateMs] - override the provider's request spacing
 * @param {(message: string) => void} [options.onWarn]
 * @returns {Promise<{ lat: number, lng: number, source: string } | null>}
 */
export const geocode = async (query, options = {}) => {
  const { provider = "nominatim", centroids, fallbackKey, rateMs, onWarn } = options;
  const client = createMapsClient(provider);
  const queries = (Array.isArray(query) ? query : [query]).filter(Boolean);

  for (const q of queries) {
    let coords = null;
    try {
      coords = firstCoords(await throttled(provider, () => client.search(q), rateMs));
    } catch (error) {
      onWarn?.(`${provider} error for "${q}": ${error instanceof Error ? error.message : String(error)}`);
    }
    if (coords) return { ...coords, source: provider };
  }

  const centroid = centroids?.[foldKey(fallbackKey)];
  if (centroid) return { lat: centroid[0], lng: centroid[1], source: "centroid" };

  return null;
};

/** Accent-folded, lowercased key so "Búzios" and "buzios" hit the same entry. */
/** @param {unknown} value */
export const foldKey = (value) =>
  String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export default geocode;
