# 🌍 Machine Learning Roadmap: Seismic Detection & Structural Health Monitoring (SHM)

> **Document Version:** 1.0.0  
> **Target System:** ESP32 (ADXL345 + SW-420) + Node.js/PostgreSQL + React Dashboard  
> **Objective:** Real-time seismic event detection, false-alarm rejection, earthquake early warning (EEW), and structural anomaly/damage detection.

---

## 📌 Executive Summary & Technical Feasibility

### What ML Can and Cannot Do
* ❌ **Pre-rupture prediction (days/hours in advance):** Geophysically impossible with local accelerometers or surface seismometers. Fault rupture mechanics cannot be predicted prior to initiation.
* ✅ **Earthquake Early Warning (EEW) & P-Wave Detection:** Detects initial non-destructive **P-waves** seconds before the arrival of destructive **S-waves** and surface waves.
* ✅ **Seismic vs. Disturbance Classification (False-Alarm Filter):** Differentiates real ground motion from mechanical noise (footsteps, slamming doors, heavy trucks, accidental table knocks).
* ✅ **Structural Health Monitoring (SHM) & Damage Assessment:** Measures shifts in Building 1 (unprotected) vs. Building 2 (damped/resistant) natural resonant frequencies and stiffness post-shake.
* ✅ **Real-Time Hazard / Intensity Level Rating:** Translates acceleration into Modified Mercalli Intensity (MMI) or custom risk tiers (*Normal*, *Minor Tremor*, *Warning*, *Structural Hazard*).

---

## 🏗 System Architecture Flow

```
[ ESP32 Firmware ]
  - ADXL345 (20 Hz / 50ms)
  - SW-420 (Digital pulse count)
         │
         │  HTTP POST /api/sensor-data
         ▼
[ Node.js Backend (Express) ]
         │
         ├──▶ Buffer / Sliding Window (50 samples = 2.5s window)
         │
         ├──▶ Feature Extractor (Time & Frequency Domain)
         │
         ├──▶ ML Inference Engine (ONNX Runtime / Python Microservice)
         │       • Classifier: Tremor vs. Ambient Noise
         │       • Damage Index: Anomaly score between Building 1 & 2
         │
         ├──▶ PostgreSQL Database (store raw + ML prediction)
         │
         └──▶ Socket.io Broadcast (`newSensorData` + `mlAlert`)
                     │
                     ▼
       [ React Frontend Dashboard ]
         - Frequency Spectrum & Resonance Shift
         - Real-time Seismic Hazard Gauge & Alarm
         - Structural Health Comparison (Building 1 vs 2)
```

---

## 🚀 Step-by-Step Implementation Plan ("What Doing Next")

### Phase 1: Data Preparation & Sliding Window Buffer
- [ ] **1.1 Setup Rolling Window Buffer in Backend:**
  - Create a memory ring buffer in Node.js (or Redis/Python) holding the last **50 to 100 samples** (2.5–5 seconds of data at 20 Hz).
- [ ] **1.2 Feature Engineering Pipeline:**
  - **Time Domain Features:**
    - Peak Ground Acceleration (PGA): $\max(|a_x|, |a_y|, |a_z|)$
    - Root Mean Square (RMS) acceleration
    - Signal energy & variance
    - SW-420 vibration pulse rate per window
  - **Frequency Domain Features (FFT):**
    - Dominant resonant peak frequency (Hz)
    - Spectral energy ratio in seismic band ($0.5\,\text{Hz} - 10\,\text{Hz}$)
    - Spectral entropy
- [ ] **1.3 Data Recording & Labelling Script:**
  - Build a recording script `backend/scripts/record_training_data.js` to log sessions with ground truth labels:
    - Label `0`: Ambient / Quiet State
    - Label `1`: Local Disturbance (knocking table, footsteps, door slam)
    - Label `2`: Simulated Earthquake / Shake Table Tremor

---

### Phase 2: Model Selection & Training

