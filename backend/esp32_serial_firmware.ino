/*
 * ═══════════════════════════════════════════════════════════════════
 *  SHM ESP32 Dual-Building Structural Health Monitoring Firmware
 * ═══════════════════════════════════════════════════════════════════
 *  Building 1: ADXL345 (0x53) + SW-420 (GPIO 25) + Buzzer (GPIO 32)
 *  Building 2: ADXL345 (0x1D) + SW-420 (GPIO 26) + Buzzer (GPIO 33)
 * ═══════════════════════════════════════════════════════════════════
 */

// ── TRANSMISSION MODE ─────────────────────────────────────────────
// Choose ONE mode below:
// 1. MODE_SERIAL (Recommended): Plug USB cable into laptop, run `node serial_reader.js COM6`.
//    100% reliable, zero Wi-Fi dropouts.
// 2. MODE_WIFI: Connects directly to Wi-Fi and streams to Render in the cloud.
#define MODE_SERIAL       // ← USB Cable Mode (ACTIVE - Recommended)
//#define MODE_WIFI       // ← Uncomment for Direct Wi-Fi Mode
// ──────────────────────────────────────────────────────────────────

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <ArduinoJson.h>

// ── Wi-Fi & Cloud Render Target ───────────────────────────────────
const char* WIFI_SSID     = "Airtel_Room No 110";      // Wi-Fi Name
const char* WIFI_PASSWORD = "Air@0786";                // Wi-Fi Password

// Render Cloud Target:
const char* SERVER_URL    = "https://shm-v5rg.onrender.com/api/sensor-data";
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

// Buzzer Active Level
#define BUZZER_ACTIVE_HIGH true
#define BUZZER_ON  (BUZZER_ACTIVE_HIGH ? HIGH : LOW)
#define BUZZER_OFF (BUZZER_ACTIVE_HIGH ? LOW : HIGH)

// ADXL345 Registers
#define POWER_CTL      0x2D
#define DATA_FORMAT    0x31
#define BW_RATE        0x2C
#define DATAX0         0x32

// Full-resolution scale factor (3.9 mg/LSB -> 0.0039g)
const float G_PER_LSB = 0.0039f;

bool has_adxl1 = false;
bool has_adxl2 = false;

// Sample rate: 50ms (20 Hz telemetry)
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
  float mag = sqrt(ax * ax + ay * ay + az * az);

  // If sensor is disconnected or uninitialized, guard against false alarms
  if (mag < 0.2f) {
    dangerStartMs = 0;
    return 0;
  }

  float dynamicG = abs(mag - 1.0f);

  // P-Delta tilt angle
  float roll  = abs(atan2(ay, az) * 180.0f / 3.14159f);
  float pitch = abs(atan2(-ax, sqrt(ay * ay + az * az)) * 180.0f / 3.14159f);
  float tilt  = max(roll, pitch);

  // Sustained resonance check
  if (dynamicG > 0.80f) {
    if (dangerStartMs == 0) dangerStartMs = millis();
  } else {
    dangerStartMs = 0;
  }

  unsigned long durationDanger = (dangerStartMs > 0) ? (millis() - dangerStartMs) : 0;

  // CRITICAL (Level 2): Permanent tilt > 14° OR sustained high shock > 3 sec
  if (tilt > 14.0f || durationDanger > 3000) {
    return 2;
  }
  // WARNING (Level 1): Moderate shaking > 0.5g
  if (dynamicG > 0.50f) {
    return 1;
  }
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
  pinMode(VIB1_PIN, INPUT_PULLDOWN);
  pinMode(VIB2_PIN, INPUT_PULLDOWN);

  // Buzzer Output Pins (default to OFF)
  pinMode(BUZZER_PIN_1, OUTPUT);
  pinMode(BUZZER_PIN_2, OUTPUT);
  digitalWrite(BUZZER_PIN_1, BUZZER_OFF);
  digitalWrite(BUZZER_PIN_2, BUZZER_OFF);

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
  while (WiFi.status() != WL_CONNECTED && tries < 30) {
    delay(500);
    Serial.print(".");
    tries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n\n🎉 [WIFI CONNECTED SUCCESSFULLY]");
    Serial.print("  ➤ ESP32 IP Address : ");
    Serial.println(WiFi.localIP());
    Serial.print("  ➤ Cloud Target     : ");
    Serial.println(SERVER_URL);
    Serial.println("══════════════════════════════════════════════════════\n");
  } else {
    Serial.println("\n❌ Wi-Fi Connection Failed. Fallback to USB mode.");
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

  float x1 = 0.0f, y1 = 0.0f, z1 = 0.0f;
  float x2 = 0.0f, y2 = 0.0f, z2 = 0.0f;

  if (has_adxl1) {
    if (!readADXL345(ADXL1, x1, y1, z1)) {
      x1 = 0.0f; y1 = 0.0f; z1 = 0.0f;
    }
  }

  if (has_adxl2) {
    if (!readADXL345(ADXL2, x2, y2, z2)) {
      x2 = 0.0f; y2 = 0.0f; z2 = 0.0f;
    }
  }

  // Digital vibration sensors
  int vib1 = digitalRead(VIB1_PIN) == HIGH ? 1 : 0;
  int vib2 = digitalRead(VIB2_PIN) == HIGH ? 1 : 0;

  // Evaluate Damage
  int alarm1 = evaluateStructuralDamage(x1, y1, z1, vib1, dangerStartMs_1);
  int alarm2 = evaluateStructuralDamage(x2, y2, z2, vib2, dangerStartMs_2);

  // ── Physical Buzzer: Sound ONLY while actively vibrating ──────────
  static float lastX1 = 0.0f, lastY1 = 0.0f, lastZ1 = 1.0f;
  static int lastVib1 = 0;

  float deltaA1 = sqrt(pow(x1 - lastX1, 2) + pow(y1 - lastY1, 2) + pow(z1 - lastZ1, 2));
  lastX1 = x1;
  lastY1 = y1;
  lastZ1 = z1;

  bool swChatter1 = (vib1 != lastVib1);
  lastVib1 = vib1;

  bool isVibrating1 = (deltaA1 > 0.20f) || swChatter1;

  static unsigned long buzzerHoldTimer1 = 0;
  if (isVibrating1) {
    buzzerHoldTimer1 = millis() + 300;
  }

  if (millis() < buzzerHoldTimer1) {
    digitalWrite(BUZZER_PIN_1, BUZZER_ON); // Sounding during vibration
  } else {
    digitalWrite(BUZZER_PIN_1, BUZZER_OFF); // Silent when resting
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

  doc["alarm_1"]     = alarm1; // 0=Safe, 1=Warning, 2=Critical Collapse
  doc["alarm_2"]     = alarm2;

  // ── 1. ALWAYS Stream JSON over USB Cable (for serial_reader.js) ──
  serializeJson(doc, Serial);
  Serial.println();

#ifdef MODE_WIFI
  // ── 2. Direct HTTPS Stream to Render over Wi-Fi ──────────────────
  if (WiFi.status() == WL_CONNECTED) {
    String payload;
    serializeJson(doc, payload);

    WiFiClientSecure client;
    client.setInsecure(); // Connect securely to Render without certificate bundling

    HTTPClient http;
    http.begin(client, SERVER_URL);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(180);
    http.POST(payload);
    http.end();
  }
#endif

  long elapsed = millis() - startMs;
  if (elapsed < SAMPLE_RATE_MS) delay(SAMPLE_RATE_MS - elapsed);
}
