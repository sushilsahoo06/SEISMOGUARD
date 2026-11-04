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
const http = require('http');

// Config
const DEFAULT_PORT = process.argv[2] || 'COM6'; // Can pass port as: node serial_reader.js COM11
const BAUD_RATE    = 115200;
const BACKEND_URL  = 'http://localhost:5000/api/sensor-data';

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
    console.log('  Open Web Dashboard at: http://localhost:5173');
    console.log('═══════════════════════════════════════════════════════');
  });

  parser.on('data', (line) => {
    const raw = line.trim();
    if (!raw || !raw.startsWith('{')) return; // Ignore non-JSON lines

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

    // POST data to Express backend
    const payload = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/sensor-data',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = http.request(options, () => {
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
    });

    req.on('error', () => {
      // Backend not yet reachable
    });

    req.write(payload);
    req.end();
  });

  port.on('error', (err) => console.error(`[PORT ERR] ${err.message}`));
  port.on('close', () => {
    console.log(`\nPort closed. Total packets received: ${packetCount}`);
    process.exit(0);
  });
}

startBridge();
