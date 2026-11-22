package dev.lightstart.mobile

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import __APP_ID__.R

/** Posts a reminder in the system tray, with the path to open when it is tapped. */
object Notifications {
    const val CHANNEL_ID = "reminders"

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Reminders", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "Daily reminders"
                },
            )
        }
    }

    fun hasPermission(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun post(context: Context, tag: String, title: String, body: String, path: String) {
        ensureChannel(context)
        if (!hasPermission(context)) return
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
            putExtra("notif_path", path)
            data = Uri.parse("lightstart://reminder/$tag")
        }
        val pending = PendingIntent.getActivity(
            context, tag.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle(title)
            .setAutoCancel(true)
            .setContentIntent(pending)
        if (body.isNotEmpty()) builder.setContentText(body).setStyle(NotificationCompat.BigTextStyle().bigText(body))
        try {
            NotificationManagerCompat.from(context).notify(tag.hashCode(), builder.build())
        } catch (e: SecurityException) {
        }
    }
}
