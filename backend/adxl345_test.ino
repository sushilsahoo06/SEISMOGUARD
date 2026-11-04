/*
 * ═══════════════════════════════════════════════════════════════════
 *  ADXL345 Accelerometer + SW-420 Vibration — Diagnostic Test Sketch
 * ═══════════════════════════════════════════════════════════════════
 *
 *  WIRING:
 *    • ADXL345 VCC ➔ ESP32 3.3V
 *    • ADXL345 GND ➔ ESP32 GND
 *    • ADXL345 CS  ➔ ESP32 3.3V  (CRITICAL: enables I2C mode!)
 *    • ADXL345 SCL ➔ ESP32 GPIO 22 (labeled D22 or 22)
 *    • ADXL345 SDA ➔ ESP32 GPIO 21 (labeled D21 or 21)
 *    • ADXL345 SDO ➔ ESP32 GND (sets address to 0x53)
 *                    (For a 2nd sensor: SDO -> 3.3V sets address to 0x1D)
 *
 *    • SW-420 #1   ➔ DO to GPIO 14
 *    • SW-420 #2   ➔ DO to GPIO 27
 * ═══════════════════════════════════════════════════════════════════
 */

#include <Wire.h>

#define I2C_SDA      21
#define I2C_SCL      22
#define SW420_PIN_1  14
#define SW420_PIN_2  27

// ADXL345 Register Addresses
#define ADXL345_ADDR_1      0x53 // SDO to GND (Building 1)
#define ADXL345_ADDR_2      0x1D // SDO to 3.3V (Building 2, optional)
#define REG_POWER_CTL       0x2D
#define REG_DATA_FORMAT     0x31
#define REG_DATAX0          0x32

bool has_adxl1 = false;
bool has_adxl2 = false;

volatile int count1 = 0;
volatile int count2 = 0;

void IRAM_ATTR onVib1() { count1++; }
void IRAM_ATTR onVib2() { count2++; }

// Initialize ADXL345 over raw I2C (no external libraries needed!)
bool initADXL345(uint8_t addr) {
  Wire.beginTransmission(addr);
  if (Wire.endTransmission() != 0) return false;

  // Set measure mode
  Wire.beginTransmission(addr);
  Wire.write(REG_POWER_CTL);
  Wire.write(0x08); // Measurement mode
  Wire.endTransmission();

  // Set ±16g range, full resolution (3.9 mg / LSB)
  Wire.beginTransmission(addr);
  Wire.write(REG_DATA_FORMAT);
  Wire.write(0x0B); // Full res, ±16g
  Wire.endTransmission();

  return true;
}

// Read acceleration in g-force
bool readADXL345(uint8_t addr, float &ax, float &ay, float &az) {
  Wire.beginTransmission(addr);
  Wire.write(REG_DATAX0);
  if (Wire.endTransmission(false) != 0) return false;

  if (Wire.requestFrom(addr, (uint8_t)6) != 6) return false;

  int16_t rawX = Wire.read() | (Wire.read() << 8);
  int16_t rawY = Wire.read() | (Wire.read() << 8);
  int16_t rawZ = Wire.read() | (Wire.read() << 8);

  // In full resolution mode, scale factor is 3.9 mg/LSB (0.0039 g/LSB)
  ax = rawX * 0.0039f;
  ay = rawY * 0.0039f;
  az = rawZ * 0.0039f;
  return true;
}

