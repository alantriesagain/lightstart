import { html, nothing } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";
import cameraLink from "../controllers/link.js";

/** @import { Prop, RemoteState } from "../types.ts" */

const HOLD_MS = 3000;

/**
 * The phone that is the camera, opened from the other phone's QR (the page's
 * `#cam=` link, or `link` when `<camera-scan>` read it in the app, or the
 * remembered pair when `again` is set): its own
 * camera full screen over whatever page the link landed on, what the other
 * phone asked for (the countdown, the shot on its way), and a way out that
 * leaves the page as it was. Lock makes the screen deaf to touch, for a
 * phone set down or handed over; a three-second hold on the lock unlocks it.
 * Nothing is kept on this phone.
 */
export default defineComponent({
  tag: "camera-link",
  class: "block",
  props: {
    link: T.string({ defaultValue: "", attribute: false }),
    again: false,
    status: T.string({ defaultValue: "idle", attribute: false, sync: cameraLink }),
    error: T.string({ defaultValue: "", attribute: false, sync: cameraLink }),
    camera: /** @type {Prop<RemoteState>} */ (T.object({ defaultValue: { phase: "off", count: 0, facing: "environment" }, attribute: false, sync: cameraLink })),
    stream: /** @type {Prop<MediaStream | null>} */ (T.object({ defaultValue: null, attribute: false, sync: cameraLink })),
    kind: T.string({ defaultValue: "web", attribute: false, sync: cameraLink }),
    locked: T.boolean({ defaultValue: false, attribute: false, sync: cameraLink }),
    _hold: /** @type {Prop<ReturnType<typeof setTimeout> | null>} */ (T.object({ reactive: false, defaultValue: null })),
  },

  connected() {
    const remembered = cameraLink.remembered;
    if (this.again && remembered) return cameraLink.serve(remembered);
    return cameraLink.serve(this.link || location.hash);
  },

  _holdStart() {
    this._holdEnd();
    this._hold = setTimeout(() => { this._hold = null; cameraLink.unlock(); }, HOLD_MS);
  },

  _holdEnd() {
    if (this._hold) clearTimeout(this._hold);
    this._hold = null;
  },

  async _leave() {
    await cameraLink.stop();
    history.replaceState(null, "", location.pathname + location.search);
    this.remove();
  },

  /** @returns {[string, string] | null} */
  _line() {
    if (this.status === "expired") return ["This code has expired", "Show a new one on the other phone and scan it again."];
    if (this.status === "error") return ["No camera link here", this.error];
    if (this.camera.phase === "denied") return ["The camera is off for this page", "Allow it in the browser's site settings, then scan the code again."];
    if (this.status === "opening" || this.status === "waiting") return ["Reaching the other phone", "Keep both phones online."];
    if (this.camera.phase === "off") return ["Paused", "The camera wakes when the other phone opens its camera."];
    return null;
  },

  render() {
    const live = ["live", "counting", "sending"].includes(this.camera.phase);
    const line = this._line();
    const connected = this.status === "connected";
    return html`
      <div class="fixed inset-0 z-[9998] overflow-hidden bg-black text-white">
        ${this.stream && live ? html`<video class="absolute inset-0 h-full w-full object-cover" autoplay muted playsinline .srcObject=${this.stream} style=${this.camera.facing === "user" && this.kind !== "native" ? "transform:scaleX(-1)" : nothing}></video>` : ""}
        ${this.camera.phase === "counting" ? html`<div class="pointer-events-none absolute inset-0 flex items-center justify-center"><span data-link-count class="text-[200px] font-black leading-none drop-shadow-lg">${this.camera.count}</span></div>` : ""}
        ${this.camera.phase === "sending" ? html`<div class="pointer-events-none absolute inset-0 bg-white/70"></div>` : ""}
        ${line ? html`<div class="absolute inset-x-8 top-1/3 text-center"><p class="text-[19px] font-black">${line[0]}</p><p class="mt-1.5 text-[14px] font-medium text-white/70">${line[1]}</p></div>` : ""}
        ${this.locked
          ? html`
            <div class="absolute inset-0 z-10 touch-none select-none" @touchstart=${(/** @type {Event} */ e) => e.preventDefault()} @contextmenu=${(/** @type {Event} */ e) => e.preventDefault()}></div>
            <div class="absolute inset-x-4 z-20 flex flex-col items-center gap-2" style="bottom:calc(var(--sab, env(safe-area-inset-bottom, 0px)) + 1.25rem)">
              <button type="button" data-link-lock class="flex h-12 w-12 items-center justify-center rounded-full border-0 bg-black/60 text-white" aria-label="Hold to unlock" @pointerdown=${() => this._holdStart()} @pointerup=${() => this._holdEnd()} @pointercancel=${() => this._holdEnd()} @pointerleave=${() => this._holdEnd()}><lc-icon name="lock" size="20"></lc-icon></button>
              <span class="rounded-full bg-black/60 px-3 py-1.5 text-[12px] font-bold text-white/80">Locked. Hold the lock for three seconds to unlock.</span>
            </div>`
          : html`
            <div class="absolute inset-x-4 flex items-center justify-between" style="top:calc(var(--sat, env(safe-area-inset-top, 0px)) + 0.75rem)">
              <lc-button glass iconOnly aria-label="Stop being the camera" style="--lc-button-height:44px" @click=${() => this._leave()}><lc-icon name="x" size="20"></lc-icon></lc-button>
              <span data-link-status class="flex items-center gap-2 rounded-full bg-black/60 px-3.5 py-2 text-[14px] font-black">
                <span class=${connected ? "h-2 w-2 rounded-full bg-success" : "h-2 w-2 rounded-full bg-warning"}></span>${connected ? "Connected" : "Not connected"}
              </span>
              <lc-button glass iconOnly aria-label="Lock the screen" style="--lc-button-height:44px" data-link-lock-on @click=${() => cameraLink.lock()}><lc-icon name="lock" size="20"></lc-icon></lc-button>
            </div>`}
      </div>`;
  },
});
