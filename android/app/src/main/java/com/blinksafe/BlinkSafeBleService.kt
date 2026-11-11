package com.blinksafe

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.*
import android.util.Log
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStream
import java.nio.charset.StandardCharsets
import java.util.UUID

/**
 * BlinkSafe Dedicated Native Android Foreground Service for BLE & Bluetooth Classic SPP.
 * Continues running when the app is minimized, locked, or in the background.
 */
class BlinkSafeBleService : Service() {

    companion object {
        const val TAG = "BlinkSafeBleService"

        const val CHANNEL_FOREGROUND_SERVICE = "blinksafe_service_channel"
        const val CHANNEL_CRITICAL = "blinksafe_critical_channel"
        const val CHANNEL_IMPORTANT = "blinksafe_important_channel"
        const val CHANNEL_INFORMATIONAL = "blinksafe_info_channel"

        const val NOTIFICATION_ID_FOREGROUND = 9001

        const val ACTION_START_SERVICE = "com.blinksafe.ACTION_START_SERVICE"
        const val ACTION_STOP_SERVICE = "com.blinksafe.ACTION_STOP_SERVICE"
        const val ACTION_SIMULATE_EVENT = "com.blinksafe.ACTION_SIMULATE_EVENT"
        const val ACTION_BACKGROUND_TEST = "com.blinksafe.ACTION_BACKGROUND_TEST"
        const val ACTION_ACKNOWLEDGE = "com.blinksafe.ACTION_ACKNOWLEDGE"
        const val ACTION_START_SCAN = "com.blinksafe.ACTION_START_SCAN"
        const val ACTION_STOP_SCAN = "com.blinksafe.ACTION_STOP_SCAN"
        const val ACTION_CONNECT = "com.blinksafe.ACTION_CONNECT"
        const val ACTION_DISCONNECT = "com.blinksafe.ACTION_DISCONNECT"

        const val EXTRA_EVENT_JSON = "extra_event_json"
        const val EXTRA_DELAY_SECONDS = "extra_delay_seconds"
        const val EXTRA_ALERT_ID = "extra_alert_id"
        const val EXTRA_DEVICE_ADDRESS = "extra_device_address"
        const val EXTRA_DEVICE_NAME = "extra_device_name"

        // BLE UUIDs for Common ESP32 Hub
        val SERVICE_UUID: UUID = UUID.fromString("4fafc201-1fb5-459e-8fcc-c5c9c331914b")
        val CHARACTERISTIC_EVENT_UUID: UUID = UUID.fromString("beb5483e-36e1-4688-b7f5-ea07361b26a8")
        val CHARACTERISTIC_ACK_UUID: UUID = UUID.fromString("beb5483e-36e1-4688-b7f5-ea07361b26a9")
        val CLIENT_CONFIG_DESCRIPTOR_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

        // Standard Bluetooth Classic Serial Port Profile (SPP) UUID
        val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805f9b34fb")

        var isServiceRunning = false
        var currentConnectionState = "DISCONNECTED"
        var connectedDeviceAddress: String? = null
        var connectedDeviceName: String? = null
        var lastRssi: Int = -65
    }

    private val binder = LocalBinder()
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private var bluetoothManager: BluetoothManager? = null
    private var bluetoothAdapter: BluetoothAdapter? = null
    private var bluetoothGatt: BluetoothGatt? = null
    private var sppSocket: BluetoothSocket? = null
    private var sppJob: Job? = null
    private var notificationManager: NotificationManager? = null
    private var vibrator: Vibrator? = null

    private var targetDeviceAddress: String? = null
    private var isScanning = false
    private var isMockMode = false

    inner class LocalBinder : Binder() {
        fun getService(): BlinkSafeBleService = this@BlinkSafeBleService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "BlinkSafe BLE Service Created")
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        bluetoothManager = getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        bluetoothAdapter = bluetoothManager?.adapter

        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

        createNotificationChannels()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        Log.d(TAG, "onStartCommand received action: $action")

