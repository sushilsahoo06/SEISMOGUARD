/*
 * serial_reader.js
 * ═══════════════════════════════════════════════════════════════════
 * Reads JSON lines from ESP32 over USB Serial and POSTs to backend.
 * Run: node serial_reader.js
 *
 * USAGE:
 *  1. Find your COM port:
 *     - Windows: Device Manager → Ports (COM & LPT) → e.g. COM3
 *  2. Edit COM_PORT below to match your port
 *  3. Run: node serial_reader.js
 * ═══════════════════════════════════════════════════════════════════
 */

const { SerialPort }    = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const http = require('http');

// ── CONFIGURE THESE TWO LINES ─────────────────────────────────────
const COM_PORT    = 'COM3';               // ← change to your port (COM3, COM5, etc.)
const BAUD_RATE   = 115200;              // must match ESP32 Serial.begin(115200)
const BACKEND_URL = 'http://localhost:5000/api/sensor-data';
// ─────────────────────────────────────────────────────────────────

let packetCount = 0;
let errorCount  = 0;
let lastStatus  = Date.now();

// Open serial port
const port = new SerialPort({
  path: COM_PORT,
  baudRate: BAUD_RATE,
  autoOpen: false,
});

// Parse line-by-line (each JSON packet ends with \n)
const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

port.open((err) => {
  if (err) {
    console.error(`❌ Cannot open ${COM_PORT}: ${err.message}`);
    console.error('   → Check: Is the port correct? Is Arduino Serial Monitor closed?');
    process.exit(1);
  }
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  SHM Serial Reader — ${COM_PORT} @ ${BAUD_RATE} baud`);
  console.log(`  Forwarding to: ${BACKEND_URL}`);
  console.log('═══════════════════════════════════════════════════════');
});

// Handle each incoming line from ESP32
parser.on('data', (line) => {
  const raw = line.trim();
  if (!raw || !raw.startsWith('{')) return; // skip empty / non-JSON lines

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.warn(`[PARSE ERR] ${raw}`);
    return;
  }

  // Show ESP32 ready message
  if (data.status === 'ready') {
    console.log('✅ ESP32 connected and sending data!\n');
    return;
  }
  if (data.error) {
    console.error(`❌ ESP32 error: ${data.error}`);
    return;
  }

  // POST to backend
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

  const req = http.request(options, (res) => {
    packetCount++;

    // Print status every second (not every 50ms — too noisy)
    const now = Date.now();
    if (now - lastStatus >= 1000) {
      const sw1 = data.sw420_1 ? '🔴VIB' : '⚪---';
      const sw2 = data.sw420_2 ? '🔴VIB' : '⚪---';
      console.log(
        `[📦 ${packetCount} pkts] ` +
        `ax1=${(data.accel_x_1 ?? 0).toFixed(3)}g  ax2=${(data.accel_x_2 ?? 0).toFixed(3)}g  ` +
        `SW420_1=${sw1}(${data.vib_count_1 ?? 0})  SW420_2=${sw2}(${data.vib_count_2 ?? 0})  ` +
        `T1=${data.temp_1 ?? '—'}°C  T2=${data.temp_2 ?? '—'}°C`
      );
      lastStatus = now;
    }
  });

  req.on('error', (err) => {
    errorCount++;
    if (errorCount <= 3) {
      console.error(`[POST ERR] ${err.message} — is backend running on port 5000?`);
    }
  });

  req.write(payload);
  req.end();
});

// Handle port errors
port.on('error', (err) => {
  console.error(`[PORT ERR] ${err.message}`);
});

port.on('close', () => {
  console.log(`\nPort ${COM_PORT} closed. Total packets sent: ${packetCount}`);
  process.exit(0);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n\nStopping... ${packetCount} packets forwarded, ${errorCount} errors.`);
  port.close();
});
