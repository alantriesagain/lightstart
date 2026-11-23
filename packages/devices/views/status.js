import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";
import devices from "../controllers/devices.js";

/** @import { Prop, ConnectedDevice, DeviceStatus } from "../types.ts" */

/**
 * A one-line badge for the connected device: its battery and whether it is
 * recording, for an app's header.
 */
export default defineComponent({
  tag: "devices-status",
  class: "inline-flex",
  props: {
    hue: "rgba(255,255,255,0.75)",
    background: "rgba(255,255,255,0.1)",
    available: T.boolean({ defaultValue: false, attribute: false, sync: devices }),
    connectionState: T.string({ defaultValue: "idle", attribute: false, sync: devices }),
    device: /** @type {Prop<ConnectedDevice | null>} */ (T.object({ defaultValue: null, attribute: false, sync: devices })),
    status: /** @type {Prop<DeviceStatus>} */ (T.object({ defaultValue: {}, attribute: false, sync: devices })),
  },
  render() {
    if (!devices.isReady()) return html``;
    const { battery, recording } = this.status;
    return html`
      <span
        class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums"
        style="background:${this.background};color:${this.hue}"
      >
        ${recording
          ? html`<span class="h-2 w-2 rounded-full" style="background:#fb4934"></span>REC`
          : html`<lc-icon name="video" size="12"></lc-icon>`}
        ${typeof battery === "number" ? html`<span>${battery}%</span>` : ""}
      </span>`;
  },
});
