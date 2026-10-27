/**
 * @bootstrapp/base/utils: small utilities that don't have a natural
 * home in the kernel itself.
 *
 *   - `createCollection`: a plain-object collection slot. Consumers
 *     read/write via native syntax (`coll[k]`, `delete coll[k]`,
 *     `Object.entries(coll)`). Use `mergeCollection(coll, obj)` for
 *     bulk merges with one-level-deep merging on object values.
 *   - `fs`: the framework's path-aware fetch helper (`$APP.fs.text`,
 *     `.json`), shared with packages.
 */

import { events } from "/app/events/index.js";
import { appUrl } from "/app/url/index.js";
import { FS_RESOURCE_NOT_FOUND } from "./events.js";

/**
 * @template {Record<string, unknown>} T
 * @param {T} [initial]
 * @returns {T}
 */
export function createCollection(initial = /** @type {T} */ ({})) {
  return { ...initial };
}

/**
 * Merge each key from `source` into `target`. For keys where both values are
 * plain objects, shallow-spreads them; otherwise replaces.
 *
 * @param {Record<string, unknown>} target
 * @param {Record<string, unknown>} source
 */
export function mergeCollection(target, source) {
  for (const [k, v] of Object.entries(source)) {
    const existing = target[k];
    if (
      existing && typeof existing === "object" && !Array.isArray(existing) &&
      v && typeof v === "object" && !Array.isArray(v)
    )
      target[k] = { .../** @type {Record<string, unknown>} */ (existing), .../** @type {Record<string, unknown>} */ (v) };
    else
      target[k] = v;
  }
}

/**
 * @param {string} path
 * @param {(response: Response) => Promise<unknown>} handleResponse
 * @param {string} extension
 * @returns {Promise<unknown>}
 */
async function fetchResource(path, handleResponse, extension) {
  try {
    const response = await fetch(appUrl(path));
    /** @type {any} */ (fs)[path] = { path, extension };
    if (response.ok) return await handleResponse(response);
  } catch (error) {
    events.emit(FS_RESOURCE_NOT_FOUND, { path, error });
  }
  return null;
}

/**
 * Format a byte count as a human-readable string (`"1.5 MB"`).
 * Used by both browser-side UI (file uploads, media library) and
 * Node-side CLI output (build size reports, VPS stats).
 *
 * @param {number | undefined | null} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

export const fs = {
  fetchResource,
  /** @param {string} path */
  text(path) {
    return fetchResource(path, (res) => res.text(), "text");
  },
  /** @param {string} path */
  json(path) {
    return fetchResource(path, (res) => res.json(), "json");
  },
  /** @param {string} file */
  getFilePath(file) {
    return appUrl(file.startsWith("/") ? file : `/${file}`);
  },
  /** @param {string} urlString */
  getRequestPath(urlString) {
    const url = new URL(urlString);
    return url.pathname + url.search;
  },
};
