package dev.lightstart.mobile.addons

import dev.lightstart.mobile.Notifications
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Keeps the process alive while a device link is open, so a GATT connection
 * survives the screen going off mid-set. Holds no connection state itself;
 * [DevicesBleManager] owns the sockets; this only stops Android from freezing us.
 */
class DeviceLinkService : Service() {

    companion object {
        private const val NOTIF_ID = 9101

        @Volatile var running = false
        @Volatile var label = "Camera connected"

        fun begin(ctx: Context, deviceName: String) {
            if (running) return
            label = if (deviceName.isNotEmpty()) "$deviceName connected" else "Camera connected"
            ctx.startForegroundService(Intent(ctx, DeviceLinkService::class.java))
        }

        fun end(ctx: Context) {
            if (!running) return
            ctx.stopService(Intent(ctx, DeviceLinkService::class.java))
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Notifications.ensureChannel(this)
        val notif = NotificationCompat.Builder(this, Notifications.CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentTitle(label)
            .setOngoing(true)
            .build()
        startForeground(NOTIF_ID, notif)
        running = true
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
