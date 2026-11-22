package dev.lightstart.mobile

import androidx.webkit.JavaScriptReplyProxy
import org.json.JSONArray
import org.json.JSONObject

/** The shell half of light's request protocol: `[id, method, args]` in, `{ id, ok, value | error }` out. */
class Bridge(private val activity: MainActivity) {

    @Volatile private var reply: JavaScriptReplyProxy? = null
    private val outbox = ArrayDeque<String>()

    fun onMessage(raw: String?, proxy: JavaScriptReplyProxy) {
        adoptProxy(proxy)
        val request = try {
            JSONArray(raw ?: return)
        } catch (e: Exception) {
            return
        }
        if (request.length() < 2) return
        val id = request.opt(0)
        val method = request.optString(1, "")
        val args = request.optJSONArray(2) ?: JSONArray()
        try {
            when (method) {
                "\$ready" -> answer(id, true, ready())
                "share" -> {
                    val options = args.optJSONObject(0) ?: JSONObject()
                    activity.runOnUiThread { activity.share(options) }
                    answer(id, true, JSONObject().put("shared", true))
                }
                else -> answer(id, false, "no method $method")
            }
        } catch (e: Exception) {
            answer(id, false, e.message ?: "mobile error")
        }
    }

    fun emit(event: String, payload: Any?) {
        send(JSONObject().put("event", event).put("payload", payload ?: JSONObject.NULL).toString())
    }

    private fun ready(): JSONObject = JSONObject()
        .put("platform", "android")
        .put("capabilities", JSONArray().put("share"))

    private fun answer(id: Any?, ok: Boolean, value: Any?) {
        val message = JSONObject().put("id", id ?: JSONObject.NULL).put("ok", ok)
        if (ok) message.put("value", value ?: JSONObject.NULL) else message.put("error", value?.toString() ?: "error")
        send(message.toString())
    }

    private fun adoptProxy(proxy: JavaScriptReplyProxy) {
        activity.runOnUiThread {
            reply = proxy
            while (outbox.isNotEmpty()) proxy.postMessage(outbox.removeFirst())
        }
    }

    private fun send(text: String) {
        activity.runOnUiThread {
            val current = reply
            if (current == null) outbox.addLast(text) else current.postMessage(text)
        }
    }
}
