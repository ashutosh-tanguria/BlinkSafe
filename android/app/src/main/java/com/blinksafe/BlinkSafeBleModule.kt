package com.blinksafe

import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject

class BlinkSafeBleModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "BlinkSafeBleModule"
        private const val TAG = "BlinkSafeBleModule"

        var instance: BlinkSafeBleModule? = null

        fun notifySafetyEvent(eventJson: String) {
            instance?.sendEvent("onSafetyEventReceived", Arguments.createMap().apply {
                putString("eventJson", eventJson)
            })
        }

        fun notifyBleStateChanged(state: String, deviceAddress: String?, rssi: Int, deviceName: String? = null) {
            instance?.sendEvent("onBleStateChanged", Arguments.createMap().apply {
                putString("state", state)
                if (deviceAddress != null) putString("deviceAddress", deviceAddress)
                if (deviceName != null) putString("deviceName", deviceName)
                putInt("rssi", rssi)
            })
        }

        fun notifyDeviceDiscovered(name: String, address: String, rssi: Int) {
            instance?.sendEvent("onDeviceDiscovered", Arguments.createMap().apply {
                putString("name", name)
                putString("address", address)
                putInt("rssi", rssi)
            })
        }
    }

    init {
        instance = this
    }

    override fun getName(): String = NAME

    private fun sendEvent(eventName: String, params: WritableMap?) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    @ReactMethod
    fun startBleService(promise: Promise) {
        try {
            val intent = Intent(reactContext, BlinkSafeBleService::class.java).apply {
                action = BlinkSafeBleService.ACTION_START_SERVICE
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start BLE service: ${e.message}", e)
            promise.reject("BLE_SERVICE_START_ERR", e.message)
        }
    }

    @ReactMethod
    fun stopBleService(promise: Promise) {
        try {
            val intent = Intent(reactContext, BlinkSafeBleService::class.java).apply {
                action = BlinkSafeBleService.ACTION_STOP_SERVICE
            }
            reactContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop BLE service: ${e.message}", e)
            promise.reject("BLE_SERVICE_STOP_ERR", e.message)
        }
    }

    @ReactMethod
    fun getConnectionStatus(promise: Promise) {
        val bluetoothManager = reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? android.bluetooth.BluetoothManager
        val adapter = bluetoothManager?.adapter
        val isBtOn = adapter != null && adapter.isEnabled
        val isConnected = isBtOn && BlinkSafeBleService.currentConnectionState == "CONNECTED"

        val map = Arguments.createMap().apply {
            putBoolean("isBluetoothEnabled", isBtOn)
            putBoolean("isServiceRunning", BlinkSafeBleService.isServiceRunning)
            putString("state", if (isConnected) "CONNECTED" else if (isBtOn && BlinkSafeBleService.currentConnectionState == "CONNECTING") "CONNECTING" else "DISCONNECTED")
            putString("deviceAddress", if (isConnected) BlinkSafeBleService.connectedDeviceAddress else null)
            putString("deviceName", if (isConnected) BlinkSafeBleService.connectedDeviceName else null)
            putInt("rssi", if (isConnected) BlinkSafeBleService.lastRssi else 0)
        }
        promise.resolve(map)
    }

    @ReactMethod
    fun startScan(promise: Promise) {
        try {
            val intent = Intent(reactContext, BlinkSafeBleService::class.java).apply {
                action = BlinkSafeBleService.ACTION_START_SCAN
            }
            reactContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start BLE scan: ${e.message}", e)
            promise.reject("SCAN_ERR", e.message)
        }
    }

    @ReactMethod
    fun stopScan(promise: Promise) {
        try {
            val intent = Intent(reactContext, BlinkSafeBleService::class.java).apply {
                action = BlinkSafeBleService.ACTION_STOP_SCAN
            }
            reactContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop BLE scan: ${e.message}", e)
            promise.reject("STOP_SCAN_ERR", e.message)
        }
    }

    @ReactMethod
    fun connectDevice(address: String, name: String?, promise: Promise) {
        try {
            val intent = Intent(reactContext, BlinkSafeBleService::class.java).apply {
                action = BlinkSafeBleService.ACTION_CONNECT
                putExtra(BlinkSafeBleService.EXTRA_DEVICE_ADDRESS, address)
                if (name != null) {
                    putExtra(BlinkSafeBleService.EXTRA_DEVICE_NAME, name)
                }
            }
            reactContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to connect to BLE device: ${e.message}", e)
            promise.reject("CONNECT_ERR", e.message)
        }
    }

    @ReactMethod
    fun disconnectDevice(promise: Promise) {
        try {
            val intent = Intent(reactContext, BlinkSafeBleService::class.java).apply {
                action = BlinkSafeBleService.ACTION_DISCONNECT
            }
            reactContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to disconnect BLE device: ${e.message}", e)
            promise.reject("DISCONNECT_ERR", e.message)
        }
    }


    @ReactMethod
    fun simulateHardwareEvent(eventJson: String, promise: Promise) {
        try {
            val intent = Intent(reactContext, BlinkSafeBleService::class.java).apply {
                action = BlinkSafeBleService.ACTION_SIMULATE_EVENT
                putExtra(BlinkSafeBleService.EXTRA_EVENT_JSON, eventJson)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to simulate hardware event: ${e.message}", e)
            promise.reject("SIMULATE_ERR", e.message)
        }
    }

    @ReactMethod
    fun triggerBackgroundAlertTest(delaySeconds: Int, eventJson: String, promise: Promise) {
        try {
            val intent = Intent(reactContext, BlinkSafeBleService::class.java).apply {
                action = BlinkSafeBleService.ACTION_BACKGROUND_TEST
                putExtra(BlinkSafeBleService.EXTRA_DELAY_SECONDS, delaySeconds)
                putExtra(BlinkSafeBleService.EXTRA_EVENT_JSON, eventJson)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to trigger background test: ${e.message}", e)
            promise.reject("BG_TEST_ERR", e.message)
        }
    }

    @ReactMethod
    fun sendAcknowledgement(alertId: String, promise: Promise) {
        try {
            val intent = Intent(reactContext, BlinkSafeBleService::class.java).apply {
                action = BlinkSafeBleService.ACTION_ACKNOWLEDGE
                putExtra(BlinkSafeBleService.EXTRA_ALERT_ID, alertId)
            }
            reactContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send ACK: ${e.message}", e)
            promise.reject("ACK_ERR", e.message)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Keep for RN Event Emitter requirement
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Keep for RN Event Emitter requirement
    }
}
