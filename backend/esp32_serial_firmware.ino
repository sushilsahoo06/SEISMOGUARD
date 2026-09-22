/*
 * ═══════════════════════════════════════════════════════════════════
 *  SHM — Structural Health Monitoring
 *  ESP32 Firmware: USB Serial Mode (No WiFi needed)
 *  Dual MPU6050 + Dual SW420
 * ═══════════════════════════════════════════════════════════════════
 *
 *  HOW IT WORKS:
 *  ESP32 → USB Cable → PC COM port → serial_reader.js → Backend
 *
 *  WIRING (same as before):
 *  MPU6050 #1 → SDA=GPIO21, SCL=GPIO22, AD0=GND  (addr 0x68)
 *  MPU6050 #2 → SDA=GPIO21, SCL=GPIO22, AD0=3.3V (addr 0x69)
 *  SW420   #1 → DO=GPIO14
 *  SW420   #2 → DO=GPIO27
 *
 *  LIBRARIES (Arduino Library Manager):
 *  - Adafruit MPU6050
 *  - Adafruit Unified Sensor
 *  - ArduinoJson
 * ═══════════════════════════════════════════════════════════════════
 */

#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <ArduinoJson.h>

// ── Sample Rate ───────────────────────────────────────────────────
const int SAMPLE_RATE_MS = 50;   // 20 Hz

// ── Pin Definitions ───────────────────────────────────────────────
#define SW420_PIN_1  14
#define SW420_PIN_2  27

// ── MPU6050 Objects ───────────────────────────────────────────────
Adafruit_MPU6050 mpu1;  // 0x68 (AD0 = GND)
Adafruit_MPU6050 mpu2;  // 0x69 (AD0 = 3.3V)

// ── SW420 Interrupt Counters ──────────────────────────────────────
volatile int sw420Count1 = 0;
volatile int sw420Count2 = 0;

void IRAM_ATTR onVib1() { sw420Count1++; }
void IRAM_ATTR onVib2() { sw420Count2++; }

// ─────────────────────────────────────────────────────────────────
void setup() {
  // 115200 baud — must match serial_reader.js
  Serial.begin(115200);
  delay(500);

  Wire.begin(21, 22);

  // MPU6050 #1
  if (!mpu1.begin(0x68)) {
    Serial.println("{\"error\":\"MPU6050 #1 not found\"}");
    while (1) delay(100);
  }
  mpu1.setAccelerometerRange(MPU6050_RANGE_2_G);
  mpu1.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu1.setFilterBandwidth(MPU6050_BAND_21_HZ);

  // MPU6050 #2
  if (!mpu2.begin(0x69)) {
    Serial.println("{\"error\":\"MPU6050 #2 not found — check AD0 pin to 3.3V\"}");
    while (1) delay(100);
  }
  mpu2.setAccelerometerRange(MPU6050_RANGE_2_G);
  mpu2.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu2.setFilterBandwidth(MPU6050_BAND_21_HZ);

  // SW420 interrupts
  pinMode(SW420_PIN_1, INPUT);
  pinMode(SW420_PIN_2, INPUT);
  attachInterrupt(digitalPinToInterrupt(SW420_PIN_1), onVib1, CHANGE);
  attachInterrupt(digitalPinToInterrupt(SW420_PIN_2), onVib2, CHANGE);

  // Ready signal (serial_reader.js waits for this)
  Serial.println("{\"status\":\"ready\"}");
}

// ─────────────────────────────────────────────────────────────────
void loop() {
  unsigned long startMs = millis();

  // Read MPU6050 #1
  sensors_event_t a1, g1, t1;
  mpu1.getEvent(&a1, &g1, &t1);

  // Read MPU6050 #2
  sensors_event_t a2, g2, t2;
  mpu2.getEvent(&a2, &g2, &t2);

  // Read SW420 states
  int sw1 = digitalRead(SW420_PIN_1);
  int sw2 = digitalRead(SW420_PIN_2);

  // Snapshot + reset interrupt counters atomically
  noInterrupts();
  int cnt1 = sw420Count1; sw420Count1 = 0;
  int cnt2 = sw420Count2; sw420Count2 = 0;
  interrupts();

  // Build JSON (compact, single line — one line per reading)
  StaticJsonDocument<512> doc;

  // MPU6050 #1 — convert m/s² to g (divide by 9.81)
  doc["accel_x_1"] = roundf(a1.acceleration.x / 9.81 * 10000) / 10000.0;
  doc["accel_y_1"] = roundf(a1.acceleration.y / 9.81 * 10000) / 10000.0;
  doc["accel_z_1"] = roundf(a1.acceleration.z / 9.81 * 10000) / 10000.0;
  doc["gyro_x_1"]  = roundf(g1.gyro.x * 10000) / 10000.0;
  doc["gyro_y_1"]  = roundf(g1.gyro.y * 10000) / 10000.0;
  doc["gyro_z_1"]  = roundf(g1.gyro.z * 10000) / 10000.0;
  doc["temp_1"]    = roundf(t1.temperature * 100) / 100.0;

  // MPU6050 #2
  doc["accel_x_2"] = roundf(a2.acceleration.x / 9.81 * 10000) / 10000.0;
  doc["accel_y_2"] = roundf(a2.acceleration.y / 9.81 * 10000) / 10000.0;
  doc["accel_z_2"] = roundf(a2.acceleration.z / 9.81 * 10000) / 10000.0;
  doc["gyro_x_2"]  = roundf(g2.gyro.x * 10000) / 10000.0;
  doc["gyro_y_2"]  = roundf(g2.gyro.y * 10000) / 10000.0;
  doc["gyro_z_2"]  = roundf(g2.gyro.z * 10000) / 10000.0;
  doc["temp_2"]    = roundf(t2.temperature * 100) / 100.0;

  // SW420
  doc["sw420_1"]     = sw1;
  doc["sw420_2"]     = sw2;
  doc["vib_count_1"] = cnt1;
  doc["vib_count_2"] = cnt2;

  // Print ONE compact JSON line — serial_reader.js parses line-by-line
  serializeJson(doc, Serial);
  Serial.println(); // newline = end of packet

  // Maintain 50ms rate
  long elapsed = millis() - startMs;
  if (elapsed < SAMPLE_RATE_MS) delay(SAMPLE_RATE_MS - elapsed);
}
