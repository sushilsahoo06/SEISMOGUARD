/*
 * ═══════════════════════════════════════════════════════════════════
 *  MPU-6050 Accelerometer Standalone Test & Scanner
 * ═══════════════════════════════════════════════════════════════════
 *
 *  WIRING INSTRUCTIONS:
 *
 *  ► For 1 Sensor (Building 1 - Default):
 *    MPU-6050 Pin   ➔   ESP32 Pin
 *    ────────────       ─────────
 *    VCC            ➔   VIN (or 5V / 3.3V)
 *    GND            ➔   GND
 *    SCL            ➔   GPIO 22 (labeled D22 or 22)
 *    SDA            ➔   GPIO 21 (labeled D21 or 21)
 *    AD0            ➔   GND (sets I2C address to 0x68)
 *
 *  ► For 2nd Sensor (Building 2 - Optional):
 *    Share VCC, GND, SDA (21), SCL (22) with Sensor #1, BUT:
 *    AD0            ➔   3.3V (sets I2C address to 0x69)
 * ═══════════════════════════════════════════════════════════════════
 */

#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

#define I2C_SDA 21
#define I2C_SCL 22

Adafruit_MPU6050 mpu1; // Address 0x68
Adafruit_MPU6050 mpu2; // Address 0x69

bool has_mpu1 = false;
bool has_mpu2 = false;

void scanI2C() {
  Serial.println("==================================================");
  Serial.printf("🔍 Scanning I2C Bus on SDA = GPIO %d, SCL = GPIO %d...\n", I2C_SDA, I2C_SCL);
  Serial.println("==================================================");
  
  byte devices = 0;
  for (byte address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    byte error = Wire.endTransmission();
    
    if (error == 0) {
      Serial.printf("   Found I2C Device at address: 0x%02X", address);
      if (address == 0x68) Serial.print("  <-- MPU-6050 #1 (AD0 to GND)");
      if (address == 0x69) Serial.print("  <-- MPU-6050 #2 (AD0 to 3.3V)");
      Serial.println();
      devices++;
    }
  }

  if (devices == 0) {
    Serial.println("\n  NO I2C DEVICES FOUND!");
    Serial.println("  Possible causes:");
    Serial.println("   1. SDA and SCL are reversed (swap pin 21 and pin 22).");
    Serial.println("   2. VCC is not getting power (try connecting VCC to VIN or 5V).");
    Serial.println("   3. GND wire is loose or disconnected.");
    Serial.println("   4. Breadboard connection is loose.");
  }
  Serial.println("==================================================\n");
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\n##################################################");
  Serial.println("       ESP32 MPU-6050 ACCELEROMETER TEST");
  Serial.println("##################################################\n");

  Wire.begin(I2C_SDA, I2C_SCL);
  scanI2C();

  // Try initializing MPU #1 (0x68)
  if (mpu1.begin(0x68)) {
    has_mpu1 = true;
    mpu1.setAccelerometerRange(MPU6050_RANGE_2_G);
    mpu1.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu1.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("MPU-6050 #1 (0x68) INITIALIZED SUCCESSFULLY!");
  } else {
    Serial.println("MPU-6050 #1 (0x68) not ready.");
  }

  // Try initializing MPU #2 (0x69)
  if (mpu2.begin(0x69)) {
    has_mpu2 = true;
    mpu2.setAccelerometerRange(MPU6050_RANGE_2_G);
    mpu2.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu2.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println(" MPU-6050 #2 (0x69) INITIALIZED SUCCESSFULLY!");
  } else {
    Serial.println("ℹMPU-6050 #2 (0x69) not connected (Normal if using 1 sensor).");
  }

  Serial.println("\nStarting live readings in 2 seconds...");
  delay(2000);
}

void loop() {
  // If no sensors were detected, keep scanning every 3 seconds so you can adjust wires without re-uploading!
  if (!has_mpu1 && !has_mpu2) {
    Serial.println("No sensor detected. Rescanning in 3 seconds... (Check wires)");
    delay(3000);
    scanI2C();
    if (mpu1.begin(0x68)) {
      has_mpu1 = true;
      Serial.println("MPU-6050 #1 (0x68) CONNECTED!");
    }
    if (mpu2.begin(0x69)) {
      has_mpu2 = true;
      Serial.println("MPU-6050 #2 (0x69) CONNECTED!");
    }
    return;
  }

  // Read MPU #1
  if (has_mpu1) {
    sensors_event_t a1, g1, t1;
    mpu1.getEvent(&a1, &g1, &t1);

    // Convert m/s² to g (divide by 9.81)
    float ax = a1.acceleration.x / 9.81;
    float ay = a1.acceleration.y / 9.81;
    float az = a1.acceleration.z / 9.81;
    float total_g = sqrt(ax * ax + ay * ay + az * az);

    // Pitch and Roll in degrees
    float roll  = atan2(ay, az) * 180.0 / PI;
    float pitch = atan2(-ax, sqrt(ay * ay + az * az)) * 180.0 / PI;

    Serial.printf("[SENSOR #1 (0x68)] Accel: X=%+6.3fg  Y=%+6.3fg  Z=%+6.3fg | Total=%5.2fg | Pitch=%+5.1f°  Roll=%+5.1f° | Temp=%4.1f°C\n",
                  ax, ay, az, total_g, pitch, roll, t1.temperature);
  }

  // Read MPU #2
  if (has_mpu2) {
    sensors_event_t a2, g2, t2;
    mpu2.getEvent(&a2, &g2, &t2);

    float ax = a2.acceleration.x / 9.81;
    float ay = a2.acceleration.y / 9.81;
    float az = a2.acceleration.z / 9.81;
    float total_g = sqrt(ax * ax + ay * ay + az * az);

    float roll  = atan2(ay, az) * 180.0 / PI;
    float pitch = atan2(-ax, sqrt(ay * ay + az * az)) * 180.0 / PI;

    Serial.printf("[SENSOR #2 (0x69)] Accel: X=%+6.3fg  Y=%+6.3fg  Z=%+6.3fg | Total=%5.2fg | Pitch=%+5.1f°  Roll=%+5.1f° | Temp=%4.1f°C\n",
                  ax, ay, az, total_g, pitch, roll, t2.temperature);
  }

  delay(200); // 5 updates per second
}
