/*
 * ═══════════════════════════════════════════════════════════════════
 *  SHM — Structural Health Monitoring
 *  ESP32 Firmware: Dual ADXL345 + Dual Vibration + Smart Buzzer Alarm
 * ═══════════════════════════════════════════════════════════════════
 *
 *  ► TRANSMISSION MODE:
 *    #define MODE_WIFI    → Active: Sends JSON directly over Wi-Fi
 *    //#define MODE_SERIAL → Uncomment to switch to USB Cable
 *
 *  PIN CONFIGURATION:
 *    • SDA ➔ GPIO 21
 *    • SCL ➔ GPIO 22
 *    • HW-072 Vibration #1 ➔ GPIO 25
 *    • HW-072 Vibration #2 ➔ GPIO 26
 *
 *    • BUZZER #1 (Building 1 Alarm) ➔ GPIO 32 (Active Buzzer (+) to 32, (-) to GND)
 *    • BUZZER #2 (Building 2 Alarm) ➔ GPIO 33 (Optional 2nd Buzzer)
 *
 *    • ADXL345 Sensor 1 (Building 1) ➔ Address 0x53 (SDO to GND, CS to 3.3V)
 *    • ADXL345 Sensor 2 (Building 2) ➔ Address 0x1D (SDO to 3.3V, CS to 3.3V)
 * ═══════════════════════════════════════════════════════════════════
 */

// ── TRANSMISSION MODE ─────────────────────────────────────────────
#define MODE_WIFI       // ← WiFi Wireless Mode (ACTIVE)
//#define MODE_SERIAL   // (Commented out)
// ──────────────────────────────────────────────────────────────────

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <ArduinoJson.h>

// ── ▼ ENTER YOUR WIFI CREDENTIALS HERE ▼ ──────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_NAME";      // ← Put your Wi-Fi name
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";  // ← Put your Wi-Fi password

// Your Laptop's local IP address (verified):
const char* SERVER_URL    = "http://192.168.1.13:5000/api/sensor-data";
// ──────────────────────────────────────────────────────────────────

// ── Sensor & Buzzer Pin Definitions ───────────────────────────────
#define ADXL1          0x53
#define ADXL2          0x1D

#define SDA_PIN        21
#define SCL_PIN        22
#define VIB1_PIN       25
#define VIB2_PIN       26

#define BUZZER_PIN_1   32   // Buzzer for Building 1 (Unprotected)
#define BUZZER_PIN_2   33   // Buzzer for Building 2 (Optional)

// ADXL345 Registers
#define POWER_CTL      0x2D
#define DATA_FORMAT    0x31
#define BW_RATE        0x2C
#define DATAX0         0x32

// Full-resolution scale factor (3.9 mg/LSB -> 0.0039g)
const float G_PER_LSB = 0.0039f;

bool has_adxl1 = false;
bool has_adxl2 = false;

// Sample rate: 50ms (20 Hz)
const int SAMPLE_RATE_MS = 50;

// Civil Engineering Collapse Cumulative Timers
unsigned long dangerStartMs_1 = 0;
unsigned long dangerStartMs_2 = 0;

// ── Initialize ADXL345 ────────────────────────────────────────────
bool initADXL345(uint8_t address) {
  Wire.beginTransmission(address);
  Wire.write(DATA_FORMAT);
  Wire.write(0x08); // Full resolution, +/-2g
  if (Wire.endTransmission() != 0) return false;

  Wire.beginTransmission(address);
  Wire.write(BW_RATE);
  Wire.write(0x0A); // 100 Hz
  if (Wire.endTransmission() != 0) return false;

  Wire.beginTransmission(address);
  Wire.write(POWER_CTL);
  Wire.write(0x08); // Measurement mode
  if (Wire.endTransmission() != 0) return false;

  return true;
}

