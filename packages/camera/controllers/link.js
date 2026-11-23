/**
 * Another phone as this app's camera. On the phone with the app, `host()`
 * opens a peer room and answers the link its QR carries (`<camera-pair>`
 * draws it); once the other phone opens the link, its camera is `stream`
 * here, and `shoot()`, `flip()` and `live()` work it, `shoot()` answering
 * with the photo. On the other phone, the app's startup calls
 * `openCameraLink()`, which mounts `<camera-link>` and calls `serve()`,
 * which joins the room, runs the camera and keeps the screen on. The video
 * and the photo go phone to phone; the signalers named through
 * `configureP2P` see only the sealed handshake. A phone running the same app
 * scans the code instead (`<camera-scan>`, role `scanning`), and an app's own
 * camera lets go of the lens while the role is `scanning` or `camera`. The
 * other phone's camera reports what it can set (`capabilities`, `lenses`)
 * and what it is set to (`settings`, every second), and `applyControl()` and
 * `selectLens()` work it. A phone in the native shell serves its native
 * camera (the lenses, the zoom range, the DNG), streamed to the viewer as the
 * preview's frames drawn on a canvas; a browser serves its web camera. The
 * pair of the last link stays on both phones (`remembered`, with the side
 * each played): `host()` reopens the same room, so the other phone rejoins
 * with `serve(remembered)` and no code is read again; `forget()` drops it.
 * While a phone serves, `locked` makes its screen deaf to touch. Needs
 * `@lightstart/p2p` and `@lightstart/qr` in the app.
 */

import { defineController } from "@lightstart/light/controller";
import { appUrl } from "@lightstart/app";
import { joinRoom, p2pConfig, randomId, resolveSignalers } from "@lightstart/p2p";
import { createCamera } from "../camera.js";
import { hasNativeCamera } from "../select-backend.js";
import { downscale } from "../lib/downscale.js";
import { decodePair, encodePair, isFresh, PAIR_TTL_MS, PAIR_VERSION } from "../lib/pair.js";
import { setLinkSlot } from "../lib/link-slot.js";
import { serveCamera, viewCamera } from "../remote.js";
import { createSounds } from "../lib/sound.js";

/** @import { CameraPair, CameraSounds, LensDevice, RemoteCamera, RemoteClip, RemotePhoto, RemoteRoom, RemoteState, RemoteViewer } from "../types.ts" */

const APP_ID = "camera-link";
const FRAME_WIDTH = 640;
const FRAME_FPS = 15;
const PHOTO_WAIT_MS = 15000;
const CLIP_GRACE_MS = 1500;

/** @type {RemoteState} */
const OFF = { phase: "off", count: 0, facing: "environment" };

/** @param {unknown} msg @returns {string} */
const messageOf = (msg) => (msg instanceof Error ? msg.message : "The room did not open");

