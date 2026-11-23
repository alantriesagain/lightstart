/**
 * @import { Transport, DriverSession, MediaItem, Advertisement } from "@lightstart/devices"
 * @import { MediaListReply, PresetTree } from "./types.ts"
 */
import {
  SERVICE_CONTROL,
  CHAR_COMMAND,
  CHAR_COMMAND_RESP,
  CHAR_QUERY,
  CHAR_QUERY_RESP,
  CHAR_SETTING,
  CHAR_SETTING_RESP,
  CHAR_WIFI_SSID,
  CHAR_WIFI_PASS,
  WATCHED_STATUSES,
  STATUS_AP_ON,
  PREVIEW_PORT,
  WATCHED_SETTINGS,
  PUSH_SETTINGS,
  PUSH_CAPABILITIES,
  PRESETS_URL,
} from "./lib/constants.js";
import {
  encodeCommand,
  createReassembler,
  parseTlv,
  parseStatuses,
  decodeStatus,
  SHUTTER_ON,
  SHUTTER_OFF,
  AP_ON,
  AP_OFF,
  QUERY_STATUS,
  REGISTER_STATUS,
  LOAD_PRESET_GROUP,
  PRESET_GROUP_FOR,
  SET_SETTING,
  LOAD_PRESET,
  QUERY_SETTINGS,
  QUERY_CAPABILITIES,
  REGISTER_SETTINGS,
  REGISTER_CAPABILITIES,
  parseSettingLists,
} from "./lib/protocol.js";
import { buildControls, settingIdFor } from "./lib/settings.js";
import { buildPresetControl } from "./lib/presets.js";
import {
  parseMediaList,
  isImportable,
  downloadUrl,
  MEDIA_LIST_URL,
  sinceFilter,
  STREAM_START_URL,
  STREAM_STOP_URL,
} from "./lib/media.js";

const REQUEST_TIMEOUT = 8000;
const AP_SETTLE_MS = 3000;
const AP_JOIN_ATTEMPTS = 3;
const PHOTO_SETTLE_MS = 1500;
const STREAM_SETTLE_MS = 600;

/** @param {number[]} bytes */
const decodeAscii = (bytes) => String.fromCharCode(...bytes).replace(/\0+$/, "");

const createEmitter = () => {
  const listeners = new Map();
  return {
    /** @param {string} event @param {(data: unknown) => void} cb */
    on(event, cb) {
      const set = listeners.get(event) ?? new Set();
      set.add(cb);
      listeners.set(event, set);
      return () => set.delete(cb);
    },
    /** @param {string} event @param {unknown} data */
    emit(event, data) {
      for (const cb of listeners.get(event) ?? [])
        try {
          cb(data);
        } catch {
          void 0;
        }
    },
  };
};

const createPending = () => {
  const waiting = new Map();
  return {
    /** @param {string} key */
    add(key) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiting.delete(key);
          reject(new Error("gopro-timeout"));
        }, REQUEST_TIMEOUT);
        waiting.set(key, { resolve, reject, timer });
      });
    },
    /** @param {string} key @param {number | undefined} status @param {number[]} body */
    settle(key, status, body) {
      const entry = waiting.get(key);
      if (!entry) return false;
      waiting.delete(key);
      clearTimeout(entry.timer);
      if (status === 0) entry.resolve(body);
      else entry.reject(new Error(`gopro-status-${status}`));
      return true;
    },
    /** @param {string} reason */
    rejectAll(reason) {
      for (const [, entry] of waiting) {
        clearTimeout(entry.timer);
        entry.reject(new Error(reason));
      }
      waiting.clear();
    },
  };
};

/**
 * @param {Transport} transport
 * @param {{ id: string, name?: string, wifiSsid?: string, wifiPass?: string }} device
 * @returns {Promise<DriverSession>}
 */
