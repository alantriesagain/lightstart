package dev.lightstart.mobile

import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.ActivityInfo
import android.net.Uri
import android.os.Bundle
import android.webkit.MimeTypeMap
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
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

/** One WebView over the app served from the APK's assets, and the share capability. */
class MainActivity : AppCompatActivity() {

    companion object {
        const val HOST = "appassets.androidplatform.net"
        const val ORIGIN = "https://$HOST"
        private const val CHANNEL = "lightMobile"

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

    private fun initialUrl(): String = if (BuildConfig.BASE_PATH.isEmpty()) "$ORIGIN/" else "$ORIGIN${BuildConfig.BASE_PATH}/"

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
            val name = entry.optString("name", "").replace(Regex("[^A-Za-z0-9._-]"), "_").ifEmpty { "file-$index" }
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
