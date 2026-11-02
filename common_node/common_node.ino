#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define MESH_CHANNEL            1
#define PACKET_MAGIC            0xB5
#define PKT_ROOM_EVENT          1
#define PKT_GLOBAL_STATE        2

#define MAX_ROOMS               8
#define ROOM_TIMEOUT_MS         3500UL
#define GLOBAL_SEND_INTERVAL_MS 500UL
#define WRIST_SEND_INTERVAL_MS  1000UL
#define PHONE_SEND_INTERVAL_MS  1000UL

#define STATUS_LED              2

#define WRIST_NAME              "BlinkBand"

#define PHONE_SERVICE_UUID      "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define PHONE_STATUS_UUID       "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define PHONE_ACK_UUID          "1c95d5e3-d8f7-413a-bf3d-7a2e5d7be87e"

typedef struct __attribute__((packed)) {
    uint8_t magic;
    uint8_t kind;
    uint8_t room;
    uint8_t event;
    uint8_t ack;
} mesh_packet_t;

static uint8_t broadcastAddress[] = {
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF
};

static volatile uint8_t roomEvent[MAX_ROOMS + 1];
static volatile unsigned long roomLastSeen[MAX_ROOMS + 1];
static uint8_t roomPrev[MAX_ROOMS + 1];
static uint8_t roomAcked[MAX_ROOMS + 1];

static volatile bool ackRequest = false;

static uint8_t currentEvent = 0;
static uint8_t currentRoom = 0;

static uint8_t lastGlobalEvent = 255;
static uint8_t lastGlobalRoom = 255;
static unsigned long lastGlobalSend = 0;

static uint8_t lastWristEvent = 255;
static unsigned long lastWristSend = 0;

static uint8_t lastPhoneEvent = 255;
static uint8_t lastPhoneRoom = 255;
static uint8_t lastPhoneWrist = 255;
static unsigned long lastPhoneSend = 0;

static volatile bool phoneConnected = false;
static volatile bool wristConnected = false;

static BLEServer *phoneServer = nullptr;
static BLECharacteristic *phoneStatusChar = nullptr;

static BLEClient *wristClient = nullptr;
static BLERemoteCharacteristic *wristChar = nullptr;
static BLEAdvertisedDevice *wristDevice = nullptr;

static BLEUUID wristServiceUUID((uint16_t)0xFFE0);
static BLEUUID wristCharUUID((uint16_t)0xFFE1);

class PhoneServerCallbacks : public BLEServerCallbacks {

    void onConnect(BLEServer *server) {

        phoneConnected = true;

        Serial.println("PHONE CONNECTED");
    }

    void onDisconnect(BLEServer *server) {

        phoneConnected = false;

        Serial.println("PHONE DISCONNECTED");

        BLEDevice::startAdvertising();
    }
};

class PhoneAckCallbacks : public BLECharacteristicCallbacks {

    void onWrite(BLECharacteristic *characteristic) {

        auto v = characteristic->getValue();

        if (v.length() > 0) {

            ackRequest = true;

            Serial.println("ACK FROM PHONE");
        }
    }
};

class WristClientCallbacks : public BLEClientCallbacks {

    void onConnect(BLEClient *client) {
    }

    void onDisconnect(BLEClient *client) {

        wristConnected = false;

        Serial.println("WRISTBAND DISCONNECTED");
    }
};

class WristScanCallbacks : public BLEAdvertisedDeviceCallbacks {

    void onResult(BLEAdvertisedDevice advertisedDevice) {

        bool nameMatch =
            advertisedDevice.haveName() &&
            strcmp(
                advertisedDevice.getName().c_str(),
                WRIST_NAME
            ) == 0;

        bool serviceMatch =
            advertisedDevice.haveServiceUUID() &&
            advertisedDevice.isAdvertisingService(
                wristServiceUUID
            );

        if (nameMatch || serviceMatch) {

            Serial.println("WRISTBAND FOUND");

            BLEDevice::getScan()->stop();

            if (wristDevice != nullptr) {

                delete wristDevice;
            }

            wristDevice =
                new BLEAdvertisedDevice(
                    advertisedDevice
                );
        }
    }
};

static void onWristNotify(
    BLERemoteCharacteristic *characteristic,
    uint8_t *data,
    size_t length,
    bool isNotify
)
{
    for (size_t i = 0; i < length; i++) {

        if (data[i] == 'A') {

            ackRequest = true;

            Serial.println("ACK FROM WRISTBAND");

            break;
        }
    }
}

