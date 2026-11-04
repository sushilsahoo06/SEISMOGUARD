# 🏢 Structural Health Monitoring (SHM) & Seismic Early Warning System

A full-stack, real-time IoT and civil engineering monitoring platform designed to analyze building structural behavior, detect seismic vibrations, and evaluate collapse risk during earthquakes.

The system performs a live side-by-side comparative analysis between:
* **Building 1 (Unprotected):** Standard rigid structure prone to resonant vibration and structural damage.
* **Building 2 (Earthquake-Resistant):** Base-isolated / damped structure designed to attenuate ground motion.

---

## 📐 System Architecture

```
 ┌────────────────────────────────────────────────────────┐
 │                   HARDWARE LAYER                       │
 │  • ESP32 Dev Board                                     │
 │  • 2× ADXL345 3-Axis Accelerometers (I2C)              │
 │  • 2× SW-420 Vibration Switches (Digital Interrupts)   │
 │  • 2× Active Buzzers (Physical Audio Alarms)           │
 └──────────────────────────┬─────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │ Transmission Mode Selection   │
            ▼                               ▼
    [ Wi-Fi HTTP POST ]             [ USB Serial Cable ]
     (20 Hz / 50ms)                  (115200 Baud)
            │                               │
            │                               ▼
            │                     node serial_reader.js
            │                               │
            └───────────────┬───────────────┘
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │                    BACKEND LAYER                       │
 │  • Node.js & Express API (`/api/sensor-data`)          │
 │  • PostgreSQL (Cloud Neon DB) Timeseries Storage       │
 │  • Socket.io Low-Latency WebSocket Gateway             │
 │  • Civil Engineering Damage & Orientation Logic       │
 └──────────────────────────┬─────────────────────────────┘
                            │
                            ▼ WebSocket Broadcast
 ┌────────────────────────────────────────────────────────┐
 │                   FRONTEND LAYER                       │
 │  • React 19 + Vite + Chart.js                          │
 │  • Real-Time Oscilloscope & Spectral Visualizations    │
 │  • Live Status: 🟢 Safe | 🟡 Warning | 🔴 Collapse Risk │
 │  • Historical CSV Export & Data Analytics              │
 └────────────────────────────────────────────────────────┘
```

---

## 🔌 Hardware Wiring & Pinout Guide

### 1. ADXL345 Accelerometers (I2C Bus)
Both sensors share the same I2C data lines (`SDA` and `SCL`). Addresses are differentiated using the `SDO` pin:

| ADXL345 Pin | ESP32 Pin | Sensor 1 (Building 1) | Sensor 2 (Building 2) | Note |
| :--- | :--- | :--- | :--- | :--- |
| **VCC** | **3.3V** | 3.3V | 3.3V | Do NOT connect to 5V |
| **GND** | **GND** | GND | GND | Common ground |
| **CS** | **3.3V** | 3.3V | 3.3V | **Crucial:** Forces I2C mode |
| **SCL** | **GPIO 22** | GPIO 22 | GPIO 22 | I2C Clock line |
| **SDA** | **GPIO 21** | GPIO 21 | GPIO 21 | I2C Data line |
| **SDO** | — | **GND** (Addr: `0x53`) | **3.3V** (Addr: `0x1D`) | Hardware I2C Addressing |

### 2. SW-420 Vibration Sensors & Buzzers
| Component | Signal Pin | ESP32 Pin | Function |
| :--- | :--- | :--- | :--- |
| **SW-420 #1 (Building 1)** | DO (Digital Out) | **GPIO 14** (or 25) | Hardware interrupt trigger |
| **SW-420 #2 (Building 2)** | DO (Digital Out) | **GPIO 27** (or 26) | Hardware interrupt trigger |
| **Buzzer #1 (Building 1)** | (+) Positive Pin | **GPIO 32** | Critical Collapse Alarm |
| **Buzzer #2 (Building 2)** | (+) Positive Pin | **GPIO 33** | Secondary Alarm |

---

## ⚙️ How It Works (Civil Engineering & Data Processing)

1. **High-Frequency Sampling (20 Hz):**
   * The ESP32 samples 3-axis acceleration $(a_x, a_y, a_z)$ and vibration pulses every **50 milliseconds**.
2. **Orientation & Tilt Derivation:**
   * Dynamic Shock Magnitude: $\text{Mag} = \sqrt{a_x^2 + a_y^2 + a_z^2}$
   * P-Delta Tilt Drift:
     $$\text{Roll} = \text{atan2}(a_y, a_z) \times \frac{180}{\pi}$$
     $$\text{Pitch} = \text{atan2}(-a_x, \sqrt{a_y^2 + a_z^2}) \times \frac{180}{\pi}$$
