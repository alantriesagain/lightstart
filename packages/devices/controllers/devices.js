/**
 * @import { MediaItem, TimerHandle, Transport, DriverSession, PreviewStats } from "../types.ts"
 * @import { ConnectedDevice, DeviceStatus, ScannedDevice, DeviceControl, PreviewState } from "../types.ts"
 * @import { DeviceDriver, ConnectTarget } from "../types.ts"
 */
import { deviceConnected, deviceControls, deviceDisconnected, deviceError, deviceImportProgress, devicePreview, deviceRecording, deviceScanResult, deviceStatus, installDeviceSignals } from "../signals.js";
import { defineController } from "@lightstart/light/controller";
import { mobile } from "@lightstart/mobile/page";
import { registerDriver, getDrivers, driverById, driverFor, scanServices } from "../lib/registry.js";
import { selectTransport } from "./devices/select-transport.js";

const KEEPALIVE_MS = 45000;
const PREVIEW_IDLE_MS = 10 * 60 * 1000;

const FRIENDLY = /** @type {Record<string, string>} */ ({
  "ble-not-paired":
    "Pairing needed. Pull down the notification shade and tap “Pair & connect”, then try again.",
  "bluetooth-permission-denied": "Bluetooth permission is off for this app.",
  "wifi-join-failed": "Could not join the camera's WiFi. Accept the prompt and try again.",
});