static bool connectWristband()
{
    if (wristClient == nullptr) {

        wristClient = BLEDevice::createClient();

        wristClient->setClientCallbacks(
            new WristClientCallbacks()
        );
    }

    if (!wristClient->connect(wristDevice)) {

        return false;
    }

    BLERemoteService *service =
        wristClient->getService(
            wristServiceUUID
        );

    if (service == nullptr) {

        wristClient->disconnect();

        return false;
    }

    wristChar =
        service->getCharacteristic(
            wristCharUUID
        );

    if (wristChar == nullptr) {

        wristClient->disconnect();

        return false;
    }

    if (wristChar->canNotify()) {

        wristChar->registerForNotify(
            onWristNotify
        );
    }

    wristConnected = true;

    Serial.println("WRISTBAND CONNECTED");

    return true;
}

static void wristbandTask(
    void *arg
)
{
    for (;;) {

        if (!wristConnected) {

            if (wristDevice == nullptr) {

                BLEScan *scan =
                    BLEDevice::getScan();

                scan->start(3, false);

                scan->clearResults();
            }
            else {

                if (!connectWristband()) {

                    delete wristDevice;

                    wristDevice = nullptr;
                }
            }
        }

        vTaskDelay(
            1000 / portTICK_PERIOD_MS
        );
    }
}

static void sendToWristband(
    uint8_t event
)
{
    if (!wristConnected ||
        wristChar == nullptr) {

        return;
    }

    uint8_t c = (uint8_t)('0' + event);

    wristChar->writeValue(&c, 1, false);
}

static void notifyPhone(
    uint8_t event,
    uint8_t room
)
{
    uint8_t payload[3];

    payload[0] = event;
    payload[1] = room;
    payload[2] = wristConnected ? 1 : 0;

    phoneStatusChar->setValue(payload, 3);

    if (phoneConnected) {

        phoneStatusChar->notify();
    }
}

static void sendGlobal(
    uint8_t event,
    uint8_t room,
    uint8_t ack
)
{
    mesh_packet_t p;

    p.magic = PACKET_MAGIC;
    p.kind = PKT_GLOBAL_STATE;
    p.room = room;
    p.event = event;
    p.ack = ack;

    esp_now_send(
        broadcastAddress,
        (uint8_t *)&p,
        sizeof(p)
    );
}

#if ESP_ARDUINO_VERSION_MAJOR >= 3
static void onMeshReceive(
    const esp_now_recv_info_t *info,
    const uint8_t *data,
    int len
)
#else
static void onMeshReceive(
    const uint8_t *mac,
    const uint8_t *data,
    int len
)
#endif
{
    if (len != (int)sizeof(mesh_packet_t)) {

        return;
    }

    mesh_packet_t p;

    memcpy(&p, data, sizeof(p));

    if (p.magic != PACKET_MAGIC ||
        p.kind != PKT_ROOM_EVENT) {

        return;
    }

    if (p.room < 1 || p.room > MAX_ROOMS) {

        return;
    }

    roomEvent[p.room] = p.event;

    roomLastSeen[p.room] = millis();
}

static void meshInit()
{
    WiFi.mode(WIFI_STA);

    WiFi.disconnect();

    esp_wifi_set_channel(
        MESH_CHANNEL,
        WIFI_SECOND_CHAN_NONE
    );

    if (esp_now_init() != ESP_OK) {

        Serial.println(
            "ESP-NOW INIT FAILED!"
        );

        return;
    }

    esp_now_register_recv_cb(onMeshReceive);

    esp_now_peer_info_t peer;

    memset(&peer, 0, sizeof(peer));

    memcpy(peer.peer_addr, broadcastAddress, 6);

    peer.channel = MESH_CHANNEL;

    peer.encrypt = false;

    if (esp_now_add_peer(&peer) != ESP_OK) {

        Serial.println(
            "ESP-NOW PEER ADD FAILED!"
        );

        return;
    }

    Serial.print("Common node mesh ready. MAC: ");
    Serial.println(WiFi.macAddress());
}

