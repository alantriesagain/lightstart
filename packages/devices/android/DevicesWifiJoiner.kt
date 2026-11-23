package dev.lightstart.mobile.addons

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiNetworkSpecifier
import android.os.Build
import org.json.JSONObject

/**
 * Joins a device's own access point and hands back a handle for the bound
 * [Network]. Callers route their HTTP through that network explicitly;
 * `bindProcessToNetwork` would drag the whole process onto an AP with no
 * internet, taking OTA and everything else down with it.
 */
class DevicesWifiJoiner(private val context: Context) {
    private val cm by lazy { context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager }
    private val networks = mutableMapOf<String, Network>()
    private val callbacks = mutableMapOf<String, ConnectivityManager.NetworkCallback>()
    private var counter = 0

    /** Fired when a joined network drops, so a live stream can surface the loss. */
    var onLost: ((String) -> Unit)? = null

    fun networkFor(handle: String?): Network? = handle?.let { networks[it] }

    fun join(ssid: String, password: String, timeoutMs: Int, respond: (Any?) -> Unit, fail: (String) -> Unit) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return fail("wifi-join-unsupported")
        if (ssid.isEmpty()) return fail("no-ssid")

        val specifier = WifiNetworkSpecifier.Builder()
            .setSsid(ssid)
            .setWpa2Passphrase(password)
            .build()

        /**
         * A camera AP has no internet. Without removing that capability Android
         * decides the network is broken and tears it down mid-download.
         */
        val request = NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .setNetworkSpecifier(specifier)
            .build()

        val handle = "net-${++counter}"
        var settled = false
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                networks[handle] = network
                if (!settled) {
                    settled = true
                    respond(JSONObject().put("handle", handle))
                }
            }

            override fun onUnavailable() {
                if (!settled) {
                    settled = true
                    release(handle)
                    fail("wifi-join-failed")
                }
            }

            override fun onLost(network: Network) {
                networks.remove(handle)
                onLost?.invoke(handle)
            }
        }
        callbacks[handle] = callback
        try {
            cm.requestNetwork(request, callback, timeoutMs)
        } catch (e: SecurityException) {
            release(handle)
            fail("wifi-permission-denied")
        }
    }

    fun release(handle: String) {
        networks.remove(handle)
        callbacks.remove(handle)?.let {
            try {
                cm.unregisterNetworkCallback(it)
            } catch (_: Exception) {
            }
        }
    }

    fun releaseAll() {
        for (handle in callbacks.keys.toList()) release(handle)
    }
}
