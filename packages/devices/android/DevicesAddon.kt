package dev.lightstart.mobile.addons

import dev.lightstart.mobile.MainActivity
import dev.lightstart.mobile.MobileAddon
import android.Manifest
import android.os.Build
import android.view.TextureView
import android.view.View
import android.webkit.WebView
import android.widget.FrameLayout
import org.json.JSONArray
import org.json.JSONObject

/**
 * Generic device transports for the page: BLE sockets, joining a device's own
 * WiFi AP, pulling files over that AP, and playing its live feed behind the
 * page. Deliberately protocol-free: a driver in JS decides what the bytes mean,
 * which keeps camera-specific iteration out of the slow Kotlin rebuild loop.
 *
 *   BLE:SCAN_START {services,timeoutMs} → [{id,name,rssi,services}]
 *   BLE:CONNECT|DISCONNECT {id}
 *   BLE:SUBSCRIBE {id,char}
 *   BLE:WRITE {id,char,data(hex),withResponse}
 *   BLE:READ {id,char} → {data(hex)}
 *   WIFI:JOIN {ssid,password,timeoutMs} → {handle}   WIFI:LEAVE {handle}
 *   DOWNLOAD:GET {url,handle} → json
 *   DOWNLOAD:FETCH {url,name,handle} → {url,bytes,path}
 *   STREAM:START {port,handle} → renders the device's live feed behind the page
 *   STREAM:BOUNDS {x,y,width,height,fit} → windows the picture (CSS px)
 *   STREAM:STOP | STREAM:SNAPSHOT → {url,width,height}
 *
 * Pushed: BLE:NOTIFY, BLE:SCAN_RESULT, BLE:STATE, download:progress, STREAM:STATE
 */
class DevicesAddon : MobileAddon {
    private lateinit var activity: MainActivity

    override val families = listOf("devices")

    private val ble by lazy { DevicesBleManager(activity) { type, data -> activity.emit(type, data) } }
    private val wifi by lazy { DevicesWifiJoiner(activity) }
    private val downloader by lazy { DevicesDownloader(activity.nativeFiles) { type, data -> activity.emit(type, data) } }
    private val stream by lazy { DevicesStreamPlayer(activity, activity.nativeFiles) { type, data -> activity.emit(type, data) } }

