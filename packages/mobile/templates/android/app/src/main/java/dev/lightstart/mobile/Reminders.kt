package dev.lightstart.mobile

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/** The daily reminders: a JSON list in SharedPreferences, one alarm each, re-armed after a reboot. */
object Reminders {
    private const val PREFS = "mobile_reminders"
    private const val KEY = "reminders"
    private const val WINDOW_MS = 10L * 60 * 1000

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun set(context: Context, reminders: JSONArray) {
        for (index in 0 until get(context).length()) cancel(context, get(context).optJSONObject(index) ?: JSONObject())
        prefs(context).edit().putString(KEY, reminders.toString()).apply()
        scheduleAll(context)
    }

    fun get(context: Context): JSONArray {
        val raw = prefs(context).getString(KEY, "[]") ?: "[]"
        return try {
            JSONArray(raw)
        } catch (e: Exception) {
            JSONArray()
        }
    }

    fun clear(context: Context) {
        for (index in 0 until get(context).length()) cancel(context, get(context).optJSONObject(index) ?: JSONObject())
        prefs(context).edit().remove(KEY).apply()
    }

    fun scheduleAll(context: Context) {
        val reminders = get(context)
        for (index in 0 until reminders.length()) {
            val reminder = reminders.optJSONObject(index) ?: continue
            schedule(context, reminder)
        }
    }

    private fun requestCode(reminder: JSONObject): Int =
        reminder.optString("id", "").ifEmpty { "${reminder.optInt("hour")}:${reminder.optInt("minute")}" }.hashCode()

    private fun cancel(context: Context, reminder: JSONObject) {
        val manager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        manager.cancel(pending(context, reminder))
    }

    fun schedule(context: Context, reminder: JSONObject) {
        val hour = reminder.optInt("hour", -1)
        val minute = reminder.optInt("minute", -1)
        if (hour !in 0..23 || minute !in 0..59) return
        val manager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val at = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1)
        }
        val pending = pending(context, reminder)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms()) {
            manager.setWindow(AlarmManager.RTC_WAKEUP, at.timeInMillis, WINDOW_MS, pending)
        } else {
            manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at.timeInMillis, pending)
        }
    }

    private fun pending(context: Context, reminder: JSONObject): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            action = "${context.packageName}.REMINDER"
            putExtra("id", reminder.optString("id", ""))
            putExtra("hour", reminder.optInt("hour", -1))
            putExtra("minute", reminder.optInt("minute", -1))
            putExtra("title", reminder.optString("title", "Reminder"))
            putExtra("body", reminder.optString("body", ""))
            putExtra("path", reminder.optString("path", "/"))
        }
        return PendingIntent.getBroadcast(
            context, requestCode(reminder), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    fun reminderOf(intent: Intent): JSONObject = JSONObject()
        .put("id", intent.getStringExtra("id") ?: "")
        .put("hour", intent.getIntExtra("hour", -1))
        .put("minute", intent.getIntExtra("minute", -1))
        .put("title", intent.getStringExtra("title") ?: "Reminder")
        .put("body", intent.getStringExtra("body") ?: "")
        .put("path", intent.getStringExtra("path") ?: "/")
}

/** A daily reminder fired, or the device rebooted: post it, then arm the next day's. */
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            Reminders.scheduleAll(context)
            return
        }
        val reminder = Reminders.reminderOf(intent)
        Notifications.post(
            context,
            reminder.optString("id", "reminder"),
            reminder.optString("title", "Reminder"),
            reminder.optString("body", ""),
            reminder.optString("path", "/"),
        )
        Reminders.schedule(context, reminder)
    }
}
