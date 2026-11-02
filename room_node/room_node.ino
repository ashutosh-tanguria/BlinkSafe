#define EIDSP_QUANTIZE_FILTERBANK   0

#include <Digital_Dataset_inferencing.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/i2s.h"
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>

#define ROOM_ID                 1
#define MESH_CHANNEL            1
#define PACKET_MAGIC            0xB5
#define PKT_ROOM_EVENT          1
#define PKT_GLOBAL_STATE        2

#define EVT_NORMAL              0
#define EVT_BABY                1
#define EVT_DOORBELL            2
#define EVT_GAS                 3
#define EVT_FIRE                4

#define MESH_REPORT_INTERVAL_MS 1000UL
#define GLOBAL_TIMEOUT_MS       3000UL

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

static volatile uint8_t globalEvent = EVT_NORMAL;
static volatile unsigned long lastGlobalRx = 0;
static volatile bool ackPending = false;

static uint8_t ackSuppress = EVT_NORMAL;
static uint8_t prevLocalEvent = EVT_NORMAL;
static uint8_t lastSentEvent = 255;
static unsigned long lastSendTime = 0;

typedef struct {
    signed short *buffers[2];
    unsigned char buf_select;
    unsigned char buf_ready;
    unsigned int buf_count;
    unsigned int n_samples;
} inference_t;

static inference_t inference;

static const uint32_t sample_buffer_size = 2048;
static signed short sampleBuffer[sample_buffer_size];

static bool debug_nn = false;
static int print_results =
    -(EI_CLASSIFIER_SLICES_PER_MODEL_WINDOW);

static bool record_status = true;

#define MQ2_PIN     34
#define MQ135_PIN   35

#define LED_WHITE   27
#define LED_BLUE    14
#define LED_RED     12
#define LED_YELLOW  13
#define LED_GREEN   15

#define ADC_RESOLUTION   4095.0f
#define ADC_VREF         3.3f

#define SENSOR_STABILIZE_MS \
    (15UL * 60UL * 1000UL)

#define CALIBRATION_SAMPLE_INTERVAL_MS 1000UL
#define SENSOR_CHECK_INTERVAL_MS       500UL

#define MQ2_GAS_LEAK_MULTIPLIER    1.5f
#define MQ135_FIRE_MULTIPLIER      2.0f

static unsigned long sensorStartTime = 0;
static unsigned long lastCalibrationSample = 0;
static unsigned long lastSensorCheck = 0;

static bool sensorsCalibrated = false;

static double mq2_sum = 0.0;
static double mq135_sum = 0.0;

static unsigned long calibrationSampleCount = 0;

static float mq2_baseline = 0.0f;
static float mq135_baseline = 0.0f;

static bool flagGasLeak  = false;
static bool flagFire     = false;
static bool flagFireAlarm = false;
static bool flagDoorbell = false;
static bool flagBabyCry  = false;

static void updateLEDs(uint8_t event)
{
    digitalWrite(LED_WHITE, LOW);
    digitalWrite(LED_BLUE, LOW);
    digitalWrite(LED_RED, LOW);
    digitalWrite(LED_YELLOW, LOW);
    digitalWrite(LED_GREEN, LOW);

    if (event == EVT_FIRE) {

        digitalWrite(LED_RED, HIGH);

    }
    else if (event == EVT_GAS) {

        digitalWrite(LED_BLUE, HIGH);

    }
    else if (event == EVT_DOORBELL) {

        digitalWrite(LED_YELLOW, HIGH);

    }
    else if (event == EVT_BABY) {

        digitalWrite(LED_GREEN, HIGH);

    }
    else {

        digitalWrite(LED_WHITE, HIGH);
    }
}

static uint8_t computeLocalEvent()
{
    if (flagFireAlarm || flagFire) {

        return EVT_FIRE;
    }

    if (flagGasLeak) {

        return EVT_GAS;
    }

    if (flagDoorbell) {

        return EVT_DOORBELL;
    }

    if (flagBabyCry) {

        return EVT_BABY;
    }

    return EVT_NORMAL;
}

