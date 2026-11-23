import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";
import devices from "../controllers/devices.js";

/** @import { Prop, ConnectTarget, ConnectedDevice, DeviceStatus, ScannedDevice } from "../types.ts" */

/**
 * Connecting one device: the remembered rows, a scan, and the connected
 * device's status, as a small block an app drops on a settings page.
 */
export default defineComponent({
  tag: "devices-connect",
  class: "block",
  props: {
    capability: "",
    available: T.boolean({ defaultValue: false, attribute: false, sync: devices }),
    connectionState: T.string({ defaultValue: "idle", attribute: false, sync: devices }),
    scanned: /** @type {Prop<ScannedDevice[]>} */ (T.array({ defaultValue: [], attribute: false, sync: devices })),
    device: /** @type {Prop<ConnectedDevice | null>} */ (T.object({ defaultValue: null, attribute: false, sync: devices })),
    status: /** @type {Prop<DeviceStatus>} */ (T.object({ defaultValue: {}, attribute: false, sync: devices })),
    error: T.string({ defaultValue: "", attribute: false, sync: devices }),
    busy: T.string({ defaultValue: "", attribute: false, sync: devices }),
    known: /** @type {Prop<ConnectTarget[]>} */ (T.array({ defaultValue: [], attribute: false, sync: devices })),
    confirmForget: false,
  },
  connected() {
    const auto = this.known.find((row) => row.autoConnect);
    if (auto && !devices.isReady()) void devices.connect(auto);
  },
  async _scan() {
    await devices.scan({});
  },
  /** @param {ConnectTarget} row */
  async _connect(row) {
    await devices.connect(row);
  },
  async _forget() {
    await devices.forget();
    this.confirmForget = false;
  },
  /** @returns {string} */
  _statusLine() {
    const { battery, recording } = this.status;
    const bits = [];
    if (typeof battery === "number") bits.push(`${battery}% battery`);
    if (recording) bits.push("recording");
    return bits.join(" · ") || "connected";
  },
  render() {
    if (!this.available)
      return html`
        <lc-empty-state
          icon="smartphone"
          title="Open the phone app"
          description="Connecting a camera needs Bluetooth, which only the installed app can reach."
          size="sm"
        ></lc-empty-state>`;

    if (devices.isReady())
      return html`
        <lc-flex direction="column" gap="sm">
          <lc-flex justify="space-between" align="center" gap="md">
            <span class="min-w-0">
              <span class="block text-sm font-semibold">${this.device?.name || "Camera"}</span>
              <span class="block text-xs text-muted">${this._statusLine()}</span>
            </span>
            <lc-badge variant="success" size="sm">Connected</lc-badge>
          </lc-flex>
          <lc-flex gap="sm">
            <lc-button size="sm" @click=${() => devices.disconnect()}>Disconnect</lc-button>
            ${this.confirmForget
              ? html`<lc-button size="sm" danger @click=${() => this._forget()}>Really forget?</lc-button>`
              : html`<lc-button size="sm" outline @click=${() => (this.confirmForget = true)}>Forget & re-pair</lc-button>`}
          </lc-flex>
          <p class="text-xs text-muted">Filming at 1080p keeps clips small enough to import comfortably.</p>
        </lc-flex>`;

    const scanning = this.connectionState === "scanning";
    const connecting = this.connectionState === "connecting";
    const rows = this.scanned.length ? this.scanned : this.known;
    return html`
      <lc-flex direction="column" gap="sm">
        ${rows.map(
          (row) => html`
          <lc-flex justify="space-between" align="center" gap="md">
            <span class="min-w-0 truncate text-sm font-semibold">${row.name || row.id}</span>
            <lc-button size="sm" primary ?disabled=${connecting} @click=${() => this._connect(row)}>
              ${connecting ? "Connecting…" : "Connect"}
            </lc-button>
          </lc-flex>`,
        )}
        ${!rows.length && !scanning
          ? html`<p class="text-xs text-muted">Put the camera in pairing mode, then scan.</p>`
          : ""}
        <lc-button size="sm" ?disabled=${scanning} @click=${() => this._scan()}>
          ${scanning ? "Scanning…" : "Scan for cameras"}
        </lc-button>
        ${this.error ? html`<p class="text-xs text-danger">${this.error}</p>` : ""}
      </lc-flex>`;
  },
});
