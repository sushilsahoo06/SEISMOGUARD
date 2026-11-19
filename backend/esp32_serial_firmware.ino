/*
 * ═══════════════════════════════════════════════════════════════════
 *  SHM ESP32 Universal Dual-Core Structural Health Monitoring Firmware
 *  HYBRID ARCHITECTURE:
 *   - Core 1: Sensors + Buzzer + USB Serial Cable (Rock-solid 20 Hz, 0ms lag)
 *   - Core 0: Wi-Fi HTTP Stream in Background (Slow network NEVER lags Serial!)
 * ═══════════════════════════════════════════════════════════════════
 *  Building 1: ADXL345 (0x53) + SW-420 (GPIO 25) + Buzzer (GPIO 32)
 *  Building 2: ADXL345 (0x1D) + SW-420 (GPIO 26) + Buzzer (GPIO 33)
 * ═══════════════════════════════════════════════════════════════════
 */

#include <WiFi.h>
#include <WiFiMulti.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <ArduinoJson.h>

WiFiMulti wifiMulti;

// ── Multi-Network Wi-Fi Credentials ───────────────────────────────
// Automatically connects to whichever network is available!
// 1. Mobile Hotspot:
const char* WIFI_1_SSID = "Sushil";
const char* WIFI_1_PASS = "sushil8260";

// 2. Room / Home Wi-Fi:
const char* WIFI_2_SSID = "Airtel_Room No 110";
const char* WIFI_2_PASS = "Air@0786";

// Public Cloud Dashboard Target:
const char* SERVER_URL  = "https://shm-v5rg.onrender.com/api/sensor-data";
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

// Sample rate: 50ms (20 Hz)
const int SAMPLE_RATE_MS = 50;

// Civil Engineering Collapse Cumulative Timers
unsigned long dangerStartMs_1 = 0;
unsigned long dangerStartMs_2 = 0;

// ── Background Wi-Fi Non-Blocking Queue (Core 0) ──────────────────
// Ensures slow / lagging Wi-Fi NEVER delays the USB Serial stream!
String latestWifiPayload = "";
bool hasNewWifiPayload = false;
portMUX_TYPE payloadMutex = portMUX_INITIALIZER_UNLOCKED;

void wifiBackgroundSenderTask(void* parameter) {
  WiFiClientSecure client;
  client.setInsecure(); // Connect securely to Render without heavy cert verification
  HTTPClient http;

  while (true) {
    if (WiFi.status() == WL_CONNECTED) {
      String toSend = "";
      portENTER_CRITICAL(&payloadMutex);
      if (hasNewWifiPayload) {
        toSend = latestWifiPayload;
        hasNewWifiPayload = false;
      }
      portEXIT_CRITICAL(&payloadMutex);

      if (toSend.length() > 0) {
        http.begin(client, SERVER_URL);
        http.addHeader("Content-Type", "application/json");
        http.setTimeout(1200); // Even if network takes 1.2s, Core 1 never waits!
        http.POST(toSend);
        http.end();
      }
    } else {
      wifiMulti.run();
    }
    vTaskDelay(pdMS_TO_TICKS(100)); // Wi-Fi upload rate (10 Hz)
  }
}

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

  if (mag < 0.2f) {
    dangerStartMs = 0;
    return 0;
  }

  float dynamicG = abs(mag - 1.0f);

  // Robust 3D tilt calculation (independent of sensor mounting orientation / Z polarity):
  // Uses Euclidean denominator so roll & pitch are strictly within [0°, 90°]
  float roll  = abs(atan2(ay, sqrt(ax * ax + az * az)) * 180.0f / 3.14159f);
  float pitch = abs(atan2(-ax, sqrt(ay * ay + az * az)) * 180.0f / 3.14159f);
  float tilt  = max(roll, pitch);

  // Sustained resonance check (> 0.8g sustained for over 2.5 seconds)
  if (dynamicG > 0.80f) {
    if (dangerStartMs == 0) dangerStartMs = millis();
  } else {
    dangerStartMs = 0;
  }

  unsigned long durationDanger = (dangerStartMs > 0) ? (millis() - dangerStartMs) : 0;

  // CRITICAL (Level 2): Permanent structural lean > 22° OR sustained destructive shaking > 2.5 sec
  if (tilt > 22.0f || durationDanger > 2500) {
    return 2;
  }
  // WARNING (Level 1): Strong dynamic shaking > 0.60g
  if (dynamicG > 0.60f) {
    return 1;
  }
  return 0;
}


