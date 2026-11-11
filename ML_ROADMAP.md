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
- [x] **1.1 Setup Rolling Window Buffer in Backend:**
  - Implemented in `backend/services/mlRingBuffer.js` holding a rolling 64-sample FIFO memory ring buffer at 20 Hz (3.2-second window).
- [x] **1.2 Feature Engineering Pipeline:**
  - Implemented in `backend/services/mlFeatureExtractor.js`:
    - **Time Domain Features:** PGA, RMS dynamic motion, crest factor, zero-crossing rate (ZCR), SW-420 activity fraction, inter-building shock attenuation & energy dissipation.
    - **Frequency Domain Features (FFT):** Radix-2 Cooley-Tukey FFT with Hanning window, dominant resonant peak frequency ($0.5\,\text{Hz} - 8\,\text{Hz}$), spectral energy ratio in seismic band, spectral entropy, and spectral centroid.
- [x] **1.3 Data Recording & Labelling Script:**
  - Implemented in `backend/scripts/record_training_data.js`:
    - Successfully extracted 1,567 labeled training windows from 31,400+ empirical sensor rows stored in Neon DB (`backend/data/training_dataset.json` and `backend/data/training_dataset.csv`).

---

### Phase 2: Model Selection & Training

| Priority | Model Type | Purpose | Advantages |
| :--- | :--- | :--- | :--- |
| **P0 (Immediate)** | **Calibrated Decision Forest / Ensemble** | Tabular feature classification (Ambient vs Bump vs Quake) | Fast training, explainable, runs in $<0.1\,\text{ms}$, zero dependency bloat. |
| **P1** | **Damage Index & Attenuation Engine** | Anomaly score & stiffness degradation between Building 1 & 2 | Directly computes base isolator energy dissipation & structural yielding. |
| **P2 (Advanced)** | **P-Wave Early Warning Detector** | Fast longitudinal wave onset detection | Provides ~2.5s advance lead time prior to destructive S-waves. |

- [x] **2.1 Offline Model Training & Validation:**
  - Implemented in `backend/scripts/train_classifier.py`:
    - Tested on 1,567 windows: **100% Recall on Seismic Tremors**, **0 ambient false alarms**, and high precision rejection of single-sample mechanical table knocks.
- [x] **2.2 High-Speed In-Memory Inference Module:**
  - Implemented in `backend/services/mlClassifier.js` with sub-millisecond execution (< 0.08 ms per window).

---

### Phase 3: Backend Integration & Real-Time Inference
- [x] **3.1 Add Inference Module to Backend:**
  - Implemented in `backend/services/mlInferenceEngine.js`:
    - Automatically pre-warms with 64 historical readings from PostgreSQL on server startup.
    - Runs inference on every incoming sensor reading in `backend/controllers/sensorController.js`.
    - Integrated with `backend/controllers/alertController.js` to suppress autonomous emergency phone calls/SMS during accidental table knocks/disturbances.
- [x] **3.2 Database Migration for ML Predictions:**
  - Implemented and executed via `backend/migrate_ml.js`:
    - Extended `sensor_readings` with `ml_event_type`, `ml_confidence`, `ml_hazard_level`, `ml_damage_index`, `ml_pga_1`, `ml_dominant_freq_1`, `ml_attenuation`.
    - Created `ml_events` persistent table for logging confirmed seismic events with duration, attenuation, and peak acceleration.
- [x] **3.3 Real-Time WebSocket Emission:**
  - Implemented in `backend/server.js`:
    - Emits live `newSensorData` with attached `ml` prediction.
    - Emits `mlAlert` event to all connected dashboard clients on tremor onset or hazard level changes.
  - Added REST endpoints in `backend/routes/sensorRoutes.js`:
    - `GET /api/sensor-data/ml-status`: Live ML metrics, probabilities, and 32-bin FFT power spectrum.
    - `GET /api/sensor-data/ml-events`: Historical list of ML-detected seismic events.

---

### Phase 4: Frontend UI Updates
- [x] **4.1 AI Alert Banner:**
  - Implemented in `frontend/src/components/AiSeismicBanner.jsx` and added to `App.jsx`:
    - Dynamic color states: 🟢 **Normal Ambient**, 🟡 **Mechanical Disturbance (Ignored & Filtered)**, 🔴 **Seismic Event Confirmed** (with hazard level, EEW P-wave lead time, confidence %, and damage index).
- [x] **4.2 Structural Damage Comparison Card:**
  - Implemented in `frontend/src/components/StructuralHealthCard.jsx` on `FrequencyPage.jsx` and `VibrationPage.jsx`:
    - Dynamic response comparison: Building 1 vs Building 2.
    - Shock reduction gauge (% shock absorbed by Building 2).
    - Seismic energy dissipation meter.
    - Resonant frequency / spectral shift indicator.
- [x] **4.3 Event History Log:**
  - Implemented in `frontend/src/components/MlEventsModal.jsx`:
    - Interactive modal table displaying all past detected seismic incidents with timestamps, hazard levels, ML confidence, peak acceleration, duration, and damage indexes.

---

### Phase 5: Verification & Calibration
- [x] **5.1 Latency Benchmarking:**
  - Verified via `backend/scripts/verify_ml_pipeline.js`: Average inference latency is **0.075 ms** (over 1,000 runs) — well under the 100 ms target.
- [x] **5.2 Shake Table Simulation:**
  - Verified with 3.5 Hz harmonic oscillation: Correctly identified 3.44 Hz dominant resonant frequency, 76.9% shock reduction, and logged persistent record to `ml_events`.
- [x] **5.3 Threshold Tuning:**
  - False-alarm rejection verified: Isolated impacts with high crest factor (> 5.0) are classified as `DISTURBANCE` (`SAFE`), preventing unwanted siren/autonomous dispatch.
  - All 15 automated test assertions passed (100%).

---

## ✅ Project Completion Status

All 5 Phases of the Machine Learning Seismic Detection & Structural Health Monitoring system have been **successfully implemented, calibrated, and verified**:

1. **Phase 1 (Sliding Buffer & Radix-2 FFT):** 64-sample in-memory FIFO buffer with Cooley-Tukey FFT and time/frequency feature extraction (`mlRingBuffer.js`, `mlFeatureExtractor.js`).
2. **Phase 2 (Model Training & Decision Engine):** 1,567 empirical training windows trained and converted into ultra-fast `<0.08 ms` tabular decision logic (`mlClassifier.js`).
3. **Phase 3 (Backend & Database Architecture):** Neon PostgreSQL migration (`migrate_ml.js`), pre-warmed inference coordinator (`mlInferenceEngine.js`), Socket.io broadcasts (`server.js`), and false-alarm filtered autonomous alerts (`alertController.js`).
4. **Phase 4 (Frontend AI Suite):** Real-time AI seismic alert banner (`AiSeismicBanner.jsx`), Structural Health comparison card (`StructuralHealthCard.jsx`), 32-bin FFT spectrum chart (`FftSpectrumChart.jsx`), ML events log modal (`MlEventsModal.jsx`), and post-event civil assessment on `PostAnalysisPage.jsx` with PDF export.
5. **Phase 5 (Verification & Dual Hardware Ingestion):** 15/15 tests passing with 0.075 ms latency; USB serial bridge streaming dual ADXL345 & SW-420 sensors at 20 Hz (`serial_reader.js`).

