#include <SoftwareSerial.h>

#define BLE_RX_PIN       10
#define BLE_TX_PIN       11
#define MOTOR_LEFT_PIN   5
#define MOTOR_RIGHT_PIN  6
#define BUTTON_PIN       4
#define STATUS_LED_PIN   13

#define DEBOUNCE_MS      40UL
#define ACK_HOLDOFF_MS   2000UL

SoftwareSerial bleSerial(BLE_RX_PIN, BLE_TX_PIN);

static uint8_t currentEvent = 0;
static unsigned long patternStart = 0;
static unsigned long ackHoldoffUntil = 0;

static bool lastButtonReading = HIGH;
static bool buttonState = HIGH;
static unsigned long lastButtonChange = 0;

static bool patternOn(uint8_t event, unsigned long t)
{
    switch (event) {

        case 1:
            return (t % 1500UL) < 300UL;

        case 2: {
            unsigned long p = t % 1600UL;
            return p < 200UL || (p >= 400UL && p < 600UL);
        }

        case 3: {
            unsigned long p = t % 2000UL;
            return p < 900UL && (p % 300UL) < 150UL;
        }

        case 4:
            return (t % 1000UL) < 900UL;
    }

    return false;
}

static uint8_t intensityFor(uint8_t event)
{
    switch (event) {

        case 1: return 150;
        case 2: return 200;
        case 3: return 230;
        case 4: return 255;
    }

    return 0;
}

static void driveMotors(bool left, bool right, uint8_t level)
{
    analogWrite(MOTOR_LEFT_PIN, left ? level : 0);
    analogWrite(MOTOR_RIGHT_PIN, right ? level : 0);
}

static void stopMotors()
{
    analogWrite(MOTOR_LEFT_PIN, 0);
    analogWrite(MOTOR_RIGHT_PIN, 0);

    digitalWrite(STATUS_LED_PIN, LOW);
}

static void updateVibration()
{
    if (currentEvent == 0) {

        stopMotors();

        return;
    }

    bool on = patternOn(
        currentEvent,
        millis() - patternStart
    );

    bool left =
        (currentEvent == 1 ||
         currentEvent == 3 ||
         currentEvent == 4);

    bool right =
        (currentEvent == 2 ||
         currentEvent == 3 ||
         currentEvent == 4);

    if (on) {

        driveMotors(
            left,
            right,
            intensityFor(currentEvent)
        );

        digitalWrite(STATUS_LED_PIN, HIGH);
    }
    else {

        driveMotors(false, false, 0);

        digitalWrite(STATUS_LED_PIN, LOW);
    }
}

static void handleIncoming()
{
    while (bleSerial.available() > 0) {

        char c = (char)bleSerial.read();

        if (c < '0' || c > '4') {

            continue;
        }

        uint8_t ev = (uint8_t)(c - '0');

        if (ev != 0 && millis() < ackHoldoffUntil) {

            continue;
        }

        if (ev != currentEvent) {

            currentEvent = ev;

            patternStart = millis();

            Serial.print("EVENT: ");
            Serial.println(currentEvent);
        }
    }
}

static void sendAck()
{
    bleSerial.write('A');

    delay(50);

    bleSerial.write('A');
}

static void handleButton()
{
    bool reading = digitalRead(BUTTON_PIN);

    if (reading != lastButtonReading) {

        lastButtonChange = millis();

        lastButtonReading = reading;
    }

    if (millis() - lastButtonChange > DEBOUNCE_MS) {

        if (reading != buttonState) {

            buttonState = reading;

            if (buttonState == LOW) {

                Serial.println("ACK PRESSED");

                currentEvent = 0;

                stopMotors();

                ackHoldoffUntil =
                    millis() + ACK_HOLDOFF_MS;

                sendAck();
            }
        }
    }
}

void setup()
{
    Serial.begin(9600);

    bleSerial.begin(9600);

    pinMode(MOTOR_LEFT_PIN, OUTPUT);
    pinMode(MOTOR_RIGHT_PIN, OUTPUT);
    pinMode(STATUS_LED_PIN, OUTPUT);
    pinMode(BUTTON_PIN, INPUT_PULLUP);

    stopMotors();

    Serial.println("BlinkSafe wristband ready");
}

void loop()
{
    handleIncoming();

    handleButton();

    updateVibration();
}