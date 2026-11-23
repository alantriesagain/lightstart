package dev.lightstart.mobile.addons

import android.content.Context
import android.graphics.Bitmap
import android.net.Network
import android.view.TextureView
import androidx.media3.common.MediaItem
import androidx.media3.common.Tracks
import androidx.media3.common.VideoSize
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.media3.common.util.TimestampAdjuster
import androidx.media3.extractor.ExtractorsFactory
import androidx.media3.extractor.ts.DefaultTsPayloadReaderFactory
import androidx.media3.extractor.ts.TsExtractor
import androidx.media3.extractor.ts.TsPayloadReader
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

/**
 * Plays a device's live MPEG-TS preview onto a [TextureView].
 *
 * A TextureView rather than a SurfaceView on purpose: CameraX's PreviewView
 * punches a hole through the window, and two hole-punching surfaces behind one
 * transparent WebView fight over z-order. A TextureView composites normally.
 */
@UnstableApi
class DevicesStreamPlayer(
    private val context: Context,
    private val servedDir: File,
    private val emit: (String, JSONObject) -> Unit,
) {
    private var player: ExoPlayer? = null
    private var videoWidth = 0
    private var videoHeight = 0
    /** "contain" shows the true framing; "cover" fills the screen. */
    private var fit = "contain"
    var view: TextureView? = null

    init {
        servedDir.mkdirs()
    }

    fun sweep() {
        servedDir.listFiles { f -> f.name.startsWith("frame-") }?.forEach { it.delete() }
    }

    fun isPlaying(): Boolean = player != null

    private fun stateJson(state: String): JSONObject =
        JSONObject()
            .put("state", state)
            .put("bind", DevicesUdpDataSource.lastBindMode)
            .put("packets", DevicesUdpDataSource.packets)
            .put("bytes", DevicesUdpDataSource.bytes)
            .put("timeouts", DevicesUdpDataSource.timeouts)

    fun start(
        network: Network?,
        port: Int,
        fitMode: String,
        respond: (Any?) -> Unit,
        fail: (String) -> Unit,
    ) {
        stop()
        val surface = view ?: return fail("no-surface")
        fit = fitMode

        /**
         * Exactly one extractor, so nothing sniffs, and it is told to ignore
         * every stream but the video.
         *
         * The camera's program map declares four: H.264, AAC, a telemetry
         * stream and AC-3. The player will not finish preparing until every
         * declared track has produced a format, and the last two never do, so
         * a perfectly good picture sits in BUFFERING until the stream ends.
         * Refusing to create readers for them is what makes it play, and a
         * viewfinder wants nothing but the picture anyway.
         */
        val readers = object : TsPayloadReader.Factory {
            private val delegate =
                DefaultTsPayloadReaderFactory(DefaultTsPayloadReaderFactory.FLAG_ALLOW_NON_IDR_KEYFRAMES)

            override fun createInitialPayloadReaders() = delegate.createInitialPayloadReaders()

            override fun createPayloadReader(streamType: Int, esInfo: TsPayloadReader.EsInfo) =
                if (streamType == TsExtractor.TS_STREAM_TYPE_H264)
                    delegate.createPayloadReader(streamType, esInfo)
                else null
        }
        val extractors = ExtractorsFactory {
            arrayOf(TsExtractor(TsExtractor.MODE_SINGLE_PMT, TimestampAdjuster(0), readers))
        }
        val source = ProgressiveMediaSource
            .Factory({ DevicesUdpDataSource(network, port) }, extractors)
            .createMediaSource(MediaItem.fromUri("udp://0.0.0.0:$port"))

        val exo = ExoPlayer.Builder(context)
            .setLoadControl(
                DefaultLoadControl.Builder()
                    .setBufferDurationsMs(1000, 5000, 200, 500)
                    /**
                     * Without this the load control stops loading once its byte
                     * target is hit, even when nothing playable has come out
                     * yet, and a live TS feed that hasn't reached a keyframe
                     * dies as "stuck buffering and not loading".
                     */
                    .setPrioritizeTimeOverSizeThresholds(true)
                    .build(),
            )
            .build()

        exo.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                val name = when (state) {
                    Player.STATE_BUFFERING -> "buffering"
                    Player.STATE_READY -> "live"
                    Player.STATE_ENDED -> "idle"
                    else -> return
                }
                emit(DevicesCommands.STREAM_STATE, stateJson(name))
            }

            override fun onVideoSizeChanged(videoSize: VideoSize) {
                videoWidth = videoSize.width
                videoHeight = videoSize.height
                fitToView()
            }

            override fun onTracksChanged(tracks: Tracks) {
                val kinds = tracks.groups.joinToString(",") {
                    it.mediaTrackGroup.getFormat(0).sampleMimeType ?: "?"
                }
                android.util.Log.i("DevicesStream", "tracks=${tracks.groups.size} [$kinds]")
                emit(DevicesCommands.STREAM_STATE, stateJson(if (tracks.groups.isEmpty()) "buffering" else "tracks").put("tracks", kinds))
            }

            override fun onPlayerError(error: PlaybackException) {
                emit(DevicesCommands.STREAM_STATE, stateJson("error").put("code", error.errorCodeName))
            }
        })

        exo.setVideoTextureView(surface)
        exo.setMediaSource(source)
        exo.prepare()
        exo.play()
        player = exo
        surface.visibility = android.view.View.VISIBLE
        /**
         * Directly beneath the WebView, above any other addon's idle surface:
         * order in this container decides who is seen through the transparent
         * page, and we are the one with a picture.
         */
        (surface.parent as? android.view.ViewGroup)?.let { parent ->
            parent.removeView(surface)
            parent.addView(surface, (parent.childCount - 1).coerceAtLeast(0))
        }
        respond(JSONObject().put("ok", true).put("port", port))
    }

    /**
     * A TextureView stretches its surface to the view's bounds, which turns a
     * landscape feed on a portrait phone into a tall smear. This letterboxes
     * instead: a viewfinder has to show the framing the camera will actually
     * record, so the whole picture stays visible rather than being cropped.
     */
    private fun fitToView() {
        val surface = view ?: return
        if (videoWidth <= 0 || videoHeight <= 0) return
        surface.post {
            val viewWidth = surface.width.toFloat()
            val viewHeight = surface.height.toFloat()
            if (viewWidth <= 0f || viewHeight <= 0f) return@post
            val videoAspect = videoWidth.toFloat() / videoHeight
            val viewAspect = viewWidth / viewHeight
            /**
             * A TextureView stretches its surface to the view's bounds, so both
             * modes are expressed as a correction on top of that. "contain"
             * shrinks the long side until the whole frame fits; "cover" grows it
             * until nothing is left blank, which is what a full-bleed backdrop
             * behind a workout needs on a portrait phone.
             */
            val letterbox = fit != "cover"
            val wider = videoAspect > viewAspect
            val scaleX: Float
            val scaleY: Float
            if (wider == letterbox) {
                scaleX = 1f
                scaleY = viewAspect / videoAspect
            } else {
                scaleX = videoAspect / viewAspect
                scaleY = 1f
            }
            surface.setTransform(
                android.graphics.Matrix().apply {
                    setScale(scaleX, scaleY, viewWidth / 2f, viewHeight / 2f)
                },
            )
        }
    }

    /**
     * Puts the picture in a window instead of behind the whole page.
     *
     * The surface is a real view, so a floating widget cannot be faked by
     * showing part of a full-screen video; the view itself has to move and
     * resize, and the page then cuts a hole at the same place. Zero width or
     * height means go back to filling the screen.
     */
    fun setBounds(x: Int, y: Int, width: Int, height: Int, fitMode: String) {
        val surface = view ?: return
        fit = fitMode
        surface.post {
            val params = surface.layoutParams as? android.widget.FrameLayout.LayoutParams ?: return@post
            val fullscreen = width <= 0 || height <= 0
            params.width =
                if (fullscreen) android.widget.FrameLayout.LayoutParams.MATCH_PARENT else width
            params.height =
                if (fullscreen) android.widget.FrameLayout.LayoutParams.MATCH_PARENT else height
            params.leftMargin = if (fullscreen) 0 else x
            params.topMargin = if (fullscreen) 0 else y
            surface.layoutParams = params
            surface.post { fitToView() }
        }
    }

    fun stop() {
        player?.release()
        player = null
        videoWidth = 0
        videoHeight = 0
        view?.visibility = android.view.View.GONE
    }

    /**
     * The live frame as a JPEG the page can fetch. Always available while the
     * stream is up, which makes it the dependable shutter even when a device's
     * own photo mode misbehaves.
     */
    fun snapshot(respond: (Any?) -> Unit, fail: (String) -> Unit) {
        val surface = view ?: return fail("no-surface")
        /**
         * At the video's own size, not the view's. The surface texture holds an
         * undistorted frame; asking for a view-sized copy bakes the portrait
         * stretch into the saved photo. The on-screen fit letterboxes instead,
         * so the display and the file disagree on purpose; neither wants the
         * other's bars or squash.
         */
        val bitmap: Bitmap =
            (if (videoWidth > 0 && videoHeight > 0) surface.getBitmap(videoWidth, videoHeight)
            else surface.bitmap) ?: return fail("no-frame")
        val file = File(servedDir, "frame-${System.currentTimeMillis()}.jpg")
        try {
            FileOutputStream(file).use { out -> bitmap.compress(Bitmap.CompressFormat.JPEG, 90, out) }
        } catch (e: Exception) {
            return fail(e.message ?: "snapshot-failed")
        }
        respond(
            JSONObject()
                .put("url", "/__mobile/native/${file.name}")
                .put("width", bitmap.width)
                .put("height", bitmap.height),
        )
    }
}
