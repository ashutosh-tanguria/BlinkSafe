package com.blinksafe

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import com.facebook.react.bridge.*

class BlinkSafeVibrationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "BlinkSafeVibrationModule"
        private const val TAG = "BlinkSafeVibrationModule"
    }

    override fun getName(): String = NAME

    private val vibrator: Vibrator? by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = reactContext.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vibratorManager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            reactContext.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    @ReactMethod
    fun hasVibrator(promise: Promise) {
        val hasVib = vibrator?.hasVibrator() ?: false
        promise.resolve(hasVib)
    }

    @ReactMethod
    fun vibratePattern(patternType: String, repeat: Boolean, promise: Promise) {
        val v = vibrator
        if (v == null || !v.hasVibrator()) {
            promise.resolve(false)
            return
        }

        try {
            val repeatIndex = if (repeat) 0 else -1
            val timings: LongArray = when (patternType.lowercase()) {
                "critical" -> longArrayOf(0, 500, 200, 500, 200, 800, 300, 800)
                "human_distress", "distress" -> longArrayOf(0, 300, 150, 300, 150, 300, 600, 300, 600)
                "high" -> longArrayOf(0, 300, 150, 300, 150, 300)
                "important" -> longArrayOf(0, 250, 200, 250)
                "informational", "info" -> longArrayOf(0, 150)
                "test" -> longArrayOf(0, 200, 100, 200, 100, 400)
                else -> longArrayOf(0, 200)
            }

            val amplitudes: IntArray? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                when (patternType.lowercase()) {
                    "critical" -> intArrayOf(0, 255, 0, 255, 0, 255, 0, 255)
                    "human_distress", "distress" -> intArrayOf(0, 240, 0, 240, 0, 240, 0, 255, 0)
                    "high" -> intArrayOf(0, 220, 0, 220, 0, 220)
                    "important" -> intArrayOf(0, 200, 0, 200)
                    "informational", "info" -> intArrayOf(0, 150)
                    else -> null
                }
            } else null

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val effect = if (amplitudes != null && amplitudes.size == timings.size) {
                    VibrationEffect.createWaveform(timings, amplitudes, repeatIndex)
                } else {
                    VibrationEffect.createWaveform(timings, repeatIndex)
                }
                v.vibrate(effect)
            } else {
                @Suppress("DEPRECATION")
                v.vibrate(timings, repeatIndex)
            }

            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Vibration execution error: ${e.message}", e)
            promise.reject("VIB_ERR", e.message)
        }
    }

    @ReactMethod
    fun stopVibration(promise: Promise) {
        try {
            vibrator?.cancel()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("VIB_STOP_ERR", e.message)
        }
    }
}
