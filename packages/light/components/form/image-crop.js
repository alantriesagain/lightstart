import { html, nothing } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { lcText } from "../utils/text.js";
import { cropToBlob, loadPicture, releasePicture } from "./crop-canvas.js";
import { boundsOf, coverRect, keyIntent, panRect, pinchRect, rectAtZoom, wheelFactor, zoomOf, zoomRectAt } from "./crop-rect.js";

/** @import { CropBounds, CropPoint, CropRect, Prop } from "../types.ts" */

/**
 * `lc-image-crop`: pick a picture and choose the square of it to keep. The
 * picture moves under a fixed frame: drag it, pinch or scroll to zoom, use the
 * arrow keys and plus and minus, or the slider. A circle over the frame shows
 * what a round avatar keeps; the square is what `toBlob()` answers, an image
 * `outputSize` wide in `outputType`, stepped down in quality until it is at
 * most `maxBytes`.
 *
 * `pick()` opens the file chooser and has to run inside the tap that asks for
 * it, which is what iOS requires. A file can also be dropped on the frame, or
 * handed over as `src` or through `load()`. `reset()` zooms back out to cover
 * the frame and `clear()` lets the picture go. `status` says where it is:
 * `empty`, `loading`, `ready` or `error`.
 */
export default defineComponent({
  tag: "lc-image-crop",
  style: true,
  props: {
    src: "",
    accept: "image/*",
    capture: "",
    shape: T.string({ defaultValue: "circle", enum: ["circle", "square"] }),
    outputSize: 512,
    outputType: "image/webp",
    quality: 0.9,
    maxBytes: 150000,
    maxZoom: 4,
    hint: "",
    disabled: false,
    status: T.string({ defaultValue: "empty", enum: ["empty", "loading", "ready", "error"] }),
    error: "",
    zoom: 1,
    _picture: /** @type {Prop<ImageBitmap | null>} */ (T.object({ defaultValue: null, reactive: false, attribute: false })),
    _rect: /** @type {Prop<CropRect | null>} */ (T.object({ defaultValue: null, reactive: false, attribute: false })),
    _bounds: /** @type {Prop<CropBounds | null>} */ (T.object({ defaultValue: null, reactive: false, attribute: false })),
    _pointers: /** @type {Prop<Map<number, CropPoint>>} */ (T.object({ defaultValue: null, reactive: false, attribute: false })),
    _gesture: /** @type {Prop<{ rect: CropRect, scale: number } | null>} */ (T.object({ defaultValue: null, reactive: false, attribute: false })),
    _loads: T.number({ defaultValue: 0, reactive: false, attribute: false }),
  },
  events: {
    loadstart: T.object(),
    load: T.object({ width: T.number(), height: T.number() }),
    change: T.object({ zoom: T.number() }),
    error: T.object({ message: T.string() }),
  },

  connected() {
    this._pointers = new Map();
    const move = (/** @type {PointerEvent} */ e) => this._moved(e);
    const up = (/** @type {PointerEvent} */ e) => this._lifted(e);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    this.$own(() => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    });
  },

  firstUpdated() {
    const frame = this._frame();
    if (!frame) return;
    const wheel = (/** @type {WheelEvent} */ e) => this._wheeled(e);
    const gestureStart = (/** @type {Event} */ e) => this._safariPinch(e, "start");
    const gestureChange = (/** @type {Event} */ e) => this._safariPinch(e, "change");
    frame.addEventListener("wheel", wheel, { passive: false });
    frame.addEventListener("gesturestart", gestureStart);
    frame.addEventListener("gesturechange", gestureChange);
    const resized = new ResizeObserver(() => this._draw());
    resized.observe(frame);
    this.$own(() => {
      frame.removeEventListener("wheel", wheel);
      frame.removeEventListener("gesturestart", gestureStart);
      frame.removeEventListener("gesturechange", gestureChange);
      resized.disconnect();
    });
    if (this.src) return this.load(this.src);
    return undefined;
  },

  /** @param {{ changedProps: Map<string, unknown> }} update */
  updated({ changedProps }) {
    if (changedProps.has("status")) this._draw();
    if (changedProps.has("src") && this.src && changedProps.get("src") !== undefined) return this.load(this.src);
    return undefined;
  },

  disconnected() {
    releasePicture(this._picture);
    this._picture = null;
  },

  _frame() {
    return /** @type {HTMLElement | null} */ (this.querySelector(".image-crop-frame"));
  },

  pick() {
    if (this.disabled) return;
    const input = /** @type {HTMLInputElement | null} */ (this.querySelector(".image-crop-input"));
    if (!input) return;
    input.value = "";
    input.click();
  },

  /**
   * Opens a picture in the frame, zoomed out to cover it.
   * @param {Blob | string} source a file, a blob or an address
   * @returns {Promise<boolean>} whether it opened
   */
  async load(source) {
    const loads = ++this._loads;
    this.status = "loading";
    this.error = "";
    this.$emit("loadstart", {});
    try {
      const picture = await loadPicture(source);
      if (loads !== this._loads) {
        releasePicture(picture);
        return false;
      }
      releasePicture(this._picture);
      this._picture = picture;
      this._bounds = boundsOf(picture.width, picture.height, this.maxZoom);
      this._rect = coverRect(this._bounds);
      this.zoom = 1;
      this.status = "ready";
      this._draw();
      this.$emit("load", { width: picture.width, height: picture.height });
      return true;
    } catch {
      if (loads !== this._loads) return false;
      this.status = "error";
      this.error = lcText("lc-image-crop", "unreadable");
      this.$emit("error", { message: this.error });
      return false;
    }
  },

  /**
   * The square in the frame as an image, or null when there is no picture or
   * no quality brings it under `maxBytes`.
   * @returns {Promise<Blob | null>}
   */
  async toBlob() {
    if (this.status !== "ready" || !this._picture || !this._rect || !this._bounds) return null;
    return cropToBlob(this._picture, this._rect, this._bounds, { size: this.outputSize, type: this.outputType, quality: this.quality, maxBytes: this.maxBytes });
  },

  reset() {
    if (!this._bounds) return;
    this._set(coverRect(this._bounds));
  },

  clear() {
    this._loads++;
    releasePicture(this._picture);
    this._picture = null;
    this._rect = null;
    this._bounds = null;
    this.zoom = 1;
    this.error = "";
    this.status = "empty";
    this._draw();
  },

  /** @param {CropRect} rect */
  _set(rect) {
    this._rect = rect;
    if (this._bounds) this.zoom = zoomOf(rect, this._bounds);
    this._draw();
    this.$emit("change", { zoom: this.zoom });
  },

  _view() {
    return this._frame()?.clientWidth || 0;
  },

  _draw() {
    const canvas = /** @type {HTMLCanvasElement | null} */ (this.querySelector(".image-crop-canvas"));
    const view = this._view();
    if (!canvas || !view) return;
    const size = Math.round(view * (globalThis.devicePixelRatio || 1));
    if (canvas.width !== size) canvas.width = size;
    if (canvas.height !== size) canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, size, size);
    const { _picture: picture, _rect: rect } = this;
    if (!picture || !rect || this.status !== "ready") return;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(picture, rect.x, rect.y, rect.size, rect.size, 0, 0, size, size);
  },

  /** @param {PointerEvent} e */
  _pressed(e) {
    if (this.disabled || this.status !== "ready" || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    this._frame()?.focus({ preventScroll: true });
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  },

  /** @param {PointerEvent} e */
  _moved(e) {
    const was = this._pointers.get(e.pointerId);
    if (!was || !this._rect || !this._bounds) return;
    const view = this._view();
    const now = { x: e.clientX, y: e.clientY };
    if (this._pointers.size === 1)
      this._rect = panRect(this._rect, now.x - was.x, now.y - was.y, view, this._bounds);
     else {
      const [first, second] = [...this._pointers.entries()];
      const other = first[0] === e.pointerId ? second[1] : first[1];
      const box = this._frame()?.getBoundingClientRect();
      const at = (/** @type {CropPoint} */ p) => ({ x: p.x - (box?.left || 0), y: p.y - (box?.top || 0) });
      this._rect = pinchRect(this._rect, [at(was), at(other)], [at(now), at(other)], view, this._bounds);
    }
    this._pointers.set(e.pointerId, now);
    this.zoom = zoomOf(this._rect, this._bounds);
    this._draw();
  },

  /** @param {PointerEvent} e */
  _lifted(e) {
    if (!this._pointers.delete(e.pointerId)) return;
    if (!this._pointers.size && this._rect) this._set(this._rect);
  },

  /** @param {WheelEvent} e */
  _wheeled(e) {
    if (this.disabled || this.status !== "ready" || !this._rect || !this._bounds) return;
    e.preventDefault();
    const box = /** @type {HTMLElement} */ (e.currentTarget).getBoundingClientRect();
    this._set(zoomRectAt(this._rect, wheelFactor(e.deltaY, e.deltaMode), e.clientX - box.left, e.clientY - box.top, this._view(), this._bounds));
  },

  /**
   * Safari's own pinch, on a trackpad and on iOS, arrives as gesture events
   * carrying the scale since the gesture began.
   * @param {Event} e
   * @param {"start" | "change"} phase
   */
  _safariPinch(e, phase) {
    if (this.disabled || this.status !== "ready" || !this._rect || !this._bounds) return;
    e.preventDefault();
    const scale = Number(/** @type {Event & { scale?: number }} */ (e).scale) || 1;
    if (phase === "start" || !this._gesture) {
      this._gesture = { rect: this._rect, scale };
      return;
    }
    const view = this._view();
    this._set(zoomRectAt(this._gesture.rect, scale / this._gesture.scale, view / 2, view / 2, view, this._bounds));
  },

  /** @param {KeyboardEvent} e */
  _key(e) {
    if (this.disabled || this.status !== "ready" || !this._rect || !this._bounds) return;
    const intent = keyIntent(e.key, { shift: e.shiftKey });
    if (!intent) return;
    e.preventDefault();
    const view = this._view();
    if ("pan" in intent) this._set(panRect(this._rect, intent.pan[0], intent.pan[1], view, this._bounds));
    else if ("zoom" in intent) this._set(zoomRectAt(this._rect, intent.zoom, view / 2, view / 2, view, this._bounds));
    else this.reset();
  },

  /**
   * @param {CustomEvent<{ value: number }>} e
   * @param {boolean} done
   */
  _slid(e, done) {
    e.stopPropagation();
    if (!this._rect || !this._bounds) return;
    const rect = rectAtZoom(this._rect, e.detail.value, this._bounds);
    if (done) {
      this._set(rect);
      return;
    }
    this._rect = rect;
    this.zoom = zoomOf(rect, this._bounds);
    this._draw();
  },

  /** @param {Event} e */
  _picked(e) {
    e.stopPropagation();
    const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
    if (file) void this.load(file);
  },

  /** @param {DragEvent} e */
  _dragged(e) {
    if (this.disabled || !e.dataTransfer?.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  },

  /** @param {DragEvent} e */
  _dropped(e) {
    const file = e.dataTransfer?.files?.[0];
    if (this.disabled || !file) return;
    e.preventDefault();
    void this.load(file);
  },

  render() {
    const ready = this.status === "ready";
    const text = (/** @type {string} */ key) => lcText("lc-image-crop", key);
    return html`
      <div class="image-crop-frame" data-shape=${this.shape} data-status=${this.status} tabindex=${ready ? "0" : "-1"}
        aria-label=${text("frame")}
        @pointerdown=${(/** @type {PointerEvent} */ e) => this._pressed(e)}
        @keydown=${(/** @type {KeyboardEvent} */ e) => this._key(e)}
        @dragover=${(/** @type {DragEvent} */ e) => this._dragged(e)}
        @drop=${(/** @type {DragEvent} */ e) => this._dropped(e)}>
        <canvas class="image-crop-canvas" aria-hidden="true"></canvas>
        ${ready ? html`<div class="image-crop-mask" aria-hidden="true"></div>` : nothing}
        ${this.status === "empty" ? html`
          <button type="button" class="image-crop-choose" data-choose ?disabled=${this.disabled} @click=${() => this.pick()}>
            <lc-icon name="image" size="28"></lc-icon>
            <span class="image-crop-choose-label">${text("choose")}</span>
            <span class="image-crop-choose-sub">${text("drop")}</span>
          </button>` : nothing}
        ${this.status === "loading" ? html`
          <div class="image-crop-state"><lc-spinner size="sm"></lc-spinner><span>${text("loading")}</span></div>` : nothing}
        ${this.status === "error" ? html`
          <div class="image-crop-state" role="alert">
            <span>${this.error}</span>
            <button type="button" class="image-crop-again" ?disabled=${this.disabled} @click=${() => this.pick()}>${text("choose")}</button>
          </div>` : nothing}
      </div>
      <div class="image-crop-zoom" ?hidden=${!ready}>
        <lc-icon name="zoom-out" size="16" aria-hidden="true"></lc-icon>
        <lc-slider class="image-crop-slider" min="1" max=${this.maxZoom} step="0.01" nofill .value=${this.zoom}
          label=${text("zoom")} ?disabled=${!ready || this.disabled}
          @input=${(/** @type {CustomEvent<{ value: number }>} */ e) => this._slid(e, false)}
          @change=${(/** @type {CustomEvent<{ value: number }>} */ e) => this._slid(e, true)}></lc-slider>
        <lc-icon name="zoom-in" size="16" aria-hidden="true"></lc-icon>
      </div>
      ${ready ? html`<p class="image-crop-hint">${this.hint || text("hint")}</p>` : nothing}
      <input type="file" class="image-crop-input" hidden accept=${this.accept} capture=${this.capture || nothing}
        @change=${(/** @type {Event} */ e) => this._picked(e)} />`;
  },
});
