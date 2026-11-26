package dev.lightstart.mobile.addons

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dev.lightstart.mobile.Notifications
import org.json.JSONObject

/**
 * Receives Firebase Cloud Messaging data messages `{ id, title, body, url }`.
 * With the app on screen they go to the page as `push:received`; otherwise
 * each id is posted once on the shell's notification channel, opening `url`
 * when tapped. A new token is kept and emitted as `push:token`.
 */
class PushService : FirebaseMessagingService() {

    override fun onCreate() {
        super.onCreate()
        PushAddon.ready(applicationContext)
    }

    @Suppress("OVERRIDE_DEPRECATION")
    override fun onNewToken(token: String) {
        if (!PushAddon.ready(applicationContext)) return
        PushAddon.keep(applicationContext, token)
        PushAddon.live()?.emit("push:token", JSONObject().put("token", token))
    }

    override fun onMessageReceived(message: RemoteMessage) {
        if (!PushAddon.configured(applicationContext)) return
        val data = message.data
        val id = data["id"].orEmpty()
        if (id.isEmpty()) return
        val title = data["title"].orEmpty()
        val body = data["body"].orEmpty()
        val url = data["url"].orEmpty()
        val activity = PushAddon.foreground()
        if (activity != null) {
            activity.emit(
                "push:received",
                JSONObject().put("id", id).put("title", title).put("body", body).put("url", url),
            )
            Log.i(PushAddon.TAG, "received $id in the app")
            return
        }
        if (PushAddon.remember(applicationContext, id)) {
            Notifications.post(applicationContext, id, title, body, url)
            Log.i(PushAddon.TAG, "posted $id")
        } else {
            Log.i(PushAddon.TAG, "already shown $id")
        }
    }
}
