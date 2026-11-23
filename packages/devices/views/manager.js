import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";
import devices from "../controllers/devices.js";

/** @import { Prop, ConnectTarget, ConnectedDevice, DeviceStatus, ScannedDevice } from "../types.ts" */

const ON_PRIMARY =
  "background:var(--color-primary, #fabd2f);color:var(--color-on-primary, var(--lc-button-primary-color, #131711))";

/**
 * A device list for a settings page: each remembered device, its state, the
 * way in and out, and an add panel that scans. Emits `camera` with the id when
 * the connected device can preview, for an app's own capture screen.
 */
export default defineComponent({
  tag: "devices-manager",
  class: "block",
  events: {
    camera: T.object({ id: T.string() }),
  },
  props: {
    available: T.boolean({ defaultValue: false, attribute: false, sync: devices }),
    connectionState: T.string({ defaultValue: "idle", attribute: false, sync: devices }),
    scanned: /** @type {Prop<ScannedDevice[]>} */ (T.array({ defaultValue: [], attribute: false, sync: devices })),
    device: /** @type {Prop<ConnectedDevice | null>} */ (T.object({ defaultValue: null, attribute: false, sync: devices })),
    status: /** @type {Prop<DeviceStatus>} */ (T.object({ defaultValue: {}, attribute: false, sync: devices })),
    error: T.string({ defaultValue: "", attribute: false, sync: devices }),
    known: /** @type {Prop<ConnectTarget[]>} */ (T.array({ defaultValue: [], attribute: false, sync: devices })),
    adding: false,
    confirmForget: "",
  },
  async _add() {
    this.adding = true;
    await devices.scan({});
  },
  /** @param {ConnectTarget} row */
  async _connect(row) {
    this.adding = false;
    await devices.connect(row);
  },
  async _disconnect() {
    await devices.disconnect();
  },
  /** @param {string} [id] */
  async _forget(id) {
    await devices.forget(id);
    this.confirmForget = "";
  },
  /** @param {ConnectTarget} row */
  _isConnected(row) {
    return devices.isReady() && devices.device?.id === row.id;
  },
  /** @param {ConnectTarget} row */
  _statusLine(row) {
    if (!this._isConnected(row)) {
      if (this.connectionState === "pairing")
        return "Pairing: tap “Pair & connect” in your notifications";
      if (this.connectionState === "connecting") return "Connecting…";
      if (this.error && this.device?.id === row.id) return this.error;
      return "Not connected";
    }
    const { battery, recording } = this.status;
    const bits = [];
    if (recording) bits.push("recording");
    if (typeof battery === "number") bits.push(`${battery}% battery`);
    return bits.join(" · ") || "Connected";
  },
  /** @param {ConnectTarget} row */
  _deviceCard(row) {
    const connected = this._isConnected(row);
    return html`
      <div class="rounded-3xl p-4" style="background:var(--color-surface, #ffffff)" data-device=${row.id}>
        <div class="flex items-center gap-3">
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style=${connected ? ON_PRIMARY : "background:var(--color-surface-lighter,#e9e6dd);color:var(--text-muted,#6e7169)"}
          >
            <lc-icon name="video" size="18"></lc-icon>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold">${row.name || row.id}</span>
            <span class="block truncate text-xs text-muted">${this._statusLine(row)}</span>
          </span>
        </div>
        <lc-flex gap="sm" class="mt-3">
          ${connected && devices.can("preview")
            ? html`
            <lc-button size="sm" primary data-open-camera @click=${() => this.$emit("camera", { id: row.id })}>
              <lc-icon name="camera" size="15"></lc-icon>
            </lc-button>`
            : ""}
          ${connected
            ? html`<lc-button size="sm" outline @click=${() => this._disconnect()}>Disconnect</lc-button>`
            : html`<lc-button size="sm" primary @click=${() => this._connect(row)}>Connect</lc-button>`}
          ${this.confirmForget === row.id
            ? html`<lc-button size="sm" danger @click=${() => this._forget(row.id)}>Really forget?</lc-button>`
            : html`<lc-button size="sm" outline @click=${() => (this.confirmForget = row.id)}>Forget</lc-button>`}
        </lc-flex>
      </div>`;
  },
  _renderAdd() {
    const scanning = this.connectionState === "scanning";
    const knownIds = new Set(this.known.map((row) => row.id));
    const fresh = this.scanned.filter((row) => !knownIds.has(row.id));
    return html`
      <div class="rounded-3xl p-4" style="background:var(--color-surface, #ffffff)" data-add-panel>
        <lc-flex justify="space-between" align="center">
          <span class="text-sm font-bold">Add a device</span>
          <lc-button size="xs" outline @click=${() => (this.adding = false)}>Cancel</lc-button>
        </lc-flex>
        <p class="mt-1 text-xs text-muted">Put it in pairing mode first. On a GoPro, that's Preferences → Wireless.</p>
        ${scanning
          ? html`<lc-flex justify="center" class="py-6"><lc-spinner></lc-spinner></lc-flex>`
          : html`
            <lc-flex direction="column" gap="xs" class="mt-3">
              ${fresh.map(
                (row) => html`
                <lc-flex justify="space-between" align="center" gap="md">
                  <span class="min-w-0 truncate text-sm font-semibold">${row.name || row.id}</span>
                  <lc-button size="sm" primary @click=${() => this._connect(row)}>Pair</lc-button>
                </lc-flex>`,
              )}
              ${!fresh.length ? html`<p class="text-xs text-muted">Nothing found yet.</p>` : ""}
              <lc-button size="sm" outline class="mt-1" @click=${() => this._add()}>Scan again</lc-button>
            </lc-flex>`}
      </div>`;
  },
  render() {
    if (!this.available)
      return html`
        <lc-empty-state
          icon="smartphone"
          title="Open the phone app"
          description="Connecting a device needs Bluetooth, which only the installed app can reach."
        ></lc-empty-state>`;

    return html`
      <lc-flex direction="column" gap="md">
        ${this.known.map((row) => this._deviceCard(row))}
        ${this.adding
          ? this._renderAdd()
          : html`
            <lc-button primary wFull data-add-device @click=${() => this._add()}>
              <lc-icon name="plus" size="16"></lc-icon>
              Add device
            </lc-button>`}
        ${!this.known.length && !this.adding
          ? html`<p class="text-center text-xs text-muted">No devices yet. A GoPro can film your sets and hand the clips back.</p>`
          : ""}
        ${this.error && !this.adding ? html`<p class="text-xs text-danger">${this.error}</p>` : ""}
      </lc-flex>`;
  },
});