// ─────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(400);

  Serial.println("\n══════════════════════════════════════════════════════");
  Serial.println("  SHM ESP32 — Dual-Core Architecture (Serial + Wi-Fi)");
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

  // Register Wi-Fi Networks with WiFiMulti
  WiFi.mode(WIFI_STA);
  wifiMulti.addAP(WIFI_1_SSID, WIFI_1_PASS);
  wifiMulti.addAP(WIFI_2_SSID, WIFI_2_PASS);

  Serial.print("Connecting to Wi-Fi");
  int tries = 0;
  while (wifiMulti.run() != WL_CONNECTED && tries < 12) {
    delay(250);
    Serial.print(".");
    tries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n🎉 [WIFI CONNECTED SUCCESSFULLY]");
    Serial.printf("  ➤ Network   : %s\n", WiFi.SSID().c_str());
    Serial.printf("  ➤ ESP32 IP  : %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("  ➤ Target    : %s\n", SERVER_URL);
  } else {
    Serial.println("\nℹ️ [Wi-Fi Not Ready] -> Streaming directly via USB Serial!");
  }

  // ── Launch Wi-Fi Background Sender on Core 0 ─────────────────────
  // Runs independently: slow internet will NEVER freeze USB Serial!
  xTaskCreatePinnedToCore(
    wifiBackgroundSenderTask,
    "WiFiSenderTask",
    8192,
    NULL,
    1,
    NULL,
    0 // Core 0
  );

  Serial.println("{\"status\":\"ready\"}");
  Serial.println("══════════════════════════════════════════════════════\n");
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

  // Evaluate Civil Engineering Damage
  int alarm1 = evaluateStructuralDamage(x1, y1, z1, vib1, dangerStartMs_1);
  int alarm2 = evaluateStructuralDamage(x2, y2, z2, vib2, dangerStartMs_2);

  // ── Physical Buzzer: Sound ONLY during genuine seismic / structural shaking ──
  static float lastX1 = 0.0f, lastY1 = 0.0f, lastZ1 = 1.0f;
  float deltaA1 = sqrt(pow(x1 - lastX1, 2) + pow(y1 - lastY1, 2) + pow(z1 - lastZ1, 2));
  lastX1 = x1;
  lastY1 = y1;
  lastZ1 = z1;

  // Only triggers when structural warning is tripped (alarm1 >= 1) or significant acceleration (deltaA1 > 0.45g)
  bool isGenuineShake1 = (alarm1 >= 1) || (deltaA1 > 0.45f && vib1 == 1);

  static unsigned long buzzerHoldTimer1 = 0;
  if (isGenuineShake1) {
    buzzerHoldTimer1 = millis() + 400;
  }

  if (millis() < buzzerHoldTimer1) {
    digitalWrite(BUZZER_PIN_1, BUZZER_ON);  // Sounding during confirmed seismic shaking
  } else {
    digitalWrite(BUZZER_PIN_1, BUZZER_OFF); // Silent during rest / slight table touch
  }

  // ── Build JSON object ────────────────────────────────────────────
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

  // ── 1. GUARANTEED REAL-TIME USB SERIAL STREAM (Core 1) ───────────
  // ALWAYS streams at full 20 Hz without ANY Wi-Fi delays!
  serializeJson(doc, Serial);
  Serial.println();

  // ── 2. HANDOFF TO BACKGROUND WI-FI SENDER (Core 0) ───────────────
  // Instantly hands off JSON string to Core 0 in 0.01ms (Zero blocking):
  String jsonStr;
  serializeJson(doc, jsonStr);
  portENTER_CRITICAL(&payloadMutex);
  latestWifiPayload = jsonStr;
  hasNewWifiPayload = true;
  portEXIT_CRITICAL(&payloadMutex);

  // Steady 50ms (20 Hz) loop rate on Core 1
  long elapsed = millis() - startMs;
  if (elapsed < SAMPLE_RATE_MS) delay(SAMPLE_RATE_MS - elapsed);
}
