import { html } from "@lightstart/light/html";
import { decodeQr } from "@lightstart/qr";
import { createCamera } from "../camera.js";
import { decodePair } from "../lib/pair.js";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";
import cameraLink from "../controllers/link.js";

/** @import { CameraInstance, Prop } from "../types.ts" */

const READ_EVERY_MS = 200;
const LONG_SIDE = 960;
const OPEN_FOR_MS = 10000;

/** @param {number} ms */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Reading the other phone's camera link with this phone's camera, for a
 * phone running the same app (a browser opens the link from its camera app
 * instead): the back camera full screen, a frame read for a QR code five
 * times a second, and on a camera link `<camera-link>` over the page with
 * it, which makes this phone that phone's camera. While it looks, the
 * `cameraLink` role is `scanning`, so the app's own camera lets go of the
 * lens. Emits `close` when it is done, with a link or without.
 */
export default defineComponent({
  tag: "camera-scan",
  class: "block",
  props: {
    stream: /** @type {Prop<MediaStream | null>} */ (T.object({ defaultValue: null, attribute: false })),
    phase: /** @type {Prop<"opening" | "looking" | "denied" | "other">} */ (T.string({ defaultValue: "opening", attribute: false })),
  },
  events: {
    close: T.object({}),
  },
  _camera: /** @type {CameraInstance | null} */ (null),
  _video: /** @type {HTMLVideoElement | null} */ (null),
  _canvas: /** @type {HTMLCanvasElement | null} */ (null),
  _timer: /** @type {ReturnType<typeof setInterval> | null} */ (null),
  _found: false,

  async connected() {
    this.$own(() => {
      this._release();
      if (!this._found) cameraLink.stop();
    });
    await cameraLink.scan();
    if (!this.isConnected) return cameraLink.stop();
    return this._open();
  },

  async _open() {
    this._release();
    this.phase = "opening";
    const camera = createCamera({ backend: "web" });
    this._camera = camera;
    const until = Date.now() + OPEN_FOR_MS;
    while (this._camera === camera && !camera.getStream() && Date.now() < until)
      await camera.start({ facingMode: "environment", width: 1280, height: 720 }).catch(() => wait(400));
    if (this._camera !== camera) return camera.stop();
    const stream = camera.getStream();
    if (!stream) {
      this.phase = "denied";
      return;
    }
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    camera.attachTo(video);
    this._video = video;
    this._canvas = document.createElement("canvas");
    this.stream = stream;
    this.phase = "looking";
    this._timer = setInterval(() => this._read(), READ_EVERY_MS);
  },

  _read() {
    const video = this._video;
    const canvas = this._canvas;
    if (!video || !canvas || video.readyState < 2 || !video.videoWidth) return;
    const scale = Math.min(1, LONG_SIDE / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const text = decodeQr(context.getImageData(0, 0, canvas.width, canvas.height));
    if (text === null) return;
    if (!decodePair(text)) {
      this.phase = "other";
      return;
    }
    this._found = true;
    this._release();
    return this._serve(text);
  },

  /** @param {string} text the camera link the code holds */
  _serve(text) {
    const link = /** @type {HTMLElement & { link: string }} */ (document.createElement("camera-link"));
    link.link = text;
    document.body.appendChild(link);
    this.$emit("close", {});
  },

  _release() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this._camera?.stop();
    this._camera = null;
    if (this._video) this._video.srcObject = null;
    this._video = null;
    this.stream = null;
  },

  /** @returns {[string, string]} */
  _line() {
    if (this.phase === "denied") return ["The camera did not open", "Allow the camera for this app, then try again."];
    if (this.phase === "other") return ["That code is not a camera link", "Point at the code the other phone shows under Another phone as the camera."];
    return ["Point at the other phone's code", "It reads by itself."];
  },

  render() {
    const [title, hint] = this._line();
    return html`
      <div class="fixed inset-0 z-[9998] overflow-hidden bg-black text-white">
        ${this.stream ? html`<camera-preview class="absolute inset-0" .stream=${this.stream}></camera-preview>` : ""}
        <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span class="block h-[min(70vw,320px)] w-[min(70vw,320px)] rounded-[28px] border-[3px] border-white/80"></span>
        </div>
        <div class="absolute inset-x-6 bottom-[12%] rounded-2xl bg-black/60 px-4 py-3 text-center" data-scan-line>
          <p class="text-[17px] font-black">${title}</p>
          <p class="mt-1 text-[13.5px] font-medium text-white/70">${hint}</p>
          ${this.phase === "denied" ? html`<lc-button primary wFull class="mt-3" data-scan-retry @click=${() => this._open()}>Try again</lc-button>` : ""}
        </div>
        <div class="absolute inset-x-4 flex items-center" style="top:calc(var(--sat, env(safe-area-inset-top, 0px)) + 0.75rem)">
          <lc-button glass iconOnly aria-label="Stop scanning" style="--lc-button-height:44px" @click=${() => this.$emit("close", {})}><lc-icon name="x" size="20"></lc-icon></lc-button>
        </div>
      </div>`;
  },
});
