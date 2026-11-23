package dev.lightstart.mobile.addons

import dev.lightstart.mobile.MainActivity
import dev.lightstart.mobile.MobileAddon
import android.Manifest
import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.util.Base64
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CaptureRequest
import android.hardware.camera2.CaptureResult
import android.hardware.camera2.TotalCaptureResult
import android.util.Log
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.camera.camera2.interop.Camera2CameraControl
import androidx.camera.camera2.interop.Camera2CameraInfo
import androidx.camera.camera2.interop.Camera2Interop
import androidx.camera.camera2.interop.CaptureRequestOptions
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** CameraX behind the page: the preview, controls, captures, clips, frame feed and meter, as an add-on of light's mobile shell. */
@androidx.annotation.OptIn(androidx.camera.camera2.interop.ExperimentalCamera2Interop::class)
class CameraAddon : MobileAddon {
    override val families: List<String> = listOf("camera")

    companion object {
        private const val TAG = "LightCamera"
        private const val MAX_REPORTED_SHUTTER_S = 0.5
        private const val CAMERA_BOUNDS = "CAMERA:BOUNDS"
        private const val CAMERA_CAPTURE = "CAMERA:CAPTURE"
        private const val CAMERA_DIAG = "CAMERA:DIAG"
        private const val CAMERA_LENSES = "CAMERA:LENSES"
        private const val CAMERA_FRAMES = "CAMERA:FRAMES"
        private const val CAMERA_VIEW = "CAMERA:VIEW"
        private const val CAMERA_RECORD_START = "CAMERA:RECORD_START"
        private const val CAMERA_RECORD_STOP = "CAMERA:RECORD_STOP"
        private const val CAMERA_SET = "CAMERA:SET"
        private const val CAMERA_START = "CAMERA:START"
        private const val CAMERA_STOP = "CAMERA:STOP"
    }

    private lateinit var activity: MainActivity
    private var previewView: PreviewView? = null
    private var provider: ProcessCameraProvider? = null
    private var camera: Camera? = null
    private var imageCapture: ImageCapture? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var activeRecording: Recording? = null
    private var recordStopRespond: ((Any?) -> Unit)? = null
    private var recStartMs = 0L
    private var currentDeviceId = "back"

    private var manualIso: Int? = null
    private var manualExposureNs: Long? = null
    private var manualFocusDiopters: Float? = null
    private var keepFormat = "jpeg"
    private var rawBound = false
    private var awbMode: Int? = null
    private var torchOn = false
    private var zoomRatio = 1f
    private var evValue = 0.0
    private var aspectRatioId = "4:3"
    private var frameShape = "portrait"
    private var boundBox = "portrait"
    private val reframe = Runnable {
        if (camera == null || activeRecording != null || box() == boundBox) return@Runnable
        try {
            bind(currentDeviceId, keep = true)
        } catch (e: Exception) {
            Log.w(TAG, "reframing after a turn failed", e)
        }
    }
    private var photoTargetSize: android.util.Size? = null
    private var videoTargetSize: android.util.Size? = null
    private var videoFps = 0
    private var rotation = android.view.Surface.ROTATION_0
    private var orientationListener: android.view.OrientationEventListener? = null
    private var meterIso: Int? = null
    private var meterExposureNs: Long? = null
    private var meterAperture: Float? = null
    private var meterAeState: Int? = null
    private var meterLuma: Double? = null
    private var lastMeterEmitMs = 0L
    private var framesOn = false
    private var frameWidth = 640
    private var frameFps = 15
    private var lastFrameMs = 0L
    private val frameExecutor = Executors.newSingleThreadExecutor()

    private val servedDir: File
        get() = activity.nativeFiles

