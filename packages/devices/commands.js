/**
 * `@lightstart/devices` cross-runtime command types: the UPPER `DOMAIN:ACTION`
 * message names spoken over the mobile shell bridge (BLE / Wi-Fi / streaming /
 * download). Request types AND native→frontend push types both live here (the
 * whole native message namespace for the family); pushes are delivered to the
 * typed emitters declared in signals.js. `DevicesCommands.kt` mirrors these
 * values. (One-way app-level notifications like `download:progress` are
 * lowercase EVENTS in events.js, not commands.)
 */
export const BLE_CONNECT = "BLE:CONNECT";
export const BLE_DISCONNECT = "BLE:DISCONNECT";
export const BLE_NOTIFY = "BLE:NOTIFY";
export const BLE_READ = "BLE:READ";
export const BLE_SCAN_RESULT = "BLE:SCAN_RESULT";
export const BLE_SCAN_START = "BLE:SCAN_START";
export const BLE_SCAN_STOP = "BLE:SCAN_STOP";
export const BLE_STATE = "BLE:STATE";
export const BLE_SUBSCRIBE = "BLE:SUBSCRIBE";
export const BLE_WRITE = "BLE:WRITE";
export const DOWNLOAD_CANCEL = "DOWNLOAD:CANCEL";
export const DOWNLOAD_FETCH = "DOWNLOAD:FETCH";
export const DOWNLOAD_GET = "DOWNLOAD:GET";
export const STREAM_BOUNDS = "STREAM:BOUNDS";
export const STREAM_SNAPSHOT = "STREAM:SNAPSHOT";
export const STREAM_START = "STREAM:START";
export const STREAM_STATE = "STREAM:STATE";
export const STREAM_STOP = "STREAM:STOP";
export const WIFI_JOIN = "WIFI:JOIN";
export const WIFI_LEAVE = "WIFI:LEAVE";
