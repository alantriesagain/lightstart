/**
 * Where the device is, asked once. The map's locate button and any list
 * sorted by distance share it.
 *
 * @import { LocateError, LocateResult } from "./types.ts"
 */

/**
 * The device's position, coarse by default. Rejects with `{ code, message }`:
 * `1` refused, `2` unavailable, `3` timed out, `0` no geolocation at all.
 * @param {PositionOptions} [options]
 * @returns {Promise<LocateResult>}
 */
export const locate = (options = {}) =>
  new Promise((resolve, reject) => {
    const geo = globalThis.navigator?.geolocation;
    if (!geo) return reject(/** @type {LocateError} */ ({ code: 0, message: "Geolocation is not available" }));
    geo.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(/** @type {LocateError} */ ({ code: err.code, message: err.message })),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000, ...options },
    );
  });
