/**
 * @file Pairing payload codec: the `#peer=` fragment contents.
 *
 * Pure: no app, no DOM. The payload is a base64(JSON) capability: whoever
 * holds it can request to join the room until `exp`. Kept under its original
 * name because the pair command and the views read this module by that name.
 */

/** @import { PairPayload } from "./types.ts" */

export const PAIR_VERSION = 3;

/**
 * @param {PairPayload} payload
 * @returns {string} URL-fragment-safe encoded payload
 */
export const encodePairPayload = (payload) =>
  encodeURIComponent(btoa(JSON.stringify(payload)));

/**
 * @param {string} hash location.hash (or any string containing `peer=<encoded>`)
 * @returns {PairPayload | null}
 */
export const decodePairPayload = (hash) => {
  const m = String(hash).match(/peer=([^&]+)/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(atob(decodeURIComponent(m[1])));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * @param {PairPayload | null} payload
 * @returns {boolean}
 */
export const isCurrent = (payload) => payload?.v === PAIR_VERSION && Array.isArray(payload.s);

/**
 * @param {{ exp?: number }} payload
 * @param {number} [now]
 * @returns {boolean}
 */
export const isExpired = (payload, now = Date.now()) =>
  Boolean(payload.exp && payload.exp < now);
