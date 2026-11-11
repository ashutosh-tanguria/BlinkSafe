"""
BlinkSafe - Laptop ESP32 Bluetooth / Hardware Simulator
======================================================
This script simulates an ESP32 Central Node / Bulb Node over Bluetooth (or local simulation)
transmitting sensor telemetry (MQ-2, MQ-135, IR, Mic, PIR) and emergency events to the
BlinkSafe Android app, and listening for Bidirectional Acknowledgment (ACK) packets from the phone.

Requirements:
    pip install bleak (for Bluetooth Low Energy GATT Server)
"""

import sys
import json
import time
import asyncio

SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
EVENT_CHAR_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8"
ACK_CHAR_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a9"

DEVICE_NAME = "BlinkSafe-Hub"

def create_telemetry_packet(alert_type="normal", location="Living Room"):
    timestamp = int(time.time())
    
    if alert_type == "fire":
        return {
            "id": f"EVT_FIRE_{timestamp}",
            "type": "fire",
            "severity": "critical",
            "title": "🔥 FLAME & SMOKE DETECTED",
            "message": f"IR Optical flame detected with rising smoke in {location}.",
            "location": location,
            "nodeId": "NODE_BULB_01",
            "deviceName": "Kitchen Bulb Hub #1",
            "confidence": 0.98,
            "timestamp": timestamp,
            "telemetry": {
                "mq2": {"ppm": 780, "status": "critical"},
                "mq135": {"ppm": 450, "airQuality": "poor"},
                "ir": {"flameDetected": True},
                "mic": {"dbLevel": 88, "sirenDetected": True},
                "pir": {"motionDetected": True},
                "lastUpdated": timestamp * 1000
            },
            "evacuationSteps": [
                "1. Avoid Kitchen corridor — high heat and smoke detected.",
                "2. Proceed along East Hallway towards Exit Door B.",
                "3. Keep close to floor to avoid toxic smoke fumes."
            ]
        }
    elif alert_type == "gas":
        return {
            "id": f"EVT_GAS_{timestamp}",
            "type": "gas_leak",
            "severity": "critical",
            "title": "🟡 COMBUSTIBLE GAS LEAK DETECTED",
            "message": f"MQ-2 Sensor detected high hydrocarbon/LPG concentration in {location}.",
            "location": location,
            "nodeId": "NODE_BULB_02",
            "deviceName": "Main Kitchen Sensor Node",
            "confidence": 0.94,
            "timestamp": timestamp,
            "telemetry": {
                "mq2": {"ppm": 850, "status": "critical"},
                "mq135": {"ppm": 520, "airQuality": "hazardous"},
                "ir": {"flameDetected": False},
                "mic": {"dbLevel": 42, "sirenDetected": False},
                "pir": {"motionDetected": False},
                "lastUpdated": timestamp * 1000
            },
            "evacuationSteps": [
                "1. Do NOT touch any electrical switches or open flames.",
                "2. Evacuate immediately towards North Garden Exit.",
                "3. Turn off main LPG regulator valve if safe to reach."
            ]
        }
    elif alert_type == "intrusion":
        return {
            "id": f"EVT_INTRUSION_{timestamp}",
            "type": "intrusion",
            "severity": "high",
            "title": "🚶 PIR MOTION & PRESENCE INTRUSION",
            "message": f"PIR Sensor detected unexpected movement in {location}.",
            "location": location,
            "nodeId": "NODE_BULB_03",
            "deviceName": "Living Room Bulb Pod",
            "confidence": 0.91,
            "timestamp": timestamp,
            "telemetry": {
                "mq2": {"ppm": 140, "status": "normal"},
                "mq135": {"ppm": 210, "airQuality": "good"},
                "ir": {"flameDetected": False},
                "mic": {"dbLevel": 64, "sirenDetected": False},
                "pir": {"motionDetected": True},
                "lastUpdated": timestamp * 1000
            }
        }
    else:
        # Normal ambient telemetry
        return {
            "id": f"EVT_TELEMETRY_{timestamp}",
            "type": "environmental_sound",
            "severity": "informational",
            "title": "✓ All Sensors Normal",
            "message": f"Normal ambient conditions in {location}.",
            "location": location,
            "nodeId": "NODE_HUB",
            "deviceName": "BlinkSafe-Hub",
            "confidence": 1.0,
            "timestamp": timestamp,
            "telemetry": {
                "mq2": {"ppm": 120, "status": "normal"},
                "mq135": {"ppm": 190, "airQuality": "good"},
                "ir": {"flameDetected": False},
                "mic": {"dbLevel": 35, "sirenDetected": False},
                "pir": {"motionDetected": False},
                "lastUpdated": timestamp * 1000
            }
        }