static void runSensorCalibration()
{
    unsigned long now = millis();

    if (now - lastCalibrationSample >=
        CALIBRATION_SAMPLE_INTERVAL_MS) {

        lastCalibrationSample = now;

        int mq2_raw = analogRead(MQ2_PIN);
        int mq135_raw = analogRead(MQ135_PIN);

        mq2_sum += mq2_raw;
        mq135_sum += mq135_raw;

        calibrationSampleCount++;

        unsigned long elapsedSec =
            (now - sensorStartTime) / 1000UL;

        unsigned long remainingSec =
            (SENSOR_STABILIZE_MS -
            (now - sensorStartTime)) / 1000UL;

        Serial.print(
            "Calibrating gas sensors... elapsed: "
        );

        Serial.print(elapsedSec);

        Serial.print("s, remaining: ");

        Serial.print(remainingSec);

        Serial.println("s");
    }

    if (now - sensorStartTime >=
        SENSOR_STABILIZE_MS) {

        if (calibrationSampleCount > 0) {

            mq2_baseline =
                (float)(
                    mq2_sum /
                    calibrationSampleCount
                );

            mq135_baseline =
                (float)(
                    mq135_sum /
                    calibrationSampleCount
                );

        }
        else {

            mq2_baseline =
                analogRead(MQ2_PIN);

            mq135_baseline =
                analogRead(MQ135_PIN);
        }

        sensorsCalibrated = true;

        Serial.println(
            "================================================="
        );

        Serial.print(
            "Gas sensor calibration complete. MQ2 baseline: "
        );

        Serial.print(mq2_baseline, 2);

        Serial.print(
            " | MQ135 baseline: "
        );

        Serial.println(mq135_baseline, 2);

        Serial.println(
            "================================================="
        );
    }
}

static void checkGasSensors()
{
    unsigned long now = millis();

    if (now - lastSensorCheck <
        SENSOR_CHECK_INTERVAL_MS) {

        return;
    }

    lastSensorCheck = now;

    int mq2_raw = analogRead(MQ2_PIN);
    int mq135_raw = analogRead(MQ135_PIN);

    float mq2_voltage =
        mq2_raw *
        (ADC_VREF / ADC_RESOLUTION);

    float mq135_voltage =
        mq135_raw *
        (ADC_VREF / ADC_RESOLUTION);

    Serial.print("MQ2 raw: ");
    Serial.print(mq2_raw);

    Serial.print(" | MQ2 voltage: ");
    Serial.print(mq2_voltage, 3);

    Serial.print(" V || MQ135 raw: ");
    Serial.print(mq135_raw);

    Serial.print(" | MQ135 voltage: ");
    Serial.print(mq135_voltage, 3);

    Serial.println(" V");

    flagGasLeak =
        (mq2_raw >=
        mq2_baseline *
        MQ2_GAS_LEAK_MULTIPLIER);

    flagFire =
        (mq135_raw >=
        mq135_baseline *
        MQ135_FIRE_MULTIPLIER);

    if (flagGasLeak) {

        Serial.println(
            "GAS LEAKAGE DETECTED (MQ2)"
        );
    }

    if (flagFire) {

        Serial.println(
            "FIRE ALERT DETECTED (MQ135)"
        );
    }
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
        p.kind != PKT_GLOBAL_STATE) {

        return;
    }

    if (p.ack) {

        ackPending = true;
    }

    globalEvent = p.event;

    lastGlobalRx = millis();
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

    Serial.print("Room node ");
    Serial.print(ROOM_ID);
    Serial.print(" mesh ready. MAC: ");
    Serial.println(WiFi.macAddress());
}

