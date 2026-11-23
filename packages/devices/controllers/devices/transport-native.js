/**
 * The native-shell transport: four generic message families over the light
 * mobile shell (`mobile.request`, `mobile.on`). Nothing here knows what a GoPro
 * is: drivers own the protocol, this owns the socket.
 *
 * @import { Transport } from "../../types.ts"
 * @import { MobileApi } from "@lightstart/mobile/page"
 */
import { mobile } from "@lightstart/mobile/page";
import { bytesToHex, hexToBytes } from "../../lib/frame.js";
import {
  BLE_SCAN_START, BLE_SCAN_STOP, BLE_CONNECT, BLE_DISCONNECT, BLE_SUBSCRIBE,
  BLE_WRITE, BLE_READ, BLE_NOTIFY, BLE_STATE,
  WIFI_JOIN, WIFI_LEAVE,
  STREAM_START, STREAM_STOP, STREAM_BOUNDS, STREAM_SNAPSHOT, STREAM_STATE,
  DOWNLOAD_GET, DOWNLOAD_FETCH,
} from "../../commands.js";
import { DOWNLOAD_PROGRESS } from "../../events.js";

const SCAN_TIMEOUT_PAD = 4000;
const CONNECT_TIMEOUT = 60000;
const JOIN_TIMEOUT = 45000;
const REQUEST_TIMEOUT = 15000;

/**
 * @template T
 * @param {MobileApi} api
 * @param {string} type @param {unknown} [payload] @param {number} [timeout]
 * @returns {Promise<T>}
 */
const request = (api, type, payload, timeout = REQUEST_TIMEOUT) => {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  const late = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`the shell did not answer ${type} within ${String(timeout)} ms`)), timeout);
  });
  return /** @type {Promise<T>} */ (Promise.race([api.request(type, [payload]), late]).finally(() => clearTimeout(timer)));
};

/**
 * @param {MobileApi} api
 * @param {string} event @param {string | null} id @param {(data: Record<string, unknown>) => void} handler
 * @returns {() => void}
 */
const onEvent = (api, event, id, handler) => {
  /** @param {unknown} payload */
  const listener = (payload) => {
    const data = /** @type {Record<string, unknown>} */ (payload ?? {});
    if (!id || data["id"] === id) handler(data);
  };
  return api.on(event, listener);
};

/**
 * @param {MobileApi} [api] the shell bridge, injected so a test can drive a fake
 * @returns {Transport}
 */
export const createNativeTransport = (api = mobile) => ({
  available: () => api.present,

  ble: {
    /** @param {{ services?: string[], timeoutMs?: number }} [opts] */
    scan: ({ services = [], timeoutMs = 8000 } = {}) =>
      request(api, BLE_SCAN_START, { services, timeoutMs }, timeoutMs + SCAN_TIMEOUT_PAD),
    stopScan: () => request(api, BLE_SCAN_STOP, {}),
    connect: (id) => request(api, BLE_CONNECT, { id }, CONNECT_TIMEOUT),
    disconnect: (id) => request(api, BLE_DISCONNECT, { id }),
    subscribe: (id, char) => request(api, BLE_SUBSCRIBE, { id, char }),
    write: (id, char, bytes, withResponse = true) =>
      request(api, BLE_WRITE, { id, char, data: bytesToHex(bytes), withResponse }),
    read: async (id, char) => {
      const reply = /** @type {{ data?: string } | null} */ (await request(api, BLE_READ, { id, char }));
      return hexToBytes(reply?.data ?? "");
    },
    onNotify: (id, char, cb) =>
      onEvent(api, BLE_NOTIFY, id, (data) => {
        if (String(data["char"] ?? "").toLowerCase() === char.toLowerCase()) cb(hexToBytes(String(data["data"] ?? "")));
      }),
    onState: (id, cb) => onEvent(api, BLE_STATE, id, (data) => cb({ connected: data["connected"] === true, reason: data["reason"] === undefined ? undefined : String(data["reason"]) })),
    onPairing: (cb) => onEvent(api, BLE_STATE, null, (data) => {
      if (data["pairing"] === true) cb({ pairing: true });
    }),
  },

  wifi: {
    join: ({ ssid, password, timeoutMs = JOIN_TIMEOUT }) =>
      request(api, WIFI_JOIN, { ssid, password, timeoutMs }, timeoutMs + SCAN_TIMEOUT_PAD),
    leave: (handle) => request(api, WIFI_LEAVE, { handle }),
  },

  preview: {
    /** @param {{ port?: number, handle?: string, fit?: "contain" | "cover" }} [opts] */
    start: ({ port = 8554, handle, fit = "contain" } = {}) =>
      request(api, STREAM_START, { port, handle, fit }, 20000),
    stop: () => request(api, STREAM_STOP, {}),
    bounds: (rect) => request(api, STREAM_BOUNDS, rect ?? {}),
    snapshot: () => request(api, STREAM_SNAPSHOT, {}, 15000),
    /** @param {(data: { state: import("../../types.ts").PreviewSignal, code?: string, bind?: string }) => void} cb */
    onState: (cb) => onEvent(api, STREAM_STATE, null, (data) => cb({
      state: /** @type {import("../../types.ts").PreviewSignal} */ (data["state"] ?? "off"),
      code: data["code"] === undefined ? undefined : String(data["code"]),
      bind: data["bind"] === undefined ? undefined : String(data["bind"]),
    })),
  },

  net: {
    getJson: (url, handle) => request(api, DOWNLOAD_GET, { url, handle }, 30000),

    fetchToFile: async ({ url, name, handle, onProgress }) => {
      const off = onProgress
        ? api.on(DOWNLOAD_PROGRESS, (payload) => {
            const data = /** @type {{ name?: string, bytes?: number, total?: number }} */ (payload ?? {});
            if (data.name === name) onProgress({ bytes: data.bytes ?? 0, total: data.total ?? 0 });
          })
        : null;
      try {
        return /** @type {{ url: string, bytes: number, path: string }} */ (
          await request(api, DOWNLOAD_FETCH, { url, name, handle }, 30 * 60 * 1000)
        );
      } finally {
        off?.();
      }
    },
  },
});
