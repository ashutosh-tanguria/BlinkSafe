/*
  BlinkSafe_ESP32_Firmware.ino

  ESP32 Bluetooth Classic Firmware for BlinkSafe Mobile App
  Uses standard "BluetoothSerial.h" (Pre-installed in Arduino ESP32 - NO extra library needed!)
  
  Features:
  - Broadcasts as "BlinkSafe-Hub"
  - Pairs directly in Phone Settings -> Bluetooth just like headphones/speakers
  - Sends continuous Fire & Gas leak emergency signals to the BlinkSafe App
  - Receives and logs "ACK" signals when user clicks "Acknowledge & Mute" on phone
*/

#include "BluetoothSerial.h"

#if !defined(CONFIG_BT_ENABLED) || !defined(CONFIG_BLUEDROID_ENABLED)
#error Bluetooth is not enabled! Please run make menuconfig to enable it
#endif

BluetoothSerial SerialBT;

#define DEVICE_NAME "BlinkSafe-Hub"

unsigned long lastSendTime = 0;
uint32_t eventCounter = 100;
bool toggleHazard = false; // false = FIRE, true = GAS LEAK

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n==========================================");
  Serial.println("   BlinkSafe ESP32 Safety Hub (Classic)");
  Serial.println("==========================================");

  // Initialize Bluetooth Classic Serial
  SerialBT.begin(DEVICE_NAME);
  
  Serial.println("[BT] Device Name: " DEVICE_NAME);
  Serial.println("[BT] Ready! Phone Settings -> Bluetooth me jao aur 'BlinkSafe-Hub' ko Pair karo.");
}

void loop() {
  // Check for incoming ACK from Mobile App
  if (SerialBT.available()) {
    String incoming = SerialBT.readStringUntil('\n');
    incoming.trim();
    if (incoming.length() > 0) {
      Serial.println("\n==================================================");
      Serial.println("[MOBILE ACK RECEIVED] User clicked Acknowledge on Phone!");
      Serial.print("Data: ");
      Serial.println(incoming);
      Serial.println("Action: Muting buzzer & resetting alarm status...");
      Serial.println("==================================================\n");
    }
  }

  // Send alternating simulated emergency alerts every 6 seconds when phone is connected
  if (SerialBT.hasClient()) {
    if (millis() - lastSendTime >= 6000) {
      lastSendTime = millis();
      eventCounter++;

      if (!toggleHazard) {
        // SCENARIO 1: CRITICAL FIRE DETECTED
        Serial.println("\n[HAZARD] Sending CRITICAL FIRE alert to phone...");
        SerialBT.println("FIRE_DETECTED");
      } else {
        // SCENARIO 2: COMBUSTIBLE GAS LEAK
        Serial.println("\n[HAZARD] Sending COMBUSTIBLE GAS alert to phone...");
        SerialBT.println("GAS_HIGH");
      }

      toggleHazard = !toggleHazard;
    }
  } else {
    // If not connected, print prompt every 4 seconds
    if (millis() - lastSendTime >= 4000) {
      lastSendTime = millis();
      Serial.println("[BT] Waiting for phone to connect... (Pair 'BlinkSafe-Hub' in phone Bluetooth)");
    }
  }

  delay(20);
}