static void updateMeshReport(
    uint8_t event
)
{
    unsigned long now = millis();

    if (event != lastSentEvent ||
        now - lastSendTime >=
        MESH_REPORT_INTERVAL_MS) {

        lastSentEvent = event;
        lastSendTime = now;

        mesh_packet_t p;

        p.magic = PACKET_MAGIC;
        p.kind = PKT_ROOM_EVENT;
        p.room = ROOM_ID;
        p.event = event;
        p.ack = 0;

        esp_now_send(
            broadcastAddress,
            (uint8_t *)&p,
            sizeof(p)
        );
    }
}

void setup()
{
    Serial.begin(115200);

    meshInit();

    Serial.println(
        "Edge Impulse Inferencing Demo"
    );

    ei_printf(
        "Inferencing settings:\n"
    );

    ei_printf(
        "\tInterval: "
    );

    ei_printf_float(
        (float)EI_CLASSIFIER_INTERVAL_MS
    );

    ei_printf(" ms.\n");

    ei_printf(
        "\tFrame size: %d\n",
        EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE
    );

    ei_printf(
        "\tSample length: %d ms.\n",
        EI_CLASSIFIER_RAW_SAMPLE_COUNT / 16
    );

    ei_printf(
        "\tNo. of classes: %d\n",
        sizeof(
            ei_classifier_inferencing_categories
        ) /
        sizeof(
            ei_classifier_inferencing_categories[0]
        )
    );

    run_classifier_init();

    ei_printf(
        "\nStarting continuous inference in 2 seconds...\n"
    );

    ei_sleep(2000);

    if (
        microphone_inference_start(
            EI_CLASSIFIER_SLICE_SIZE
        ) == false
    ) {

        ei_printf(
            "ERR: Could not allocate audio buffer "
            "(size %d)\r\n",
            EI_CLASSIFIER_RAW_SAMPLE_COUNT
        );

        return;
    }

    ei_printf("Recording...\n");

    pinMode(MQ2_PIN, INPUT);
    pinMode(MQ135_PIN, INPUT);

    pinMode(LED_WHITE, OUTPUT);
    pinMode(LED_BLUE, OUTPUT);
    pinMode(LED_RED, OUTPUT);
    pinMode(LED_YELLOW, OUTPUT);
    pinMode(LED_GREEN, OUTPUT);

    digitalWrite(LED_WHITE, HIGH);

    digitalWrite(LED_BLUE, LOW);
    digitalWrite(LED_RED, LOW);
    digitalWrite(LED_YELLOW, LOW);
    digitalWrite(LED_GREEN, LOW);

    sensorStartTime = millis();

    lastCalibrationSample =
        sensorStartTime;

    lastSensorCheck =
        sensorStartTime;

    Serial.println();
    Serial.println(
        "Starting 15-minute MQ2/MQ135 "
        "stabilization period..."
    );
}