const cameraLink = defineController({
  name: "cameraLink",
  props: {
    role: /** @type {"idle" | "viewer" | "scanning" | "camera"} */ ("idle"),
    status: /** @type {"idle" | "opening" | "waiting" | "connected" | "expired" | "error"} */ ("idle"),
    pairUrl: "",
    error: "",
    camera: /** @type {RemoteState} */ ({ ...OFF }),
    stream: /** @type {MediaStream | null} */ (null),
    capabilities: /** @type {Record<string, unknown>} */ ({}),
    settings: /** @type {Record<string, unknown>} */ ({}),
    lenses: /** @type {LensDevice[]} */ ([]),
    kind: "web",
    remoteKind: "web",
    remembered: /** @type {(CameraPair & { side: "viewer" | "camera" }) | null} */ (null),
    locked: false,
  },
  sync: {
    remembered: { to: "local", key: "camera-link:pair" },
  },
  _room: /** @type {{ leave(): void, peers(): string[] } & RemoteRoom | null} */ (null),
  _viewer: /** @type {RemoteViewer | null} */ (null),
  _served: /** @type {RemoteCamera | null} */ (null),
  _wake: /** @type {WakeLockSentinel | null} */ (null),
  _offs: /** @type {Array<() => void>} */ ([]),
  _waiting: /** @type {Array<(photo: RemotePhoto | null) => void>} */ ([]),
  _clipWaiting: /** @type {Array<(clip: RemoteClip | null) => void>} */ ([]),
  _recording: false,
  _sounds: /** @type {CameraSounds | null} */ (null),

  disconnected() {
    return this.stop();
  },

  _sound() {
    return (this._sounds ??= createSounds());
  },

  /** @param {CameraPair} pair */
  _config(pair) {
    const manifest = p2pConfig();
    return {
      appId: pair.a,
      password: pair.p,
      signalers: pair.s,
      relayUrl: pair.u ?? undefined,
      trackers: manifest.trackers,
      brokers: manifest.brokers,
      iceServers: manifest.iceServers,
      video: true,
    };
  },

  isConnected() {
    return this.role === "viewer" && this.status === "connected";
  },

  /** @param {RemotePhoto | null} photo */
  _settle(photo) {
    for (const resolve of this._waiting.splice(0)) resolve(photo);
  },

  /** @param {RemoteClip | null} clip */
  _settleClip(clip) {
    for (const resolve of this._clipWaiting.splice(0)) resolve(clip);
  },

  async host() {
    if (this.role === "viewer" && this._room) return this.pairUrl;
    await this.stop();
    this.role = "viewer";
    this.status = "opening";
    try {
      const { signalers, relayUrl } = await resolveSignalers();
      if (!signalers.length) {
        this.status = "error";
        this.error = "There is no way to reach another phone from here";
        return "";
      }
      const kept = this.remembered?.side === "viewer" ? this.remembered : null;
      /** @type {CameraPair} */
      const pair = { v: PAIR_VERSION, a: APP_ID, r: kept?.r ?? randomId(20), p: kept?.p ?? randomId(32), s: signalers, ...(relayUrl ? { u: relayUrl } : {}), exp: Date.now() + PAIR_TTL_MS };
      this.remembered = { ...pair, side: /** @type {"viewer"} */ ("viewer") };
      const room = await joinRoom(this._config(pair), pair.r);
      const viewer = viewCamera({ room });
      this._room = room;
      this._viewer = viewer;
      this._offs = [
        viewer.onState((state) => {
          this.camera = state;
          this.status = viewer.connected ? "connected" : "waiting";
          if (!viewer.connected) {
            this._settle(null);
            this._settleClip(null);
            return;
          }
          if (state.phase === "recording" && !this._recording) void viewer.record(false).catch(() => {});
          if (state.phase === "live" && this._clipWaiting.length) setTimeout(() => { if (this.camera.phase === "live") this._settleClip(null); }, CLIP_GRACE_MS);
        }),
        viewer.onClip((clip) => this._settleClip(clip)),
        viewer.onTrack((track) => {
          this.stream = track ? new MediaStream([track]) : null;
        }),
        viewer.onPhoto((photo) => this._settle(photo)),
        viewer.onCaps((caps) => {
          this.capabilities = caps.capabilities;
          this.lenses = caps.lenses;
          this.remoteKind = caps.kind || "web";
          this.settings = { ...caps.settings, deviceId: caps.deviceId };
        }),
        viewer.onSettings((settings) => {
          this.settings = { ...settings, deviceId: this._viewer?.caps.deviceId ?? "" };
        }),
      ];
      this.pairUrl = `${location.origin}${appUrl(location.pathname)}#cam=${encodePair(pair)}`;
      this.status = "waiting";
      return this.pairUrl;
    } catch (e) {
      this.status = "error";
      this.error = messageOf(e);
      return "";
    }
  },

  /** @param {boolean} on whether this app is showing the other phone's camera, so it runs */
  live(on) {
    return this._viewer?.live(on).catch(() => {});
  },

  /**
   * Take a photo on the other phone, after its self-timer, and answer with it.
   *
   * @param {number} [timer] seconds the other phone counts down first
   * @returns {Promise<RemotePhoto | null>} null when the other phone left first
   */
  shoot(timer = 0) {
    const viewer = this._viewer;
    if (!viewer || !this.isConnected()) return Promise.resolve(null);
    return new Promise((resolve) => {
      /** @param {RemotePhoto | null} photo */
      const done = (photo) => {
        clearTimeout(wait);
        resolve(photo);
      };
      const wait = setTimeout(() => {
        this._waiting = this._waiting.filter((r) => r !== done);
        resolve(null);
      }, timer * 1000 + PHOTO_WAIT_MS);
      this._waiting.push(done);
      viewer.shoot(timer).catch(() => this._settle(null));
    });
  },

  cancel() {
    return this._viewer?.cancel().catch(() => {});
  },

  async startRecording() {
    const viewer = this._viewer;
    if (!viewer || !this.isConnected()) throw new Error("link-not-connected");
    this._recording = true;
    await viewer.record(true).catch((e) => {
      this._recording = false;
      throw e;
    });
  },

  /** @returns {Promise<RemoteClip | null>} */
  stopRecording() {
    const viewer = this._viewer;
    this._recording = false;
    if (!viewer || !this.isConnected()) return Promise.resolve(null);
    return new Promise((resolve) => {
      this._clipWaiting.push(resolve);
      viewer.record(false).catch(() => this._settleClip(null));
    });
  },

  flip() {
    return this._viewer?.flip().catch(() => {});
  },

  /** @param {string} key @param {unknown} value */
  applyControl(key, value) {
    const viewer = this._viewer;
    if (!viewer || !this.isConnected()) return Promise.resolve(this.settings);
    return new Promise((resolve) => {
      const done = () => { off(); clearTimeout(timer); resolve(this.settings); };
      const off = viewer.onSettings(() => done());
      const timer = setTimeout(done, 2500);
      viewer.set(key, value).catch(done);
    });
  },

  /** @param {string} deviceId one of `lenses` */
  selectLens(deviceId) {
    return this._viewer?.selectLens(deviceId).catch(() => {});
  },

  forget() {
    this.remembered = null;
  },

  async scan() {
    await this._release();
    this.role = "scanning";
    this.status = "idle";
  },

  /**
   * Be the camera of the phone whose link this is.
   *
   * @param {string | CameraPair} link the page's `location.hash`, the link a scan read, or the remembered pair
   */
  async serve(link) {
    const pair = typeof link === "string" ? decodePair(link) : link;
    await this._release();
    this.role = "camera";
    if (!pair) {
      this.status = "error";
      this.error = "This is not a camera link";
      return;
    }
    if (typeof link === "string" && !isFresh(pair)) {
      this.status = "expired";
      return;
    }
    this.remembered = { v: pair.v, a: pair.a, r: pair.r, p: pair.p, s: pair.s, ...(pair.u ? { u: pair.u } : {}), exp: pair.exp, side: /** @type {"camera"} */ ("camera") };
    this.status = "opening";
    try {
      const room = await joinRoom(this._config(pair), pair.r);
      const lens = hasNativeCamera() ? createCamera({ frames: { width: FRAME_WIDTH, fps: FRAME_FPS } }) : createCamera({ backend: "web" });
      this.kind = lens.backend.kind;
      const served = serveCamera({ room, camera: lens, prepare: (blob, max) => downscale(blob, { max }) });
      this._room = room;
      this._served = served;
      const seen = () => {
        this.status = room.peers().length ? "connected" : "waiting";
      };
      let count = 0;
      this._offs = [
        served.onState((state) => {
          if (state.phase === "counting" && state.count !== count) this._sound().tick(state.count);
          if (state.phase === "sending" && this.camera.phase !== "sending" && this.camera.phase !== "recording") this._sound().click();
          count = state.phase === "counting" ? state.count : 0;
          this.camera = state;
          this.stream = state.phase === "off" || state.phase === "denied" ? null : lens.getStream();
        }),
        room.onPeerJoin(seen),
        room.onPeerLeave(seen),
      ];
      seen();
      await served.start();
      await this._keepAwake();
      const visible = () => { if (document.visibilityState === "visible" && this.role === "camera") void this._keepAwake(); };
      document.addEventListener("visibilitychange", visible);
      this._offs.push(() => document.removeEventListener("visibilitychange", visible));
    } catch (e) {
      this.status = "error";
      this.error = messageOf(e);
    }
  },

  async _keepAwake() {
    if (this._wake && !this._wake.released) return;
    this._wake = (await navigator.wakeLock?.request("screen").catch(() => null)) ?? null;
  },

  lock() {
    this.locked = true;
  },

  unlock() {
    this.locked = false;
  },

  async stop() {
    await this._release();
    this.role = "idle";
    this.status = "idle";
  },

  async _release() {
    for (const off of this._offs) off();
    this._offs = [];
    this.locked = false;
    this._settle(null);
    this._settleClip(null);
    this._viewer?.close();
    this._served?.close();
    this._room?.leave();
    await this._wake?.release().catch(() => {});
    this._viewer = null;
    this._served = null;
    this._room = null;
    this._wake = null;
    this.pairUrl = "";
    this.error = "";
    this.camera = { ...OFF };
    this.stream = null;
    this.capabilities = {};
    this.settings = {};
    this.lenses = [];
    this.kind = "web";
    this.remoteKind = "web";
  },
});

setLinkSlot(() => /** @type {import("../types.ts").CameraLinkSlot | undefined} */ (cameraLink));

export default cameraLink;
