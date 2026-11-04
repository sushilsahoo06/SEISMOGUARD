/*
 * ═══════════════════════════════════════════════════════════════════
 *  serial_reader.js — USB Cable Bridge for ESP32 -> Web Dashboard
 * ═══════════════════════════════════════════════════════════════════
 *  Usage:
 *    node serial_reader.js          (Uses default port or auto-detects)
 *    node serial_reader.js COM11    (Specify exact port)
 * ═══════════════════════════════════════════════════════════════════
 */

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// Config
const DEFAULT_PORT = process.argv[2] || 'COM6'; // e.g. node serial_reader.js COM6
const BAUD_RATE    = 115200;
const BACKEND_URL  = process.env.BACKEND_URL || process.argv[3] || 'https://shm-v5rg.onrender.com/api/sensor-data';

let packetCount = 0;
let lastStatus  = Date.now();

async function startBridge() {
  let targetPort = DEFAULT_PORT;

  // Verify / list ports
  try {
    const ports = await SerialPort.list();
    const portExists = ports.some((p) => p.path.toUpperCase() === targetPort.toUpperCase());

    if (!portExists && ports.length > 0) {
      console.log(`⚠️ Port ${targetPort} not found in available ports:`);
      ports.forEach((p) => console.log(`   - ${p.path} (${p.manufacturer || 'USB Serial'})`));
      // Auto-fallback if only 1 port exists
      if (ports.length === 1) {
        targetPort = ports[0].path;
        console.log(`👉 Auto-selecting available port: ${targetPort}`);
      }
    }
  } catch (e) {
    // Ignore listing error and proceed with targetPort
  }

  const port = new SerialPort({
    path: targetPort,
    baudRate: BAUD_RATE,
    autoOpen: false,
  });

  const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

  port.open((err) => {
    if (err) {
      console.error(`\n❌ Cannot open ${targetPort}: ${err.message}`);
      console.error('   1. Check if the port is correct (e.g. node serial_reader.js COM11)');
      console.error('   2. IMPORTANT: Is the Arduino Serial Monitor closed?');
      process.exit(1);
    }
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  SHM USB Serial Bridge ACTIVE: ${targetPort} @ ${BAUD_RATE}`);
    console.log(`  Forwarding live data to: ${BACKEND_URL}`);
    console.log('  Live Vercel Dashboard:   https://shm-kohl.vercel.app');
    console.log('  Post-Event Report:       https://shm-kohl.vercel.app/post-analysis');
    console.log('═══════════════════════════════════════════════════════');
  });

  let warnedNonJson = false;
  parser.on('data', (line) => {
    const raw = line.trim();
    if (!raw) return;
    if (!raw.startsWith('{')) {
      if (!warnedNonJson) {
        console.log(`ℹ️ [ESP32 Serial Output]: "${raw}"`);
        if (raw.includes('HTTP') || raw.includes('5000')) {
          console.log('\n⚠️ Notice: ESP32 has an old WiFi firmware loaded!');
          console.log('   👉 Please open backend/esp32_serial_firmware.ino in Arduino IDE and click Upload (Ctrl+U) to flash USB streaming mode.\n');
          warnedNonJson = true;
        }
      }
      return;
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return;
    }

    if (data.status === 'ready') {
      console.log('✅ ESP32 handshake received — sensor streaming active!\n');
      return;
    }

    // POST data to cloud or local backend via fetch
    const payload = JSON.stringify(data);
    fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    })
      .then(() => {
        packetCount++;
        const now = Date.now();
        // Log summary once every second
        if (now - lastStatus >= 1000) {
          const v1 = data.sw420_1 ? '🔴 VIB' : '⚪ IDLE';
          const v2 = data.sw420_2 ? '🔴 VIB' : '⚪ IDLE';
          console.log(
            `[📦 ${packetCount} pkts] ` +
            `B1(X=${(data.accel_x_1 ?? 0).toFixed(2)}g Y=${(data.accel_y_1 ?? 0).toFixed(2)}g Z=${(data.accel_z_1 ?? 0).toFixed(2)}g | ${v1})  ` +
            `B2(X=${(data.accel_x_2 ?? 0).toFixed(2)}g Y=${(data.accel_y_2 ?? 0).toFixed(2)}g Z=${(data.accel_z_2 ?? 0).toFixed(2)}g | ${v2})`
          );
          lastStatus = now;
        }
      })
      .catch(() => {
        // Backend not yet reachable or temporary network hiccup
      });
  });

  port.on('error', (err) => console.error(`[PORT ERR] ${err.message}`));
  port.on('close', () => {
    console.log(`\nPort closed. Total packets received: ${packetCount}`);
    process.exit(0);
  });
}

startBridge();