    override fun onCreate(activity: MainActivity, root: FrameLayout, webView: WebView) {
        this.activity = activity
        /**
         * Backed by a TextureView rather than the default SurfaceView.
         *
         * The default punches a hole through the window, which cannot be
         * layered with another addon's surface: an idle one paints solid black
         * over whatever is drawing behind the same WebView, and hiding it to
         * avoid that stops its surface ever being created, so the preview comes
         * back blank. Compositing normally costs a little power and makes both
         * problems go away.
         */
        previewView = PreviewView(activity).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            )
            implementationMode = PreviewView.ImplementationMode.COMPATIBLE
        }
        root.addView(previewView, 0)
        orientationListener = object : android.view.OrientationEventListener(activity) {
            override fun onOrientationChanged(degrees: Int) {
                if (degrees == ORIENTATION_UNKNOWN) return
                val next = when (degrees) {
                    in 45..134 -> android.view.Surface.ROTATION_270
                    in 135..224 -> android.view.Surface.ROTATION_180
                    in 225..314 -> android.view.Surface.ROTATION_90
                    else -> android.view.Surface.ROTATION_0
                }
                if (next == rotation) return
                rotation = next
                imageCapture?.targetRotation = next
                videoCapture?.targetRotation = next
                emitOrientation()
                previewView?.removeCallbacks(reframe)
                previewView?.postDelayed(reframe, 500)
            }
        }
        // Only this addon's own captures. The served dir is shared, and other
        // addons keep durable files there (imported device media).
        servedDir.listFiles { f -> f.name.startsWith("shot-") || f.name.startsWith("clip-") }
            ?.forEach { it.delete() }
    }

    override fun onDestroy() {
        if (!::activity.isInitialized) return
        try { activeRecording?.stop() } catch (e: Exception) {}
        activeRecording = null
        orientationListener?.disable()
        orientationListener = null
        provider?.unbindAll()
        provider = null
        camera = null
        imageCapture = null
        videoCapture = null
        frameExecutor.shutdown()
        activity.setWebViewTransparent("camera", false)
    }

    override fun handle(method: String, args: JSONArray, respond: (Any?) -> Unit, fail: (String) -> Unit): Boolean {
        if (!method.startsWith("CAMERA:")) return false
        val payload = args.optJSONObject(0) ?: JSONObject()
        activity.runOnUiThread {
            try {
                when (method) {
                    CAMERA_START -> start(payload, respond, fail)
                    CAMERA_STOP -> { stopCamera(); respond(null) }
                    CAMERA_BOUNDS -> { setBounds(payload); respond(null) }
                    CAMERA_SET -> set(payload, respond, fail)
                    CAMERA_CAPTURE -> capture(respond, fail)
                    CAMERA_RECORD_START -> recordStart(respond, fail)
                    CAMERA_RECORD_STOP -> recordStop(respond, fail)
                    CAMERA_LENSES -> respond(JSONObject().put("lenses", lensesForFacing(currentFacing)))
                    CAMERA_FRAMES -> { setFrames(payload); respond(null) }
                    CAMERA_VIEW -> { setView(payload); respond(null) }
                    CAMERA_DIAG -> respond(diagnoseJson())
                    else -> fail("unknown camera message: $method")
                }
            } catch (e: Exception) {
                Log.w(TAG, "camera op failed: $method", e)
                fail(e.message ?: "camera error")
            }
        }
        return true
    }

    private var currentFacing = "back"
    private var pendingZoom = 1f

    /** The page's rotation, as the degrees a capture is turned by. */
    /** The mean of the Y plane, sampled every eighth pixel: the frame's luma, 0 to 1 as the sensor encodes it. */
    private fun lumaOf(image: ImageProxy): Double {
        val plane = image.planes[0]
        val buf = plane.buffer
        val rowStride = plane.rowStride
        val pixelStride = plane.pixelStride
        var sum = 0L
        var n = 0L
        var y = 0
        while (y < image.height) {
            val row = y * rowStride
            var x = 0
            while (x < image.width) {
                val i = row + x * pixelStride
                if (i < buf.limit()) { sum += (buf.get(i).toInt() and 0xff); n++ }
                x += 8
            }
            y += 8
        }
        return if (n == 0L) 0.0 else sum.toDouble() / n / 255.0
    }

    /** `CAMERA:FRAMES { on, width, fps }`: the preview's frames to the page while on; a change of size rebinds the analysis stream. */
    private fun setFrames(payload: JSONObject?) {
        val on = payload?.optBoolean("on", false) == true
        val width = payload?.optInt("width", 640)?.coerceIn(160, 1280) ?: 640
        val rebind = on != framesOn || (on && width != frameWidth)
        framesOn = on
        frameWidth = width
        frameFps = payload?.optInt("fps", 15)?.coerceIn(1, 30) ?: 15
        lastFrameMs = 0L
        if (rebind && camera != null) bind(currentDeviceId, keep = true)
    }

    private fun nv21Of(image: ImageProxy): ByteArray {
        val w = image.width
        val h = image.height
        val y = image.planes[0]
        val u = image.planes[1]
        val v = image.planes[2]
        val out = ByteArray(w * h * 3 / 2)
        var pos = 0
        val yBuf = y.buffer
        for (row in 0 until h) for (col in 0 until w) out[pos++] = yBuf.get(row * y.rowStride + col * y.pixelStride)
        val uBuf = u.buffer
        val vBuf = v.buffer
        for (row in 0 until h / 2) for (col in 0 until w / 2) {
            val i = row * u.rowStride + col * u.pixelStride
            out[pos++] = vBuf.get(i)
            out[pos++] = uBuf.get(i)
        }
        return out
    }

    /** One preview frame to the page as a JPEG, at most `frameFps` a second. */
    private fun emitFrame(image: ImageProxy) {
        val now = System.currentTimeMillis()
        if (now - lastFrameMs < 1000L / frameFps) return
        lastFrameMs = now
        try {
            val w = image.width
            val h = image.height
            val out = ByteArrayOutputStream()
            YuvImage(nv21Of(image), ImageFormat.NV21, w, h, null).compressToJpeg(Rect(0, 0, w, h), 70, out)
            val data = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
            val rotation = image.imageInfo.rotationDegrees
            activity.runOnUiThread { activity.emit("camera:frame", JSONObject().put("data", data).put("width", w).put("height", h).put("rotation", rotation)) }
        } catch (e: Exception) {
            Log.w(TAG, "frame to the page failed", e)
        }
    }

    /** The sensor's reading, at most four times a second: what the last frame was made with, and how bright it came out. */
    private fun maybeEmitMeter() {
        val now = System.currentTimeMillis()
        if (now - lastMeterEmitMs < 250) return
        lastMeterEmitMs = now
        val o = JSONObject()
        meterIso?.let { o.put("iso", it) }
        meterExposureNs?.let { o.put("exposureTime", it / 1e9) }
        meterAperture?.let { o.put("aperture", it.toDouble()) }
        meterAeState?.let { o.put("aeState", it) }
        meterLuma?.let { o.put("luma", it) }
        activity.runOnUiThread { activity.emit("camera:meter", o) }
    }

    private fun emitOrientation() {
        val degrees = when (rotation) {
            android.view.Surface.ROTATION_90 -> 90
            android.view.Surface.ROTATION_180 -> 180
            android.view.Surface.ROTATION_270 -> 270
            else -> 0
        }
        activity.emit("camera:orientation", JSONObject().put("rotation", degrees))
    }

    private fun start(payload: JSONObject?, respond: (Any?) -> Unit, fail: (String) -> Unit) {
        val requested = payload?.optString("deviceId", "") ?: ""
        val width = payload?.optInt("width", 0) ?: 0
        val height = payload?.optInt("height", 0) ?: 0
        videoTargetSize = if (width > 0 && height > 0) android.util.Size(width, height) else null
        videoFps = payload?.optInt("frameRate", 0) ?: 0
        payload?.optString("orientation", "")?.takeIf { it == "portrait" || it == "landscape" }?.let { frameShape = it }
        payload?.optString("keep", "")?.takeIf { it == "raw" || it == "jpeg" }?.let { keepFormat = it }
        val deviceId = when {
            requested.isNotEmpty() && requested != "null" -> requested
            payload?.optString("facingMode") == "user" -> "front"
            else -> "back"
        }
        activity.ensurePermissions(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)) { granted ->
            if (!granted) {
                fail("camera-permission-denied")
                return@ensurePermissions
            }
            val future = ProcessCameraProvider.getInstance(activity)
            future.addListener({
                try {
                    provider = future.get()
                    bind(deviceId)
                    activity.setWebViewTransparent("camera", true)
                    orientationListener?.enable()
                    emitOrientation()
                    respond(JSONObject()
                        .put("capabilities", capabilitiesJson())
                        .put("settings", settingsJson())
                        .put("lens", currentDeviceId)
                        .put("lenses", lensesForFacing(currentFacing)))
                } catch (e: Exception) {
                    Log.w(TAG, "camera start failed", e)
                    fail(e.message ?: "camera-start-failed")
                }
            }, ContextCompat.getMainExecutor(activity))
        }
    }

    /** Build a selector for a deviceId: a real camera id, a facing shortcut, or a "zoom:<facing>:<ratio>" synthetic lens. */
    private fun selectorFor(deviceId: String): Pair<CameraSelector, Float> {
        if (deviceId.startsWith("zoom:")) {
            val parts = deviceId.split(":")
            val facing = parts.getOrElse(1) { "back" }
            val ratio = parts.getOrNull(2)?.toFloatOrNull() ?: 1f
            val sel = if (facing == "front") CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA
            return sel to ratio
        }
        val target = provider?.availableCameraInfos?.firstOrNull { Camera2CameraInfo.from(it).cameraId == deviceId }
        if (target != null)
            return CameraSelector.Builder()
                .addCameraFilter { infos -> infos.filter { Camera2CameraInfo.from(it).cameraId == deviceId } }
                .build() to 1f
        return (if (deviceId == "front") CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA) to 1f
    }

    /**
     * The box on the screen the picture is cut to, in the display's own
     * orientation (the activity is held upright): the picture wanted
     * (`frameShape`), turned when the phone is on its side, so a landscape
     * picture from a phone turned sideways is the whole sensor and one from a
     * phone held upright is a wide cut of it.
     */
    private fun box(): String {
        val sideways = rotation == android.view.Surface.ROTATION_90 || rotation == android.view.Surface.ROTATION_270
        return if ((frameShape == "landscape") != sideways) "landscape" else "portrait"
    }

    /** The crop every output shares: the box, as the clip's 16:9 in video and the photo's aspect otherwise, so what is kept is what the screen showed. */
    private fun frameRatio(): android.util.Rational {
        val (w, h) = if (videoTargetSize != null) 16 to 9 else when (aspectRatioId) {
            "16:9" -> 16 to 9
            "1:1" -> 1 to 1
            else -> 4 to 3
        }
        return if (box() == "landscape") android.util.Rational(w, h) else android.util.Rational(h, w)
    }

    /** The settings a rebind for a control, a turn or the frames leaves as they were. */
    private fun restoreControls() {
        val cam = camera ?: return
        applyRequestOptions()
        val step = cam.cameraInfo.exposureState.exposureCompensationStep.toFloat()
        if (step > 0f && evValue != 0.0) cam.cameraControl.setExposureCompensationIndex(Math.round(evValue / step).toInt())
        if (torchOn) cam.cameraControl.enableTorch(true)
        if (zoomRatio != 1f) cam.cameraControl.setZoomRatio(zoomRatio)
    }

    /** Bind the camera's outputs; `keep` is a rebind of the same camera, which leaves what the page set. */
    private fun bind(deviceId: String, keep: Boolean = false) {
        val cameraProvider = provider ?: throw IllegalStateException("camera provider unavailable")
        if (deviceId != currentDeviceId) photoTargetSize = null
        currentDeviceId = deviceId
        if (!keep) {
            manualIso = null
            manualExposureNs = null
            manualFocusDiopters = null
            awbMode = null
            torchOn = false
            evValue = 0.0
        }

        val (selector, zoomTarget) = selectorFor(deviceId)
        pendingZoom = if (keep) zoomRatio else zoomTarget
        if (!keep) zoomRatio = zoomTarget
        val previewBuilder = Preview.Builder()
        Camera2Interop.Extender(previewBuilder).setSessionCaptureCallback(object : CameraCaptureSession.CaptureCallback() {
            override fun onCaptureCompleted(session: CameraCaptureSession, request: CaptureRequest, result: TotalCaptureResult) {
                meterIso = result.get(CaptureResult.SENSOR_SENSITIVITY)
                meterExposureNs = result.get(CaptureResult.SENSOR_EXPOSURE_TIME)
                meterAperture = result.get(CaptureResult.LENS_APERTURE)
                meterAeState = result.get(CaptureResult.CONTROL_AE_STATE)
                maybeEmitMeter()
            }
        })
        val preview = previewBuilder.build().also { it.setSurfaceProvider(previewView!!.surfaceProvider) }
        val analysisSize = if (framesOn) android.util.Size(frameWidth, frameWidth * 3 / 4) else android.util.Size(320, 240)
        val analysis = ImageAnalysis.Builder()
            .setResolutionSelector(
                androidx.camera.core.resolutionselector.ResolutionSelector.Builder()
                    .setAspectRatioStrategy(androidx.camera.core.resolutionselector.AspectRatioStrategy.RATIO_4_3_FALLBACK_AUTO_STRATEGY)
                    .setResolutionStrategy(androidx.camera.core.resolutionselector.ResolutionStrategy(analysisSize, androidx.camera.core.resolutionselector.ResolutionStrategy.FALLBACK_RULE_CLOSEST_LOWER_THEN_HIGHER))
                    .build(),
            )
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
            .also { it.setAnalyzer(frameExecutor) { image ->
                meterLuma = lumaOf(image)
                if (framesOn) emitFrame(image)
                image.close()
                maybeEmitMeter()
            } }
        val rawWanted = keepFormat == "raw" && rawSupported(cameraProvider.getCameraInfo(selector))
        val imageBuilder = ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY).setTargetRotation(rotation)
        if (rawWanted) imageBuilder.setOutputFormat(ImageCapture.OUTPUT_FORMAT_RAW_JPEG)
        photoTargetSize?.let { imageBuilder.setTargetResolution(it) }
        val image = imageBuilder.build()
        rawBound = rawWanted
        val wanted = videoTargetSize?.let { size ->
            when (minOf(size.width, size.height)) {
                in 2160..Int.MAX_VALUE -> Quality.UHD
                in 1080..2159 -> Quality.FHD
                in 720..1079 -> Quality.HD
                else -> Quality.SD
            }
        } ?: Quality.HD
        val recorder = Recorder.Builder()
            .setQualitySelector(QualitySelector.from(wanted, androidx.camera.video.FallbackStrategy.higherQualityOrLowerThan(wanted)))
            .build()
        val fpsOk = videoFps > 0 && try {
            cameraProvider.getCameraInfo(selector).supportedFrameRateRanges.any { it.lower <= videoFps && it.upper >= videoFps }
        } catch (e: Exception) { false }
        val videoBuilder = VideoCapture.Builder(recorder).setTargetRotation(rotation)
        if (fpsOk) videoBuilder.setTargetFrameRate(android.util.Range(videoFps, videoFps))
        val video = videoBuilder.build()

        boundBox = box()
        val viewPort = androidx.camera.core.ViewPort.Builder(frameRatio(), previewView!!.display?.rotation ?: android.view.Surface.ROTATION_0).build()
        fun attempt(vararg cases: androidx.camera.core.UseCase): Boolean = try {
            cameraProvider.unbindAll()
            val group = androidx.camera.core.UseCaseGroup.Builder().setViewPort(viewPort)
            cases.forEach { group.addUseCase(it) }
            camera = cameraProvider.bindToLifecycle(activity, selector, group.build())
            true
        } catch (e: Exception) {
            Log.w(TAG, "binding ${cases.joinToString { it.javaClass.simpleName }} failed", e)
            false
        }
        fun videoSide(): Int = video.resolutionInfo?.resolution?.let { minOf(it.width, it.height) } ?: 0

        var bound: ImageCapture? = image
        videoCapture = null
        meterLuma = null
        if (rawWanted) {
            /**
             * RAW is bound with as few streams as the HAL can be asked for: the
             * preview, the capture and the meter's analysis, never video beside
             * them. A HAL that takes the fourth stream on a JPEG session has been
             * seen to die on a RAW press with it.
             */
            if (!attempt(preview, image, analysis) && !attempt(preview, image)) {
                Log.w(TAG, "binding RAW beside the preview failed; JPEG only")
                rawBound = false
                val jpegOnly = ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY).setTargetRotation(rotation)
                    .also { b -> photoTargetSize?.let { b.setTargetResolution(it) } }.build()
                bound = jpegOnly
                if (!attempt(preview, jpegOnly)) throw IllegalStateException("camera-bind-failed")
            }
        } else if (videoTargetSize == null) {
            if (!attempt(preview, image, analysis) && !attempt(preview, image)) throw IllegalStateException("camera-bind-failed")
        } else {
            val wantedSide = when (wanted) {
                Quality.UHD -> 2160
                Quality.FHD -> 1080
                Quality.HD -> 720
                else -> 480
            }
            val sets: List<Array<androidx.camera.core.UseCase>> = if (framesOn)
                listOf(arrayOf(preview, image, video, analysis), arrayOf(preview, video, analysis))
            else
                listOf(arrayOf(preview, image, video, analysis), arrayOf(preview, video, analysis), arrayOf(preview, image, video), arrayOf(preview, video))
            var best = -1
            var bestSide = -1
            var current = -1
            for ((i, set) in sets.withIndex()) {
                if (!attempt(*set)) continue
                current = i
                val side = videoSide()
                Log.i(TAG, "clip stream ${video.resolutionInfo?.resolution} with ${set.joinToString { it.javaClass.simpleName }}")
                if (side > bestSide) {
                    best = i
                    bestSide = side
                }
                if (side >= wantedSide) break
            }
            if (best < 0) {
                Log.w(TAG, "binding video failed; photo-only")
                if (!attempt(preview, image)) throw IllegalStateException("camera-bind-failed")
            } else {
                val set = sets[best]
                if (current != best && !attempt(*set)) throw IllegalStateException("camera-bind-failed")
                videoCapture = video
                if (image !in set) bound = null
            }
        }
        imageCapture = bound
        currentFacing = if (camera?.cameraInfo?.let { Camera2CameraInfo.from(it) }?.getCameraCharacteristic(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_FRONT) "front" else "back"
        if (keep) restoreControls() else if (zoomTarget != 1f) camera?.cameraControl?.setZoomRatio(zoomTarget)
    }

    /**
     * Draw the preview into a rect of the page rather than behind all of it, so
     * a floating widget shows a scaled-down whole frame instead of a crop of a
     * full-screen one. Zero width or height restores fullscreen.
     */
    /** `CAMERA:VIEW { scale }`: the preview view magnified about its centre, the camera itself untouched. */
    private fun setView(payload: JSONObject?) {
        val preview = previewView ?: return
        val scale = (payload?.optDouble("scale", 1.0) ?: 1.0).toFloat().coerceIn(1f, 4f)
        preview.scaleX = scale
        preview.scaleY = scale
    }

    private fun setBounds(payload: JSONObject?) {
        val preview = previewView ?: return
        val density = activity.resources.displayMetrics.density
        val px = { key: String -> ((payload?.optDouble(key, 0.0) ?: 0.0) * density).toInt() }
        val width = px("width")
        val height = px("height")
        val params = preview.layoutParams as? FrameLayout.LayoutParams ?: return
        val fullscreen = width <= 0 || height <= 0
        params.width = if (fullscreen) FrameLayout.LayoutParams.MATCH_PARENT else width
        params.height = if (fullscreen) FrameLayout.LayoutParams.MATCH_PARENT else height
        params.leftMargin = if (fullscreen) 0 else px("x")
        params.topMargin = if (fullscreen) 0 else px("y")
        preview.layoutParams = params
    }

    private fun stopCamera() {
        orientationListener?.disable()
        previewView?.scaleX = 1f
        previewView?.scaleY = 1f
        meterIso = null
        meterExposureNs = null
        meterAperture = null
        meterLuma = null
        setBounds(null)
        try { activeRecording?.stop() } catch (e: Exception) {}
        activeRecording = null
        provider?.unbindAll()
        camera = null
        imageCapture = null
        videoCapture = null
        activity.setWebViewTransparent("camera", false)
    }

    private fun characteristics(): Camera2CameraInfo? =
        camera?.cameraInfo?.let { Camera2CameraInfo.from(it) }

    /** Whether the camera writes the sensor's DNG beside the JPEG in one press. */
    private fun rawSupported(info: androidx.camera.core.CameraInfo?): Boolean = try {
        info != null && ImageCapture.getImageCaptureCapabilities(info).supportedOutputFormats.contains(ImageCapture.OUTPUT_FORMAT_RAW_JPEG)
    } catch (e: Exception) { false }

    private fun hasManualSensor(): Boolean {
        val caps = characteristics()?.getCameraCharacteristic(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES)
        return caps?.contains(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_MANUAL_SENSOR) == true
    }

    private fun capabilitiesJson(): JSONObject {
        val out = JSONObject()
        val cam = camera ?: return out
        val info = cam.cameraInfo
        out.put("orientations", org.json.JSONArray(listOf("portrait", "landscape")))
        out.put("stills", imageCapture != null)

        val zoom = info.zoomState.value
        if (zoom != null)
            out.put("zoom", JSONObject()
                .put("min", zoom.minZoomRatio.toDouble())
                .put("max", zoom.maxZoomRatio.toDouble())
                .put("step", 0.1))

        val exposure = info.exposureState
        if (exposure.isExposureCompensationSupported) {
            val step = exposure.exposureCompensationStep.toFloat()
            out.put("exposureCompensation", JSONObject()
                .put("min", (exposure.exposureCompensationRange.lower * step).toDouble())
                .put("max", (exposure.exposureCompensationRange.upper * step).toDouble())
                .put("step", step.toDouble()))
        }

        val c2 = characteristics()
        if (c2 != null && hasManualSensor()) {
            val isoRange = c2.getCameraCharacteristic(CameraCharacteristics.SENSOR_INFO_SENSITIVITY_RANGE)
            if (isoRange != null)
                out.put("iso", JSONObject()
                    .put("min", isoRange.lower)
                    .put("max", isoRange.upper)
                    .put("step", 1))
            val expRange = c2.getCameraCharacteristic(CameraCharacteristics.SENSOR_INFO_EXPOSURE_TIME_RANGE)
            if (expRange != null) {
                val minS = expRange.lower / 1e9
                val maxS = minOf(expRange.upper / 1e9, MAX_REPORTED_SHUTTER_S)
                out.put("exposureTime", JSONObject()
                    .put("min", minS)
                    .put("max", maxS)
                    .put("step", minS))
            }
        }

        val minFocus = c2?.getCameraCharacteristic(CameraCharacteristics.LENS_INFO_MINIMUM_FOCUS_DISTANCE)
        if (minFocus != null && minFocus > 0f)
            out.put("focusDistance", JSONObject()
                .put("min", 0.0)
                .put("max", minFocus.toDouble())
                .put("step", (minFocus / 100f).toDouble()))

        val awbModes = c2?.getCameraCharacteristic(CameraCharacteristics.CONTROL_AWB_AVAILABLE_MODES)
        if (awbModes != null && awbModes.size > 1)
            out.put("colorTemperature", JSONObject()
                .put("min", 2500)
                .put("max", 9000)
                .put("step", 100))

        if (info.hasFlashUnit()) out.put("torch", true)
        out.put("raw", rawSupported(info))

        out.put("photoSizes", photoSizesJson(c2))
        out.put("videoQualities", videoQualitiesJson(info))
        out.put("aspectRatios", org.json.JSONArray().put("4:3").put("16:9").put("1:1"))
        return out
    }

    /** The preview's real geometry, so a blank picture can be diagnosed from JS. */
    private fun previewJson(): JSONObject {
        val pv = previewView
        val parent = pv?.parent as? android.view.ViewGroup
        return JSONObject()
            .put("width", pv?.width ?: -1)
            .put("height", pv?.height ?: -1)
            .put("left", pv?.left ?: -1)
            .put("top", pv?.top ?: -1)
            .put("visibility", pv?.visibility ?: -1)
            .put("index", parent?.indexOfChild(pv) ?: -1)
            .put("siblings", parent?.childCount ?: -1)
            .put("mode", pv?.implementationMode?.name ?: "none")
            .put("bound", camera != null)
    }

    private fun diagnoseJson(): JSONObject {
        val out = JSONObject().put("preview", previewJson())
        val cx = org.json.JSONArray()
        for (info in provider?.availableCameraInfos ?: emptyList()) {
            val c2 = Camera2CameraInfo.from(info)
            cx.put(camInfoJson(c2.cameraId, c2.getCameraCharacteristic(CameraCharacteristics.LENS_FACING),
                c2.getCameraCharacteristic(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS),
                c2.getCameraCharacteristic(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE),
                c2.getCameraCharacteristic(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES)))
        }
        out.put("cameraX", cx)
        val raw = org.json.JSONArray()
        try {
            val cm = activity.getSystemService(Context.CAMERA_SERVICE) as android.hardware.camera2.CameraManager
            for (id in cm.cameraIdList) {
                val ch = cm.getCameraCharacteristics(id)
                raw.put(camInfoJson(id, ch.get(CameraCharacteristics.LENS_FACING),
                    ch.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS),
                    ch.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE),
                    ch.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES)))
            }
        } catch (e: Exception) { out.put("rawError", e.message) }
        out.put("camera2", raw)
        return out
    }

    private fun camInfoJson(id: String, facing: Int?, focals: FloatArray?, sensor: android.util.SizeF?, caps: IntArray?): JSONObject {
        val mm = if (focals != null && focals.isNotEmpty() && sensor != null && sensor.width > 0)
            Math.round(focals[0] * 36f / sensor.width) else -1
        return JSONObject()
            .put("id", id)
            .put("facing", if (facing == CameraCharacteristics.LENS_FACING_FRONT) "front" else if (facing == CameraCharacteristics.LENS_FACING_BACK) "back" else "ext")
            .put("mm", mm)
            .put("focals", focals?.joinToString(",") ?: "")
            .put("backwardCompat", caps?.contains(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_BACKWARD_COMPATIBLE) ?: false)
    }

    /** The bound camera's real JPEG output sizes, deduped to a few sensible megapixel choices. */
    private fun photoSizesJson(c2: Camera2CameraInfo?): org.json.JSONArray {
        val out = org.json.JSONArray()
        val map = c2?.getCameraCharacteristic(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP) ?: return out
        val sizes = map.getOutputSizes(android.graphics.ImageFormat.JPEG)?.toList() ?: return out
        val ranked = sizes.sortedByDescending { it.width.toLong() * it.height }
        val picks = mutableListOf<android.util.Size>()
        for (s in ranked) {
            if (picks.none { Math.abs((it.width.toLong() * it.height) - (s.width.toLong() * s.height)) < (s.width.toLong() * s.height) * 0.15 })
                picks.add(s)
            if (picks.size >= 3) break
        }
        for (s in picks) {
            val mp = Math.round(s.width.toLong() * s.height / 1_000_000.0)
            out.put(JSONObject().put("w", s.width).put("h", s.height).put("mp", mp).put("id", "${s.width}x${s.height}"))
        }
        return out
    }

    private fun videoQualitiesJson(info: androidx.camera.core.CameraInfo): org.json.JSONArray {
        val out = org.json.JSONArray()
        val caps = try { Recorder.getVideoCapabilities(info) } catch (e: Exception) { null } ?: return out
        val quals = try { caps.getSupportedQualities(androidx.camera.core.DynamicRange.SDR) } catch (e: Exception) { emptyList() }
        val names = mapOf(Quality.UHD to "2160p", Quality.FHD to "1080p", Quality.HD to "720p", Quality.SD to "480p")
        for (q in quals) names[q]?.let { out.put(it) }
        return out
    }

    private fun settingsJson(): JSONObject {
        val out = JSONObject()
        out.put("deviceId", currentDeviceId)
        out.put("facingMode", if (currentFacing == "front") "user" else "environment")
        videoTargetSize?.let { out.put("width", it.width).put("height", it.height) }
        if (videoFps > 0) out.put("frameRate", videoFps)
        out.put("zoom", (camera?.cameraInfo?.zoomState?.value?.zoomRatio ?: zoomRatio).toDouble())
        out.put("exposureCompensation", evValue)
        out.put("torch", torchOn)
        manualIso?.let { out.put("iso", it) }
        manualExposureNs?.let { out.put("exposureTime", it / 1e9) }
        manualFocusDiopters?.let { out.put("focusDistance", it.toDouble()) }
        val res = imageCapture?.resolutionInfo?.resolution
        if (res != null) {
            out.put("width", res.width)
            out.put("height", res.height)
        }
        out.put("aspectRatio", aspectRatioId)
        out.put("orientation", frameShape)
        out.put("box", boundBox)
        videoCapture?.resolutionInfo?.let { info ->
            val crop = info.cropRect
            val turned = info.rotationDegrees % 180 != 0
            out.put("clip", if (turned) "${crop.height()}x${crop.width()}" else "${crop.width()}x${crop.height()}")
        }
        out.put("keep", if (rawBound) "raw" else "jpeg")
        photoTargetSize?.let { out.put("photoSize", "${it.width}x${it.height}") }
        return out
    }

    private fun set(payload: JSONObject?, respond: (Any?) -> Unit, fail: (String) -> Unit) {
        val cam = camera ?: return fail("not-started")
        val key = payload?.optString("key") ?: return fail("missing control key")
        when (key) {
            "zoom" -> {
                zoomRatio = payload.optDouble("value", 1.0).toFloat()
                cam.cameraControl.setZoomRatio(zoomRatio)
            }
            "exposureCompensation" -> {
                evValue = payload.optDouble("value", 0.0)
                val step = cam.cameraInfo.exposureState.exposureCompensationStep.toFloat()
                if (step > 0f) cam.cameraControl.setExposureCompensationIndex(Math.round(evValue / step).toInt())
            }
            "iso" -> {
                manualIso = payload.optInt("value", 0).takeIf { it > 0 }
                applyRequestOptions()
            }
            "exposureTime" -> {
                val seconds = payload.optDouble("value", 0.0)
                manualExposureNs = if (seconds > 0) (seconds * 1e9).toLong() else null
                applyRequestOptions()
            }
            "focusDistance" -> {
                manualFocusDiopters = payload.optDouble("value", -1.0).toFloat().takeIf { it >= 0f }
                applyRequestOptions()
            }
            "colorTemperature" -> {
                val kelvin = payload.optInt("value", 0)
                awbMode = if (kelvin <= 0) null else when {
                    kelvin < 3500 -> CaptureRequest.CONTROL_AWB_MODE_INCANDESCENT
                    kelvin < 5000 -> CaptureRequest.CONTROL_AWB_MODE_FLUORESCENT
                    kelvin < 6500 -> CaptureRequest.CONTROL_AWB_MODE_DAYLIGHT
                    else -> CaptureRequest.CONTROL_AWB_MODE_CLOUDY_DAYLIGHT
                }
                applyRequestOptions()
            }
            "torch" -> {
                torchOn = payload.optBoolean("value", false)
                cam.cameraControl.enableTorch(torchOn)
            }
            "aspectRatio" -> {
                aspectRatioId = payload.optString("value", "4:3")
                bind(currentDeviceId, keep = true)
                respond(JSONObject().put("settings", settingsJson()).put("capabilities", capabilitiesJson()))
                return
            }
            "orientation" -> {
                val wantedShape = if (payload.optString("value", "portrait") == "landscape") "landscape" else "portrait"
                if (wantedShape != frameShape) {
                    if (activeRecording != null) return fail("recording")
                    frameShape = wantedShape
                    bind(currentDeviceId, keep = true)
                }
                respond(JSONObject().put("settings", settingsJson()).put("capabilities", capabilitiesJson()))
                return
            }
            "photoSize" -> {
                val id = payload.optString("value", "")
                photoTargetSize = id.split("x").let { if (it.size == 2) android.util.Size(it[0].toInt(), it[1].toInt()) else null }
                bind(currentDeviceId, keep = true)
                respond(JSONObject().put("settings", settingsJson()).put("capabilities", capabilitiesJson()))
                return
            }
            "keep" -> {
                val wanted = if (payload.optString("value", "jpeg") == "raw") "raw" else "jpeg"
                if (wanted != keepFormat) {
                    keepFormat = wanted
                    bind(currentDeviceId, keep = true)
                }
                respond(JSONObject().put("settings", settingsJson()).put("capabilities", capabilitiesJson()))
                return
            }
            else -> return fail("unsupported control: $key")
        }
        respond(JSONObject().put("settings", settingsJson()))
    }

    private fun applyRequestOptions() {
        val cam = camera ?: return
        val builder = CaptureRequestOptions.Builder()
        val manualExposure = manualIso != null || manualExposureNs != null
        if (manualExposure && hasManualSensor()) {
            builder.setCaptureRequestOption(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_OFF)
            builder.setCaptureRequestOption(CaptureRequest.SENSOR_SENSITIVITY, manualIso ?: 400)
            builder.setCaptureRequestOption(CaptureRequest.SENSOR_EXPOSURE_TIME, manualExposureNs ?: 16_666_666L)
        }
        val focus = manualFocusDiopters
        if (focus != null) {
            builder.setCaptureRequestOption(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_OFF)
            builder.setCaptureRequestOption(CaptureRequest.LENS_FOCUS_DISTANCE, focus)
        }
        val awb = awbMode
        if (awb != null)
            builder.setCaptureRequestOption(CaptureRequest.CONTROL_AWB_MODE, awb)
        Camera2CameraControl.from(cam.cameraControl).setCaptureRequestOptions(builder.build())
    }

    private fun capture(respond: (Any?) -> Unit, fail: (String) -> Unit) {
        val image = imageCapture ?: return fail("not-started")
        val stamp = System.currentTimeMillis()
        val file = File(servedDir, "shot-$stamp.jpg")
        if (rawBound) {
            val raw = File(servedDir, "shot-$stamp.dng")
            var done = false
            val seen = mutableSetOf<Int>()
            image.takePicture(
                ImageCapture.OutputFileOptions.Builder(raw).build(),
                ImageCapture.OutputFileOptions.Builder(file).build(),
                ContextCompat.getMainExecutor(activity),
                object : ImageCapture.OnImageSavedCallback {
                    override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                        seen.add(output.imageFormat)
                        if (done || seen.size < 2) return
                        done = true
                        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                        BitmapFactory.decodeFile(file.absolutePath, bounds)
                        respond(JSONObject()
                            .put("url", "/__mobile/native/${file.name}")
                            .put("rawUrl", "/__mobile/native/${raw.name}")
                            .put("width", bounds.outWidth)
                            .put("height", bounds.outHeight))
                    }
                    override fun onError(e: ImageCaptureException) {
                        if (done) return
                        done = true
                        fail(e.message ?: "capture-failed")
                    }
                },
            )
            return
        }
        image.takePicture(
            ImageCapture.OutputFileOptions.Builder(file).build(),
            ContextCompat.getMainExecutor(activity),
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                    BitmapFactory.decodeFile(file.absolutePath, bounds)
                    respond(JSONObject()
                        .put("url", "/__mobile/native/${file.name}")
                        .put("width", bounds.outWidth)
                        .put("height", bounds.outHeight))
                }
                override fun onError(e: ImageCaptureException) {
                    fail(e.message ?: "capture-failed")
                }
            },
        )
    }

    /** A clip asked for while the camera is bound for photos binds the video stream first, at 1080p unless a size was asked. */
    private fun recordStart(respond: (Any?) -> Unit, fail: (String) -> Unit) {
        if (videoCapture == null && camera != null && activeRecording == null) {
            if (videoTargetSize == null) videoTargetSize = android.util.Size(1920, 1080)
            try {
                bind(currentDeviceId, keep = true)
            } catch (e: Exception) {
                return fail(e.message ?: "recording-unsupported")
            }
        }
        val video = videoCapture ?: return fail("recording-unsupported")
        if (activeRecording != null) return fail("already-recording")
        val file = File(servedDir, "clip-${System.currentTimeMillis()}.mp4")
        val hasAudio = ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
        var pending = video.output.prepareRecording(activity, FileOutputOptions.Builder(file).build())
        if (hasAudio) pending = pending.withAudioEnabled()
        recStartMs = System.currentTimeMillis()
        activeRecording = pending.start(ContextCompat.getMainExecutor(activity)) { event ->
            if (event is VideoRecordEvent.Finalize) {
                activeRecording = null
                val stopRespond = recordStopRespond
                recordStopRespond = null
                if (event.hasError()) {
                    Log.w(TAG, "recording finalize error ${event.error}")
                    stopRespond?.invoke(JSONObject.NULL)
                } else
                    stopRespond?.invoke(JSONObject()
                        .put("url", "/__mobile/native/${file.name}")
                        .put("durationMs", System.currentTimeMillis() - recStartMs)
                        .put("mime", "video/mp4")
                        .put("ext", "mp4"))
            }
        }
        respond(null)
    }

    private fun recordStop(respond: (Any?) -> Unit, fail: (String) -> Unit) {
        val recording = activeRecording ?: return fail("not-recording")
        recordStopRespond = respond
        recording.stop()
    }

    private data class LensCandidate(val id: String, val mm: Int, val hasAf: Boolean, val sensorW: Float)

    /**
     * The real photographic lenses for one facing. Enumerates every bindable camera,
     * drops non-BACKWARD_COMPATIBLE sensors (depth/ToF), computes 35mm-equivalent focal
     * length, dedupes by rounded mm (a fixed-focus macro that shares the main's focal
     * length collapses into Main), and, if a phone fuses lenses into one logical camera
     * with a wide zoom range, synthesizes zoom-stop lenses. Classification/labels are
     * done in JS (lens-model).
     */
    private fun lensesForFacing(facing: String): org.json.JSONArray {
        val out = org.json.JSONArray()
        val infos = provider?.availableCameraInfos ?: return out
        val want = if (facing == "front") CameraCharacteristics.LENS_FACING_FRONT else CameraCharacteristics.LENS_FACING_BACK

        val candidates = mutableListOf<LensCandidate>()
        for (info in infos) {
            val c2 = Camera2CameraInfo.from(info)
            if (c2.getCameraCharacteristic(CameraCharacteristics.LENS_FACING) != want) continue
            val caps = c2.getCameraCharacteristic(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES) ?: continue
            if (!caps.contains(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_BACKWARD_COMPATIBLE)) continue
            val focal = c2.getCameraCharacteristic(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)?.firstOrNull() ?: continue
            val sensor = c2.getCameraCharacteristic(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE) ?: continue
            if (sensor.width <= 0f) continue
            val mm = Math.round(focal * 36f / sensor.width)
            val afModes = c2.getCameraCharacteristic(CameraCharacteristics.CONTROL_AF_AVAILABLE_MODES)
            val hasAf = afModes != null && afModes.any {
                it == CameraCharacteristics.CONTROL_AF_MODE_CONTINUOUS_PICTURE || it == CameraCharacteristics.CONTROL_AF_MODE_AUTO
            }
            candidates.add(LensCandidate(c2.cameraId, mm, hasAf, sensor.width))
        }

        val deduped = candidates
            .groupBy { it.mm }
            .map { (_, group) -> group.sortedWith(compareByDescending<LensCandidate> { it.hasAf }.thenByDescending { it.sensorW }).first() }
            .sortedBy { it.mm }
        if (deduped.isEmpty()) return out
        val mainMm = (deduped.firstOrNull { it.mm in 20..40 } ?: deduped.first()).mm

        // Only REAL, separately-bindable cameras become lenses. Digital zoom is exposed
        // separately (see maxZoom in capabilities) and taught as zoom, never as a lens.
        for (l in deduped)
            out.put(JSONObject()
                .put("deviceId", l.id)
                .put("nominalMm", l.mm)
                .put("zoomRatio", l.mm.toFloat() / mainMm)
                .put("facing", facing))
        return out
    }
}
