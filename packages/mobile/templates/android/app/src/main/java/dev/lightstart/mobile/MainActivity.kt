package dev.lightstart.mobile

import android.Manifest
import android.annotation.SuppressLint
import android.content.ClipData
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.webkit.MimeTypeMap
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
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

/** One WebView over the app served from the APK's assets, and the share, reminder and capture capabilities. */
class MainActivity : AppCompatActivity() {

    companion object {
        const val HOST = "appassets.androidplatform.net"
        const val ORIGIN = "https://$HOST"
        private const val CHANNEL = "lightMobile"
        private const val CAPTURE_REQUEST = 7301
        private const val NOTIFICATION_REQUEST = 7302
        private const val SERVED = "mobile-served"

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
    private lateinit var bridge: Bridge
    private lateinit var assetLoader: WebViewAssetLoader
    private var insetJs = ""
    private var captureFile: File? = null
    private var captureDone: ((JSONObject?) -> Unit)? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        holdOrientation()
        bridge = Bridge(this)
        assetLoader = WebViewAssetLoader.Builder()
            .setDomain(HOST)
            .addPathHandler("/", WebViewAssetLoader.PathHandler { path -> serveAsset(path) })
            .build()
        setupWebView()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })
    }

    override fun onDestroy() {
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
        if (requestCode == NOTIFICATION_REQUEST) return
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
        setContentView(webView)
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
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                if (request.url.host == HOST) assetLoader.shouldInterceptRequest(request.url) else null

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
        sharedIn(intent)?.let { return originUrl("${it.path}?${it.query}") }
        intent?.getStringExtra("notif_path")?.takeIf { it.isNotEmpty() }?.let { return originUrl(it) }
        return homeUrl()
    }

    private fun homeUrl(): String = if (BuildConfig.BASE_PATH.isEmpty()) "$ORIGIN/" else "$ORIGIN${BuildConfig.BASE_PATH}/"

    private fun originUrl(path: String): String = if (path.startsWith("http")) path else "$ORIGIN${if (path.startsWith("/")) path else "/$path"}"

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
