package dev.lightstart.mobile.addons

import android.Manifest
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.lifecycle.Lifecycle
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import dev.lightstart.mobile.MainActivity
import dev.lightstart.mobile.MobileAddon
import dev.lightstart.mobile.Notifications
import org.json.JSONArray
import org.json.JSONObject
import java.lang.ref.WeakReference
import java.util.concurrent.atomic.AtomicBoolean

/**
 * The `push` family: remote pushes through Firebase Cloud Messaging,
 * initialised in code from the string resources `light_push_project_id`,
 * `light_push_app_id`, `light_push_api_key` and `light_push_sender_id`.
 *
 *   PUSH:PERMISSION -> { granted }, asking for POST_NOTIFICATIONS on Android 13+
 *   PUSH:TOKEN      -> { token, platform: "android" }
 *
 * Without all four resources the shell reports no `push` family and both
 * commands answer "unconfigured". [PushService] shows or forwards what arrives.
 */
class PushAddon : MobileAddon {
    override val families: List<String> get() = if (appContext?.let { configured(it) } == true) listOf("push") else emptyList()

    override fun onCreate(activity: MainActivity, root: FrameLayout, webView: WebView) {
        current = WeakReference(activity)
        appContext = activity.applicationContext
    }

    override fun handle(method: String, args: JSONArray, respond: (Any?) -> Unit, fail: (String) -> Unit): Boolean {
        if (!method.startsWith("PUSH:")) return false
        val activity = current?.get()
        if (activity == null || appContext == null || !ready(appContext!!)) {
            fail("unconfigured")
            return true
        }
        when (method) {
            PUSH_PERMISSION -> permission(activity, respond)
            PUSH_TOKEN -> token(activity, respond, fail)
            else -> fail("unknown push message: $method")
        }
        return true
    }

    private fun permission(activity: MainActivity, respond: (Any?) -> Unit) {
        if (Notifications.hasPermission(activity)) {
            respond(JSONObject().put("granted", true))
            return
        }
        activity.ensurePermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS)) { granted ->
            respond(JSONObject().put("granted", granted))
        }
    }

    @Suppress("DEPRECATION")
    private fun token(activity: MainActivity, respond: (Any?) -> Unit, fail: (String) -> Unit) {
        val ctx = activity.applicationContext
        val answered = AtomicBoolean(false)
        val answer: (String?, String) -> Unit = { token, error ->
            if (answered.compareAndSet(false, true)) {
                val found = token?.takeIf { it.isNotEmpty() } ?: kept(ctx)
                if (found.isEmpty()) fail(error)
                else respond(JSONObject().put("token", found).put("platform", "android"))
            }
        }
        Handler(Looper.getMainLooper()).postDelayed({ answer(null, "push-timeout") }, TOKEN_TIMEOUT_MS)
        try {
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                val token = if (task.isSuccessful) task.result else null
                if (!token.isNullOrEmpty()) keep(ctx, token)
                else Log.w(TAG, "token failed: ${task.exception?.message}")
                answer(token, task.exception?.message ?: "push-token")
            }
        } catch (e: Exception) {
            answer(null, e.message ?: "push-token")
        }
    }

    companion object {
        const val TAG = "LightPush"
        const val PUSH_PERMISSION = "PUSH:PERMISSION"
        const val PUSH_TOKEN = "PUSH:TOKEN"

        private const val PREFS = "light_push"
        private const val TOKEN_TIMEOUT_MS = 8_000L
        private const val SHOWN_KEPT = 500

        @Volatile private var current: WeakReference<MainActivity>? = null
        @Volatile private var appContext: Context? = null

        private fun setting(context: Context, name: String): String {
            val id = context.resources.getIdentifier(name, "string", context.packageName)
            return if (id == 0) "" else context.resources.getString(id)
        }

        /** Whether the app supplied all four Firebase values as string resources. */
        fun configured(context: Context): Boolean =
            listOf("light_push_project_id", "light_push_app_id", "light_push_api_key", "light_push_sender_id")
                .all { setting(context, it).isNotEmpty() }

        /** Start Firebase in code from the app's resources, so no google-services plugin or JSON is needed. */
        fun ready(context: Context): Boolean {
            if (!configured(context)) return false
            synchronized(this) {
                if (FirebaseApp.getApps(context).isEmpty()) {
                    FirebaseApp.initializeApp(
                        context,
                        FirebaseOptions.Builder()
                            .setProjectId(setting(context, "light_push_project_id"))
                            .setApplicationId(setting(context, "light_push_app_id"))
                            .setApiKey(setting(context, "light_push_api_key"))
                            .setGcmSenderId(setting(context, "light_push_sender_id"))
                            .build(),
                    )
                }
            }
            return true
        }

        fun live(): MainActivity? = current?.get()?.takeIf { !it.isDestroyed }

        fun foreground(): MainActivity? = live()?.takeIf { it.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED) }

        fun keep(context: Context, token: String) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("token", token).apply()
            Log.d(TAG, "token kept")
        }

        fun kept(context: Context): String =
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("token", "") ?: ""

        /** Record that an id was shown; false when it already was, so one push shows one line. */
        fun remember(context: Context, id: String): Boolean {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val shown = (prefs.getStringSet("shown", emptySet()) ?: emptySet()).toMutableSet()
            if (!shown.add(id)) return false
            while (shown.size > SHOWN_KEPT) shown.remove(shown.first())
            prefs.edit().putStringSet("shown", shown).apply()
            return true
        }
    }
}
