// backend/simulate_esp32.js
const http = require('http');

const BACKEND_HOST = 'localhost';
const BACKEND_PORT = 5000;
const SAMPLE_RATE_MS = 50; // 20 Hz stream for dense seismic spikes

let step = 0;

function generateSeismicSpikes(t) {
  // 1. High-frequency base vibration chatter
  const noise1 = (Math.random() - 0.5) * 1.8;
  const highFreqChatter = Math.sin(t * 1.7) * 0.8 + Math.cos(t * 3.1) * 0.5;

  // 2. Periodic seismic impact shocks (spikes hitting +3.0 to +5.0)
  const isShock = Math.sin(t * 0.25) > 0.65;
  const shockSpike = isShock ? Math.random() * 2.8 : 0;

  // Building 1 (Unprotected): Chaotic, high-energy impact spikes
  let vib1 = 1.0 + highFreqChatter + noise1 + shockSpike;
  vib1 = Math.max(-0.4, Math.min(5.0, vib1)); // Clamped to [-0.4, 5.0]

  // Building 2 (Resistant): Damped baseline near 0.1 - 0.3 with rare small transient bumps
  const dampedNoise = (Math.random() - 0.5) * 0.15;
  const dampedShock = isShock ? Math.random() * 0.9 : 0;
  let vib2 = 0.2 + (Math.sin(t * 0.5) * 0.08) + dampedNoise + dampedShock;
  vib2 = Math.max(0.0, Math.min(1.6, vib2)); // Clamped

  // Keep accelerations synchronized
  const accel1 = parseFloat(((vib1 - 1.0) * 0.45).toFixed(2));
  const accel2 = parseFloat((vib2 * 0.15).toFixed(2));

  return {
    accel_1: accel1,
    accel_2: accel2,
    vib_1: parseFloat(vib1.toFixed(2)),
    vib_2: parseFloat(vib2.toFixed(2))
  };
}

function sendDataPacket() {
  const data = generateSeismicSpikes(step);
  const payload = JSON.stringify(data);
  step += 1;

  const options = {
    hostname: BACKEND_HOST,
    port: BACKEND_PORT,
    path: '/api/sensor-data',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  const req = http.request(options, (res) => {
    const isDanger = data.vib_1 >= 3.0 ? '⚠️ DANGER SPIKE' : '✅ NORMAL      ';
    console.log(`[#${String(step).padStart(4, '0')}] ${isDanger} | Bldg1 Vib: ${data.vib_1.toFixed(2)} | Bldg2 Vib: ${data.vib_2.toFixed(2)}`);
  });

  req.on('error', (err) => {
    console.error(`[Error]: ${err.message}`);
  });

  req.write(payload);
  req.end();
}

console.log("================================================================================");
console.log("            SIMULATOR: HIGH-FREQUENCY SEISMIC IMPACT SPIKES                     ");
console.log("================================================================================");

setInterval(sendDataPacket, SAMPLE_RATE_MS);