static void bleInit()
{
    BLEDevice::init("BlinkSafe-Hub");

    phoneServer = BLEDevice::createServer();

    phoneServer->setCallbacks(
        new PhoneServerCallbacks()
    );

    BLEService *service =
        phoneServer->createService(
            PHONE_SERVICE_UUID
        );

    phoneStatusChar =
        service->createCharacteristic(
            PHONE_STATUS_UUID,
            BLECharacteristic::PROPERTY_READ |
            BLECharacteristic::PROPERTY_NOTIFY
        );

    phoneStatusChar->addDescriptor(
        new BLE2902()
    );

    uint8_t initial[3] = {0, 0, 0};

    phoneStatusChar->setValue(initial, 3);

    BLECharacteristic *ackChar =
        service->createCharacteristic(
            PHONE_ACK_UUID,
            BLECharacteristic::PROPERTY_WRITE |
            BLECharacteristic::PROPERTY_WRITE_NR
        );

    ackChar->setCallbacks(
        new PhoneAckCallbacks()
    );

    service->start();

    BLEAdvertising *advertising =
        BLEDevice::getAdvertising();

    advertising->addServiceUUID(
        PHONE_SERVICE_UUID
    );

    advertising->setScanResponse(true);

    BLEDevice::startAdvertising();

    BLEScan *scan = BLEDevice::getScan();

    scan->setAdvertisedDeviceCallbacks(
        new WristScanCallbacks()
    );

    scan->setActiveScan(true);

    scan->setInterval(100);

    scan->setWindow(99);

    xTaskCreatePinnedToCore(
        wristbandTask,
        "WristbandLink",
        8192,
        NULL,
        1,
        NULL,
        0
    );
}

static void evaluateState()
{
    unsigned long now = millis();

    bool ack = ackRequest;

    ackRequest = false;

    uint8_t top = 0;
    uint8_t topRoom = 0;

    for (uint8_t r = 1; r <= MAX_ROOMS; r++) {

        uint8_t ev = roomEvent[r];

        if (now - roomLastSeen[r] >
            ROOM_TIMEOUT_MS) {

            ev = 0;
        }

        if (ev == 0 || ev < roomPrev[r]) {

            roomAcked[r] = 0;
        }

        roomPrev[r] = ev;

        if (ack) {

            roomAcked[r] = ev;
        }

        uint8_t eff =
            (ev > roomAcked[r]) ? ev : 0;

        if (eff > top) {

            top = eff;

            topRoom = r;
        }
    }

    if (ack) {

        Serial.println(
            "ACKNOWLEDGED -> BROADCASTING STOP"
        );

        for (int i = 0; i < 3; i++) {

            sendGlobal(top, topRoom, 1);

            delay(30);
        }

        lastGlobalSend = now;
    }

    currentEvent = top;
    currentRoom = topRoom;
}

void setup()
{
    Serial.begin(115200);

    pinMode(STATUS_LED, OUTPUT);

    memset((void *)roomEvent, 0, sizeof(roomEvent));
    memset((void *)roomLastSeen, 0, sizeof(roomLastSeen));
    memset(roomPrev, 0, sizeof(roomPrev));
    memset(roomAcked, 0, sizeof(roomAcked));

    meshInit();

    bleInit();

    Serial.println("BlinkSafe common node running");
}

void loop()
{
    evaluateState();

    unsigned long now = millis();

    if (currentEvent != lastGlobalEvent ||
        currentRoom != lastGlobalRoom ||
        now - lastGlobalSend >=
        GLOBAL_SEND_INTERVAL_MS) {

        if (currentEvent != lastGlobalEvent ||
            currentRoom != lastGlobalRoom) {

            Serial.print("ACTIVE EVENT: ");
            Serial.print(currentEvent);
            Serial.print(" | ROOM: ");
            Serial.println(currentRoom);
        }

        sendGlobal(currentEvent, currentRoom, 0);

        lastGlobalEvent = currentEvent;
        lastGlobalRoom = currentRoom;
        lastGlobalSend = now;
    }

    if (currentEvent != lastWristEvent ||
        now - lastWristSend >=
        WRIST_SEND_INTERVAL_MS) {

        sendToWristband(currentEvent);

        lastWristEvent = currentEvent;
        lastWristSend = now;
    }

    uint8_t wristFlag = wristConnected ? 1 : 0;

    if (currentEvent != lastPhoneEvent ||
        currentRoom != lastPhoneRoom ||
        wristFlag != lastPhoneWrist ||
        now - lastPhoneSend >=
        PHONE_SEND_INTERVAL_MS) {

        notifyPhone(currentEvent, currentRoom);

        lastPhoneEvent = currentEvent;
        lastPhoneRoom = currentRoom;
        lastPhoneWrist = wristFlag;
        lastPhoneSend = now;
    }

    if (wristConnected) {

        digitalWrite(STATUS_LED, HIGH);
    }
    else {

        digitalWrite(
            STATUS_LED,
            ((now / 500UL) % 2UL) ? HIGH : LOW
        );
    }

    delay(20);
}