void loop()
{
    bool m =
        microphone_inference_record();

    if (!m) {

        ei_printf(
            "ERR: Failed to record audio...\n"
        );

        return;
    }

    signal_t signal;

    signal.total_length =
        EI_CLASSIFIER_SLICE_SIZE;

    signal.get_data =
        &microphone_audio_signal_get_data;

    ei_impulse_result_t result = {0};

    EI_IMPULSE_ERROR r =
        run_classifier_continuous(
            &signal,
            &result,
            debug_nn
        );

    if (r != EI_IMPULSE_OK) {

        ei_printf(
            "ERR: Failed to run classifier (%d)\n",
            r
        );

        return;
    }

    if (
        ++print_results >=
        EI_CLASSIFIER_SLICES_PER_MODEL_WINDOW
    ) {

        float doorbell = 0.0;
        float babycrying = 0.0;
        float firealarm = 0.0;

        for (
            size_t ix = 0;
            ix < EI_CLASSIFIER_LABEL_COUNT;
            ix++
        ) {

            String label =
                result.classification[ix].label;

            float value =
                result.classification[ix].value;

            if (label == "doorbell") {

                doorbell = value;
            }
            else if (
                label == "babycrying"
            ) {

                babycrying = value;
            }
            else if (
                label == "fire_alarm"
            ) {

                firealarm = value;
            }
        }

        if (
            doorbell > 0.6 &&
            doorbell > firealarm &&
            doorbell > babycrying
        ) {

            Serial.println(
                "DOORBELL DETECTED"
            );

            flagDoorbell = true;
            flagBabyCry = false;
            flagFireAlarm = false;
        }

        else if (
            firealarm > 0.75
        ) {

            Serial.println(
                "FIRE ALARM DETECTED"
            );

            flagDoorbell = false;
            flagBabyCry = false;
            flagFireAlarm = true;
        }

        else if (
            babycrying > 0.6 &&
            babycrying > firealarm &&
            babycrying > doorbell
        ) {

            Serial.println(
                "BABY CRYING DETECTED"
            );

            flagBabyCry = true;
            flagDoorbell = false;
            flagFireAlarm = false;
        }

        else {

            Serial.println(
                "STABLE CONDITION"
            );

            flagDoorbell = false;
            flagBabyCry = false;
            flagFireAlarm = false;
        }

        print_results = 0;
    }

    if (!sensorsCalibrated) {

        runSensorCalibration();

        flagGasLeak = false;
        flagFire = false;

    }
    else {

        checkGasSensors();
    }

    uint8_t localEvent = computeLocalEvent();

    if (localEvent == EVT_NORMAL ||
        localEvent < prevLocalEvent) {

        ackSuppress = EVT_NORMAL;
    }

    if (ackPending) {

        ackPending = false;

        ackSuppress = localEvent;
    }

    prevLocalEvent = localEvent;

    uint8_t shownLocal =
        (localEvent > ackSuppress) ?
        localEvent : EVT_NORMAL;

    if (globalEvent != EVT_NORMAL &&
        millis() - lastGlobalRx >
        GLOBAL_TIMEOUT_MS) {

        globalEvent = EVT_NORMAL;
    }

    uint8_t displayEvent =
        (shownLocal > globalEvent) ?
        shownLocal : globalEvent;

    updateLEDs(displayEvent);

    updateMeshReport(localEvent);
}

static void audio_inference_callback(
    uint32_t n_bytes
)
{
    for (
        int i = 0;
        i < n_bytes >> 1;
        i++
    ) {

        inference.buffers[
            inference.buf_select
        ][
            inference.buf_count++
        ] = sampleBuffer[i];

        if (
            inference.buf_count >=
            inference.n_samples
        ) {

            inference.buf_select ^= 1;

            inference.buf_count = 0;

            inference.buf_ready = 1;
        }
    }
}

static void capture_samples(
    void* arg
)
{
    const int32_t i2s_bytes_to_read =
        (uint32_t)arg;

    size_t bytes_read =
        i2s_bytes_to_read;

    while (record_status) {

        i2s_read(
            (i2s_port_t)1,
            (void*)sampleBuffer,
            i2s_bytes_to_read,
            &bytes_read,
            100
        );

        if (bytes_read <= 0) {

            ei_printf(
                "Error in I2S read : %d",
                bytes_read
            );
        }
        else {

            if (
                bytes_read <
                i2s_bytes_to_read
            ) {

                ei_printf(
                    "Partial I2S read"
                );
            }

            for (
                int x = 0;
                x < i2s_bytes_to_read / 2;
                x++
            ) {

                sampleBuffer[x] =
                    (int16_t)(
                        sampleBuffer[x]
                    ) * 8;
            }

            if (record_status) {

                audio_inference_callback(
                    i2s_bytes_to_read
                );
            }
            else {

                break;
            }
        }
    }

    vTaskDelete(NULL);
}

