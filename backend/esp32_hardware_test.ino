/*
 * ═══════════════════════════════════════════════════════════════════
 *  SHM — ESP32 Sensor Hardware Diagnostic & Test Firmware
 * ═══════════════════════════════════════════════════════════════════
 *  SAME BOARD CONNECTIONS:
 *    • MPU6050 #1 (0x68) : SDA -> GPIO 21, SCL -> GPIO 22, AD0 -> GND
 *    • MPU6050 #2 (0x69) : SDA -> GPIO 21, SCL -> GPIO 22, AD0 -> 3.3V
 *    • SW-420  #1        : DO  -> GPIO 14
 *    • SW-420  #2        : DO  -> GPIO 27
 *    • VCC -> 3.3V (or 5V if sensor board has 3.3V regulator)
 *    • GND -> GND
 *
 *  PURPOSE:
 *    Run this sketch and open Arduino IDE Serial Monitor (115200 baud)
 *    to visually verify that all sensors are detected and responding.
 * ═══════════════════════════════════════════════════════════════════
 */

#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

#define SDA_PIN      21
#define SCL_PIN      22
#define SW420_PIN_1  14
#define SW420_PIN_2  27

Adafruit_MPU6050 mpu1;
Adafruit_MPU6050 mpu2;

bool mpu1_found = false;
bool mpu2_found = false;

volatile int count1 = 0;
volatile int count2 = 0;

void IRAM_ATTR onVib1() { count1++; }
void IRAM_ATTR onVib2() { count2++; }

// Helper function: Scan I2C bus to check wiring
void scanI2CBus() {
  Serial.println("\n--- Scanning I2C Bus on SDA: 21, SCL: 22 ---");
  byte count = 0;
  for (byte i = 1; i < 127; i++) {
    Wire.beginTransmission(i);
    if (Wire.endTransmission() == 0) {
      Serial.print("  [+] I2C device detected at address: 0x");
      if (i < 16) Serial.print("0");
      Serial.print(i, HEX);
      if (i == 0x68) Serial.print("  <-- MPU6050 #1 (AD0 = GND)");
      if (i == 0x69) Serial.print("  <-- MPU6050 #2 (AD0 = 3.3V)");
      Serial.println();
      count++;
    }
  }
  if (count == 0) {
    Serial.println("  [!] NO I2C devices found! Check 3.3V, GND, SDA (21), and SCL (22).");
  }
  Serial.println("--------------------------------------------\n");
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("==================================================");
  Serial.println("  SHM ESP32 HARDWARE DIAGNOSTIC TEST");
  Serial.println("==================================================");

  // Initialize I2C
  Wire.begin(SDA_PIN, SCL_PIN);
  scanI2CBus();

  // Initialize MPU6050 #1
  Serial.print("Initializing MPU6050 #1 (0x68)... ");
  if (mpu1.begin(0x68)) {
    mpu1_found = true;
    mpu1.setAccelerometerRange(MPU6050_RANGE_2_G);
    mpu1.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu1.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("SUCCESS [OK]");
  } else {
    Serial.println("FAILED! (Check wires & AD0 -> GND)");
  }

  // Initialize MPU6050 #2
  Serial.print("Initializing MPU6050 #2 (0x69)... ");
  if (mpu2.begin(0x69)) {
    mpu2_found = true;
    mpu2.setAccelerometerRange(MPU6050_RANGE_2_G);
    mpu2.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu2.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("SUCCESS [OK]");
  } else {
    Serial.println("FAILED! (Check wires & AD0 -> 3.3V)");
  }

  // Initialize SW-420 pins
  pinMode(SW420_PIN_1, INPUT);
  pinMode(SW420_PIN_2, INPUT);
  attachInterrupt(digitalPinToInterrupt(SW420_PIN_1), onVib1, CHANGE);
  attachInterrupt(digitalPinToInterrupt(SW420_PIN_2), onVib2, CHANGE);
  Serial.println("SW-420 Vibration interrupts attached to GPIO 14 & 27.");

  Serial.println("\nBeginning live sensor data stream in 2 seconds...");
  Serial.println("==================================================\n");
  delay(2000);
}

void loop() {
  int sw1 = digitalRead(SW420_PIN_1);
  int sw2 = digitalRead(SW420_PIN_2);

  noInterrupts();
  int pulse1 = count1;
  int pulse2 = count2;
  interrupts();

  Serial.println("--------------------------------------------------");

  // MPU6050 #1 Readings
  if (mpu1_found) {
    sensors_event_t a1, g1, t1;
    mpu1.getEvent(&a1, &g1, &t1);
    float ax1 = a1.acceleration.x / 9.81;
    float ay1 = a1.acceleration.y / 9.81;
    float az1 = a1.acceleration.z / 9.81;

    Serial.printf("[MPU #1 (0x68)] Accel: X=%.3fg  Y=%.3fg  Z=%.3fg | Gyro: X=%.2f Y=%.2f Z=%.2f | Temp: %.1f C\n",
                  ax1, ay1, az1, g1.gyro.x, g1.gyro.y, g1.gyro.z, t1.temperature);
  } else {
    Serial.println("[MPU #1 (0x68)] NOT CONNECTED");
  }

  // MPU6050 #2 Readings
  if (mpu2_found) {
    sensors_event_t a2, g2, t2;
    mpu2.getEvent(&a2, &g2, &t2);
    float ax2 = a2.acceleration.x / 9.81;
    float ay2 = a2.acceleration.y / 9.81;
    float az2 = a2.acceleration.z / 9.81;

    Serial.printf("[MPU #2 (0x69)] Accel: X=%.3fg  Y=%.3fg  Z=%.3fg | Gyro: X=%.2f Y=%.2f Z=%.2f | Temp: %.1f C\n",
                  ax2, ay2, az2, g2.gyro.x, g2.gyro.y, g2.gyro.z, t2.temperature);
  } else {
    Serial.println("[MPU #2 (0x69)] NOT CONNECTED");
  }

  // SW-420 Readings
  Serial.printf("[SW-420 #1] State: %s (%d) | Pulses: %d\n", sw1 ? "VIBRATING" : "IDLE", sw1, pulse1);
  Serial.printf("[SW-420 #2] State: %s (%d) | Pulses: %d\n", sw2 ? "VIBRATING" : "IDLE", sw2, pulse2);

  delay(400); // 400ms update rate for comfortable reading
}