def on_ack_received(ack_data_bytes):
    try:
        data = json.loads(ack_data_bytes.decode("utf-8"))
        print("\n" + "="*60)
        print("🎉 [BIDIRECTIONAL ACK RECEIVED FROM MOBILE PHONE!]")
        print(f"   Action:     {data.get('action')}")
        print(f"   Alert ID:   {data.get('alertId')}")
        print(f"   Timestamp:  {data.get('timestamp')}")
        print("   Status:     Buzzer/Strobe on Central Node can now be MUTED.")
        print("="*60 + "\n")
    except Exception as e:
        print(f"[ACK Error] Raw bytes: {ack_data_bytes} ({e})")

async def run_ble_server():
    try:
        from bleak.backends.server import BaseGATTServer
    except ImportError:
        print("\n[NOTE] 'bleak' library not detected for BLE GATT server.")
        print("       Install via: pip install bleak\n")
        print("Running in Interactive JSON Payload Test mode:\n")
        run_interactive_console()
        return

    print(f"Starting BLE GATT Peripheral: {DEVICE_NAME}...")
    print(f"Service UUID:        {SERVICE_UUID}")
    print(f"Event Characteristic:{EVENT_CHAR_UUID}")
    print(f"ACK Characteristic:  {ACK_CHAR_UUID}")
    run_interactive_console()

def run_interactive_console():
    print("\n" + "="*50)
    print("   BLINKSAFE ESP32 SENSOR & ALERT SIMULATOR")
    print("="*50)
    print("Options:")
    print("  [1] Send 🔥 FIRE Alert (MQ-2 Critical + IR Flame Detected)")
    print("  [2] Send 🟡 GAS LEAK Alert (MQ-2 Gas ppm 850 + MQ-135 Toxic)")
    print("  [3] Send 🚶 PIR Motion Detection Alert")
    print("  [4] Send 🍃 Normal Ambient Telemetry Update")
    print("  [5] Simulate Receiving Mobile ACK (Test Bidirectional Response)")
    print("  [0] Exit")
    print("="*50)

    while True:
        try:
            choice = input("\nEnter choice [0-5]: ").strip()
            if choice == "1":
                pkt = create_telemetry_packet("fire", "Kitchen")
                print("\n[SIMULATING FIRE PACKET SENT OVER BLE]:")
                print(json.dumps(pkt, indent=2))
            elif choice == "2":
                pkt = create_telemetry_packet("gas", "Kitchen Utility")
                print("\n[SIMULATING GAS LEAK PACKET SENT OVER BLE]:")
                print(json.dumps(pkt, indent=2))
            elif choice == "3":
                pkt = create_telemetry_packet("intrusion", "Living Room Corridor")
                print("\n[SIMULATING MOTION DETECTED PACKET SENT OVER BLE]:")
                print(json.dumps(pkt, indent=2))
            elif choice == "4":
                pkt = create_telemetry_packet("normal", "Bedroom")
                print("\n[SIMULATING AMBIENT TELEMETRY PACKET SENT OVER BLE]:")
                print(json.dumps(pkt, indent=2))
            elif choice == "5":
                sample_ack = json.dumps({"action": "ACKNOWLEDGE", "alertId": "EVT_FIRE_SAMPLE", "timestamp": int(time.time())}).encode("utf-8")
                on_ack_received(sample_ack)
            elif choice == "0":
                print("Exiting simulator.")
                break
        except KeyboardInterrupt:
            break

if __name__ == "__main__":
    run_interactive_console()
