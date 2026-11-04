/*
 * ═══════════════════════════════════════════════════════════════════
 *  SHM — Structural Health Monitoring
 *  ESP32 Firmware: Dual MPU6050 + Dual SW420
 * ═══════════════════════════════════════════════════════════════════
 *
 *  WIRING:
 *  MPU6050 #1 (Building 1) → SDA=GPIO21, SCL=GPIO22, AD0=GND  (addr 0x68)
 *  MPU6050 #2 (Building 2) → SDA=GPIO21, SCL=GPIO22, AD0=3.3V (addr 0x69)
 *  SW420   #1 (Building 1) → DO=GPIO14
 *  SW420   #2 (Building 2) → DO=GPIO27
 *
 *  LIBRARIES NEEDED (Arduino Library Manager):
 *  - Adafruit MPU6050
 *  - Adafruit Unified Sensor
 *  - ArduinoJson
 * ═══════════════════════════════════════════════════════════════════
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <ArduinoJson.h>

// ── WiFi Credentials ─────────────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_NAME";       // ← change this
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";   // ← change this

// ── Backend Server ────────────────────────────────────────────────
// Use your PC's local IP (run: ipconfig on Windows, look for IPv4)
// Example: "http://192.168.1.105:5000/api/sensor-data"
const char* SERVER_URL = "http://192.168.1.105:5000/api/sensor-data";

// ── Sample Rate ───────────────────────────────────────────────────
const int SAMPLE_RATE_MS = 50;   // 20 Hz — matches simulator

// ── Pin Definitions ───────────────────────────────────────────────
#define SW420_PIN_1  14   // SW420 Building 1
#define SW420_PIN_2  27   // SW420 Building 2

// ── MPU6050 Objects ───────────────────────────────────────────────
Adafruit_MPU6050 mpu1;   // I2C address 0x68 (AD0 = GND)
Adafruit_MPU6050 mpu2;   // I2C address 0x69 (AD0 = 3.3V)

// ── SW420 Interrupt Counters (volatile because ISR) ───────────────
volatile int sw420Count1 = 0;
volatile int sw420Count2 = 0;

// Interrupt Service Routines — called every time SW420 triggers
void IRAM_ATTR onVib1() { sw420Count1++; }
void IRAM_ATTR onVib2() { sw420Count2++; }

// ─────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n═══════════════════════════════════════════");
  Serial.println("  SHM — Dual MPU6050 + SW420 Firmware");
  Serial.println("═══════════════════════════════════════════");

  // ── I2C Init ────────────────────────────────────────────────────
  Wire.begin(21, 22);   // SDA=21, SCL=22 (ESP32 defaults)

  // ── MPU6050 #1 (0x68) ───────────────────────────────────────────
  if (!mpu1.begin(0x68)) {
    Serial.println("MPU6050 #1 (0x68) not found! Check wiring.");
    while (1) delay(100);
  }
  mpu1.setAccelerometerRange(MPU6050_RANGE_2_G);
  mpu1.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu1.setFilterBandwidth(MPU6050_BAND_21_HZ);
  Serial.println("MPU6050 #1 (0x68) OK");

  // ── MPU6050 #2 (0x69) ───────────────────────────────────────────
  if (!mpu2.begin(0x69)) {
    Serial.println("MPU6050 #2 (0x69) not found! Check AD0 pin → 3.3V.");
    while (1) delay(100);
  }
  mpu2.setAccelerometerRange(MPU6050_RANGE_2_G);
  mpu2.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu2.setFilterBandwidth(MPU6050_BAND_21_HZ);
  Serial.println("MPU6050 #2 (0x69) OK");

  // ── SW420 Pins with Interrupts ───────────────────────────────────
  pinMode(SW420_PIN_1, INPUT);
  pinMode(SW420_PIN_2, INPUT);
  attachInterrupt(digitalPinToInterrupt(SW420_PIN_1), onVib1, CHANGE);
  attachInterrupt(digitalPinToInterrupt(SW420_PIN_2), onVib2, CHANGE);
  Serial.println("SW420 interrupts attached");

  // ── WiFi Connection ──────────────────────────────────────────────
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (++attempts > 30) {
      Serial.println("\n WiFi failed. Restarting...");
      ESP.restart();
    }
  }
  Serial.println("\n WiFi connected!");
  Serial.print("   IP Address: ");
  Serial.println(WiFi.localIP());
  Serial.print("   Sending to: ");
  Serial.println(SERVER_URL);
  Serial.println("═══════════════════════════════════════════\n");
}

// ─────────────────────────────────────────────────────────────────
void loop() {
  unsigned long startMs = millis();

  // ── Read MPU6050 #1 ─────────────────────────────────────────────
  sensors_event_t a1, g1, t1;
  mpu1.getEvent(&a1, &g1, &t1);

  // ── Read MPU6050 #2 ─────────────────────────────────────────────
  sensors_event_t a2, g2, t2;
  mpu2.getEvent(&a2, &g2, &t2);

  // ── Read SW420 digital state ─────────────────────────────────────
  int sw1_state = digitalRead(SW420_PIN_1);  // 0 or 1
  int sw2_state = digitalRead(SW420_PIN_2);  // 0 or 1

  // ── Snapshot + reset interrupt counters atomically ───────────────
  noInterrupts();
  int count1 = sw420Count1; sw420Count1 = 0;
  int count2 = sw420Count2; sw420Count2 = 0;
  interrupts();

  // ── Build JSON Payload ───────────────────────────────────────────
  // Accelerometer: m/s² → divide by 9.81 to convert to g-force
  StaticJsonDocument<512> doc;

  // MPU6050 #1 (Building 1 — Unprotected)
  doc["accel_x_1"] = roundf(a1.acceleration.x / 9.81 * 10000) / 10000.0;
  doc["accel_y_1"] = roundf(a1.acceleration.y / 9.81 * 10000) / 10000.0;
  doc["accel_z_1"] = roundf(a1.acceleration.z / 9.81 * 10000) / 10000.0;
  doc["gyro_x_1"]  = roundf(g1.gyro.x * 10000) / 10000.0;   // already in rad/s → convert if needed
  doc["gyro_y_1"]  = roundf(g1.gyro.y * 10000) / 10000.0;
  doc["gyro_z_1"]  = roundf(g1.gyro.z * 10000) / 10000.0;
  doc["temp_1"]    = roundf(t1.temperature * 100) / 100.0;

  // MPU6050 #2 (Building 2 — Resistant)
  doc["accel_x_2"] = roundf(a2.acceleration.x / 9.81 * 10000) / 10000.0;
  doc["accel_y_2"] = roundf(a2.acceleration.y / 9.81 * 10000) / 10000.0;
  doc["accel_z_2"] = roundf(a2.acceleration.z / 9.81 * 10000) / 10000.0;
  doc["gyro_x_2"]  = roundf(g2.gyro.x * 10000) / 10000.0;
  doc["gyro_y_2"]  = roundf(g2.gyro.y * 10000) / 10000.0;
  doc["gyro_z_2"]  = roundf(g2.gyro.z * 10000) / 10000.0;
  doc["temp_2"]    = roundf(t2.temperature * 100) / 100.0;

  // SW420 (Building 1 & 2)
  doc["sw420_1"]     = sw1_state;
  doc["sw420_2"]     = sw2_state;
  doc["vib_count_1"] = count1;
  doc["vib_count_2"] = count2;

  // ── Serialize to string ──────────────────────────────────────────
  String payload;
  serializeJson(doc, payload);

  // ── HTTP POST to backend ─────────────────────────────────────────
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(SERVER_URL);
    http.addHeader("Content-Type", "application/json");

    int httpCode = http.POST(payload);

    if (httpCode == 201) {
      Serial.printf("[OK] SW1=%d(%d) SW2=%d(%d) | ax1=%.3f ax2=%.3f | T1=%.1f T2=%.1f\n",
        sw1_state, count1, sw2_state, count2,
        doc["accel_x_1"].as<float>(),
        doc["accel_x_2"].as<float>(),
        doc["temp_1"].as<float>(),
        doc["temp_2"].as<float>()
      );
    } else {
      Serial.printf("[ERR] HTTP %d — %s\n", httpCode, http.errorToString(httpCode).c_str());
    }
    http.end();
  } else {
    Serial.println("[WARN] WiFi disconnected, reconnecting...");
    WiFi.reconnect();
  }

  // ── Maintain precise 50ms sample rate ────────────────────────────
  long elapsed = millis() - startMs;
  if (elapsed < SAMPLE_RATE_MS) {
    delay(SAMPLE_RATE_MS - elapsed);
  }
}
