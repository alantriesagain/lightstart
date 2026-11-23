package dev.lightstart.mobile.addons

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.content.BroadcastReceiver
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/**
 * Generic BLE transport. Knows nothing about any particular device: it opens
 * GATT sockets, writes bytes and forwards notifications. Protocol lives in JS.
 *
 * Payloads cross the bridge as hex strings; a 200-byte response as a JSON array
 * of numbers is several times the size and unreadable in a log.
 */
@SuppressLint("MissingPermission")
class DevicesBleManager(
    private val context: Context,
    private val emit: (String, JSONObject) -> Unit,
) {
    private val main = Handler(Looper.getMainLooper())
    private val adapter: BluetoothAdapter? by lazy {
        (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter
    }
    private val connections = mutableMapOf<String, BluetoothGatt>()
    private var scanCallback: ScanCallback? = null
    private val found = linkedMapOf<String, JSONObject>()

    private val CLIENT_CONFIG = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
    private val OP_TIMEOUT_MS = 10000L

    /**
     * Android runs ONE GATT operation at a time per connection: issuing a write
     * while a descriptor write is still in flight makes the second silently
     * return false. Everything that touches GATT goes through this queue and
     * completes on its own callback.
     */
    private class Op(
        val label: String,
        val start: () -> Boolean,
        val respond: (Any?) -> Unit,
        val fail: (String) -> Unit,
    )

    private val queue = ArrayDeque<Op>()
    private var current: Op? = null
    private val timeoutRunnable = Runnable { finish(false, "gatt-op-timeout") }

    private fun enqueue(label: String, start: () -> Boolean, respond: (Any?) -> Unit, fail: (String) -> Unit) {
        synchronized(queue) { queue.addLast(Op(label, start, respond, fail)) }
        main.post { pump() }
    }

    private fun pump() {
        val op = synchronized(queue) {
            if (current != null) return
            current = queue.removeFirstOrNull()
            current
        } ?: return
        main.postDelayed(timeoutRunnable, OP_TIMEOUT_MS)
        val accepted = try {
            op.start()
        } catch (e: SecurityException) {
            false
        }
        if (!accepted) finish(false, "gatt-${op.label}-rejected")
    }

    private fun finish(ok: Boolean, payload: Any?) {
        val op = synchronized(queue) {
            val op = current ?: return
            current = null
            op
        }
        main.removeCallbacks(timeoutRunnable)
        if (ok) op.respond(payload) else op.fail(payload as? String ?: "gatt-failed")
        main.post { pump() }
    }

    private fun dropQueue(reason: String) {
        val pending = synchronized(queue) {
            val all = queue.toList() + listOfNotNull(current)
            queue.clear()
            current = null
            all
        }
        main.removeCallbacks(timeoutRunnable)
        for (op in pending) op.fail(reason)
    }

    fun isSupported(): Boolean = adapter != null
    fun isEnabled(): Boolean = adapter?.isEnabled == true

    fun startScan(services: List<String>, timeoutMs: Long, respond: (Any?) -> Unit, fail: (String) -> Unit) {
        val scanner = adapter?.bluetoothLeScanner ?: return fail("bluetooth-unavailable")
        if (adapter?.isEnabled != true) return fail("bluetooth-off")
        stopScan()
        found.clear()

        val filters = services.map {
            ScanFilter.Builder().setServiceUuid(ParcelUuid(UUID.fromString(it))).build()
        }
        val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()

        val callback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                val device = result.device ?: return
                val uuids = result.scanRecord?.serviceUuids?.map { it.uuid.toString() } ?: emptyList()
                val row = JSONObject()
                    .put("id", device.address)
                    .put("name", device.name ?: result.scanRecord?.deviceName ?: "")
                    .put("rssi", result.rssi)
                    .put("services", JSONArray(uuids))
                found[device.address] = row
                emit(DevicesCommands.BLE_SCAN_RESULT, row)
            }

            override fun onScanFailed(errorCode: Int) {
                stopScan()
                fail("scan-failed-$errorCode")
            }
        }
        scanCallback = callback
        try {
            scanner.startScan(filters, settings, callback)
        } catch (e: SecurityException) {
            return fail("bluetooth-permission-denied")
        }

        main.postDelayed({
            stopScan()
            respond(JSONArray(found.values.toList()))
        }, timeoutMs)
    }

    fun stopScan() {
        val callback = scanCallback ?: return
        scanCallback = null
        try {
            adapter?.bluetoothLeScanner?.stopScan(callback)
        } catch (_: Exception) {
        }
    }

    private fun gattCallback(id: String, onReady: (Boolean, String?) -> Unit) = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                main.postDelayed({ gatt.discoverServices() }, 300)
                return
            }
            if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                connections.remove(id)
                dropQueue("link-lost")
                gatt.close()
                emit(
                    DevicesCommands.BLE_STATE,
                    JSONObject().put("id", id).put("connected", false)
                        .put("reason", if (status == 133) "gatt-133" else "disconnected"),
                )
                onReady(false, if (status == 133) "gatt-133" else "connect-failed-$status")
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) return onReady(false, "service-discovery-failed")
            emit(DevicesCommands.BLE_STATE, JSONObject().put("id", id).put("connected", true))
            onReady(true, null)
        }

        override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) = finish(true, null)

        override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS) finish(true, null) else finish(false, "descriptor-write-$status")
        }

        override fun onCharacteristicWrite(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS) finish(true, null) else finish(false, "write-$status")
        }

        override fun onCharacteristicRead(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray,
            status: Int,
        ) {
            if (status == BluetoothGatt.GATT_SUCCESS) finish(true, JSONObject().put("data", toHex(value)))
            else finish(false, "read-$status")
        }

        @Deprecated("pre-33 callback")
        @Suppress("DEPRECATION")
        override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS)
                finish(true, JSONObject().put("data", toHex(characteristic.value ?: ByteArray(0))))
            else finish(false, "read-$status")
        }

        override fun onCharacteristicChanged(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray,
        ) = forward(id, characteristic.uuid, value)

        @Deprecated("pre-33 callback")
        @Suppress("DEPRECATION")
        override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
            forward(id, characteristic.uuid, characteristic.value ?: ByteArray(0))
        }
    }

    fun connect(id: String, respond: (Any?) -> Unit, fail: (String) -> Unit) {
        val adapter = adapter ?: return fail("bluetooth-unavailable")
        if (connections.containsKey(id)) return respond(null)

        val device: BluetoothDevice = try {
            adapter.getRemoteDevice(id)
        } catch (e: IllegalArgumentException) {
            return fail("bad-device-id")
        }

        /**
         * A device that has forgotten this phone still advertises and still lets
         * us connect; it drops the link only when an encrypted read is tried,
         * so every subscribe sits there until it times out and the user is told
         * nothing useful half a minute later. Say it up front instead, and ask
         * Android to pair so the system prompt appears if the device is
         * listening for one.
         *
         * Every device we speak to requires a bond; if one ever does not, this
         * becomes a flag on the driver rather than a guess here.
         */
        if (device.bondState != BluetoothDevice.BOND_BONDED) {
            return pairThenConnect(device, id, respond, fail)
        }

        var settled = false
        val callback = gattCallback(id) { ok, error ->
            if (settled) return@gattCallback
            settled = true
            if (!ok) return@gattCallback fail(error ?: "connect-failed")
            enqueue("mtu", { connections[id]?.requestMtu(185) ?: false }, {}, {})
            respond(null)
        }

        connections[id] = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            device.connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE)
        else device.connectGatt(context, false, callback)
    }

    /**
     * Pair first, then connect.
     *
     * Failing the moment a bond is missing was too eager: pairing takes a few
     * seconds and the user has to accept a prompt, so the attempt was abandoned
     * before it could succeed. This waits for the outcome and carries on by
     * itself, so a camera put into pairing mode simply connects.
     *
     * If the camera is not listening for a pairing, Android gives up after
     * about half a minute and we say so in words rather than as a timeout.
     */
    private fun pairThenConnect(
        device: BluetoothDevice,
        id: String,
        respond: (Any?) -> Unit,
        fail: (String) -> Unit,
    ) {
        var settled = false
        val filter = IntentFilter(BluetoothDevice.ACTION_BOND_STATE_CHANGED)
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val target: BluetoothDevice? =
                    intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
                if (target?.address != device.address || settled) return
                when (intent.getIntExtra(BluetoothDevice.EXTRA_BOND_STATE, -1)) {
                    BluetoothDevice.BOND_BONDED -> {
                        settled = true
                        runCatching { context.unregisterReceiver(this) }
                        connect(id, respond, fail)
                    }
                    BluetoothDevice.BOND_NONE -> {
                        settled = true
                        runCatching { context.unregisterReceiver(this) }
                        fail("ble-not-paired")
                    }
                }
            }
        }
        context.registerReceiver(receiver, filter)
        emit(DevicesCommands.BLE_STATE, JSONObject().put("id", id).put("pairing", true))

        val started = try {
            device.createBond()
        } catch (e: SecurityException) {
            false
        }
        if (!started) {
            settled = true
            runCatching { context.unregisterReceiver(receiver) }
            return fail("ble-not-paired")
        }
    }

    private fun forward(id: String, uuid: UUID, value: ByteArray) {
        emit(DevicesCommands.BLE_NOTIFY, JSONObject().put("id", id).put("char", uuid.toString()).put("data", toHex(value)))
    }

    private fun characteristic(id: String, char: String): BluetoothGattCharacteristic? {
        val gatt = connections[id] ?: return null
        val target = try {
            UUID.fromString(char)
        } catch (e: IllegalArgumentException) {
            return null
        }
        for (service in gatt.services) service.getCharacteristic(target)?.let { return it }
        return null
    }

    fun subscribe(id: String, char: String, respond: (Any?) -> Unit, fail: (String) -> Unit) {
        val gatt = connections[id] ?: return fail("not-connected")
        val target = characteristic(id, char) ?: return fail("no-such-characteristic")
        val descriptor = target.getDescriptor(CLIENT_CONFIG) ?: return fail("no-cccd")
        enqueue("subscribe", {
            if (!gatt.setCharacteristicNotification(target, true)) false
            else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
                gatt.writeDescriptor(descriptor, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE) == BluetoothGatt.GATT_SUCCESS
            else {
                @Suppress("DEPRECATION")
                run {
                    descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                    gatt.writeDescriptor(descriptor)
                }
            }
        }, respond, fail)
    }

    fun write(id: String, char: String, hex: String, withResponse: Boolean, respond: (Any?) -> Unit, fail: (String) -> Unit) {
        val gatt = connections[id] ?: return fail("not-connected")
        val target = characteristic(id, char) ?: return fail("no-such-characteristic")
        val bytes = fromHex(hex)
        val writeType = if (withResponse) BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
        else BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
        enqueue("write", {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
                gatt.writeCharacteristic(target, bytes, writeType) == BluetoothGatt.GATT_SUCCESS
            else {
                @Suppress("DEPRECATION")
                run {
                    target.writeType = writeType
                    target.value = bytes
                    gatt.writeCharacteristic(target)
                }
            }
        }, respond, fail)
    }

    fun read(id: String, char: String, respond: (Any?) -> Unit, fail: (String) -> Unit) {
        val gatt = connections[id] ?: return fail("not-connected")
        val target = characteristic(id, char) ?: return fail("no-such-characteristic")
        enqueue("read", { gatt.readCharacteristic(target) }, respond, fail)
    }

    fun disconnect(id: String) {
        connections.remove(id)?.let {
            dropQueue("disconnected")
            try {
                it.disconnect()
                it.close()
            } catch (_: Exception) {
            }
        }
    }

    fun hasConnections(): Boolean = connections.isNotEmpty()

    fun closeAll() {
        stopScan()
        for (id in connections.keys.toList()) disconnect(id)
    }

    private fun toHex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it) }

    private fun fromHex(hex: String): ByteArray {
        val clean = hex.trim()
        if (clean.length % 2 != 0) return ByteArray(0)
        return ByteArray(clean.length / 2) { clean.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
    }
}
