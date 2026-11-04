# 🏢 Structural Health Monitoring (SHM) & Seismic Early Warning System

A full-stack, real-time IoT and civil engineering monitoring platform designed to analyze building structural behavior, detect seismic vibrations, evaluate collapse risks during earthquakes, and automatically trigger life-saving emergency phone calls, SMS, and WhatsApp alerts to residents and relatives.

The system performs a live side-by-side comparative analysis between:
* **Building 1 (Unprotected):** Standard rigid fixed-base structure prone to resonant vibration, plastic hinge deformation, and structural collapse.
* **Building 2 (Earthquake-Resistant):** Base-isolated / damped structure designed to attenuate ground shock and absorb seismic kinetic energy.

---

## 🌐 Live Cloud Deployments & Links

| Service | Platform | Live URL | Description |
| :--- | :--- | :--- | :--- |
| **Frontend Web App** | **Vercel** | [https://shm-kohl.vercel.app](https://shm-kohl.vercel.app) | Live real-time oscilloscope, FFT spectrum & structural dashboard |
| **Backend API Gateway** | **Render** | [https://shm-v5rg.onrender.com](https://shm-v5rg.onrender.com) | Node.js + Express + Socket.io + Twilio REST Server |
| **Evacuation & Alerts Directory** | **Vercel** | [https://shm-kohl.vercel.app/occupants](https://shm-kohl.vercel.app/occupants) | Occupant directory, Excel bulk upload/download & Twilio broadcast |
| **Post-Event Analysis Report** | **Vercel** | [https://shm-kohl.vercel.app/post-analysis](https://shm-kohl.vercel.app/post-analysis) | Printable PDF engineering safety report with dynamic curves |
| **Cloud Timeseries DB** | **Neon** | PostgreSQL Serverless | Timeseries sensor records & occupant directory |

---

## 📐 System Architecture

```
 ┌────────────────────────────────────────────────────────┐
 │                   HARDWARE LAYER                       │
 │  • ESP32 NodeMCU Dev Board                             │
 │  • 2× ADXL345 3-Axis Accelerometers (I2C 100 Hz)       │
 │  • 2× SW-420 Vibration Switches (Digital Interrupts)   │
 │  • 2× Active Buzzers (Physical Audio Alarms)           │
 └──────────────────────────┬─────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │ Transmission Mode Selection   │
            ▼                               ▼
    [ Option A: Wi-Fi Mode ]        [ Option B: USB Cable Mode ]
     (20 Hz / 50ms HTTP POST)        (115200 Baud Serial Stream)
            │                               │
            │                               ▼
            │                     node serial_reader.js
            │                     (Dual-forwarding bridge)
            │                               │
            └───────────────┬───────────────┘
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │                    BACKEND LAYER                       │
 │  • Render Cloud (`https://shm-v5rg.onrender.com`)      │
 │  • Node.js & Express API Gateway                       │
 │  • Socket.io Low-Latency WebSocket Gateway             │
 │  • Neon PostgreSQL Timeseries & Occupants DB           │
 │  • Twilio Automated Emergency Voice Calls & Auto-Cut   │
 │  • Twilio Resident SMS, WhatsApp & Family Advisories   │
 └──────────────────────────┬─────────────────────────────┘
                            │
                            ▼ WebSocket Broadcast (< 50ms)
 ┌────────────────────────────────────────────────────────┐
 │                   FRONTEND LAYER                       │
 │  • Vercel Cloud (`https://shm-kohl.vercel.app`)        │
 │  • React 19 + Vite + Chart.js                          │
 │  • Live Status: 🟢 Safe | 🟡 Warning | 🔴 Collapse     │
 │  • Occupant Evacuation Center with Excel Import/Export │
 │  • Automated PDF Civil Engineering Post-Analysis       │
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
| **SW-420 #1 (Building 1)** | DO (Digital Out) | **GPIO 25** (or 14) | Building 1 Vibration Trip |
| **SW-420 #2 (Building 2)** | DO (Digital Out) | **GPIO 26** (or 27) | Building 2 Vibration Trip |
| **Buzzer #1 (Building 1)** | (+) Positive Pin | **GPIO 32** | Critical Collapse Alarm (Active High) |
| **Buzzer #2 (Building 2)** | (+) Positive Pin | **GPIO 33** | Secondary Alarm (Optional) |

---

## 📟 Serial Monitor & Serial Reader Execution Guide

You can run the ESP32 data stream via the **USB Serial Cable Bridge** or the **Arduino IDE Serial Monitor**:

### Method 1: Running the USB Serial Bridge (`serial_reader.js`) — Recommended

The `serial_reader.js` script bridges data directly from your USB cable to **both** your local server and your live Render backend so the deployed Vercel web app updates in real-time without Wi-Fi dropouts.

1. **Upload Firmware in USB Serial Mode:**
   - In [`backend/esp32_serial_firmware.ino`](file:///backend/esp32_serial_firmware.ino), make sure:
     ```cpp
     //#define MODE_WIFI
     #define MODE_SERIAL
     ```
   - Connect ESP32 via USB and click **Upload** in Arduino IDE.
   - **IMPORTANT:** Once uploaded, **close the Arduino IDE Serial Monitor** so the COM port is released.

2. **Run the Serial Reader:**
   Open a terminal in the project root:
   ```bash
   cd backend
   node serial_reader.js
   ```
   * Or specify your exact COM port:
   ```bash
   node serial_reader.js COM6
   ```

3. **What You Will See in the Terminal:**
   ```
   =======================================================
     SHM USB Serial Bridge ACTIVE: COM6 @ 115200
     Forwarding live data to: https://shm-v5rg.onrender.com/api/sensor-data
     Live Vercel Dashboard:   https://shm-kohl.vercel.app
     Post-Event Report:       https://shm-kohl.vercel.app/post-analysis
   =======================================================
   ✅ ESP32 handshake received — sensor streaming active!

   [📦 20 pkts] B1(X=0.04g Y=0.01g Z=1.01g | ⚪ IDLE)  B2(X=0.02g Y=0.00g Z=0.99g | ⚪ IDLE)
   [📦 40 pkts] B1(X=0.88g Y=0.45g Z=1.65g | 🔴 VIB)   B2(X=0.22g Y=0.10g Z=1.02g | ⚪ IDLE)
   ```

> [!WARNING]
> **COM Port Conflict ("Access Denied"):**
> Windows allows only **one application** to access a serial port at a time. If `serial_reader.js` reports `Cannot open COM6: Access denied`, ensure that:
> 1. The **Arduino IDE Serial Monitor window is closed**.
> 2. No other background Node.js or PuTTY instance is holding the port.

---

### Method 2: Arduino IDE Built-In Serial Monitor

If you want to view raw debug telemetry directly inside Arduino IDE:
1. Open **Arduino IDE**.
2. Select your ESP32 board and COM port under **Tools $\rightarrow$ Port**.
3. Open **Serial Monitor** (**Ctrl + Shift + M**).
4. Set the baud rate dropdown in the bottom right corner to **115200 baud**.
5. You will see:
   - I2C sensor checks (`ADXL345 #1 (0x53): OK`, `ADXL345 #2 (0x1D): OK`).
   - Wi-Fi connection progress & assigned IP address (if in `MODE_WIFI`).
   - JSON packet output stream.

---

## 🚨 Emergency Calling, SMS & WhatsApp Alert System (Twilio & Deepgram)

Integrated with **Twilio Telecom REST APIs** and **Deepgram**, the system automates life-safety evacuation protocols during seismic emergencies:

### 1. 📞 Occupant Voice Call with Auto-Hangup
- **Target:** Residents registered as **"Inside Building"**.
- **Action:** Twilio calls the resident's mobile phone. As soon as the call is answered, Amazon Polly speaks:
  > *"EMERGENCY EARTHQUAKE WARNING! A severe seismic tremor has struck [Building Name]. You are registered inside [Flat / Room]. Evacuate immediately using emergency stairs. Do not use elevators! Proceed to the open ground assembly area now."*
- **Auto-Cut:** Automatically drops the call using `<Hangup/>` once the message is complete.

### 2. 💬 Resident Evacuation SMS & 🟢 WhatsApp
- Sends a direct high-priority evacuation alert:
  > *"CRITICAL EARTHQUAKE ALERT: Severe seismic tremor detected in Building 1, Flat 402. You are listed as INSIDE THE BUILDING. EVACUATE IMMEDIATELY via stairs! Do not use elevators."*

### 3. 👨‍👩‍👦 Relative / Family Member Advisory SMS
- For each resident inside the building, an alert is automatically dispatched to their registered emergency contact:
  > *"EARTHQUAKE ADVISORY: An earthquake has affected Building 1 (Flat 402), where your Father Sushil Sahoo resides. Emergency rescue & evacuation protocols are underway. You will receive updates as soon as they confirm safe evacuation."*

---

## 👥 Occupants Directory & Evacuation Dashboard (`/occupants`)

Visit [https://shm-kohl.vercel.app/occupants](https://shm-kohl.vercel.app/occupants) to access:

* **Live Safety Counters:**
  - Total Residents registered.
  - 🔴 **Inside Building (High Risk)**: Target list for emergency calls & SMS.
  - 🟢 **Evacuated / Safe**: Residents confirmed safe at assembly grounds.
* **Emergency Action Center:**
  - **🚨 TRIGGER EVACUATION BROADCAST Button**: One-click broadcast with modal confirmation and live dispatch audit logs.
  - **🛠️ Direct Telecom Tester**: Test Voice Call (Auto-Cut), SMS, and WhatsApp on any phone number.
* **Directory Management (Manual & Excel):**
  - **➕ Add Resident Manually**: Add name, phone, building, room, floor, status, and emergency relative contact.
  - **✏️ Edit & 🗑️ Delete**: Full CRUD capabilities stored in Neon PostgreSQL.
  - **One-Click Status Toggle**: Instantly switch an occupant between `Inside Building` and `Evacuated / Safe`.
  - **📁 Import Excel / CSV**: Drag-and-drop `.xlsx` upload with fuzzy column header matching.
  - **📥 Download Template**: Get a sample Excel template ready for editing.
  - **📤 Export Directory**: Export the entire database into `.xlsx`.
* **Live Audit Log:** Real-time log of every call SID, SMS SID, recipient, and status.

---

## 💻 Local Development Setup

### Backend
```bash
cd backend
npm install
npm start
# Runs locally at http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Runs locally at http://localhost:5173
```

---

## 📄 License & Civil Engineering Research
Developed for Advanced Structural Health Monitoring (SHM), Base-Isolation Damping Comparative Studies, and Autonomous Seismic Life-Safety Systems.
