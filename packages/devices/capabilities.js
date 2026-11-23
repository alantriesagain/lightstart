/**
 * Capability declaration for the `devices` command family. One family for the
 * whole addon (BLE / Wi-Fi joining / streaming / downloads ship together in
 * `DevicesAddon`); the per-command manifest still answers fine-grained
 * `mobile.can(...)` checks.
 */
import {
  BLE_CONNECT,
  BLE_DISCONNECT,
  BLE_NOTIFY,
  BLE_READ,
  BLE_SCAN_RESULT,
  BLE_SCAN_START,
  BLE_SCAN_STOP,
  BLE_STATE,
  BLE_SUBSCRIBE,
  BLE_WRITE,
  DOWNLOAD_CANCEL,
  DOWNLOAD_FETCH,
  DOWNLOAD_GET,
  STREAM_BOUNDS,
  STREAM_SNAPSHOT,
  STREAM_START,
  STREAM_STATE,
  STREAM_STOP,
  WIFI_JOIN,
  WIFI_LEAVE,
} from "./commands.js";

export default {
  id: "devices",
  description: "BLE, Wi-Fi joining, RTSP streaming, and downloads",
  commands: {
    [BLE_SCAN_START]: {},
    [BLE_SCAN_STOP]: { input: {} },
    [BLE_SCAN_RESULT]: {},
    [BLE_CONNECT]: {},
    [BLE_DISCONNECT]: {},
    [BLE_READ]: {},
    [BLE_WRITE]: {},
    [BLE_SUBSCRIBE]: {},
    [BLE_NOTIFY]: {},
    [BLE_STATE]: { input: {} },
    [WIFI_JOIN]: {},
    [WIFI_LEAVE]: { input: {} },
    [STREAM_START]: {},
    [STREAM_STOP]: { input: {} },
    [STREAM_BOUNDS]: {},
    [STREAM_STATE]: { input: {} },
    [STREAM_SNAPSHOT]: {},
    [DOWNLOAD_FETCH]: {},
    [DOWNLOAD_GET]: {},
    [DOWNLOAD_CANCEL]: {},
  },
};