        when (action) {
            ACTION_START_SERVICE -> {
                startForegroundServiceWithNotification()
                isServiceRunning = true
                val isBtOn = bluetoothAdapter?.isEnabled == true
                if (!isBtOn || bluetoothGatt == null) {
                    currentConnectionState = "DISCONNECTED"
                    connectedDeviceAddress = null
                    connectedDeviceName = null
                    lastRssi = 0
                }
                BlinkSafeBleModule.notifyBleStateChanged(currentConnectionState, connectedDeviceAddress, lastRssi, connectedDeviceName)
            }
            ACTION_STOP_SERVICE -> {
                stopForeground(true)
                stopSelf()
                isServiceRunning = false
                currentConnectionState = "DISCONNECTED"
                BlinkSafeBleModule.notifyBleStateChanged(currentConnectionState, null, 0)
            }
            ACTION_SIMULATE_EVENT -> {
                val jsonStr = intent.getStringExtra(EXTRA_EVENT_JSON)
                if (!jsonStr.isNullOrEmpty()) {
                    handleIncomingPacket(jsonStr)
                }
            }
            ACTION_BACKGROUND_TEST -> {
                val jsonStr = intent.getStringExtra(EXTRA_EVENT_JSON)
                val delaySec = intent.getIntExtra(EXTRA_DELAY_SECONDS, 5)
                Log.d(TAG, "Scheduling Background Alert Test in $delaySec seconds...")
                serviceScope.launch {
                    delay(delaySec * 1000L)
                    Log.d(TAG, "Executing scheduled Background Alert Test event")
                    val eventToFire = jsonStr ?: JSONObject().apply {
                        put("id", "EVT_TEST_" + System.currentTimeMillis())
                        put("type", "fire")
                        put("severity", "critical")
                        put("location", "Kitchen")
                        put("nodeId", "NODE_01")
                        put("confidence", 0.96)
                        put("timestamp", System.currentTimeMillis() / 1000)
                        put("title", "FIRE DETECTED")
                        put("message", "High smoke & heat readings detected in Kitchen.")
                    }.toString()
                    handleIncomingPacket(eventToFire)
                }
            }
            ACTION_ACKNOWLEDGE -> {
                val alertId = intent.getStringExtra(EXTRA_ALERT_ID)
                if (alertId != null) {
                    sendAckToEsp32(alertId)
                }
            }
            ACTION_START_SCAN -> {
                startBleScan()
            }
            ACTION_STOP_SCAN -> {
                stopBleScan()
            }
            ACTION_CONNECT -> {
                val address = intent.getStringExtra(EXTRA_DEVICE_ADDRESS)
                val name = intent.getStringExtra(EXTRA_DEVICE_NAME)
                if (!address.isNullOrEmpty()) {
                    connectGattDevice(address, name)
                }
            }
            ACTION_DISCONNECT -> {
                disconnectGattDevice()
            }
        }

