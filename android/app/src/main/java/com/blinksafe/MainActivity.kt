package com.blinksafe

import android.content.Intent
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "BlinkSafe"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(null)
        handleIntentPayload(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntentPayload(intent)
    }

    private fun handleIntentPayload(intent: Intent?) {
        if (intent == null) return

        val alertId = intent.getStringExtra("alertId")
        val severity = intent.getStringExtra("severity")
        val location = intent.getStringExtra("location")
        val payload = intent.getStringExtra("payload")
        val dataUri = intent.data

        if (alertId != null || dataUri != null) {
            val resolvedAlertId = alertId ?: dataUri?.lastPathSegment ?: ""
            val map: WritableMap = Arguments.createMap().apply {
                putString("alertId", resolvedAlertId)
                putString("severity", severity ?: "critical")
                putString("location", location ?: "Home")
                putString("payload", payload ?: "")
                putString("uri", dataUri?.toString() ?: "")
            }
            BlinkSafeNotificationModule.initialNotificationPayload = map
            BlinkSafeBleModule.notifySafetyEvent(payload ?: """{"id":"$resolvedAlertId","type":"fire","severity":"critical","location":"$location"}""")
        }
    }
}