3. **Multi-Stage Collapse Evaluation:**
   * 🟢 **Normal / Safe (Level 0):** Acceleration $< 0.35g$, Tilt $< 4^\circ$.
   * 🟡 **Structural Warning (Level 1):** Moderate shaking ($0.35g - 0.8g$) or transient impact.
   * 🔴 **Critical Collapse Risk (Level 2):** Permanent tilt $> 12^\circ$ or violent shaking $> 0.8g$ sustained for more than 3 seconds. Triggers onboard physical buzzers and dashboard emergency banners.
4. **Instant WebSocket Broadcast:**
   * Incoming packets are persisted in PostgreSQL and instantly broadcast via Socket.io to the React client with $< 50\,\text{ms}$ latency.

---

## 🚀 Execution & Setup Guide

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher)
* [Arduino IDE](https://www.arduino.cc/en/software) (with ESP32 board manager installed)
* Active PostgreSQL database (Neon or local)

---

### Step 1: Configure & Run Backend Server

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create/verify your `.env` file in `backend/`:
   ```env
   PORT=5000
   DATABASE_URL=postgresql://<user>:<password>@<neon-host>/neondb?sslmode=require
   ```
4. Run database migrations:
   ```bash
   node migrate.js
   node migrate_sw420.js
   ```
5. Start the backend:
   ```bash
   npm start
   # Server runs at http://localhost:5000
   ```

---

### Step 2: Configure & Run Frontend Dashboard

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   # Dashboard opens at http://localhost:5173
   ```

---

### Step 3: Flash Firmware to ESP32

1. Open **Arduino IDE**.
2. Install required libraries via **Sketch $\rightarrow$ Include Library $\rightarrow$ Manage Libraries**:
   * `ArduinoJson` (by Benoit Blanchon)
   * `Wire` (built-in)
   * `WiFi` & `HTTPClient` (built-in for ESP32)
3. Open [`backend/esp32_serial_firmware.ino`](file:///c:/Users/HP/OneDrive/ドキュメント/GitHub/shm/backend/esp32_serial_firmware.ino).

#### Choose your transmission mode:

#### Option A: Wi-Fi Wireless Streaming (Recommended)
1. In the firmware code, keep `#define MODE_WIFI` uncommented:
   ```cpp
   #define MODE_WIFI
   //#define MODE_SERIAL
   ```
2. Enter your Wi-Fi credentials (must be **2.4 GHz** Wi-Fi):
   ```cpp
   const char* WIFI_SSID     = "Your_WiFi_Name";
   const char* WIFI_PASSWORD = "Your_WiFi_Password";
   ```
3. Set `SERVER_URL` to your computer's local IPv4 address (run `ipconfig` in Windows terminal):
   ```cpp
   const char* SERVER_URL    = "http://192.168.1.X:5000/api/sensor-data";
   ```
4. Connect ESP32 via USB and click **Upload**.
5. Once uploaded, open **Serial Monitor (115200 baud)** to verify Wi-Fi connection and `HTTP 201` responses. You can now power the ESP32 from any USB adapter!

#### Option B: USB Cable Direct Streaming (No Wi-Fi needed)
1. In the firmware code:
   ```cpp
   //#define MODE_WIFI
   #define MODE_SERIAL
   ```
2. Upload the sketch to ESP32.
3. In your backend terminal, run the serial bridge:
   ```bash
   cd backend
   node serial_reader.js
   ```

---

## 📊 Dashboard Pages & Views

| Page | Route | Description |
| :--- | :--- | :--- |
| **Vibration View** | `/vibration` | Real-time multi-axis acceleration curves, dynamic shock magnitude, and SW-420 vibration pulse count. |
| **Frequency View** | `/frequency` | Live Fast Fourier Transform (FFT) spectral response and resonant peak frequency tracking. |
| **Orientation View** | `/orientation` | Real-time P-Delta drift, pitch, and roll angular displacement comparison. |
| **History & Export** | All Pages | Download full session records as a structured `.csv` file. |

---

## 🛠️ Common Troubleshooting

* **ESP32 prints `HTTP -1` or Connection Failed:**
  * Your laptop's IP address probably changed. Run `ipconfig` in PowerShell and update `SERVER_URL` in the firmware.
  * Ensure Windows Defender Firewall allows inbound traffic on port `5000`.
* **ADXL345 "NOT FOUND" in Serial Monitor:**
  * Check that `CS` pin is securely connected to `3.3V` (enables I2C mode).
  * Verify `SDO` pin on Sensor 1 is connected to `GND` (`0x53`) and Sensor 2 to `3.3V` (`0x1D`).
* **Vibration charts not moving:**
  * Verify `npm start` is running in `backend` and Socket.io shows `Client connected`.
  * Open browser console on `http://localhost:5173` to verify WebSocket status.