const devices = defineController({
  name: "devices",
  props: {
    available: false,
    connectionState: "idle",
    scanned: /** @type {ScannedDevice[]} */ ([]),
    device: /** @type {ConnectedDevice | null} */ (null),
    status: /** @type {DeviceStatus} */ ({}),
    busy: "",
    previewState: /** @type {PreviewState} */ ("off"),
    controls: /** @type {DeviceControl[]} */ ([]),
    progress: 0,
    error: "",
    known: /** @type {ConnectTarget[]} */ ([]),
  },
  sync: {
    known: { to: "local", key: "devices:known" },
  },
  _transport: /** @type {Transport} */ (/** @type {unknown} */ (null)),
  _session: /** @type {DriverSession | null} */ (null),
  _offs: /** @type {Array<() => void>} */ ([]),
  _keepAlive: /** @type {TimerHandle | null} */ (null),
  _previewIdle: /** @type {TimerHandle | null} */ (null),
  _offPreview: /** @type {(() => void) | null} */ (null),
  _previewStats: /** @type {PreviewStats | null} */ (null),
  _previewExpires: false,

  connected() {
    installDeviceSignals();
    this._offs = [];
    this._refresh();
    if (mobile.present && mobile.ready) return mobile.ready.then(() => this._refresh()).catch(() => {});
    return null;
  },

  _refresh() {
    this._transport = selectTransport();
    this.available = this._transport.available();
    return this.available;
  },

  /** @param {DeviceDriver} driver */
  registerDriver(driver) {
    return registerDriver(driver);
  },

  drivers() {
    return getDrivers();
  },

  /** @param {string} capability */
  can(capability) {
    return Boolean(this.device?.capabilities?.includes(capability));
  },

  /** A live session and a link to use it on: narrows `_session` for the callers that need it. @returns {this is { _session: DriverSession }} */
  isReady() {
    return this.connectionState === "ready" && Boolean(this._session);
  },

  /** @param {string} code */
  _fail(code) {
    this.error = FRIENDLY[code] ?? code;
    this.connectionState = "error";
    deviceError.emit({ id: this.device?.id, code });
    return code;
  },

  async scan({ timeoutMs = 8000 } = {}) {
    if (!this._refresh()) return [];
    this.error = "";
    this.connectionState = "scanning";
    this.scanned = [];
    try {
      const found = await this._transport.ble.scan({ services: scanServices(), timeoutMs });
      const tagged = [];
      for (const advertisement of found ?? []) {
        const driver = driverFor(advertisement);
        if (!driver) continue;
        const row = { ...advertisement, driverId: driver.id, driverLabel: driver.label };
        tagged.push(row);
        deviceScanResult.emit(row);
      }
      this.scanned = tagged;
      this.connectionState = this._session ? "ready" : "idle";
      return tagged;
    } catch (e) {
      this._fail(e instanceof Error ? e.message : "scan-failed");
      return [];
    }
  },

  async stopScan() {
    if (!this.available) return;
    await this._transport.ble.stopScan().catch(() => {});
    if (this.connectionState === "scanning") this.connectionState = this._session ? "ready" : "idle";
  },

  /** @param {string | ConnectTarget} target */
  async connect(target) {
    if (!this._refresh()) return null;
    const record = typeof target === "string" ? this._known(target) : target;
    if (!record) return this._fail("unknown-device"), null;
    const driver = driverById(record.driverId ?? record.driver ?? "");
    if (!driver) return this._fail("no-driver"), null;

    this.error = "";
    this.connectionState = "connecting";
    const offPairing = this._transport.ble.onPairing?.(() => {
      this.connectionState = "pairing";
    });
    try {
      const session = await driver.connect(this._transport, record);
      this._session = session;
      this.device = {
        id: record.id,
        name: record.name ?? "",
        driverId: driver.id,
        capabilities: session.capabilities ?? driver.capabilities ?? [],
      };
      this._wireSession(session);
      this._persist(record, driver);
      this.connectionState = "ready";
      deviceConnected.emit({ ...this.device });
      this._startKeepAlive();
      this.refreshStatus().catch(() => {});
      this.refreshControls().catch(() => {});
      return this.device;
    } catch (e) {
      this._fail(e instanceof Error ? e.message : "connect-failed");
      return null;
    } finally {
      offPairing?.();
    }
  },

  /** @param {DriverSession} session */
  _wireSession(session) {
    this._offs = [
      session.on?.("status", (data) => {
        this.status = { ...data };
        deviceStatus.value = { id: this.device?.id, ...data };
      }),
      session.on?.("recording", (data) => {
        this.status = { ...this.status, recording: data.recording };
        deviceRecording.emit({
          id: this.device?.id,
          recording: data.recording,
          at: new Date().toISOString(),
        });
      }),
      session.on?.("state", (data) => {
        if (!data?.connected) this._dropped(data?.reason || "link-lost");
      }),
      session.on?.("controls", (list) => {
        this.controls = list ?? [];
        deviceControls.emit({
          id: this.device?.id,
          controls: this.controls,
        });
      }),
      session.on?.("credentials", (data) => {
        const id = this.device?.id;
        if (!id) return;
        this.known = this.known.map((row) =>
          row.id === id ? { ...row, wifiSsid: data.ssid ?? "", wifiPass: data.password ?? "" } : row,
        );
      }),
    ].filter(Boolean);
  },

  /** @param {string} reason */
  _dropped(reason) {
    this.stopPreview();
    this._stopKeepAlive();
    this._session = null;
    this.connectionState = "error";
    this.error = reason;
    deviceDisconnected.emit({ id: this.device?.id, reason });
  },

  /** @param {string} id @returns {ConnectTarget | null} */
  _known(id) {
    const row = this.known.find((entry) => entry.id === id);
    return row ? { ...row, driverId: row.driverId ?? row.driver } : null;
  },

  /** @param {ConnectTarget} record @param {DeviceDriver} driver */
  _persist(record, driver) {
    const now = new Date().toISOString();
    const row = {
      id: record.id,
      driver: driver.id,
      name: record.name ?? "",
      capabilities: this.device?.capabilities ?? [],
      wifiSsid: record.wifiSsid ?? "",
      wifiPass: record.wifiPass ?? "",
      autoConnect: record.autoConnect ?? true,
      lastSeenAt: now,
    };
    const existing = this.known.find((entry) => entry.id === record.id);
    this.known = existing
      ? this.known.map((entry) => (entry.id === record.id ? { ...entry, ...row, driverId: driver.id } : entry))
      : [...this.known, { ...row, driverId: driver.id, createdAt: now }];
  },

  /** @param {string} [id] */
  async forget(id) {
    const target = id ?? this.device?.id;
    if (!target) return;
    if (this.device?.id === target) await this.disconnect();
    this.known = this.known.filter((row) => row.id !== target);
  },

  async disconnect() {
    await this.stopPreview();
    this._stopKeepAlive();
    const session = this._session;
    this._session = null;
    for (const off of this._offs) off?.();
    this._offs = [];
    const id = this.device?.id;
    try {
      await session?.close?.();
    } catch {
      void 0;
    }
    this.connectionState = "idle";
    this.status = {};
    this.controls = [];
    this.device = null;
    if (id) deviceDisconnected.emit({ id, reason: "user" });
  },

  _startKeepAlive() {
    this._stopKeepAlive();
    if (!this._session?.keepAlive) return;
    this._keepAlive = setInterval(() => {
      this._session?.keepAlive?.().catch(() => this._dropped("keepalive-failed"));
    }, KEEPALIVE_MS);
  },

  _stopKeepAlive() {
    clearInterval(/** @type {TimerHandle} */ (this._keepAlive));
    this._keepAlive = null;
  },

  async refreshStatus() {
    if (!this.isReady() || !this.can("telemetry")) return null;
    const next = await this._session.status?.();
    if (!next) return null;
    this.status = { ...next };
    deviceStatus.value = { id: this.device?.id, ...next };
    return next;
  },

  async refreshControls() {
    if (!this.isReady() || !this.can("controls")) return [];
    this.controls = (await this._session.listControls?.()) ?? [];
    deviceControls.emit({ id: this.device?.id, controls: this.controls });
    return this.controls;
  },

  /** @param {string} id @param {number | string} value */
  async setControl(id, value) {
    if (!this.isReady() || !this.can("controls")) return false;
    if (this.status.recording) return this._fail("recording"), false;
    const previous = this.controls;
    this.controls = this.controls.map((control) =>
      control.id === id ? { ...control, value } : control,
    );
    try {
      await this._session.setControl?.(id, value);
      if (this.previewState !== "off") this._armPreviewIdle();
      return true;
    } catch (e) {
      this.controls = previous;
      this._fail(e instanceof Error ? e.message : "control-failed");
      return false;
    }
  },

  async startRecording() {
    if (!this.isReady() || !this.can("shutter")) return false;
    try {
      await this._session.startRecording?.();
      this.status = { ...this.status, recording: true };
      return true;
    } catch (e) {
      this._fail(e instanceof Error ? e.message : "record-start-failed");
      return false;
    }
  },

  async stopRecording() {
    if (!this.isReady() || !this.can("shutter")) return false;
    try {
      await this._session.stopRecording?.();
      this.status = { ...this.status, recording: false };
      return true;
    } catch (e) {
      this._fail(e instanceof Error ? e.message : "record-stop-failed");
      return false;
    }
  },

  /** @param {{ fit?: "contain" | "cover", expires?: boolean }} [opts] */
  async startPreview({ fit = "contain", expires = true } = {}) {
    if (!this.isReady() || !this.can("preview")) return false;
    this._previewExpires = expires;
    if (this.previewState === "live" || this.previewState === "starting") return true;
    this.previewState = "starting";
    this._emitPreview();
    this._offPreview?.();
    this._offPreview = this._transport.preview.onState((data) => {
      this._previewStats = data;
      if (data?.state === "tracks") return this._emitPreview();
      this.previewState = data?.state ?? "off";
      this._emitPreview(data?.code);
      if (this.previewState === "error") {
        this.error = data?.code || "preview-lost";
        this.stopPreview();
      }
    });
    try {
      await this._session.startPreview?.({ fit });
      this._armPreviewIdle();
      return true;
    } catch (e) {
      this.previewState = "off";
      this._offPreview?.();
      this._offPreview = null;
      this._fail(e instanceof Error ? e.message : "preview-failed");
      return false;
    }
  },

  async stopPreview() {
    clearTimeout(/** @type {TimerHandle} */ (this._previewIdle));
    this._previewIdle = null;
    this._offPreview?.();
    this._offPreview = null;
    if (this.previewState === "off") return;
    this.previewState = "off";
    this._emitPreview();
    await this._session?.stopPreview?.().catch(() => {});
    await this._transport?.preview?.stop?.().catch(() => {});
  },

  _armPreviewIdle() {
    clearTimeout(/** @type {TimerHandle} */ (this._previewIdle));
    this._previewIdle = this._previewExpires === false
      ? null
      : setTimeout(() => this.stopPreview(), PREVIEW_IDLE_MS);
  },

  /** @param {string} [code] */
  _emitPreview(code) {
    globalThis.document?.documentElement?.classList?.toggle(
      "native-preview",
      this.previewState === "live" || this.previewState === "buffering",
    );
    devicePreview.emit({
      ...this._previewStats,
      state: this.previewState,
      code,
    });
  },

  isPreviewing() {
    return this.previewState !== "off";
  },

  /** @param {{ x?: number, y?: number, width?: number, height?: number, fit?: string }} [rect] */
  setPreviewBounds(rect) {
    if (this.previewState === "off") return;
    this._transport?.preview?.bounds?.(rect ?? {}).catch(() => {});
  },

  async capturePreviewFrame() {
    if (this.previewState !== "live") return null;
    this._armPreviewIdle();
    try {
      return await this._transport.preview.snapshot();
    } catch (e) {
      this._fail(e instanceof Error ? e.message : "snapshot-failed");
      return null;
    }
  },

  async capturePhoto() {
    if (!this.isReady() || !this._session.capturePhoto) return false;
    try {
      await this._session.capturePhoto();
      return true;
    } catch (e) {
      this._fail(e instanceof Error ? e.message : "photo-failed");
      return false;
    }
  },

  async listMedia(opts = {}) {
    if (!this.isReady() || !this.can("media-import")) return [];
    this.busy = "listing";
    try {
      return (await this._session.listMedia?.(opts)) ?? [];
    } catch (e) {
      this._fail(e instanceof Error ? e.message : "media-list-failed");
      return [];
    } finally {
      this.busy = "";
    }
  },

  /**
   * @param {MediaItem[]} items
   * @param {{ onProgress?: (done: number, total: number) => void }} [opts]
   */
  async importMedia(items, { onProgress } = {}) {
    if (!this.isReady() || !this.can("media-import")) return [];
    if (!items?.length) return [];
    await this.stopPreview();
    this.busy = "importing";
    this.progress = 0;
    try {
      return (
        (await this._session.importMedia?.(items, {
          onProgress: (done, total) => {
            this.progress = total ? done / total : 0;
            deviceImportProgress.emit({
              id: this.device?.id,
              done,
              total,
            });
            onProgress?.(done, total);
          },
        })) ?? []
      );
    } catch (e) {
      this._fail(e instanceof Error ? e.message : "media-import-failed");
      return [];
    } finally {
      this.busy = "";
      this.progress = 0;
    }
  },

  disconnected() {
    clearTimeout(/** @type {TimerHandle} */ (this._previewIdle));
    this._offPreview?.();
    this._offPreview = null;
    this.previewState = "off";
    this._stopKeepAlive();
    for (const off of this._offs) off?.();
    this._offs = [];
    this._session?.close?.().catch(() => {});
    this._session = null;
  },
});

export default devices;