        return START_STICKY
    }

    private fun startForegroundServiceWithNotification() {
        val notificationIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_FOREGROUND_SERVICE)
            .setContentTitle("BlinkSafe Active")
            .setContentText("Continuous local safety monitoring active.")
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID_FOREGROUND,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
            )
        } else {
            startForeground(NOTIFICATION_ID_FOREGROUND, notification)
        }
    }

    /**
     * Creates high-priority notification channels for safety events.
     */
    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // 1. Foreground Service Channel
            val fgsChannel = NotificationChannel(
                CHANNEL_FOREGROUND_SERVICE,
                "BlinkSafe Background Monitor",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps BlinkSafe safety background connection active."
                setShowBadge(false)
            }

            // 2. Critical Channel (Max priority, Heads-up, Loud)
            val criticalChannel = NotificationChannel(
                CHANNEL_CRITICAL,
                "Critical Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Emergency alerts for Fire, Smoke, Gas, CO, and Immediate Hazards."
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 800)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                setBypassDnd(true)
                setShowBadge(true)
            }

            // 3. Important Channel (High priority, Human distress, intrusion)
            val importantChannel = NotificationChannel(
                CHANNEL_IMPORTANT,
                "Important Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Distress calls, yelling, intrusion, and urgent safety alerts."
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 300, 150, 300, 150, 300)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                setShowBadge(true)
            }

            // 4. Informational Channel (Doorbell, knocking, normal activity)
            val infoChannel = NotificationChannel(
                CHANNEL_INFORMATIONAL,
                "Informational Alerts",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Doorbell, visitors, and environmental notices."
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 150)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                setShowBadge(false)
            }

            notificationManager?.createNotificationChannel(fgsChannel)
            notificationManager?.createNotificationChannel(criticalChannel)
            notificationManager?.createNotificationChannel(importantChannel)
            notificationManager?.createNotificationChannel(infoChannel)
        }
    }

    /**
     * Processes any incoming packet from real BLE or Mock simulation.
     * Fires immediate background vibration and Android notification if needed.
     */
    fun handleIncomingPacket(packetRaw: String) {
        val trimmed = packetRaw.trim()
        Log.i(TAG, "Safety Packet Received: $trimmed")
        try {
            val json = if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
                JSONObject(trimmed)
            } else {
                val upper = trimmed.uppercase()
                val isFire = upper.contains("FIRE")
                val isGas = upper.contains("GAS") || upper.contains("MQ")
                JSONObject().apply {
                    put("id", "EVT_" + System.currentTimeMillis())
                    put("type", if (isFire) "fire" else if (isGas) "gas_leak" else "hazard")
                    put("severity", "critical")
                    put("location", "Central Safety Hub")
                    put("confidence", 0.98)
                    put("title", if (isFire) "🔥 FIRE DETECTED" else if (isGas) "🟡 GAS LEAK DETECTED" else "⚠ SAFETY HAZARD DETECTED")
                    put("message", "ESP32 Sensor Signal: $trimmed")
                    put("safeRouteAvailable", true)
                }
            }
            val packetJson = json.toString()
            val id = json.optString("id", "EVT_" + System.currentTimeMillis())
            val type = json.optString("type", "unknown").lowercase()
            val severity = json.optString("severity", "critical").lowercase()
            val location = json.optString("location", "Home")
            val confidence = json.optDouble("confidence", 0.90)
            val customTitle = json.optString("title", "")
            val customMessage = json.optString("message", "")

            val title = if (customTitle.isNotEmpty()) {
                customTitle
            } else {
                when (type) {
                    "fire" -> "🔥 FIRE DETECTED"
                    "smoke" -> "💨 SMOKE DETECTED"
                    "gas_leak", "gas" -> "🟡 GAS LEAK DETECTED"
                    "co" -> "⚠ CARBON MONOXIDE DETECTED"
                    "human_distress" -> "🚨 HUMAN DISTRESS DETECTED"
                    "intrusion" -> "🛡 INTRUSION DETECTED"
                    "doorbell" -> "🔔 DOORBELL"
                    "knocking" -> "✊ KNOCKING DETECTED"
                    else -> "⚠ SAFETY ALERT"
                }
            }

            val message = if (customMessage.isNotEmpty()) {
                customMessage
            } else {
                "$location • ${(confidence * 100).toInt()}% confidence"
            }

            // 1. Native Vibration Trigger (Works in Background / Locked)
            triggerNativeVibration(severity, type)

            // 2. Android High-Priority Heads-Up Notification (Works in Background / Locked)
            triggerAndroidNotification(id, title, message, severity, location, packetJson)

            // 3. Inform React Native Bridge if running
            BlinkSafeBleModule.notifySafetyEvent(packetJson)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse incoming safety packet: ${e.message}", e)
        }
    }

    private fun triggerNativeVibration(severity: String, type: String) {
        if (vibrator == null || !vibrator!!.hasVibrator()) return

        val pattern = when {
            severity == "critical" -> longArrayOf(0, 500, 200, 500, 200, 800, 300, 800)
            type == "human_distress" -> longArrayOf(0, 300, 150, 300, 150, 300, 600, 300, 600)
            severity == "high" || severity == "important" -> longArrayOf(0, 300, 200, 300)
            else -> longArrayOf(0, 180)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator?.vibrate(VibrationEffect.createWaveform(pattern, -1))
        } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(pattern, -1)
        }
    }

    private fun triggerAndroidNotification(
        alertId: String,
        title: String,
        message: String,
        severity: String,
        location: String,
        rawPayload: String
    ) {
        val channelId = when (severity) {
            "critical" -> CHANNEL_CRITICAL
            "high", "important" -> CHANNEL_IMPORTANT
            else -> CHANNEL_INFORMATIONAL
        }

        // Tap routing intent directly to MainActivity with deep link
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            data = Uri.parse("blinksafe://alert/$alertId")
            putExtra("alertId", alertId)
            putExtra("severity", severity)
            putExtra("location", location)
            putExtra("payload", rawPayload)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            alertId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // ACK Quick Action in Notification
        val ackIntent = Intent(this, BlinkSafeBleService::class.java).apply {
            action = ACTION_ACKNOWLEDGE
            putExtra(EXTRA_ALERT_ID, alertId)
        }
        val ackPendingIntent = PendingIntent.getService(
            this,
            alertId.hashCode() + 100,
            ackIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setContentTitle(title)
            .setContentText(message)
            .setSubText(location)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(
                if (severity == "critical") NotificationCompat.PRIORITY_MAX
                else if (severity == "high") NotificationCompat.PRIORITY_HIGH
                else NotificationCompat.PRIORITY_DEFAULT
            )
            .setCategory(
                if (severity == "critical") NotificationCompat.CATEGORY_ALARM
                else NotificationCompat.CATEGORY_EVENT
            )
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(android.R.drawable.checkbox_on_background, "Acknowledge", ackPendingIntent)

        val notificationId = alertId.hashCode()
        notificationManager?.notify(notificationId, notificationBuilder.build())
    }

    private var bleScanner: BluetoothLeScanner? = null

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult?) {
            result ?: return
            val device = result.device ?: return
            val name = try { device.name ?: "Unknown BLE Device" } catch (e: SecurityException) { "BLE Device" }
            val address = device.address ?: return
            val rssi = result.rssi
            BlinkSafeBleModule.notifyDeviceDiscovered(name, address, rssi)
        }

        override fun onBatchScanResults(results: MutableList<ScanResult>?) {
            results?.forEach { result ->
                val device = result.device ?: return@forEach
                val name = try { device.name ?: "Unknown BLE Device" } catch (e: SecurityException) { "BLE Device" }
                val address = device.address ?: return@forEach
                val rssi = result.rssi
                BlinkSafeBleModule.notifyDeviceDiscovered(name, address, rssi)
            }
        }

        override fun onScanFailed(errorCode: Int) {
            Log.e(TAG, "BLE Scan failed with error code: $errorCode")
            isScanning = false
        }
    }

    private fun startBleScan() {
        if (bluetoothAdapter == null || !bluetoothAdapter!!.isEnabled) {
            Log.w(TAG, "Bluetooth not enabled for scan")
            return
        }

        // 1. Immediately report all already-paired Bluetooth Classic & BLE devices!
        try {
            bluetoothAdapter?.bondedDevices?.forEach { device ->
                val name = try { device.name ?: "Paired Device" } catch (e: SecurityException) { "Paired Device" }
                val address = device.address
                Log.i(TAG, "Discovered bonded Bluetooth device: $name ($address)")
                BlinkSafeBleModule.notifyDeviceDiscovered(name, address, -45)
            }
        } catch (e: SecurityException) {
            Log.w(TAG, "SecurityException reading bonded devices: ${e.message}")
        }

        // 2. Start BLE Active Scan for non-paired BLE beacons / hubs
        bleScanner = bluetoothAdapter?.bluetoothLeScanner
        if (bleScanner == null) {
            Log.w(TAG, "BluetoothLeScanner is null")
            return
        }
        isScanning = true
        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()
        try {
            bleScanner?.startScan(null, settings, scanCallback)
            Log.i(TAG, "BLE Scan started successfully")
            serviceScope.launch {
                delay(12000L)
                if (isScanning) {
                    stopBleScan()
                }
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException starting BLE scan: ${e.message}")
        }
    }

    private fun stopBleScan() {
        if (!isScanning || bleScanner == null) return
        isScanning = false
        try {
            bleScanner?.stopScan(scanCallback)
            Log.i(TAG, "BLE Scan stopped")
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException stopping BLE scan: ${e.message}")
        }
    }

    private fun connectGattDevice(address: String, name: String?) {
        stopBleScan()
        if (bluetoothAdapter == null || !bluetoothAdapter!!.isEnabled) {
            Log.w(TAG, "Cannot connect: Bluetooth disabled")
            return
        }
        val device = try { bluetoothAdapter?.getRemoteDevice(address) } catch (e: Exception) { null } ?: return
        currentConnectionState = "CONNECTING"
        connectedDeviceAddress = address
        connectedDeviceName = name ?: try { device.name ?: "BlinkSafe Hub" } catch (e: SecurityException) { "BlinkSafe Hub" }
        BlinkSafeBleModule.notifyBleStateChanged(currentConnectionState, connectedDeviceAddress, lastRssi, connectedDeviceName)

        val isBonded = try { device.bondState == BluetoothDevice.BOND_BONDED } catch (e: SecurityException) { false }
        val isClassicOrDual = device.type == BluetoothDevice.DEVICE_TYPE_CLASSIC || device.type == BluetoothDevice.DEVICE_TYPE_DUAL

        if (isBonded || isClassicOrDual) {
            Log.i(TAG, "Connecting via Bluetooth Classic SPP to: $address ($connectedDeviceName)")
            connectSppDevice(device, connectedDeviceName)
        } else {
            Log.i(TAG, "Connecting via BLE GATT to: $address ($connectedDeviceName)")
            connectBleGatt(device, connectedDeviceName)
        }
    }

    private fun connectSppDevice(device: BluetoothDevice, name: String?) {
        sppJob?.cancel()
        sppJob = serviceScope.launch {
            try {
                // Cancel existing connections first
                try { sppSocket?.close() } catch (e: Exception) {}
                try { bluetoothGatt?.disconnect(); bluetoothGatt?.close(); bluetoothGatt = null } catch (e: Exception) {}

                val socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
                socket.connect()
                sppSocket = socket
                currentConnectionState = "CONNECTED"
                connectedDeviceAddress = device.address
                connectedDeviceName = name ?: "BlinkSafe Hub"
                lastRssi = -45
                BlinkSafeBleModule.notifyBleStateChanged(currentConnectionState, connectedDeviceAddress, lastRssi, connectedDeviceName)
                Log.i(TAG, "Bluetooth Classic SPP CONNECTED successfully to ${device.address}")

                val reader = BufferedReader(InputStreamReader(socket.inputStream))
                while (isActive && socket.isConnected) {
                    val line = reader.readLine() ?: break
                    if (line.trim().isNotEmpty()) {
                        Log.i(TAG, "Incoming SPP line: $line")
                        handleIncomingPacket(line.trim())
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "SPP connection failed or closed: ${e.message}. Attempting BLE fallback...")
                if (sppSocket == null || !sppSocket!!.isConnected) {
                    connectBleGatt(device, name)
                }
            }
        }
    }

    private fun connectBleGatt(device: BluetoothDevice, name: String?) {
        try {
            bluetoothGatt?.close()
            bluetoothGatt = device.connectGatt(this, false, gattCallback)
            Log.i(TAG, "Initiated GATT connection to ${device.address} ($name)")
        } catch (e: Exception) {
            Log.e(TAG, "Exception connecting to GATT: ${e.message}", e)
            currentConnectionState = "DISCONNECTED"
            BlinkSafeBleModule.notifyBleStateChanged(currentConnectionState, null, 0, null)
        }
    }

    private fun disconnectGattDevice() {
        sppJob?.cancel()
        sppJob = null
        try {
            sppSocket?.close()
            sppSocket = null
        } catch (e: Exception) {}
        try {
            bluetoothGatt?.disconnect()
            bluetoothGatt?.close()
            bluetoothGatt = null
        } catch (e: Exception) {
            Log.e(TAG, "Exception disconnecting GATT: ${e.message}", e)
        }
        currentConnectionState = "DISCONNECTED"
        connectedDeviceAddress = null
        connectedDeviceName = null
        BlinkSafeBleModule.notifyBleStateChanged(currentConnectionState, null, 0, null)
        Log.i(TAG, "Disconnected all Bluetooth links (SPP and GATT)")
    }

    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            Log.i(TAG, "GATT connection state changed: status=$status, newState=$newState")
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                currentConnectionState = "CONNECTED"
                connectedDeviceAddress = gatt.device.address
                connectedDeviceName = try { gatt.device.name ?: connectedDeviceName ?: "BlinkSafe Hub" } catch (e: SecurityException) { connectedDeviceName ?: "BlinkSafe Hub" }
                BlinkSafeBleModule.notifyBleStateChanged(currentConnectionState, connectedDeviceAddress, lastRssi, connectedDeviceName)
                gatt.discoverServices()
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                currentConnectionState = "DISCONNECTED"
                connectedDeviceAddress = null
                connectedDeviceName = null
                BlinkSafeBleModule.notifyBleStateChanged(currentConnectionState, null, 0, null)
                try {
                    gatt.close()
                } catch (e: Exception) {}
                bluetoothGatt = null
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            Log.i(TAG, "GATT services discovered: status=$status")
            if (status == BluetoothGatt.GATT_SUCCESS) {
                val service = gatt.getService(SERVICE_UUID)
                val characteristic = service?.getCharacteristic(CHARACTERISTIC_EVENT_UUID)
                if (characteristic != null) {
                    gatt.setCharacteristicNotification(characteristic, true)
                    val descriptor = characteristic.getDescriptor(CLIENT_CONFIG_DESCRIPTOR_UUID)
                    if (descriptor != null) {
                        descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                        gatt.writeDescriptor(descriptor)
                        Log.i(TAG, "Subscribed to BLE Event notifications!")
                    }
                }
            }
        }

        @Deprecated("Deprecated in Java")
        override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
            val data = characteristic.value ?: return
            val jsonStr = String(data, StandardCharsets.UTF_8)
            Log.i(TAG, "Incoming BLE Characteristic: $jsonStr")
            handleIncomingPacket(jsonStr)
        }

        override fun onCharacteristicChanged(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray
        ) {
            val jsonStr = String(value, StandardCharsets.UTF_8)
            Log.i(TAG, "Incoming BLE Characteristic (modern): $jsonStr")
            handleIncomingPacket(jsonStr)
        }

        override fun onReadRemoteRssi(gatt: BluetoothGatt, rssi: Int, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                lastRssi = rssi
                BlinkSafeBleModule.notifyBleStateChanged(currentConnectionState, connectedDeviceAddress, lastRssi, connectedDeviceName)
            }
        }
    }

    /**
     * Sends Acknowledgement signal back to ESP32 over Bluetooth Classic SPP or BLE
     */
    fun sendAckToEsp32(alertId: String): Boolean {
        Log.i(TAG, "Sending ACK to ESP32 for alert: $alertId")

        // 1. If connected via Bluetooth Classic SPP:
        if (sppSocket != null && sppSocket!!.isConnected) {
            try {
                val ackMsg = "ACK|$alertId\n"
                sppSocket?.outputStream?.write(ackMsg.toByteArray(StandardCharsets.UTF_8))
                sppSocket?.outputStream?.flush()
                Log.i(TAG, "Transmitted ACK to ESP32 via Bluetooth Classic SPP: $ackMsg")
                return true
            } catch (e: Exception) {
                Log.e(TAG, "Error writing ACK over SPP: ${e.message}", e)
            }
        }

        // 2. If connected via BLE GATT:
        if (bluetoothGatt != null) {
            try {
                val service = bluetoothGatt?.getService(SERVICE_UUID)
                val ackChar = service?.getCharacteristic(CHARACTERISTIC_ACK_UUID)
                    ?: service?.getCharacteristic(CHARACTERISTIC_EVENT_UUID)

                if (ackChar != null) {
                    val ackPacket = JSONObject().apply {
                        put("action", "ACKNOWLEDGE")
                        put("alertId", alertId)
                        put("timestamp", System.currentTimeMillis() / 1000)
                    }.toString()

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        bluetoothGatt?.writeCharacteristic(
                            ackChar,
                            ackPacket.toByteArray(StandardCharsets.UTF_8),
                            BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                        )
                    } else {
                        @Suppress("DEPRECATION")
                        ackChar.value = ackPacket.toByteArray(StandardCharsets.UTF_8)
                        @Suppress("DEPRECATION")
                        bluetoothGatt?.writeCharacteristic(ackChar)
                    }
                    Log.i(TAG, "Successfully transmitted ACK to BLE characteristic")
                    return true
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error writing ACK to BLE: ${e.message}", e)
            }
        }

        Log.d(TAG, "Simulated ACK handled.")
        return true
    }


    override fun onDestroy() {
        super.onDestroy()
        isServiceRunning = false
        serviceScope.cancel()
        try {
            bluetoothGatt?.close()
            bluetoothGatt = null
        } catch (e: Exception) {
            Log.e(TAG, "Error closing GATT: ${e.message}")
        }
        Log.d(TAG, "BlinkSafe BLE Service Destroyed")
    }
}