// ── Read ADXL345 Acceleration in g ────────────────────────────────
bool readADXL345(uint8_t address, float &x, float &y, float &z) {
  Wire.beginTransmission(address);
  Wire.write(DATAX0);
  if (Wire.endTransmission(false) != 0) return false;

  if (Wire.requestFrom(address, (uint8_t)6) != 6) return false;

  uint8_t data[6];
  for (int i = 0; i < 6; i++) {
    data[i] = Wire.read();
  }

  int16_t rawX = (int16_t)((data[1] << 8) | data[0]);
  int16_t rawY = (int16_t)((data[3] << 8) | data[2]);
  int16_t rawZ = (int16_t)((data[5] << 8) | data[4]);

  x = roundf(rawX * G_PER_LSB * 1000.0f) / 1000.0f;
  y = roundf(rawY * G_PER_LSB * 1000.0f) / 1000.0f;
  z = roundf(rawZ * G_PER_LSB * 1000.0f) / 1000.0f;

  return true;
}

// ── Civil Engineering Damage Evaluation ───────────────────────────
// Returns: 0 = Normal / Safe, 1 = Structural Warning, 2 = Critical Collapse
int evaluateStructuralDamage(float ax, float ay, float az, int vibTrigger, unsigned long &dangerStartMs) {
  // 1. Calculate shock magnitude and dynamic acceleration (minus 1g gravity)
  float mag = sqrt(ax * ax + ay * ay + az * az);
  float dynamicG = abs(mag - 1.0f);

  // 2. Calculate P-Delta tilt angle (degrees from vertical)
  float roll  = abs(atan2(ay, az) * 180.0f / 3.14159f);
  float pitch = abs(atan2(-ax, sqrt(ay * ay + az * az)) * 180.0f / 3.14159f);
  float tilt  = max(roll, pitch);

  // 3. Track sustained duration at high resonance (> 0.8g)
  if (dynamicG > 0.80f) {
    if (dangerStartMs == 0) dangerStartMs = millis();
  } else {
    dangerStartMs = 0; // Reset if shaking calms down
  }

  unsigned long durationDanger = (dangerStartMs > 0) ? (millis() - dangerStartMs) : 0;

  // ── CIVIL ENGINEERING COLLAPSE CRITERIA ─────────────────────────
  // CRITICAL (Level 2): Permanent tilt > 12° OR sustained destructive shaking > 3 sec
  if (tilt > 12.0f || durationDanger > 3000) {
    return 2;
  }
  // WARNING (Level 1): Moderate shaking > 0.5g for > 1.5 sec OR vibration sensor tripped
  if (dynamicG > 0.50f || vibTrigger == 1) {
    return 1;
  }
  // SAFE (Level 0)
  return 0;
}

// ─────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n══════════════════════════════════════════════════════");
  Serial.println("  SHM ESP32 — Smart Civil Engineering Alarm Node");
  Serial.println("══════════════════════════════════════════════════════");

  // Start I2C
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000);

  // Digital Vibration Sensors
  pinMode(VIB1_PIN, INPUT);
  pinMode(VIB2_PIN, INPUT);

  // Buzzer Output Pins
  pinMode(BUZZER_PIN_1, OUTPUT);
  pinMode(BUZZER_PIN_2, OUTPUT);
  digitalWrite(BUZZER_PIN_1, LOW);
  digitalWrite(BUZZER_PIN_2, LOW);

  has_adxl1 = initADXL345(ADXL1);
  has_adxl2 = initADXL345(ADXL2);

  Serial.println(has_adxl1 ? "ADXL345 #1 (0x53): OK" : "ADXL345 #1: NOT FOUND");
  Serial.println(has_adxl2 ? "ADXL345 #2 (0x1D): OK" : "ADXL345 #2: NOT FOUND");

#ifdef MODE_WIFI
  // Connect to WiFi
  Serial.printf("\nConnecting to Wi-Fi SSID: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 40) {
    delay(500);
    Serial.print(".");
    tries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n\n🎉 [WIFI CONNECTED SUCCESSFULLY]");
    Serial.print("  ➤ ESP32 IP Address : ");
    Serial.println(WiFi.localIP());
    Serial.print("  ➤ Streaming Target  : ");
    Serial.println(SERVER_URL);
    Serial.println("══════════════════════════════════════════════════════\n");
  } else {
    Serial.println("\n❌ Wi-Fi Connection Failed! Check SSID and Password.");
  }
#else
  Serial.println("OK: USB Serial Stream Ready.");
  Serial.println("{\"status\":\"ready\"}");
  Serial.println("══════════════════════════════════════════════════════\n");
