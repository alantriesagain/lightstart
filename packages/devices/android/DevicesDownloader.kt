package dev.lightstart.mobile.addons

import android.net.Network
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * Pulls files off a device's HTTP server into the shell's native files, over a
 * specific [Network] so requests don't escape to cellular while the phone sits
 * on an internet-less camera AP. The page fetches them at
 * `/__mobile/native/<name>`.
 */
class DevicesDownloader(
    private val mediaDir: File,
    private val emit: (String, JSONObject) -> Unit,
) {
    @Volatile private var cancelled = false

    init {
        mediaDir.mkdirs()
    }

    private fun open(url: String, network: Network?): HttpURLConnection {
        val target = URL(url)
        val connection = (network?.openConnection(target) ?: target.openConnection()) as HttpURLConnection
        connection.connectTimeout = 15000
        connection.readTimeout = 30000
        // The shell installs a shared HTTP cache; a video pull would evict
        // every real asset out of it for nothing.
        connection.useCaches = false
        return connection
    }

    fun getJson(url: String, network: Network?, respond: (Any?) -> Unit, fail: (String) -> Unit) {
        Thread {
            try {
                val connection = open(url, network)
                val code = connection.responseCode
                if (code !in 200..299) return@Thread fail("http-$code")
                val body = connection.inputStream.bufferedReader().use { it.readText() }
                connection.disconnect()
                respond(JSONObject(body))
            } catch (e: Exception) {
                fail(e.message ?: "request-failed")
            }
        }.start()
    }

    fun cancel() {
        cancelled = true
    }

    fun fetchToFile(url: String, name: String, network: Network?, respond: (Any?) -> Unit, fail: (String) -> Unit) {
        cancelled = false
        Thread {
            val target = File(mediaDir, name.substringAfterLast('/'))
            val partial = File(mediaDir, "${target.name}.part")
            try {
                val connection = open(url, network)
                val code = connection.responseCode
                if (code !in 200..299) return@Thread fail("http-$code")
                val total = connection.contentLengthLong
                var written = 0L
                var lastEmit = 0L

                connection.inputStream.use { input ->
                    FileOutputStream(partial).use { output ->
                        val buffer = ByteArray(64 * 1024)
                        while (true) {
                            if (cancelled) throw InterruptedException("cancelled")
                            val read = input.read(buffer)
                            if (read <= 0) break
                            output.write(buffer, 0, read)
                            written += read
                            val now = System.currentTimeMillis()
                            if (now - lastEmit >= 250) {
                                lastEmit = now
                                emit(
                                    DevicesCommands.DOWNLOAD_PROGRESS,
                                    JSONObject().put("name", target.name).put("bytes", written).put("total", total),
                                )
                            }
                        }
                    }
                }
                connection.disconnect()
                // Rename only once complete, so an interrupted pull never leaves a
                // half file that looks importable.
                if (target.exists()) target.delete()
                if (!partial.renameTo(target)) throw IllegalStateException("rename-failed")
                respond(
                    JSONObject()
                        .put("url", "/__mobile/native/${target.name}")
                        .put("bytes", written)
                        .put("path", target.absolutePath),
                )
            } catch (e: Exception) {
                partial.delete()
                fail(if (cancelled) "cancelled" else (e.message ?: "download-failed"))
            }
        }.start()
    }
}
