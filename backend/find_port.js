// Run: node find_port.js
// Lists all available serial ports so you can find your ESP32 COM port
const { SerialPort } = require('serialport');

SerialPort.list().then((ports) => {
  console.log('\n══════════════════════════════════════════');
  console.log('  Available Serial Ports:');
  console.log('══════════════════════════════════════════');
  if (ports.length === 0) {
    console.log('No ports found. Is ESP32 plugged in?');
  } else {
    ports.forEach((p) => {
      const isESP = p.manufacturer?.includes('Silicon') || 
                    p.manufacturer?.includes('CP210') ||
                    p.manufacturer?.includes('CH340') ||
                    p.manufacturer?.includes('FTDI') ||
                    p.pnpId?.includes('USB');
      const tag = isESP ? '  ← Likely ESP32!' : '';
      console.log(`  ${p.path.padEnd(8)} ${(p.manufacturer || 'Unknown').padEnd(30)} ${tag}`);
    });
  }
  console.log('══════════════════════════════════════════');
  console.log('  Update COM_PORT in serial_reader.js\n');
});