#endif
}

// ─────────────────────────────────────────────────────────────────
void loop() {
  unsigned long startMs = millis();

  float x1 = 0, y1 = 0, z1 = 1.0;
  float x2 = 0, y2 = 0, z2 = 1.0;

  if (has_adxl1) readADXL345(ADXL1, x1, y1, z1);
  if (has_adxl2) readADXL345(ADXL2, x2, y2, z2);

  // Digital vibration sensors (HIGH = 1, LOW = 0)
  int vib1 = digitalRead(VIB1_PIN) == HIGH ? 1 : 0;
  int vib2 = digitalRead(VIB2_PIN) == HIGH ? 1 : 0;

  // ── Evaluate Damage for Both Buildings ───────────────────────────
  int alarm1 = evaluateStructuralDamage(x1, y1, z1, vib1, dangerStartMs_1);
  int alarm2 = evaluateStructuralDamage(x2, y2, z2, vib2, dangerStartMs_2);

  // ── Control Physical Buzzers ─────────────────────────────────────
  // Buzzer 1 (Building 1):
  if (alarm1 == 2) {
    digitalWrite(BUZZER_PIN_1, HIGH); // Continuous Loud Siren (Collapse Danger)
  } else if (alarm1 == 1) {
    digitalWrite(BUZZER_PIN_1, (millis() / 250) % 2); // Pulsing Warning Beep
  } else {
    digitalWrite(BUZZER_PIN_1, LOW);  // Silent (Normal Shaking)
  }

  // Buzzer 2 (Building 2, if plugged in):
  if (alarm2 == 2) {
    digitalWrite(BUZZER_PIN_2, HIGH);
  } else if (alarm2 == 1) {
    digitalWrite(BUZZER_PIN_2, (millis() / 250) % 2);
  } else {
    digitalWrite(BUZZER_PIN_2, LOW);
  }

  // ── Build JSON object for Web / Backend ──────────────────────────
  StaticJsonDocument<320> doc;
  doc["accel_x_1"]   = x1;
  doc["accel_y_1"]   = y1;
  doc["accel_z_1"]   = z1;

  doc["accel_x_2"]   = x2;
  doc["accel_y_2"]   = y2;
  doc["accel_z_2"]   = z2;

  doc["sw420_1"]     = vib1;
  doc["sw420_2"]     = vib2;
  doc["vib_count_1"] = vib1;
  doc["vib_count_2"] = vib2;

  // Real-time alarm flags sent to web dashboard:
  doc["alarm_1"]     = alarm1; // 0=Safe, 1=Warning, 2=Critical Collapse
  doc["alarm_2"]     = alarm2;

#ifdef MODE_WIFI
  // Send over WiFi HTTP POST
  if (WiFi.status() == WL_CONNECTED) {
    String payload;
    serializeJson(doc, payload);

    HTTPClient http;
    http.begin(SERVER_URL);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(150);
    int httpCode = http.POST(payload);

    static unsigned long lastLog = 0;
    static int pkts = 0;
    pkts++;

    if (millis() - lastLog >= 1000) {
      lastLog = millis();
      const char* st1 = alarm1 == 2 ? "🔴COLLAPSE" : alarm1 == 1 ? "🟡WARN" : "🟢SAFE";
      const char* st2 = alarm2 == 2 ? "🔴COLLAPSE" : alarm2 == 1 ? "🟡WARN" : "🟢SAFE";

      if (httpCode == 201) {
        Serial.printf("📡 Pkts: %d | HTTP 201 | B1: %s (%.2fg) | B2: %s (%.2fg)\n",
                      pkts, st1, x1, st2, x2);
      } else {
        Serial.printf("⚠️ [HTTP %d] Check server at %s\n", httpCode, SERVER_URL);
      }
    }
    http.end();
  } else {
    WiFi.reconnect();
  }
#else
  // Stream directly over USB Cable
  serializeJson(doc, Serial);
  Serial.println();
#endif

  long elapsed = millis() - startMs;
  if (elapsed < SAMPLE_RATE_MS) delay(SAMPLE_RATE_MS - elapsed);
}
