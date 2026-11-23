package dev.lightstart.mobile

import android.Manifest
import android.annotation.SuppressLint
import android.content.ClipData
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.webkit.MimeTypeMap
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import __APP_ID__.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileInputStream

/** One WebView over the app served from the APK's assets, and the share, reminder, capture and result capabilities. */
open class MainActivity : AppCompatActivity() {

    companion object {
        const val HOST = "appassets.androidplatform.net"
        const val ORIGIN = "https://$HOST"
        private const val CHANNEL = "lightMobile"
        private const val CAPTURE_REQUEST = 7301
        private const val NOTIFICATION_REQUEST = 7302
        private const val ADDON_PERMISSION_REQUEST = 7303
        private const val SERVED = "mobile-served"
        private const val NATIVE = "mobile-native"

        private val MIME = mapOf(
            "html" to "text/html", "js" to "text/javascript", "mjs" to "text/javascript",
            "css" to "text/css", "json" to "application/json", "webmanifest" to "application/manifest+json",
            "svg" to "image/svg+xml", "md" to "text/markdown", "txt" to "text/plain",
            "xml" to "application/xml", "wasm" to "application/wasm", "map" to "application/json",
            "mp4" to "video/mp4", "m4v" to "video/mp4", "mov" to "video/quicktime",
            "jpg" to "image/jpeg", "jpeg" to "image/jpeg", "png" to "image/png", "webp" to "image/webp",
        )
        private val TEXT_TYPES = setOf("html", "js", "mjs", "css", "json", "svg", "md", "txt", "xml", "webmanifest", "map")
    }

    private lateinit var webView: WebView
    private lateinit var root: FrameLayout
    private lateinit var addons: List<MobileAddon>
    private lateinit var bridge: Bridge
    private lateinit var assetLoader: WebViewAssetLoader
    private var insetJs = ""
    private var captureFile: File? = null
    private var captureDone: ((JSONObject?) -> Unit)? = null
    private var permissionDone: ((Boolean) -> Unit)? = null
    private val transparentOwners = LinkedHashSet<String>()

