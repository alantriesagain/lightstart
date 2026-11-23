/**
 * The link that makes a phone the camera of another: the room to join and
 * its key, carried after `#cam=` in the URL fragment so no server sees it.
 * Pure.
 */

/** @import { CameraPair } from "../types.ts" */

export const PAIR_VERSION = 1;
export const PAIR_TTL_MS = 60 * 60 * 1000;

/** @param {CameraPair} pair */
export const encodePair = (pair) => encodeURIComponent(btoa(JSON.stringify(pair)));

/**
 * @param {string} hash a `location.hash`, or any text holding `cam=<encoded>`
 * @returns {CameraPair | null}
 */
export const decodePair = (hash) => {
  const match = /cam=([^&]+)/.exec(hash);
  if (!match) return null;
  try {
    const pair = JSON.parse(atob(decodeURIComponent(match[1])));
    const valid = pair?.v === PAIR_VERSION && typeof pair.a === "string" && typeof pair.r === "string" && typeof pair.p === "string" && Array.isArray(pair.s) && typeof pair.exp === "number";
    return valid ? pair : null;
  } catch {
    return null;
  }
};

/** @param {CameraPair} pair @param {number} [now] */
export const isFresh = (pair, now = Date.now()) => pair.exp > now;
