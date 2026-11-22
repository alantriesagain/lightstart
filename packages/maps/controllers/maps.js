/**
 * The map engines alive in the app. A `<maps-view>` asks for one, and one
 * marked `keepalive` hands its engine back when it leaves the page, so the
 * next map on the same tiles takes the camera and the loaded tiles over
 * instead of starting cold. A handed-back engine that nobody takes within
 * the grace period is destroyed. Every burst of engine work is settle-tracked
 * here, so a crawl waits for tiles whoever holds the engine at the time.
 */
import { trackWork } from "@lightstart/light";
import { defineController } from "@lightstart/light/controller";
import { createMapEngine } from "../engine.js";

/** @import { LatLng, MapHandle, MapOwner, TilesManifest } from "../types.ts" */

const PARK_GRACE_MS = 1500;

export default defineController({
  name: "maps",
  _parked: /** @type {MapHandle | null} */ (null),
  _live: /** @type {Set<MapHandle>} */ (new Set()),
  _manifests: /** @type {Map<string, Promise<TilesManifest | null>>} */ (new Map()),

  connected() {
    this.$own(() => {
      for (const handle of [...this._live]) this.destroy(handle);
      this._manifests.clear();
    });
  },

  /**
   * Start an engine on a canvas. Its frames go to whichever owner holds it.
   * @param {HTMLElement} canvas
   * @param {{ center: LatLng, zoom: number, tileUrl: string }} options
   * @returns {MapHandle}
   */
  createMap(canvas, { center, zoom, tileUrl }) {
    const handle = /** @type {MapHandle} */ ({ canvas, tileUrl, owner: null, timer: null, busy: false });
    this._live.add(handle);
    handle.engine = createMapEngine(canvas, {
      center,
      zoom,
      tileUrl,
      onFrame: () => handle.owner?._onFrame(),
      onRenderScheduled: () => this._trackBusy(handle),
    });
    return handle;
  },

  /**
   * @param {MapHandle} handle
   * @param {MapOwner} owner
   * @returns {void}
   */
  claim(handle, owner) {
    if (handle.timer) clearTimeout(handle.timer);
    handle.timer = null;
    if (this._parked === handle) this._parked = null;
    handle.owner = owner;
  },

  /**
   * An engine on these tiles for a `keepalive` newcomer: the parked one, else
   * one another `keepalive` map still holds, which first lets it go.
   * @param {string} tileUrl
   * @param {MapOwner} owner
   * @returns {MapHandle | null}
   */
  adopt(tileUrl, owner) {
    const parked = this._parked;
    if (parked && parked.tileUrl === tileUrl) {
      this.claim(parked, owner);
      return parked;
    }
    for (const handle of this._live) {
      const donor = handle.owner;
      if (!donor || donor === owner || !donor.keepalive || handle.tileUrl !== tileUrl) continue;
      donor._release();
      this.claim(handle, owner);
      return handle;
    }
    return null;
  },

  /**
   * Hold an engine for the grace period, then destroy it unless adopted.
   * @param {MapHandle} handle
   * @returns {void}
   */
  park(handle) {
    handle.owner = null;
    if (this._parked && this._parked !== handle) this.destroy(this._parked);
    this._parked = handle;
    handle.timer = setTimeout(() => this.destroy(handle), PARK_GRACE_MS);
  },

  /**
   * @param {MapHandle} handle
   * @returns {void}
   */
  destroy(handle) {
    if (handle.timer) clearTimeout(handle.timer);
    handle.timer = null;
    handle.owner = null;
    if (this._parked === handle) this._parked = null;
    if (!this._live.delete(handle)) return;
    handle.engine.destroy();
  },

  /**
   * How many engines are alive, parked ones included.
   * @returns {number}
   */
  count() {
    return this._live.size;
  },

  /**
   * A tiles manifest, fetched once per url; `null` when there is none.
   * @param {string} url
   * @returns {Promise<TilesManifest | null>}
   */
  manifest(url) {
    let pending = this._manifests.get(url);
    if (!pending) {
      pending = fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      this._manifests.set(url, pending);
    }
    return pending;
  },

  /**
   * @param {MapHandle} handle
   * @returns {void}
   */
  _trackBusy(handle) {
    if (handle.busy || !this._live.has(handle)) return;
    if (!handle.engine) return void queueMicrotask(() => this._trackBusy(handle));
    handle.busy = true;
    trackWork(
      handle.engine.whenIdle().then(() => {
        handle.busy = false;
      }),
      "maps:engine",
    );
  },
});