| Priority | Model Type | Purpose | Advantages |
| :--- | :--- | :--- | :--- |
| **P0 (Immediate)** | **Random Forest / XGBoost** | Tabular feature classification (Ambient vs Bump vs Quake) | Fast training, explainable, runs in $<2\,\text{ms}$, minimal compute. |
| **P1** | **Isolation Forest / Autoencoder** | Unsupervised Anomaly Detection for structural damage | Requires **no labelled disaster data**; trains on normal building sway and flags deviations. |
| **P2 (Advanced)** | **1D-CNN (Convolutional)** | Direct raw waveform classification ($a_x, a_y, a_z$) | Learns waveform shapes without manual FFT tuning (Earthquake Transformer pattern). |

- [ ] **2.1 Offline Model Training in Python:**
  - Train model in Jupyter / Python (`scikit-learn` or `PyTorch`).
  - Compute confusion matrix, precision/recall (aim for $<1\%$ false alarm rate on ambient noise).
- [ ] **2.2 Export to ONNX (`.onnx` format):**
  - Export trained model to ONNX so it can run cross-platform with zero dependency bloat.

---

### Phase 3: Backend Integration & Real-Time Inference
- [ ] **3.1 Add Inference Module to Backend:**
  - **Option A (Recommended - Node.js Native):** Install `onnxruntime-node` inside `backend/package.json`. Run inference directly on the incoming data buffer every $500\,\text{ms}$.
  - **Option B (Python Microservice):** Small FastAPI microservice receiving batch arrays.
- [ ] **3.2 Database Migration for ML Predictions:**
  - Add table `ml_predictions` or extend `sensor_readings`:
    ```sql
    ALTER TABLE sensor_readings 
    ADD COLUMN ml_event_type VARCHAR(50) DEFAULT 'NORMAL',
    ADD COLUMN ml_confidence REAL DEFAULT 0.0,
    ADD COLUMN ml_hazard_level VARCHAR(20) DEFAULT 'LOW',
    ADD COLUMN ml_damage_index REAL DEFAULT 0.0;
    ```
- [ ] **3.3 Real-Time WebSocket Emission:**
  - Emit prediction payloads via Socket.io:
    ```javascript
    io.emit('mlAlert', {
      timestamp: new Date().toISOString(),
      event: 'SEISMIC_TREMOR_DETECTED',
      hazardLevel: 'HIGH', // LOW | MODERATE | HIGH | CRITICAL
      confidence: 0.94,
      affectedBuilding: 'Building 1 (Unprotected)',
      building2Attenuation: '68% vibration reduction'
    });
    ```

---

### Phase 4: Frontend UI Updates
- [ ] **4.1 AI Alert Banner:**
  - Prominent alert badge on top of `FrequencyPage.jsx` and `VibrationPage.jsx` with color state:
    - 🟢 **Normal Ambient**
    - 🟡 **External Disturbance (Ignored)**
    - 🔴 **Seismic Event Confirmed**
- [ ] **4.2 Structural Damage Comparison Card:**
  - Real-time gauge showing:
    - Dynamic response comparison: Building 1 vs Building 2.
    - Resonant frequency drop indicator (identifying structural softening or joint looseness).
- [ ] **4.3 Event History Log:**
  - Table of past detected seismic events with timestamp, duration, peak acceleration, and classification certainty.

---

### Phase 5: Verification & Calibration
- [ ] **5.1 Latency Benchmarking:** Ensure end-to-end detection latency is under $100\,\text{ms}$ from sensor impulse to frontend alert.
- [ ] **5.2 Shake Table Simulation:** Conduct tests using controlled vibration frequencies (e.g. 1 Hz, 3 Hz, 5 Hz) and transient impacts.
- [ ] **5.3 Threshold Tuning:** Fine-tune the decision boundary to prevent nuisance alarms during daily activities.

---

## 📋 Recommended Immediate Next Action

1. **Create `backend/services/mlFeatureExtractor.js`** to compute running statistical features (PGA, RMS, dominant frequency) from the sensor stream.
2. **Collect sample test records** (baseline quiet vs. active vibration) into CSV/JSON to build our first training dataset.
3. **Train and load the first lightweight classifier** to tag live sensor packets.

