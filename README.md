# BlinkSafe

Smart-bulb safety network that turns doorbells, fire alarms, gas leaks and baby cries into light, vibration and app alerts for hard-of-hearing users. Fully offline, no cloud, no audio leaves the room.

Built for Tech Eximius 2.0 (Tech Circle Hackathon) by Ashutosh Tanguria and Prithika Banerjee, IIT Kharagpur.

## Architecture

```
Room node(s) [ESP32]  --ESP-NOW-->  Common node [ESP32]  --BLE-->  Wristband [Arduino Uno + HM-10]
 mic + MQ-2 + MQ-135                      |                          vibration motors + ack button
 RGB/LED indicators   <--ESP-NOW--        +--BLE (GATT)-->  Android app
```

| Node | Board | Role |
|---|---|---|
| Room node | ESP32 | Classifies sound on-device, reads gas sensors, shows alert colour, reports to common node |
| Common node | ESP32 | Collects room events, picks highest priority, broadcasts global state, drives wristband and phone over BLE |
| Wristband | Arduino Uno + HM-10 | Vibration patterns per event, push button to acknowledge |

## Repository layout

```
BlinkSafe/
  room_node/room_node.ino
  common_node/common_node.ino
  wristband/wristband.ino
```

## Events and priority

| ID | Event | Light | Wristband vibration |
|---|---|---|---|
| 0 | Normal | White | Off |
| 1 | Baby cry | Green | Left motor, short pulse every 1.5 s |
| 2 | Doorbell | Yellow | Right motor, double pulse |
| 3 | Gas leak (MQ-2) | Blue | Both motors, rapid pulses |
| 4 | Fire (fire alarm sound or MQ-135) | Red | Both motors, near continuous |

Higher ID wins. The common node picks the highest active event across all rooms.

## Data flow

1. Room node runs the Edge Impulse classifier (labels: `doorbell`, `babycrying`, `fire_alarm`) and gas checks, then broadcasts its local event over ESP-NOW once per second or on change.
2. Common node merges all room events (rooms time out after 3.5 s of silence), then broadcasts the global state back to every room node so all lights switch together.
3. Common node writes the current event as ASCII `'0'` to `'4'` to the wristband over BLE and notifies the phone.
4. Acknowledge from the wristband button (`'A'`) or from the phone stops the alert. The common node broadcasts the ack and room nodes suppress that event until it clears.

## Hardware

### Room node (ESP32)

| Part | Pin |
|---|---|
| INMP441 BCK | GPIO 26 |
| INMP441 WS | GPIO 25 |
| INMP441 SD | GPIO 33 |
| MQ-2 (analog) | GPIO 34 |
| MQ-135 (analog) | GPIO 35 |
| LED white | GPIO 27 |
| LED blue | GPIO 14 |
| LED red | GPIO 12 |
| LED yellow | GPIO 13 |
| LED green | GPIO 15 |

### Common node (ESP32)

| Part | Pin |
|---|---|
| Status LED | GPIO 2 (solid when wristband connected, blinking when searching) |

### Wristband (Arduino Uno)

| Part | Pin |
|---|---|
| HM-10 TX | D10 (Uno RX) |
| HM-10 RX | D11 (Uno TX, use a 5V to 3.3V divider) |
| Left vibration motor | D5 (PWM, via transistor) |
| Right vibration motor | D6 (PWM, via transistor) |
| Acknowledge button | D4 to GND (internal pull-up) |
| Status LED | D13 |

## Setup

### Libraries

- ESP32 Arduino core (provides WiFi, ESP-NOW, BLE, I2S)
- Edge Impulse exported Arduino library `Digital_Dataset_inferencing` (room node only)
- `SoftwareSerial` (bundled, wristband only)

### Room node

1. Install the Edge Impulse library in the Arduino IDE.
2. Set `ROOM_ID` (1 to 8) at the top of `room_node.ino`. Every room needs a unique ID.
3. Flash to each ESP32 room node.
4. Gas sensors need a 15 minute warm-up and baseline calibration after every boot. Gas and fire detection stay off during this window. Triggers fire at 1.5x baseline (MQ-2) and 2.0x baseline (MQ-135).

### Common node

1. Flash `common_node.ino` to a separate ESP32.
2. Room and common nodes must share the same ESP-NOW channel (`MESH_CHANNEL`, default 1).
3. It advertises as `BlinkSafe-Hub` and auto-scans for the wristband.

### Wristband

1. Set the HM-10 name once over AT commands at 9600 baud:
   ```
   AT+NAMEBlinkBand
   ```
2. Flash `wristband.ino` to the Arduino Uno.
3. The common node scans for `BlinkBand` (service `0xFFE0`, characteristic `0xFFE1`) and connects automatically.

## BLE interface for the phone app

| Item | UUID | Properties |
|---|---|---|
| Service | `4fafc201-1fb5-459e-8fcc-c5c9c331914b` | |
| Status | `beb5483e-36e1-4688-b7f5-ea07361b26a8` | Read, Notify |
| Acknowledge | `1c95d5e3-d8f7-413a-bf3d-7a2e5d7be87e` | Write, Write without response |

Status payload is 3 bytes: `[event, room, wristbandConnected]`. Write any byte to the Acknowledge characteristic to stop the active alert.

## Prototype results

- Sound model validation accuracy: 73.3%, ROC AUC: 0.92
- Approximate build cost: common node Rs 550, room node Rs 850 each, wristband Rs 650 each. Four rooms plus one wristband is about Rs 4,600.

## Next steps

- Evacuation guidance
- Longer-range RF with packet acknowledgement
- Customisable alerts
- CCTV integration