void scanI2C() {
  Serial.println("==================================================");
  Serial.printf("🔍 Scanning I2C Bus on SDA: %d, SCL: %d...\n", I2C_SDA, I2C_SCL);
  Serial.println("==================================================");
  byte count = 0;
  for (byte i = 1; i < 127; i++) {
    Wire.beginTransmission(i);
    if (Wire.endTransmission() == 0) {
      Serial.printf("  ✔ Found I2C device at: 0x%02X", i);
      if (i == 0x53) Serial.print("  <-- ADXL345 #1 (SDO -> GND)");
      if (i == 0x1D) Serial.print("  <-- ADXL345 #2 (SDO -> 3.3V)");
      Serial.println();
      count++;
    }
  }
  if (count == 0) {
    Serial.println("  ❌ NO I2C DEVICES FOUND!");
    Serial.println("  1. Check VCC (3.3V) and GND.");
    Serial.println("  2. Did you connect ADXL345 CS to 3.3V? (REQUIRED for I2C!)");
    Serial.println("  3. Check SDA (GPIO 21) and SCL (GPIO 22).");
  }
  Serial.println("==================================================\n");
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\n##################################################");
  Serial.println("    ADXL345 + SW-420 HARDWARE TEST MONITOR");
  Serial.println("    (No Gyroscope / No Temperature Needed)");
  Serial.println("##################################################\n");

  Wire.begin(I2C_SDA, I2C_SCL);
  scanI2C();

  // Init ADXL345 #1
  if (initADXL345(ADXL345_ADDR_1)) {
    has_adxl1 = true;
    Serial.println("✅ ADXL345 #1 (0x53) Initialized [OK]");
  } else {
    Serial.println("⚠️ ADXL345 #1 (0x53) not detected.");
  }

  // Init ADXL345 #2 (optional)
  if (initADXL345(ADXL345_ADDR_2)) {
    has_adxl2 = true;
    Serial.println("✅ ADXL345 #2 (0x1D) Initialized [OK]");
  } else {
    Serial.println("ℹ️ ADXL345 #2 (0x1D) not connected (Normal if testing with 1 sensor).");
  }

  // SW-420 Pins
  pinMode(SW420_PIN_1, INPUT);
  pinMode(SW420_PIN_2, INPUT);
  attachInterrupt(digitalPinToInterrupt(SW420_PIN_1), onVib1, CHANGE);
  attachInterrupt(digitalPinToInterrupt(SW420_PIN_2), onVib2, CHANGE);
  Serial.println("✅ SW-420 interrupts attached on GPIO 14 and 27.");

  Serial.println("\nBeginning live readings in 2 seconds...");
  delay(2000);
}

void loop() {
  // If sensor not yet found, retry scanning every 3s
  if (!has_adxl1 && !has_adxl2) {
    Serial.println("Waiting for ADXL345... (Check wiring and CS -> 3.3V)");
    delay(3000);
    scanI2C();
    if (initADXL345(ADXL345_ADDR_1)) has_adxl1 = true;
    if (initADXL345(ADXL345_ADDR_2)) has_adxl2 = true;
    return;
  }

  // Read SW-420
  int sw1 = digitalRead(SW420_PIN_1);
  int sw2 = digitalRead(SW420_PIN_2);

  noInterrupts();
  int p1 = count1;
  int p2 = count2;
  interrupts();

  Serial.println("----------------------------------------------------------------------");

  // Read Sensor 1
  if (has_adxl1) {
    float ax, ay, az;
    if (readADXL345(ADXL345_ADDR_1, ax, ay, az)) {
      float mag = sqrt(ax * ax + ay * ay + az * az);
      float pitch = atan2(-ax, sqrt(ay * ay + az * az)) * 180.0f / 3.14159f;
      float roll  = atan2(ay, az) * 180.0f / 3.14159f;
      Serial.printf("[ADXL345 #1 (0x53)] X=%+6.3fg  Y=%+6.3fg  Z=%+6.3fg | Mag=%5.2fg | Pitch=%+5.1f° Roll=%+5.1f°\n",
                    ax, ay, az, mag, pitch, roll);
    }
  }

  // Read Sensor 2
  if (has_adxl2) {
    float ax2, ay2, az2;
    if (readADXL345(ADXL345_ADDR_2, ax2, ay2, az2)) {
      float mag2 = sqrt(ax2 * ax2 + ay2 * ay2 + az2 * az2);
      Serial.printf("[ADXL345 #2 (0x1D)] X=%+6.3fg  Y=%+6.3fg  Z=%+6.3fg | Mag=%5.2fg\n",
                    ax2, ay2, az2, mag2);
    }
  }

  Serial.printf("[SW-420 Sensors]    SW1=%s (%d pulses) | SW2=%s (%d pulses)\n",
                sw1 ? "VIB 🔴" : "IDLE ⚪", p1,
                sw2 ? "VIB 🔴" : "IDLE ⚪", p2);

  delay(300);
}
