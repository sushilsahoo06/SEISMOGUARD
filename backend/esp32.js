// backend/esp32.js — Dual MPU6050 Simulator
// Simulates two MPU6050 sensors:
//   Sensor 1 → Building 1 (Unprotected) — higher vibration, chaotic
//   Sensor 2 → Building 2 (Resistant)   — damped, stable

const http = require('http');

const BACKEND_HOST  = 'localhost';
const BACKEND_PORT  = 5000;
const SAMPLE_RATE_MS = 50; // 20 Hz

let step  = 0;
let temp1 = 28.5; // MPU6050 #1 die temperature
let temp2 = 27.8; // MPU6050 #2 die temperature

function generateDualMPU6050(t) {
  // ── Seismic event window ──────────────────────────────────────────────────
  const quakeActive = Math.sin(t * 0.3) > 0.6;
  const shockAmp    = quakeActive ? (Math.random() * 0.7 + 0.4) : 0;

  // ══ MPU6050 #1 — Building 1 (Unprotected) ════════════════════════════════
  // Higher baseline vibration + large shock spikes during quake
  const ax1 = parseFloat((Math.sin(t * 1.8) * 0.18 + (Math.random() - 0.5) * 0.12 + shockAmp * (Math.random() - 0.5) * 1.5).toFixed(4));
  const ay1 = parseFloat((Math.cos(t * 2.1) * 0.14 + (Math.random() - 0.5) * 0.10 + shockAmp * (Math.random() - 0.5) * 1.2).toFixed(4));
  const az1 = parseFloat((1.0 + Math.sin(t * 0.5) * 0.06 + (Math.random() - 0.5) * 0.04 + shockAmp * Math.random() * 0.20).toFixed(4));

  const gx1 = parseFloat((Math.sin(t * 1.1) * 3.5 + (Math.random() - 0.5) * 1.8 + shockAmp * (Math.random() - 0.5) * 25).toFixed(3));
  const gy1 = parseFloat((Math.cos(t * 0.9) * 2.8 + (Math.random() - 0.5) * 1.5 + shockAmp * (Math.random() - 0.5) * 20).toFixed(3));
  const gz1 = parseFloat((Math.sin(t * 0.4) * 1.5 + (Math.random() - 0.5) * 1.0 + shockAmp * (Math.random() - 0.5) * 10).toFixed(3));

  temp1 += (Math.random() - 0.49) * 0.05; // slightly warmer (more vibration energy)
  temp1  = Math.max(26, Math.min(40, temp1));

  // ══ MPU6050 #2 — Building 2 (Resistant) ══════════════════════════════════
  // Damped — much smaller motion, even during quake
  const dampFactor = 0.12; // 88% energy absorbed
  const ax2 = parseFloat(((Math.sin(t * 1.8) * 0.02 + (Math.random() - 0.5) * 0.015 + shockAmp * (Math.random() - 0.5) * dampFactor)).toFixed(4));
  const ay2 = parseFloat(((Math.cos(t * 2.1) * 0.015 + (Math.random() - 0.5) * 0.01 + shockAmp * (Math.random() - 0.5) * (dampFactor * 0.8))).toFixed(4));
  const az2 = parseFloat((1.0 + Math.sin(t * 0.5) * 0.008 + (Math.random() - 0.5) * 0.005 + shockAmp * Math.random() * 0.02).toFixed(4));

  const gx2 = parseFloat((Math.sin(t * 1.1) * 0.4 + (Math.random() - 0.5) * 0.3 + shockAmp * (Math.random() - 0.5) * 3).toFixed(3));
  const gy2 = parseFloat((Math.cos(t * 0.9) * 0.3 + (Math.random() - 0.5) * 0.25 + shockAmp * (Math.random() - 0.5) * 2.5).toFixed(3));
  const gz2 = parseFloat((Math.sin(t * 0.4) * 0.2 + (Math.random() - 0.5) * 0.15 + shockAmp * (Math.random() - 0.5) * 1.2).toFixed(3));

  temp2 += (Math.random() - 0.49) * 0.03;
  temp2  = Math.max(25, Math.min(35, temp2));

  // ══ SW420 #1 — Building 1 (Unprotected) ═════════════════════════════════
  // Higher vibration → triggers frequently during quake, occasionally at rest
  // Probability of trigger: 85% during quake, 8% at rest
  const sw420TriggerProb1 = quakeActive ? 0.85 : 0.08;
  const sw420_1 = Math.random() < sw420TriggerProb1 ? 1 : 0;

  // ══ SW420 #2 — Building 2 (Resistant) ════════════════════════════════════
  // Damped structure → rarely triggers even during quake
  // Probability: 20% during quake, 2% at rest
  const sw420TriggerProb2 = quakeActive ? 0.20 : 0.02;
  const sw420_2 = Math.random() < sw420TriggerProb2 ? 1 : 0;

  // Rolling vib_count: simulates how many times SW420 fired in the last 50ms
  // (on real ESP32 you'd count interrupts in the interval)
  const vib_count_1 = quakeActive ? Math.floor(Math.random() * 8) + 2 : Math.floor(Math.random() * 2);
  const vib_count_2 = quakeActive ? Math.floor(Math.random() * 2)     : 0;

  return {
    // ── MPU6050 #1 ──
    accel_x_1: ax1, accel_y_1: ay1, accel_z_1: az1,
    gyro_x_1:  gx1, gyro_y_1:  gy1, gyro_z_1:  gz1,
    temp_1:    parseFloat(temp1.toFixed(2)),
    // ── MPU6050 #2 ──
    accel_x_2: ax2, accel_y_2: ay2, accel_z_2: az2,
    gyro_x_2:  gx2, gyro_y_2:  gy2, gyro_z_2:  gz2,
    temp_2:    parseFloat(temp2.toFixed(2)),
    // ── SW420 #1 & #2 ──
    sw420_1, sw420_2,
    vib_count_1, vib_count_2,
  };
}

function sendDataPacket() {
  const data    = generateDualMPU6050(step);
  const payload = JSON.stringify(data);
  step += 1;

  const options = {
    hostname: BACKEND_HOST,
    port:     BACKEND_PORT,
    path:     '/api/sensor-data',
    method:   'POST',
    headers: {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  const req = http.request(options);

  const mag1  = Math.sqrt(data.accel_x_1**2 + data.accel_y_1**2 + data.accel_z_1**2);
  const alert = mag1 > 1.5 ? '⚠️ SEISMIC' : '✅ NOMINAL';
  const s1    = data.sw420_1 ? '🔴VIB' : '⚪---';
  const s2    = data.sw420_2 ? '🔴VIB' : '⚪---';
  console.log(
    `[#${String(step).padStart(4,'0')}] ${alert} | ` +
    `MPU1: ax=${data.accel_x_1.toFixed(3)} T=${data.temp_1}°C SW420=${s1}(${data.vib_count_1}) | ` +
    `MPU2: ax=${data.accel_x_2.toFixed(3)} T=${data.temp_2}°C SW420=${s2}(${data.vib_count_2})`
  );

  req.on('error', (err) => console.error(`[Error]: ${err.message}`));
  req.write(payload);
  req.end();
}

console.log('═══════════════════════════════════════════════════════════════════');
console.log('  DUAL MPU6050 SIMULATOR — Building 1 (Raw) vs Building 2 (Damped)');
console.log('═══════════════════════════════════════════════════════════════════');

setInterval(sendDataPacket, SAMPLE_RATE_MS);