static bool microphone_inference_start(
    uint32_t n_samples
)
{
    inference.buffers[0] =
        (signed short *)malloc(
            n_samples *
            sizeof(signed short)
        );

    if (
        inference.buffers[0] == NULL
    ) {

        return false;
    }

    inference.buffers[1] =
        (signed short *)malloc(
            n_samples *
            sizeof(signed short)
        );

    if (
        inference.buffers[1] == NULL
    ) {

        ei_free(
            inference.buffers[0]
        );

        return false;
    }

    inference.buf_select = 0;
    inference.buf_count = 0;
    inference.n_samples = n_samples;
    inference.buf_ready = 0;

    if (
        i2s_init(
            EI_CLASSIFIER_FREQUENCY
        )
    ) {

        ei_printf(
            "Failed to start I2S!"
        );
    }

    ei_sleep(100);

    record_status = true;

    xTaskCreate(
        capture_samples,
        "CaptureSamples",
        1024 * 32,
        (void*)sample_buffer_size,
        10,
        NULL
    );

    return true;
}

static bool microphone_inference_record(
    void
)
{
    bool ret = true;

    if (
        inference.buf_ready == 1
    ) {

        ei_printf(
            "Error sample buffer overrun. "
            "Decrease the number of slices per model window "
            "(EI_CLASSIFIER_SLICES_PER_MODEL_WINDOW)\n"
        );

        ret = false;
    }

    while (
        inference.buf_ready == 0
    ) {

        delay(1);
    }

    inference.buf_ready = 0;

    return true;
}

static int microphone_audio_signal_get_data(
    size_t offset,
    size_t length,
    float *out_ptr
)
{
    numpy::int16_to_float(
        &inference.buffers[
            inference.buf_select ^ 1
        ][offset],
        out_ptr,
        length
    );

    return 0;
}

static void microphone_inference_end(
    void
)
{
    i2s_deinit();

    ei_free(
        inference.buffers[0]
    );

    ei_free(
        inference.buffers[1]
    );
}

static int i2s_init(
    uint32_t sampling_rate
)
{
    i2s_config_t i2s_config = {

        .mode =
            (i2s_mode_t)(
                I2S_MODE_MASTER |
                I2S_MODE_RX |
                I2S_MODE_TX
            ),

        .sample_rate =
            sampling_rate,

        .bits_per_sample =
            (i2s_bits_per_sample_t)16,

        .channel_format =
            I2S_CHANNEL_FMT_ONLY_LEFT,

        .communication_format =
            I2S_COMM_FORMAT_I2S,

        .intr_alloc_flags = 0,

        .dma_buf_count = 8,

        .dma_buf_len = 512,

        .use_apll = false,

        .tx_desc_auto_clear = false,

        .fixed_mclk = -1,
    };

    i2s_pin_config_t pin_config = {

        .bck_io_num = 26,

        .ws_io_num = 25,

        .data_out_num = -1,

        .data_in_num = 33,
    };

    esp_err_t ret = 0;

    ret =
        i2s_driver_install(
            (i2s_port_t)1,
            &i2s_config,
            0,
            NULL
        );

    if (ret != ESP_OK) {

        ei_printf(
            "Error in i2s_driver_install"
        );
    }

    ret =
        i2s_set_pin(
            (i2s_port_t)1,
            &pin_config
        );

    if (ret != ESP_OK) {

        ei_printf(
            "Error in i2s_set_pin"
        );
    }

    ret =
        i2s_zero_dma_buffer(
            (i2s_port_t)1
        );

    if (ret != ESP_OK) {

        ei_printf(
            "Error in initializing DMA buffer"
        );
    }

    return int(ret);
}

static int i2s_deinit(
    void
)
{
    i2s_driver_uninstall(
        (i2s_port_t)1
    );

    return 0;
}

#if !defined(EI_CLASSIFIER_SENSOR) || \
    EI_CLASSIFIER_SENSOR != EI_CLASSIFIER_SENSOR_MICROPHONE

#error "Invalid model for current sensor."

#endif