    override fun onCreate(activity: MainActivity, root: FrameLayout, webView: WebView) {
        this.activity = activity
        val surface = TextureView(activity).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            )
            visibility = View.GONE
        }
        root.addView(surface, 0)
        stream.view = surface
        stream.sweep()
        wifi.onLost = {
            stopStream()
            activity.emit(
                DevicesCommands.STREAM_STATE,
                JSONObject().put("state", "error").put("code", "network-lost"),
            )
        }
    }

    override fun onDestroy() {
        stopStream()
        ble.closeAll()
        wifi.releaseAll()
        downloader.cancel()
        activity.setWebViewTransparent("devices", false)
    }

    private fun stopStream() {
        if (!stream.isPlaying()) return
        stream.stop()
        activity.setWebViewTransparent("devices", false)
    }

    private fun blePermissions(): Array<String> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
            arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
        else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)

    override fun handle(
        method: String,
        args: JSONArray,
        respond: (Any?) -> Unit,
        fail: (String) -> Unit,
    ): Boolean {
        val payload = args.optJSONObject(0)
        when {
            method.startsWith("BLE:") -> handleBle(method, payload, respond, fail)
            method.startsWith("WIFI:") -> handleWifi(method, payload, respond, fail)
            method.startsWith("DOWNLOAD:") -> handleDownload(method, payload, respond, fail)
            method.startsWith("STREAM:") -> handleStream(method, payload, respond, fail)
            else -> return false
        }
        return true
    }

    private fun handleBle(method: String, payload: JSONObject?, respond: (Any?) -> Unit, fail: (String) -> Unit) {
        val id = payload?.optString("id") ?: ""
        val char = payload?.optString("char") ?: ""
        when (method) {
            DevicesCommands.BLE_SCAN_START -> activity.ensurePermissions(blePermissions()) { granted ->
                if (!granted) return@ensurePermissions fail("bluetooth-permission-denied")
                val services = mutableListOf<String>()
                payload?.optJSONArray("services")?.let { array ->
                    for (i in 0 until array.length()) services.add(array.optString(i))
                }
                ble.startScan(
                    services.filter { it.isNotEmpty() },
                    payload?.optLong("timeoutMs", 8000L) ?: 8000L,
                    respond,
                    fail,
                )
            }
            DevicesCommands.BLE_SCAN_STOP -> { ble.stopScan(); respond(null) }
            DevicesCommands.BLE_CONNECT -> activity.ensurePermissions(blePermissions()) { granted ->
                if (!granted) return@ensurePermissions fail("bluetooth-permission-denied")
                ble.connect(id, { result ->
                    DeviceLinkService.begin(activity.applicationContext, payload?.optString("name") ?: "")
                    respond(result)
                }, fail)
            }
            DevicesCommands.BLE_DISCONNECT -> {
                ble.disconnect(id)
                if (!ble.hasConnections()) DeviceLinkService.end(activity.applicationContext)
                respond(null)
            }
            DevicesCommands.BLE_SUBSCRIBE -> ble.subscribe(id, char, respond, fail)
            DevicesCommands.BLE_WRITE -> ble.write(
                id, char,
                payload?.optString("data") ?: "",
                payload?.optBoolean("withResponse", true) ?: true,
                respond, fail,
            )
            DevicesCommands.BLE_READ -> ble.read(id, char, respond, fail)
            DevicesCommands.BLE_STATE -> respond(JSONObject().put("supported", ble.isSupported()).put("enabled", ble.isEnabled()))
            else -> fail("unknown ble message: $method")
        }
    }

    private fun handleWifi(method: String, payload: JSONObject?, respond: (Any?) -> Unit, fail: (String) -> Unit) {
        when (method) {
            DevicesCommands.WIFI_JOIN -> wifi.join(
                payload?.optString("ssid") ?: "",
                payload?.optString("password") ?: "",
                payload?.optInt("timeoutMs", 45000) ?: 45000,
                respond, fail,
            )
            DevicesCommands.WIFI_LEAVE -> {
                wifi.release(payload?.optString("handle") ?: "")
                respond(null)
            }
            else -> fail("unknown wifi message: $method")
        }
    }

    /**
     * Everything here touches the player and its view, both of which belong to
     * the UI thread; the bridge hands us a worker thread.
     */
    private fun handleStream(method: String, payload: JSONObject?, respond: (Any?) -> Unit, fail: (String) -> Unit) {
        activity.runOnUiThread { handleStreamOnUi(method, payload, respond, fail) }
    }

    private fun handleStreamOnUi(method: String, payload: JSONObject?, respond: (Any?) -> Unit, fail: (String) -> Unit) {
        when (method) {
            DevicesCommands.STREAM_START -> {
                val network = wifi.networkFor(payload?.optString("handle")?.ifEmpty { null })
                activity.setWebViewTransparent("devices", true)
                stream.start(
                    network,
                    payload?.optInt("port", 8554) ?: 8554,
                    payload?.optString("fit")?.ifEmpty { "contain" } ?: "contain",
                    respond,
                ) { code ->
                    activity.setWebViewTransparent("devices", false)
                    fail(code)
                }
            }
            DevicesCommands.STREAM_BOUNDS -> {
                val density = activity.resources.displayMetrics.density
                val px = { key: String -> ((payload?.optDouble(key, 0.0) ?: 0.0) * density).toInt() }
                stream.setBounds(
                    px("x"), px("y"), px("width"), px("height"),
                    payload?.optString("fit")?.ifEmpty { "cover" } ?: "cover",
                )
                respond(null)
            }
            DevicesCommands.STREAM_STOP -> { stopStream(); respond(null) }
            DevicesCommands.STREAM_SNAPSHOT -> stream.snapshot(respond, fail)
            else -> fail("unknown stream message: $method")
        }
    }

    private fun handleDownload(method: String, payload: JSONObject?, respond: (Any?) -> Unit, fail: (String) -> Unit) {
        val network = wifi.networkFor(payload?.optString("handle")?.ifEmpty { null })
        when (method) {
            DevicesCommands.DOWNLOAD_GET -> downloader.getJson(payload?.optString("url") ?: "", network, respond, fail)
            DevicesCommands.DOWNLOAD_FETCH -> downloader.fetchToFile(
                payload?.optString("url") ?: "",
                payload?.optString("name") ?: "file.bin",
                network, respond, fail,
            )
            DevicesCommands.DOWNLOAD_CANCEL -> { downloader.cancel(); respond(null) }
            else -> fail("unknown download message: $method")
        }
    }
}