const connect = async (transport, device) => {
  const { id } = device;
  const events = createEmitter();
  const pending = createPending();
  /** @type {Array<() => void>} */
  const offs = [];
  /** @type {string | null} */
  let wifiHandle = null;
  let apHolds = 0;
  let previewing = false;
  let mode = "video";
  /**
   * Kept warm by the camera's own pushes, so listing controls never hits the wire.
   * @type {Record<number, number>}
   */
  let settingValues = {};
  /** @type {Record<number, number[]>} */
  let settingCapabilities = {};
  /** @type {PresetTree | null} */
  let presetTree = null;
  /** @type {number | null} */
  let activePresetId = null;
  let credentials = { ssid: device.wifiSsid ?? "", password: device.wifiPass ?? "" };

  await transport.ble.connect(id);

  const controls = () => {
    const preset = buildPresetControl(presetTree, mode, activePresetId);
    return [...(preset ? [preset] : []), ...buildControls(settingCapabilities, settingValues, mode)];
  };
  const emitControls = () => events.emit("controls", controls());

  /** @param {Record<number, number>} next */
  const absorbSettings = (next) => {
    settingValues = { ...settingValues, ...next };
    emitControls();
  };

  /** @param {Record<number, number[]>} next */
  const absorbCapabilities = (next) => {
    settingCapabilities = { ...settingCapabilities, ...next };
    emitControls();
  };

  /** @param {string} char */
  const wire = (char) => {
    const reassembler = createReassembler();
    offs.push(
      transport.ble.onNotify(id, char, (bytes) => {
        const payload = reassembler.push(bytes);
        if (!payload) return;
        const { requestId, status, body } = parseTlv(payload);
        if (pending.settle(`${char}:${requestId}`, status, body)) return;
        if (requestId === PUSH_SETTINGS) return absorbSettings(parseStatuses(body));
        if (requestId === PUSH_CAPABILITIES) return absorbCapabilities(parseSettingLists(body));
        const next = decodeStatus(parseStatuses(body));
        if (Object.keys(next).length) {
          if (next.presetId != null) activePresetId = next.presetId;
          if (next.mode && next.mode !== mode) {
            mode = next.mode;
            presetTree = null;
            emitControls();
          } else if (next.presetId != null) emitControls();
          events.emit("status", next);
          if ("recording" in next) events.emit("recording", { recording: next.recording });
        }
      }),
    );
  };

  await transport.ble.subscribe(id, CHAR_COMMAND_RESP);
  await transport.ble.subscribe(id, CHAR_QUERY_RESP);
  await transport.ble.subscribe(id, CHAR_SETTING_RESP);
  wire(CHAR_COMMAND_RESP);
  wire(CHAR_QUERY_RESP);
  wire(CHAR_SETTING_RESP);

  offs.push(
    transport.ble.onState(id, (state) => {
      if (!state?.connected) {
        pending.rejectAll("link-lost");
        events.emit("state", state);
      }
    }),
  );

  /** @param {string} char @param {number[]} payload @param {string} responseChar */
  const send = async (char, payload, responseChar) => {
    const promise = pending.add(`${responseChar}:${payload[0]}`);
    await transport.ble.write(id, char, encodeCommand(payload));
    return promise;
  };

  /** @param {number[]} payload */
  const command = (payload) => send(CHAR_COMMAND, payload, CHAR_COMMAND_RESP);
  /** @param {number[]} payload */
  const query = (payload) => send(CHAR_QUERY, payload, CHAR_QUERY_RESP);
  /** @param {number[]} payload */
  const setting = (payload) => send(CHAR_SETTING, payload, CHAR_SETTING_RESP);

  const status = async () => {
    const body = await query(QUERY_STATUS(WATCHED_STATUSES));
    return decodeStatus(parseStatuses(body));
  };

  await query(REGISTER_STATUS(WATCHED_STATUSES)).catch(() => {});

  const readControls = async () => {
    const [caps, values] = await Promise.all([
      query(QUERY_CAPABILITIES(WATCHED_SETTINGS)).catch(() => null),
      query(QUERY_SETTINGS(WATCHED_SETTINGS)).catch(() => null),
    ]);
    if (caps) settingCapabilities = parseSettingLists(caps);
    if (values) settingValues = parseStatuses(values);
    emitControls();
    return controls();
  };

  await readControls().catch(() => {});
  await query(REGISTER_SETTINGS(WATCHED_SETTINGS)).catch(() => {});
  await query(REGISTER_CAPABILITIES(WATCHED_SETTINGS)).catch(() => {});

  const readCredentials = async () => {
    if (credentials.ssid && credentials.password) return credentials;
    const [ssid, password] = await Promise.all([
      transport.ble.read(id, CHAR_WIFI_SSID),
      transport.ble.read(id, CHAR_WIFI_PASS),
    ]);
    credentials = { ssid: decodeAscii(ssid), password: decodeAscii(password) };
    events.emit("credentials", { ...credentials });
    return credentials;
  };

  const ensureAp = async () => {
    if (wifiHandle) return wifiHandle;
    const { ssid, password } = await readCredentials();
    if (!ssid) throw new Error("no-wifi-credentials");
    await command(AP_ON);
    let lastError = "";
    for (let attempt = 0; attempt < AP_JOIN_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, AP_SETTLE_MS));
      try {
        const joined = await transport.wifi.join({ ssid, password });
        if (joined?.handle) {
          wifiHandle = joined.handle;
          return wifiHandle;
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }
    throw new Error(lastError || "wifi-join-failed");
  };

  /** @param {string} handle */
  const fetchPresets = async (handle) => {
    if (presetTree) return presetTree;
    presetTree = /** @type {PresetTree | null} */ (await transport.net.getJson(PRESETS_URL(), handle).catch(() => null));
    if (presetTree) emitControls();
    return presetTree;
  };

  const holdAp = async () => {
    const handle = await ensureAp();
    apHolds++;
    fetchPresets(handle).catch(() => {});
    return handle;
  };

  const releaseAp = async () => {
    apHolds = Math.max(0, apHolds - 1);
    if (apHolds > 0 || !wifiHandle) return;
    const handle = wifiHandle;
    wifiHandle = null;
    await transport.wifi.leave(handle).catch(() => {});
    await command(AP_OFF).catch(() => {});
  };

  const forceLeaveAp = async () => {
    apHolds = 0;
    if (!wifiHandle) return;
    const handle = wifiHandle;
    wifiHandle = null;
    await transport.wifi.leave(handle).catch(() => {});
    await command(AP_OFF).catch(() => {});
  };

  /** @param {"video" | "photo"} next */
  const setMode = async (next) => {
    const group = PRESET_GROUP_FOR[next];
    if (!group || mode === next) return mode;
    await command(LOAD_PRESET_GROUP(group));
    mode = next;
    events.emit("status", { mode });
    await readControls().catch(() => {});
    return mode;
  };

  const stopPreview = async () => {
    if (!previewing) return;
    previewing = false;
    await transport.preview.stop().catch(() => {});
    if (wifiHandle) await transport.net.getJson(STREAM_STOP_URL(), wifiHandle).catch(() => {});
    await releaseAp();
  };

  return {
    capabilities: ["telemetry", "shutter", "media-import", "wifi-ap", "preview", "controls"],
    status,
    async startRecording() {
      await command(SHUTTER_ON);
      events.emit("recording", { recording: true });
    },
    async stopRecording() {
      await command(SHUTTER_OFF);
      events.emit("recording", { recording: false });
    },
    listControls: async () => controls(),
    async setControl(controlId, value) {
      if (controlId === "preset") {
        await command(LOAD_PRESET(Number(value)));
        activePresetId = Number(value);
        emitControls();
        await readControls().catch(() => {});
        return;
      }
      const settingId = settingIdFor(controlId, mode);
      if (!settingId) throw new Error("unknown-control");
      await setting(SET_SETTING(settingId, Number(value)));
      settingValues = { ...settingValues, [settingId]: Number(value) };
      emitControls();
      await readControls().catch(() => {});
    },
    setMode,
    async capturePhoto() {
      await setMode("photo");
      try {
        await command(SHUTTER_ON);
        await new Promise((resolve) => setTimeout(resolve, PHOTO_SETTLE_MS));
      } finally {
        await setMode("video").catch(() => {});
      }
    },
    async startPreview({ fit = "contain" } = {}) {
      if (previewing) return { port: PREVIEW_PORT };
      const handle = await holdAp();
      previewing = true;
      try {
        await transport.net.getJson(STREAM_STOP_URL(), handle).catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, STREAM_SETTLE_MS));
        await transport.net.getJson(STREAM_START_URL(), handle);
        return await transport.preview.start({ port: PREVIEW_PORT, handle, fit });
      } catch (e) {
        previewing = false;
        await releaseAp();
        throw e;
      }
    },
    stopPreview,
    async keepAlive() {
      await query(QUERY_STATUS([STATUS_AP_ON]));
    },
    /** @returns {Promise<MediaItem[]>} */
    async listMedia({ since } = {}) {
      const handle = await ensureAp();
      const json = /** @type {MediaListReply} */ (await transport.net.getJson(MEDIA_LIST_URL(), handle));
      const items = parseMediaList(json).filter((item) => isImportable(item.name));
      return sinceFilter(items, since);
    },
    async importMedia(items, { onProgress } = {}) {
      const handle = await holdAp();
      const done = [];
      try {
        for (const [index, item] of (items ?? []).entries()) {
          const result = await transport.net.fetchToFile({
            url: downloadUrl(item),
            name: item.name,
            handle,
          });
          done.push({
            url: result.url,
            name: item.name,
            bytes: result.bytes ?? item.sizeBytes,
            remotePath: item.path,
            capturedAt: item.capturedAt,
            durationMs: item.durationMs,
          });
          onProgress?.(index + 1, items.length);
        }
      } finally {
        await releaseAp();
      }
      return done;
    },
    on: events.on,
    async close() {
      await stopPreview().catch(() => {});
      await forceLeaveAp();
      pending.rejectAll("closed");
      for (const off of offs) off?.();
      await transport.ble.disconnect(id).catch(() => {});
    },
  };
};

export default {
  id: "gopro",
  label: "GoPro",
  capabilities: ["telemetry", "shutter", "media-import", "wifi-ap", "preview", "controls"],
  scanFilter: { services: [SERVICE_CONTROL], namePrefixes: ["GoPro"] },
  /** @param {Advertisement} advertisement */
  matches: (advertisement) =>
    (advertisement?.services ?? []).some((s) => s?.toLowerCase() === SERVICE_CONTROL) ||
    /gopro/i.test(advertisement?.name ?? ""),
  connect,
};
