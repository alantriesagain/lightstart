package dev.lightstart.mobile.addons

import android.net.Network
import android.net.Uri
import androidx.media3.common.C
import androidx.media3.datasource.BaseDataSource
import androidx.media3.datasource.DataSpec
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetSocketAddress
import java.net.SocketException
import java.net.SocketTimeoutException

/**
 * Reads an MPEG-TS stream a device pushes over UDP.
 *
 * media3's own UdpDataSource builds its socket on the default network with no
 * way to inject one, which is useless here: the camera's access point carries
 * no internet, so the phone keeps its normal network as default and only our
 * sockets are bound across. The socket must be unconnected and bound to the
 * [Network] before it takes a port.
 */
@androidx.media3.common.util.UnstableApi
class DevicesUdpDataSource(
    private val network: Network?,
    private val port: Int,
    private val socketTimeoutMs: Int = 8000,
) : BaseDataSource(true) {

    companion object {
        private const val PACKET_SIZE = 4096
        private const val RECEIVE_BUFFER_BYTES = 2 * 1024 * 1024
        private const val TAG = "DevicesUdp"
        @Volatile var lastBindMode: String = "none"
        @Volatile var packets: Long = 0
        @Volatile var bytes: Long = 0
        @Volatile var timeouts: Long = 0
    }

    private var socket: DatagramSocket? = null
    private val packet = DatagramPacket(ByteArray(PACKET_SIZE), PACKET_SIZE)
    /** Bytes of the current datagram not yet handed to the extractor, and where they start. */
    private var buffered = 0
    private var offset = 0

    override fun open(dataSpec: DataSpec): Long {
        val created = DatagramSocket(null).apply { reuseAddress = true }
        lastBindMode = "unbound"
        if (network != null) {
            try {
                network.bindSocket(created)
                lastBindMode = "network"
            } catch (e: Exception) {
                // An inbound socket usually still receives by destination port,
                // so a failed bind is worth continuing through rather than
                // failing the whole preview.
                lastBindMode = "unbound-fallback"
            }
        }
        /**
         * A generous kernel receive buffer. The default is small enough that a
         * momentary stall on the loading thread drops datagrams, and the stream
         * carries its PAT/PMT only every few hundred packets (lose those and
         * the extractor never identifies a track, so the picture never starts).
         */
        try {
            created.receiveBufferSize = RECEIVE_BUFFER_BYTES
        } catch (_: Exception) {
        }
        created.bind(InetSocketAddress(port))
        created.soTimeout = socketTimeoutMs
        socket = created
        packets = 0
        bytes = 0
        timeouts = 0
        android.util.Log.i(TAG, "open port=$port bind=$lastBindMode rcvbuf=${created.receiveBufferSize}")
        transferStarted(dataSpec)
        return C.LENGTH_UNSET.toLong()
    }

    /**
     * A quiet moment is not the end of a live stream.
     *
     * Throwing on the socket timeout hands an IOException to ExoPlayer's loader,
     * which backs off and retries; a few of those in a row and the player decides
     * playback is "stuck buffering and not loading" and dies. So a timeout just
     * goes back to waiting. `close()` shuts the socket, which unblocks receive
     * with a SocketException that is the only way out.
     */
    override fun read(buffer: ByteArray, bufferOffset: Int, length: Int): Int {
        if (length == 0) return 0
        if (buffered == 0) {
            while (buffered == 0) {
                val active = socket ?: return C.RESULT_END_OF_INPUT
                try {
                    /** receive() caps at the packet's current length, so it must be reset each time. */
                    packet.setLength(PACKET_SIZE)
                    active.receive(packet)
                    buffered = packet.length
                } catch (e: SocketTimeoutException) {
                    timeouts++
                    if (timeouts % 4L == 0L)
                        android.util.Log.w(TAG, "no data for ${timeouts * socketTimeoutMs / 1000}s (packets=$packets)")
                } catch (e: SocketException) {
                    return C.RESULT_END_OF_INPUT
                }
            }
            offset = 0
            packets++
            bytes += buffered
            if (packets == 1L) android.util.Log.i(TAG, "first packet len=$buffered")
            bytesTransferred(buffered)
        }
        val taken = minOf(length, buffered)
        System.arraycopy(packet.data, offset, buffer, bufferOffset, taken)
        offset += taken
        buffered -= taken
        return taken
    }

    override fun close() {
        socket?.close()
        socket = null
        buffered = 0
        offset = 0
        transferEnded()
    }

    override fun getUri(): Uri = Uri.parse("udp://0.0.0.0:$port")
}