    /** Whether another app started this one for a result (`ResultActivity`), which finishes with what the page returns. */
    open val forResult: Boolean get() = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        holdOrientation()
        addons = Addons.create()
        bridge = Bridge(this, addons)
        assetLoader = WebViewAssetLoader.Builder()
            .setDomain(HOST)
            .addPathHandler("/", WebViewAssetLoader.PathHandler { path -> serveAsset(path) })
            .build()
        setupWebView()
        for (addon in addons) addon.onCreate(this, root, webView)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack()
                else if (forResult) endWithResult(RESULT_CANCELED, null)
                else finish()
            }
        })
    }

    override fun onDestroy() {
        if (::addons.isInitialized) for (addon in addons) addon.onDestroy()
        if (::webView.isInitialized) webView.destroy()
        super.onDestroy()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (!::webView.isInitialized) return
        val shared = sharedIn(intent)
        if (shared != null) {
            bridge.emit("share", shared.payload)
            webView.post { webView.loadUrl(originUrl("${shared.path}?${shared.query}")) }
            return
        }
        val notificationPath = intent.getStringExtra("notif_path")
        if (!notificationPath.isNullOrEmpty()) webView.post { webView.loadUrl(originUrl(notificationPath)) }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != CAPTURE_REQUEST) return
        val done = captureDone ?: return
        val file = captureFile
        captureDone = null
        captureFile = null
        if (resultCode == RESULT_OK && file != null && file.isFile && file.length() > 0) {
            val type = MimeTypeMap.getSingleton().getMimeTypeFromExtension(file.extension.lowercase()) ?: "application/octet-stream"
            done(JSONObject().put("url", "/__mobile/capture/${file.name}").put("type", type).put("name", file.name))
        } else {
            done(null)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != ADDON_PERMISSION_REQUEST) return
        val done = permissionDone ?: return
        permissionDone = null
        val granted = permissions.indices.all { index ->
            index < grantResults.size && grantResults[index] == PackageManager.PERMISSION_GRANTED
        }
        done(granted)
    }

    private fun holdOrientation() {
        requestedOrientation = when (BuildConfig.ORIENTATION) {
            "portrait" -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            "landscape" -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            else -> ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView = WebView(this)
        root = FrameLayout(this)
        root.addView(webView, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        setContentView(root)
        ViewCompat.setOnApplyWindowInsetsListener(webView) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            view.setPadding(0, 0, 0, ime.bottom)
            val density = resources.displayMetrics.density
            insetJs = "if(document.documentElement){document.documentElement.style.setProperty('--sat','${(bars.top / density).toInt()}px');document.documentElement.style.setProperty('--sab','${(bars.bottom / density).toInt()}px');}"
            webView.evaluateJavascript(insetJs, null)
            insets
        }
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
        }
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true)
        installStartScript()
        installBridge()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                if (request.url.host != HOST) return null
                if (request.url.path?.startsWith("/__mobile/native/") == true) return serveNative(request)
                return assetLoader.shouldInterceptRequest(request.url)
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.host == HOST) return false
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, request.url))
                    true
                } catch (e: Exception) {
                    true
                }
            }

            override fun onPageFinished(view: WebView, url: String) {
                if (insetJs.isNotEmpty()) view.evaluateJavascript(insetJs, null)
            }
        }
        webView.loadUrl(initialUrl())
    }

    private fun initialUrl(): String {
        if (forResult) resultLaunchUrl(intent)?.let { return it }
        sharedIn(intent)?.let { return originUrl("${it.path}?${it.query}") }
        intent?.getStringExtra("notif_path")?.takeIf { it.isNotEmpty() }?.let { return originUrl(it) }
        return homeUrl()
    }

    private fun homeUrl(): String = if (BuildConfig.BASE_PATH.isEmpty()) "$ORIGIN/" else "$ORIGIN${BuildConfig.BASE_PATH}/"

    private fun originUrl(path: String): String = if (path.startsWith("http")) path else "$ORIGIN${if (path.startsWith("/")) path else "/$path"}"

    /** The capture or pick page for a request for a result, with what the caller asked in the query. */
    private fun resultLaunchUrl(intent: Intent?): String? {
        val action = intent?.action ?: return null
        return when (action) {
            MediaStore.ACTION_IMAGE_CAPTURE ->
                BuildConfig.RESULT_CAPTURE.takeIf { it.isNotEmpty() }?.let { "$ORIGIN$it?request=capture&type=${Uri.encode("image/*")}" }
            MediaStore.ACTION_VIDEO_CAPTURE ->
                BuildConfig.RESULT_CAPTURE.takeIf { it.isNotEmpty() }?.let { "$ORIGIN$it?request=capture&type=${Uri.encode("video/*")}" }
            Intent.ACTION_GET_CONTENT, Intent.ACTION_PICK ->
                BuildConfig.RESULT_PICK.takeIf { it.isNotEmpty() }?.let { "$ORIGIN$it?request=pick&type=${Uri.encode(intent.type ?: "*/*")}" }
            else -> null
        }
    }

    /** What the caller asked for, or null when this shell was not started for a result. */
    fun resultRequest(): JSONObject? {
        if (!forResult) return null
        val action = intent?.action ?: return null
        val kind: String
        val type: String
        when (action) {
            MediaStore.ACTION_IMAGE_CAPTURE -> { kind = "capture"; type = "image/*" }
            MediaStore.ACTION_VIDEO_CAPTURE -> { kind = "capture"; type = "video/*" }
            Intent.ACTION_GET_CONTENT, Intent.ACTION_PICK -> { kind = "pick"; type = intent?.type ?: "*/*" }
            else -> return null
        }
        @Suppress("DEPRECATION")
        val output = intent?.getParcelableExtra<Uri>(MediaStore.EXTRA_OUTPUT) != null
        return JSONObject().put("kind", kind).put("type", type).put("output", output).put("from", callerLabel() ?: JSONObject.NULL)
    }

    /** The name of the app that asked for the result, which may see us because it started us. */
    private fun callerLabel(): String? = try {
        val caller = callingActivity?.packageName ?: callingPackage
        if (caller == null) null
        else packageManager.getApplicationLabel(packageManager.getApplicationInfo(caller, 0)).toString().ifEmpty { null }
    } catch (e: Exception) {
        null
    }

    /** Answer the open request with the page's bytes, written to the caller's output or offered through the FileProvider. */
    fun answerResult(payload: JSONObject?) {
        if (!forResult) return
        val data = payload?.optString("data", "") ?: ""
        if (payload == null || data.isEmpty()) {
            cancelResult()
            return
        }
        val name = payload.optString("name", "").replace(Regex("[^A-Za-z0-9._-]"), "_").takeUnless { it.trim('.').isEmpty() } ?: "result"
        val type = payload.optString("type", "").ifEmpty { "application/octet-stream" }
        @Suppress("DEPRECATION")
        val output = intent?.getParcelableExtra<Uri>(MediaStore.EXTRA_OUTPUT)
        Thread {
            val result = try {
                val bytes = android.util.Base64.decode(data, android.util.Base64.DEFAULT)
                if (output != null) {
                    contentResolver.openOutputStream(output, "w")?.use { it.write(bytes) }
                        ?: throw IllegalStateException("the caller's output cannot be opened")
                    Intent().setData(output).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                } else {
                    val root = File(servedRoot(), "result").apply { mkdirs() }
                    prune(root, 3600_000L)
                    val file = File(File(root, System.currentTimeMillis().toString()).apply { mkdirs() }, name)
                    file.writeBytes(bytes)
                    val uri = FileProvider.getUriForFile(this, "${BuildConfig.APPLICATION_ID}.files", file)
                    Intent()
                        .setDataAndType(uri, type)
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        .also { it.clipData = ClipData.newRawUri("", uri) }
                }
            } catch (e: Exception) {
                null
            }
            runOnUiThread { endWithResult(if (result != null) RESULT_OK else RESULT_CANCELED, result) }
        }.start()
    }

    /** Hand the caller nothing and close. */
    fun cancelResult() {
        if (!forResult) return
        endWithResult(RESULT_CANCELED, null)
    }

    /** Finish from the main looper: a finish inside a bridge callback has been seen to do nothing. */
    private fun endWithResult(code: Int, data: Intent?) {
        window.decorView.post {
            setResult(code, data)
            finish()
        }
    }

    private fun installStartScript() {
        val script = "window.__lightMobile = { present: true, platform: \"android\" };"
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))
            WebViewCompat.addDocumentStartJavaScript(webView, script, setOf(ORIGIN))
    }

    private fun installBridge() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        WebViewCompat.addWebMessageListener(webView, CHANNEL, setOf(ORIGIN)) { _, message, _, _, replyProxy ->
            bridge.onMessage(message.data, replyProxy)
        }
    }

    private fun serveAsset(rawPath: String): WebResourceResponse {
        val clean = rawPath.substringBefore('?').trimStart('/')
        if (clean.startsWith("__mobile/")) {
            val file = servedFile(clean.removePrefix("__mobile/")) ?: return notFound()
            return serveFile(file)
        }
        val path = relativeAssetPath(rawPath) ?: return notFound()
        val extension = path.substringAfterLast('.', "").lowercase()
        val mime = MIME[extension] ?: MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension) ?: "application/octet-stream"
        val charset = if (extension in TEXT_TYPES) "utf-8" else null
        return try {
            WebResourceResponse(mime, charset, assets.open(path))
        } catch (e: Exception) {
            notFound()
        }
    }

    private fun relativeAssetPath(rawPath: String): String? {
        var path = rawPath.substringBefore('?').trimStart('/')
        val base = BuildConfig.BASE_PATH.trim('/')
        if (base.isNotEmpty()) {
            path = when {
                path == base -> ""
                path.startsWith("$base/") -> path.removePrefix("$base/")
                else -> return null
            }
        }
        if (path.isEmpty()) path = "index.html"
        for (candidate in listOf(path, "$path/index.html", "$path.html"))
            if (assetExists("www/$candidate")) return "www/$candidate"
        if (!path.substringAfterLast('/').contains('.')) {
            for (candidate in listOf("www/404.html", "www/index.html"))
                if (assetExists(candidate)) return candidate
        }
        return null
    }

    private fun assetExists(path: String): Boolean = try {
        assets.open(path).use { }
        true
    } catch (e: Exception) {
        false
    }

    private fun notFound(): WebResourceResponse =
        WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))

    private fun servedRoot(): File = File(cacheDir, SERVED)

    private fun servedFile(relative: String): File? {
        if (relative.isEmpty() || relative.contains("..")) return null
        val root = servedRoot()
        val file = File(root, relative)
        return file.takeIf { it.isFile && it.canonicalPath.startsWith(root.canonicalPath + File.separator) }
    }

    private fun serveFile(file: File): WebResourceResponse {
        val extension = file.extension.lowercase()
        val mime = MIME[extension] ?: MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension) ?: "application/octet-stream"
        val charset = if (extension in TEXT_TYPES) "utf-8" else null
        return WebResourceResponse(mime, charset, FileInputStream(file))
    }

    /** A folder under the cache whose files the asset loader serves at `/__mobile/native/<name>`. */
    val nativeFiles: File
        get() = File(cacheDir, NATIVE).apply { mkdirs() }

    private fun mimeOf(file: File): String {
        val extension = file.extension.lowercase()
        return MIME[extension] ?: MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension) ?: "application/octet-stream"
    }

    private fun serveNative(request: WebResourceRequest): WebResourceResponse {
        val relative = request.url.path.orEmpty().removePrefix("/__mobile/native/")
        if (relative.isEmpty() || relative.contains("..")) return notFound()
        val folder = nativeFiles
        val file = File(folder, relative)
        if (!file.isFile || !file.canonicalPath.startsWith(folder.canonicalPath + File.separator)) return notFound()
        val total = file.length()
        val header = request.requestHeaders.entries.firstOrNull { it.key.equals("Range", ignoreCase = true) }?.value
        val match = header?.let { Regex("bytes=(\\d*)-(\\d*)").find(it) }
        if (match == null) return serveFile(file)
        val startText = match.groupValues[1]
        val endText = match.groupValues[2]
        val start = if (startText.isEmpty()) {
            (total - (endText.toLongOrNull() ?: 0L)).coerceAtLeast(0L)
        } else {
            startText.toLongOrNull() ?: 0L
        }
        var end = if (startText.isEmpty() || endText.isEmpty()) total - 1 else endText.toLongOrNull() ?: (total - 1)
        if (end >= total) end = total - 1
        if (start > end || start >= total) {
            return WebResourceResponse(
                "text/plain", "utf-8", 416, "Range Not Satisfiable",
                mapOf("Content-Range" to "bytes */$total"), ByteArrayInputStream(ByteArray(0)),
            )
        }
        val length = end - start + 1
        val input = FileInputStream(file)
        input.channel.position(start)
        val headers = mapOf(
            "Content-Range" to "bytes $start-$end/$total",
            "Content-Length" to length.toString(),
            "Accept-Ranges" to "bytes",
        )
        return WebResourceResponse(mimeOf(file), null, 206, "Partial Content", headers, BoundedInputStream(input, length))
    }

    private fun prune(dir: File, ageMs: Long) {
        dir.listFiles()?.filter { it.lastModified() < System.currentTimeMillis() - ageMs }?.forEach { it.deleteRecursively() }
    }

    private data class SharedIn(val path: String, val query: String, val payload: JSONObject)

    private fun shareTargets(): List<Pair<String, List<String>>> =
        BuildConfig.SHARE_TARGETS.split(';').mapNotNull { entry ->
            val parts = entry.split('|')
            val path = parts.getOrNull(0) ?: return@mapNotNull null
            val types = parts.getOrNull(1)?.split(',')?.filter { it.isNotEmpty() } ?: emptyList()
            if (path.isEmpty() || types.isEmpty()) null else path to types
        }

    private fun accepts(configured: String, actual: String): Boolean =
        configured == actual || (configured.endsWith("/*") && actual.startsWith(configured.dropLast(1)))

    private fun targetFor(targets: List<Pair<String, List<String>>>, type: String): String =
        (targets.firstOrNull { (_, types) -> types.any { accepts(it, type) } } ?: targets.first()).first

    private fun sharedIn(intent: Intent?): SharedIn? {
        if (intent == null) return null
        if (intent.action != Intent.ACTION_SEND && intent.action != Intent.ACTION_SEND_MULTIPLE) return null
        val targets = shareTargets()
        if (targets.isEmpty()) return null
        val type = intent.type ?: "text/plain"
        val path = targetFor(targets, type)
        val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString().orEmpty()
        val title = intent.getCharSequenceExtra(Intent.EXTRA_SUBJECT)?.toString().orEmpty()
        val files = sharedFiles(intent)
        val payload = JSONObject()
            .put("text", text)
            .put("title", title)
            .put("files", JSONArray(files))
        val query = StringBuilder("text=${Uri.encode(text)}&title=${Uri.encode(title)}")
        for (file in files) {
            query.append("&file=${Uri.encode(file.optString("url"))}")
            query.append("&type=${Uri.encode(file.optString("type"))}")
            query.append("&name=${Uri.encode(file.optString("name"))}")
        }
        return SharedIn(path, query.toString(), payload)
    }

    private fun sharedFiles(intent: Intent): List<JSONObject> {
        val uris = ArrayList<Uri>()
        if (intent.action == Intent.ACTION_SEND_MULTIPLE) {
            @Suppress("DEPRECATION")
            intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)?.let { uris.addAll(it) }
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)?.let { uris.add(it) }
        }
        val dir = File(servedRoot(), "shared").apply { mkdirs() }
        prune(dir, 24L * 3600_000L)
        return uris.mapIndexedNotNull { index, uri -> copySharedIn(uri, intent.type, index) }
    }

    private fun copySharedIn(uri: Uri, type: String?, index: Int): JSONObject? {
        return try {
            val name = displayName(uri)
            val mime = contentResolver.getType(uri) ?: type ?: "application/octet-stream"
            val extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime)
                ?: name.substringAfterLast('.', "").takeIf { it.isNotEmpty() && it.length <= 5 }
                ?: "bin"
            val dir = File(servedRoot(), "shared").apply { mkdirs() }
            val file = File(dir, "${System.currentTimeMillis()}-$index.$extension")
            contentResolver.openInputStream(uri)?.use { input -> file.outputStream().use { input.copyTo(it) } } ?: return null
            JSONObject()
                .put("url", "/__mobile/shared/${file.name}")
                .put("type", mime)
                .put("name", name)
        } catch (e: Exception) {
            null
        }
    }

    private fun displayName(uri: Uri): String {
        try {
            contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0)?.let { return it }
            }
        } catch (e: Exception) {
        }
        return uri.lastPathSegment ?: "shared"
    }

    /** Ask for the permissions an add-on lists that are missing, then say whether all are granted. */
    fun ensurePermissions(permissions: Array<String>, then: (Boolean) -> Unit) {
        val missing = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) {
            then(true)
            return
        }
        permissionDone?.invoke(false)
        permissionDone = then
        ActivityCompat.requestPermissions(this, missing.toTypedArray(), ADDON_PERMISSION_REQUEST)
    }

    /** Send an add-on's event to the page as `{ event, payload }`, which `mobile.on(event, ...)` receives. */
    fun emit(event: String, payload: Any?) {
        bridge.emit(event, payload)
    }

    /** Make the page transparent while any add-on wants to draw behind it. */
    fun setWebViewTransparent(owner: String, on: Boolean) {
        if (on) transparentOwners.add(owner) else transparentOwners.remove(owner)
        val transparent = transparentOwners.isNotEmpty()
        webView.setBackgroundColor(if (transparent) Color.TRANSPARENT else Color.WHITE)
        if (::root.isInitialized) root.setBackgroundColor(if (transparent) Color.TRANSPARENT else Color.WHITE)
    }

    fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), NOTIFICATION_REQUEST)
        }
    }

    private fun isInstalled(packageName: String): Boolean = try {
        packageManager.getPackageInfo(packageName, 0)
        true
    } catch (e: Exception) {
        false
    }

    fun capture(options: JSONObject, done: (JSONObject?) -> Unit) {
        val kind = options.optString("kind", "image")
        val requestedApp = options.optString("app", "").ifEmpty { BuildConfig.CAMERA_APP }
        val video = kind == "video"
        val action = if (video) MediaStore.ACTION_VIDEO_CAPTURE else MediaStore.ACTION_IMAGE_CAPTURE
        val extension = if (video) "mp4" else "jpg"
        val dir = File(servedRoot(), "capture").apply { mkdirs() }
        prune(dir, 3600_000L)
        val file = File(dir, "${System.currentTimeMillis()}.$extension")
        val uri = FileProvider.getUriForFile(this, "${BuildConfig.APPLICATION_ID}.files", file)
        val request = Intent(action).apply {
            putExtra(MediaStore.EXTRA_OUTPUT, uri)
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        request.clipData = ClipData.newRawUri("", uri)
        val intent = if (requestedApp.isNotEmpty() && isInstalled(requestedApp)) {
            Intent(request).setPackage(requestedApp)
        } else {
            Intent.createChooser(request, "")
        }
        captureFile = file
        captureDone = done
        try {
            @Suppress("DEPRECATION")
            startActivityForResult(intent, CAPTURE_REQUEST)
        } catch (e: Exception) {
            captureFile = null
            captureDone = null
            done(null)
        }
    }

    fun share(options: JSONObject) {
        val title = textOf(options, "title")
        val text = textOf(options, "text")
        val url = textOf(options, "url")
        val app = textOf(options, "app")
        val files = options.optJSONArray("files")
        if (files != null && files.length() > 0) shareFiles(title, text, files, app)
        else shareText(title, text, url, app)
    }

    private fun textOf(options: JSONObject, key: String): String? =
        options.optString(key, "").takeIf { it.isNotEmpty() && it != "null" }

    private fun shareText(title: String?, text: String?, url: String?, app: String?) {
        val body = listOfNotNull(text, url).joinToString("\n")
        if (body.isEmpty()) return
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, title ?: "")
            putExtra(Intent.EXTRA_TEXT, body)
        }
        startShare(intent, title, app)
    }

    private fun shareFiles(title: String?, text: String?, files: JSONArray, app: String?) {
        val root = File(cacheDir, "mobile-share").apply { mkdirs() }
        root.listFiles()?.filter { it.lastModified() < System.currentTimeMillis() - 3_600_000L }?.forEach { it.deleteRecursively() }
        val dir = File(root, System.currentTimeMillis().toString()).apply { mkdirs() }
        val uris = ArrayList<Uri>()
        val types = LinkedHashSet<String>()
        for (index in 0 until files.length()) {
            val entry = files.optJSONObject(index) ?: continue
            val data = entry.optString("data", "")
            if (data.isEmpty()) continue
            val name = entry.optString("name", "").replace(Regex("[^A-Za-z0-9._-]"), "_").takeUnless { it.trim('.').isEmpty() } ?: "file-$index"
            val file = File(dir, name)
            file.writeBytes(android.util.Base64.decode(data, android.util.Base64.DEFAULT))
            uris.add(FileProvider.getUriForFile(this, "${BuildConfig.APPLICATION_ID}.files", file))
            types.add(entry.optString("type", "").ifEmpty { "application/octet-stream" })
        }
        if (uris.isEmpty()) return
        val mime = if (types.size == 1) types.first()
            else types.map { it.substringBefore('/') }.toSet().singleOrNull()?.let { "$it/*" } ?: "*/*"
        val intent = Intent(if (uris.size == 1) Intent.ACTION_SEND else Intent.ACTION_SEND_MULTIPLE).apply {
            type = mime
            if (uris.size == 1) putExtra(Intent.EXTRA_STREAM, uris[0])
            else putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
            if (!title.isNullOrEmpty()) putExtra(Intent.EXTRA_SUBJECT, title)
            if (!text.isNullOrEmpty()) putExtra(Intent.EXTRA_TEXT, text)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        startShare(intent, title, app)
    }

    private fun startShare(intent: Intent, title: String?, app: String?) {
        if (!app.isNullOrEmpty()) {
            try {
                startActivity(Intent(intent).setPackage(app))
                return
            } catch (e: android.content.ActivityNotFoundException) {
            }
        }
        startActivity(Intent.createChooser(intent, title ?: ""))
    }
}

/** The requested byte range of a file, so a native asset answers a `Range` request without reading the rest. */
private class BoundedInputStream(private val source: FileInputStream, private var left: Long) : java.io.InputStream() {
    override fun read(): Int {
        if (left <= 0L) return -1
        val value = source.read()
        if (value >= 0) left -= 1
        return value
    }

    override fun read(bytes: ByteArray, offset: Int, length: Int): Int {
        if (left <= 0L) return -1
        val count = source.read(bytes, offset, minOf(length.toLong(), left).toInt())
        if (count > 0) left -= count
        return count
    }

    override fun close() {
        source.close()
    }
}
