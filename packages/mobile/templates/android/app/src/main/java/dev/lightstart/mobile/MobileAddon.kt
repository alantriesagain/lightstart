package dev.lightstart.mobile

import android.webkit.WebView
import android.widget.FrameLayout
import org.json.JSONArray

/**
 * A Kotlin add-on the shell compiles in. `families` become capabilities in
 * `$ready`, so `mobile.can("<family>")` answers true; `handle` owns a method by
 * returning true and answers through `respond(value)` or `fail(message)`, in
 * the same `{ id, ok, value | error }` reply the bridge sends.
 */
interface MobileAddon {
    val families: List<String>

    fun onCreate(activity: MainActivity, root: FrameLayout, webView: WebView) {}

    fun handle(method: String, args: JSONArray, respond: (Any?) -> Unit, fail: (String) -> Unit): Boolean

    fun onDestroy() {}
}
