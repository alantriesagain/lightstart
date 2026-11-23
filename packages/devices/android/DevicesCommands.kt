package dev.lightstart.mobile.addons

/**
 * The cross-runtime message names, mirroring `commands.js` and `events.js`.
 * Request names and native-to-page push names share this namespace.
 */
object DevicesCommands {
    const val BLE_CONNECT = "BLE:CONNECT"
    const val BLE_DISCONNECT = "BLE:DISCONNECT"
    const val BLE_NOTIFY = "BLE:NOTIFY"
    const val BLE_READ = "BLE:READ"
    const val BLE_SCAN_RESULT = "BLE:SCAN_RESULT"
    const val BLE_SCAN_START = "BLE:SCAN_START"
    const val BLE_SCAN_STOP = "BLE:SCAN_STOP"
    const val BLE_STATE = "BLE:STATE"
    const val BLE_SUBSCRIBE = "BLE:SUBSCRIBE"
    const val BLE_WRITE = "BLE:WRITE"
    const val DOWNLOAD_CANCEL = "DOWNLOAD:CANCEL"
    const val DOWNLOAD_FETCH = "DOWNLOAD:FETCH"
    const val DOWNLOAD_GET = "DOWNLOAD:GET"
    const val STREAM_BOUNDS = "STREAM:BOUNDS"
    const val STREAM_SNAPSHOT = "STREAM:SNAPSHOT"
    const val STREAM_START = "STREAM:START"
    const val STREAM_STATE = "STREAM:STATE"
    const val STREAM_STOP = "STREAM:STOP"
    const val WIFI_JOIN = "WIFI:JOIN"
    const val WIFI_LEAVE = "WIFI:LEAVE"
    const val DOWNLOAD_PROGRESS = "download:progress"
}
