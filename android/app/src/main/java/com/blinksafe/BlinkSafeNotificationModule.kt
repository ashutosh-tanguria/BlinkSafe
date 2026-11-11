package com.blinksafe

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.*

class BlinkSafeNotificationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "BlinkSafeNotificationModule"
        private const val TAG = "BlinkSafeNotificationModule"
        var initialNotificationPayload: WritableMap? = null
    }

    override fun getName(): String = NAME

    private val notificationManager: NotificationManager by lazy {
        reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    }

    @ReactMethod
    fun areNotificationsEnabled(promise: Promise) {
        try {
            val enabled = NotificationManagerCompat.from(reactContext).areNotificationsEnabled()
            promise.resolve(enabled)
        } catch (e: Exception) {
            promise.reject("NOTIF_CHECK_ERR", e.message)
        }
    }

    @ReactMethod
    fun cancelNotification(notificationId: Int, promise: Promise) {
        try {
            notificationManager.cancel(notificationId)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("NOTIF_CANCEL_ERR", e.message)
        }
    }

    @ReactMethod
    fun cancelAllNotifications(promise: Promise) {
        try {
            notificationManager.cancelAll()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("NOTIF_CANCEL_ALL_ERR", e.message)
        }
    }

    @ReactMethod
    fun getInitialNotification(promise: Promise) {
        try {
            val payload = initialNotificationPayload
            initialNotificationPayload = null
            promise.resolve(payload)
        } catch (e: Exception) {
            promise.reject("GET_INITIAL_NOTIF_ERR", e.message)
        }
    }
}
