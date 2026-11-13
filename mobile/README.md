# 📱 SHM Earthquake Alert Mobile App (React Native / Expo)

A single-page real-time earthquake and structural collapse alarm app built with **React Native (Expo)**. When the Structural Health Monitoring (SHM) backend detects a critical earthquake tremor or structural hazard, the app triggers an immediate high-priority alarm with pulsating visual takeover, continuous haptic vibration, and audio playback using **your own custom audio file**.

---

## 🚀 Key Features

* **Real-Time WebSocket Detection**: Connects via Socket.io to the SHM backend (`/api/sensor-data`). Automatically triggers whenever ML inference or civil engineering algorithms classify a **`CRITICAL`** seismic tremor.
* **Custom Audio Alert Selection**:
  * Tap **"Pick Custom Sound"** to choose any audio file (`.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg`) stored on your phone.
  * Preview your sound anytime with the **"Preview"** button.
  * Reset back to the built-in emergency siren with one tap.
* **Aggressive Alarm Takeover**:
  * Full-screen animated flashing alert banner.
  * Continuous multi-pattern haptic vibration.
  * Loop playback at full volume.
  * Prominent **"DISMISS & SILENCE ALARM"** button to instantly quiet the phone once safe.
* **Manual Simulation Button**:
  * Tap **"Test Critical Alarm"** to simulate an earthquake and verify your custom audio and vibration with a single tap.
* **Dual-Building Telemetry Dashboard**:
  * Live peak acceleration for **Building 1** (Unprotected) vs **Building 2** (Resistant/Damped).
  * Real-time SW-420 digital vibration switch indicator.
  * Structural shock attenuation percentage.
* **Configurable Backend Host**:
  * Connect to your local computer over Wi-Fi (`http://192.168.1.xxx:5000`) or Render cloud (`https://shm-v5rg.onrender.com`).

---

## 📲 How to Run on Your Phone (in 2 Minutes)

### Step 1: Install Expo Go
* **Android**: Download **Expo Go** from [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent).
* **iOS**: Download **Expo Go** from [Apple App Store](https://apps.apple.com/app/expo-go/id982107779).

### Step 2: Start the Expo Development Server
In your terminal, navigate to the `mobile` folder and start Expo:

```bash
cd mobile
npm start
```
*(Or run `npx expo start`)*

### Step 3: Open on Your Phone
1. A QR code will display in your terminal.
2. Open **Expo Go** on your phone (or your phone's Camera app on iOS).
3. Scan the QR code.
4. The app will bundle and load directly onto your phone!

---

## 🛠️ Testing Your Custom Audio
1. Once open on your phone, scroll to the **"Emergency Audio Alert"** card.
2. Tap **"Pick Custom Sound"** and select any music or sound file from your device.
3. Tap **"Preview"** to verify the volume.
4. Tap **"Test Critical Alarm (Simulate)"** to experience the full emergency alert screen and sound!

