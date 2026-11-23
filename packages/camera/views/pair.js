import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";
import cameraLink from "../controllers/link.js";

/** @import { Prop, RemoteState } from "../types.ts" */

/**
 * Pairing another phone as the camera, as a bottom sheet a capture screen
 * opens: what it is and Show the code, then the QR the other phone opens
 * while this one waits, then the paired state with the way back to this
 * phone's camera. Closes itself once the other phone connects. On the other
 * phone, the same sheet's Broadcast to the other phone opens `<camera-scan>`.
 */
export default defineComponent({
  tag: "camera-pair",
  class: "block",
  props: {
    open: false,
    role: T.string({ defaultValue: "idle", attribute: false, sync: cameraLink }),
    status: T.string({ defaultValue: "idle", attribute: false, sync: cameraLink }),
    pairUrl: T.string({ defaultValue: "", attribute: false, sync: cameraLink }),
    error: T.string({ defaultValue: "", attribute: false, sync: cameraLink }),
    camera: /** @type {Prop<RemoteState>} */ (T.object({ defaultValue: { phase: "off", count: 0, facing: "environment" }, attribute: false, sync: cameraLink })),
    scanning: T.boolean({ defaultValue: false, attribute: false }),
  },
  events: {
    close: T.object({}),
  },

  /** @param {{ changedProps: Map<string, unknown> }} detail */
  updated({ changedProps }) {
    if (changedProps.has("status") && this.open && this.status === "connected" && changedProps.get("status") !== "connected") this.$emit("close", {});
  },

  _body() {
    const link = cameraLink;
    const hosting = this.role === "viewer";
    if (hosting && this.status === "connected")
      return html`
        <div slot="sheet" class="pb-2 text-default">
          <h2 class="px-1 text-[22px] font-black tracking-tight">The other phone is the camera</h2>
          <p class="mt-2 px-1 text-[15px] font-medium leading-normal text-muted">Its ${this.camera.facing === "user" ? "front" : "back"} camera shows here, and the shutter works it.</p>
          <lc-button primary wFull class="mt-4" @click=${() => this.$emit("close", {})}>Done</lc-button>
          <lc-button ghost wFull class="mt-1" data-unpair @click=${() => link.stop()}>Use this phone's camera</lc-button>
        </div>`;
    if (hosting && (this.status === "waiting" || this.status === "opening"))
      return html`
        <div slot="sheet" class="pb-2 text-default">
          <h2 class="px-1 text-[22px] font-black tracking-tight">Scan with the other phone</h2>
          <div class="mt-4 flex justify-center">
            ${this.pairUrl
              ? html`<div class="rounded-[22px] bg-white p-3 text-black"><qr-code data-pair-code size="220" value=${this.pairUrl}></qr-code></div>`
              : html`<div class="flex h-[244px] items-center justify-center"><lc-spinner></lc-spinner></div>`}
          </div>
          <p class="mt-4 px-1 text-center text-[14px] font-medium leading-normal text-muted">On the other phone, open this same sheet and tap Broadcast to the other phone, or open the code with its camera app. Both phones need to be online; on the same Wi-Fi the video goes straight between them.</p>
          <p class="mt-3 flex items-center justify-center gap-2 text-[13px] font-bold text-muted"><lc-spinner size="sm"></lc-spinner>Waiting for the other phone</p>
          <lc-button ghost wFull class="mt-2" @click=${() => link.stop()}>Stop</lc-button>
        </div>`;
    return html`
      <div slot="sheet" class="pb-2 text-default">
        <h2 class="px-1 text-[22px] font-black tracking-tight">Another phone as the camera</h2>
        <p class="mt-2 px-1 text-[15px] font-medium leading-normal text-muted">Stand a second phone where it sees you. This phone shows what it sees, works the shutter and keeps the photo.</p>
        ${this.error ? html`<p class="mt-2 px-1 text-[14px] font-bold text-danger">${this.error}</p>` : ""}
        <lc-button primary wFull class="mt-4" data-pair-start @click=${() => link.host()}><lc-icon name="qr-code" size="18"></lc-icon>Show the code</lc-button>
        <lc-button ghost wFull class="mt-1" data-pair-scan @click=${() => { this.scanning = true; }}><lc-icon name="scan-line" size="18"></lc-icon>Broadcast to the other phone</lc-button>
      </div>`;
  },

  render() {
    return html`
      <lc-bottom-sheet grabber ?open=${this.open && !this.scanning}
        @sheet-closed=${(/** @type {Event} */ e) => { e.stopPropagation(); if (!this.scanning) this.$emit("close", {}); }}>
        ${this.open && !this.scanning ? this._body() : ""}
      </lc-bottom-sheet>
      ${this.scanning ? html`<camera-scan @close=${() => { this.scanning = false; this.$emit("close", {}); }}></camera-scan>` : ""}`;
  },
});
