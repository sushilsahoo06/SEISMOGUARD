/*
 * ═══════════════════════════════════════════════════════════════════
 *  SHM — Structural Health Monitoring
 *  ESP32 Firmware: ADXL345 Accelerometer + SW-420 Vibration (USB Serial)
 *  (No Gyroscope / No Temperature Sensor Required)
 * ═══════════════════════════════════════════════════════════════════
 *
 *  WIRING:
 *  ► ADXL345 #1 (Building 1 - Default):
 *      VCC ➔ ESP32 3.3V
 *      GND ➔ ESP32 GND
 *      CS  ➔ ESP32 3.3V  (IMPORTANT: Enables I2C mode!)
 *      SCL ➔ ESP32 GPIO 22
 *      SDA ➔ ESP32 GPIO 21
 *      SDO ➔ ESP32 GND   (Address 0x53)
 *
 *  ► ADXL345 #2 (Building 2 - Optional):
 *      Same as #1, but SDO ➔ ESP32 3.3V (Address 0x1D)
 *
 *  ► SW-420 Sensors:
 *      SW-420 #1 DO ➔ GPIO 14
 *      SW-420 #2 DO ➔ GPIO 27
 *
 *  LIBRARY REQUIRED (in Arduino Library Manager):
 *    - ArduinoJson (by Benoit Blanchon)
 * ═══════════════════════════════════════════════════════════════════
 */

#include <Wire.h>
#include <ArduinoJson.h>

// ── Sample rate (20 Hz = 50ms) ─────────────────────────────────────
const int SAMPLE_RATE_MS = 50;

// ── Pin & Address definitions ──────────────────────────────────────
#define I2C_SDA          21
#define I2C_SCL          22
#define SW420_PIN_1      14
#define SW420_PIN_2      27

#define ADXL345_ADDR_1   0x53 // SDO to GND (Building 1)
#define ADXL345_ADDR_2   0x1D // SDO to 3.3V (Building 2, optional)

#define REG_POWER_CTL    0x2D
#define REG_DATA_FORMAT  0x31
#define REG_DATAX0       0x32

bool has_adxl1 = false;
bool has_adxl2 = false;

// ── SW420 interrupt counters ──────────────────────────────────────
volatile int sw420Count1 = 0;
volatile int sw420Count2 = 0;

void IRAM_ATTR onVib1() { sw420Count1++; }
void IRAM_ATTR onVib2() { sw420Count2++; }

// ── Initialize ADXL345 via direct I2C ──────────────────────────────
bool initADXL345(uint8_t addr) {
  Wire.beginTransmission(addr);
  if (Wire.endTransmission() != 0) return false;

  // Measurement mode
  Wire.beginTransmission(addr);
  Wire.write(REG_POWER_CTL);
  Wire.write(0x08);
  Wire.endTransmission();

  // ±16g range, full resolution (0.0039g / LSB)
  Wire.beginTransmission(addr);
  Wire.write(REG_DATA_FORMAT);
  Wire.write(0x0B);
  Wire.endTransmission();

  return true;
}

// ── Read Acceleration (g) ─────────────────────────────────────────
bool readAccel(uint8_t addr, float &ax, float &ay, float &az) {
  Wire.beginTransmission(addr);
  Wire.write(REG_DATAX0);
  if (Wire.endTransmission(false) != 0) return false;

  if (Wire.requestFrom(addr, (uint8_t)6) != 6) return false;

  int16_t rawX = Wire.read() | (Wire.read() << 8);
  int16_t rawY = Wire.read() | (Wire.read() << 8);
  int16_t rawZ = Wire.read() | (Wire.read() << 8);

  ax = roundf(rawX * 0.0039f * 10000.0f) / 10000.0f;
  ay = roundf(rawY * 0.0039f * 10000.0f) / 10000.0f;
  az = roundf(rawZ * 0.0039f * 10000.0f) / 10000.0f;
  return true;
}

// ─────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n═══════════════════════════════════════════");
  Serial.println("  SHM — ADXL345 + SW-420 USB Firmware");
  Serial.println("  Mode: USB Serial Cable (115200 baud)");
  Serial.println("═══════════════════════════════════════════");

  Wire.begin(I2C_SDA, I2C_SCL);

  // Initialize Sensor #1
  if (initADXL345(ADXL345_ADDR_1)) {
    has_adxl1 = true;
    Serial.println("OK: ADXL345 #1 (0x53) connected.");
  } else {
    Serial.println("WARN: ADXL345 #1 (0x53) not found! Check wiring and CS -> 3.3V");
  }

  // Initialize Sensor #2 (Optional)
  if (initADXL345(ADXL345_ADDR_2)) {
    has_adxl2 = true;
    Serial.println("OK: ADXL345 #2 (0x1D) connected.");
  }

  // SW420 Interrupts
  pinMode(SW420_PIN_1, INPUT);
  pinMode(SW420_PIN_2, INPUT);
  attachInterrupt(digitalPinToInterrupt(SW420_PIN_1), onVib1, CHANGE);
  attachInterrupt(digitalPinToInterrupt(SW420_PIN_2), onVib2, CHANGE);
  Serial.println("OK: SW420 vibration interrupts attached.");

  Serial.println("OK: USB Serial ready — run: node serial_reader.js");
  Serial.println("{\"status\":\"ready\"}");
  Serial.println("═══════════════════════════════════════════\n");
}

// ─────────────────────────────────────────────────────────────────
void loop() {
  unsigned long startMs = millis();

  float ax1 = 0, ay1 = 0, az1 = 1.0;
  float ax2 = 0, ay2 = 0, az2 = 1.0;

  if (has_adxl1) {
    readAccel(ADXL345_ADDR_1, ax1, ay1, az1);
  }
  if (has_adxl2) {
    readAccel(ADXL345_ADDR_2, ax2, ay2, az2);
  }

  // Read SW-420 vibration switches
  int sw1 = digitalRead(SW420_PIN_1);
  int sw2 = digitalRead(SW420_PIN_2);

  noInterrupts();
  int cnt1 = sw420Count1; sw420Count1 = 0;
  int cnt2 = sw420Count2; sw420Count2 = 0;
  interrupts();

  // ── Build Clean JSON (Acceleration + Vibration only) ─────────────
  StaticJsonDocument<384> doc;

  // Building 1 (Sensor #1)
  doc["accel_x_1"]   = ax1;
  doc["accel_y_1"]   = ay1;
  doc["accel_z_1"]   = az1;

  // Building 2 (Sensor #2)
  doc["accel_x_2"]   = ax2;
  doc["accel_y_2"]   = ay2;
  doc["accel_z_2"]   = az2;

  // SW-420 Vibration
  doc["sw420_1"]     = sw1;
  doc["sw420_2"]     = sw2;
  doc["vib_count_1"] = cnt1;
  doc["vib_count_2"] = cnt2;

  // ── Stream JSON over USB Cable ───────────────────────────────────
  serializeJson(doc, Serial);
  Serial.println(); // newline indicates complete packet

  // ── Maintain 50ms (20 Hz) sample rate ────────────────────────────
  long elapsed = millis() - startMs;
  if (elapsed < SAMPLE_RATE_MS) delay(SAMPLE_RATE_MS - elapsed);
}
