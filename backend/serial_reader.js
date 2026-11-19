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

// ANSI Color Codes
const RESET    = '\x1b[0m';
const BOLD     = '\x1b[1m';
const DIM      = '\x1b[2m';
const RED      = '\x1b[31m';
const GREEN    = '\x1b[32m';
const YELLOW   = '\x1b[33m';
const BLUE     = '\x1b[34m';
const MAGENTA  = '\x1b[35m';
const CYAN     = '\x1b[36m';
const BG_RED   = '\x1b[41m\x1b[37m\x1b[1m';

// Helper to format values in yellow
function fmtVal(val) {
  return `${YELLOW}${(val ?? 0).toFixed(2)}g${RESET}`;
}

// Config
const DEFAULT_PORT = process.argv[2] || 'COM6';
const BAUD_RATE    = 115200;
const BACKEND_URL  = process.env.BACKEND_URL || process.argv[3] || 'https://shm-v5rg.onrender.com/api/sensor-data';

let packetCount = 0;
let lastStatus  = Date.now();

async function startBridge() {
  let targetPort = DEFAULT_PORT;

  // Verify / list ports and auto-detect ESP32 USB chip
  try {
    const ports = await SerialPort.list();
    const espPort = ports.find((p) => {
      const desc = `${p.manufacturer || ''} ${p.friendlyName || ''} ${p.pnpId || ''}`.toLowerCase();
      return desc.includes('cp210') || desc.includes('silicon labs') || desc.includes('ch340') || desc.includes('ftdi') || desc.includes('usb to uart');
    });

    if (espPort) {
      targetPort = espPort.path;
    } else {
      const portExists = ports.some((p) => p.path.toUpperCase() === targetPort.toUpperCase());
      if (!portExists) {
        console.log(`${YELLOW}⏳ ESP32 USB cable unplugged. Waiting for connection... (Retrying in 2s)${RESET}`);
        setTimeout(() => startBridge(), 2000);
        return;
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
      console.log(`${YELLOW}⏳ Cannot open ${targetPort} (${err.message}). Waiting for ESP32... (Retrying in 2s)${RESET}`);
      setTimeout(() => startBridge(), 2000);
      return;
    }
    console.log(`${CYAN}═══════════════════════════════════════════════════════${RESET}`);
    console.log(`  ${BOLD}SHM USB Serial Bridge ACTIVE:${RESET} ${GREEN}${targetPort}${RESET} @ ${YELLOW}${BAUD_RATE}${RESET}`);
    console.log(`  Forwarding live data to: ${DIM}${BACKEND_URL}${RESET}`);
    console.log(`  Live Dashboard:          ${CYAN}http://localhost:5173/frequency${RESET}`);
    console.log(`  Post-Event Report:       ${CYAN}http://localhost:5173/post-analysis${RESET}`);
    console.log(`${CYAN}═══════════════════════════════════════════════════════${RESET}`);
  });

  let warnedNonJson = false;
  parser.on('data', (line) => {
    const raw = line.trim();
    if (!raw) return;
    if (!raw.startsWith('{')) {
      if (!warnedNonJson) {
        console.log(`${DIM}ℹ️ [ESP32 Serial Output]: "${raw}"${RESET}`);
        if (raw.includes('HTTP') || raw.includes('5000')) {
          console.log(`\n${YELLOW}⚠️ Notice: ESP32 has an old WiFi firmware loaded!${RESET}`);
          console.log(`   👉 Please open backend/esp32_serial_firmware.ino in Arduino IDE and click Upload (Ctrl+U) to flash USB streaming mode.\n`);
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
      console.log(`${GREEN}${BOLD}✅ ESP32 handshake received — sensor streaming active!${RESET}\n`);
      return;
    }

    // POST data to BOTH Cloud Render (for Vercel) and Localhost (for local dashboard)
    const payload = JSON.stringify(data);

    // Fast-path local dispatch (timeout 3000ms)
    fetch('http://localhost:5000/api/sensor-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      signal: AbortSignal.timeout(3000),
    }).catch(() => {});

    // Async cloud dispatch (timeout 800ms, non-blocking)
    fetch('https://shm-v5rg.onrender.com/api/sensor-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      signal: AbortSignal.timeout(800),
    }).catch(() => {});

    packetCount++;
    const now = Date.now();
    // Log summary once every second
    if (now - lastStatus >= 1000) {
      // High-visibility status indicator: Red badge for vibration, green for idle
      const v1 = data.sw420_1 ? `${BG_RED} ◈ VIB ${RESET}` : `${GREEN}○ IDLE${RESET}`;
      const v2 = data.sw420_2 ? `${BG_RED} ◈ VIB ${RESET}` : `${GREEN}○ IDLE${RESET}`;

      const pkts = `${DIM}[📦 ${packetCount} pkts]${RESET}`;
      const isDead1 = (!data.accel_x_1 && !data.accel_y_1 && !data.accel_z_1);
      const isDead2 = (!data.accel_x_2 && !data.accel_y_2 && !data.accel_z_2);
      const b1 = isDead1
        ? `${CYAN}${BOLD}B1${RESET}(${RED}OFFLINE / DEAD${RESET})`
        : `${CYAN}${BOLD}B1${RESET}(X=${fmtVal(data.accel_x_1)} Y=${fmtVal(data.accel_y_1)} Z=${fmtVal(data.accel_z_1)} | ${v1})`;
      const b2 = isDead2
        ? `${MAGENTA}${BOLD}B2${RESET}(${RED}OFFLINE / DEAD${RESET})`
        : `${MAGENTA}${BOLD}B2${RESET}(X=${fmtVal(data.accel_x_2)} Y=${fmtVal(data.accel_y_2)} Z=${fmtVal(data.accel_z_2)} | ${v2})`;

      console.log(`${pkts} ${b1}  ${b2}`);
      lastStatus = now;
    }
  });

  port.on('error', (err) => console.error(`\n${RED}[PORT ERR] ${err.message}${RESET}`));
  port.on('close', () => {
    console.log(`\n${YELLOW}Port closed. Total packets: ${packetCount}. Reconnecting in 2s...${RESET}`);
    setTimeout(() => startBridge(), 2000);
  });
}

startBridge();