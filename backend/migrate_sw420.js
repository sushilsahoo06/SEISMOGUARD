// Run once: node migrate_sw420.js
// Adds SW420 vibration sensor columns to sensor_readings table
const db = require('./config/db');
require('dotenv').config();

async function migrate() {
  console.log('Running SW420 schema migration...');
  await db.query(`
    ALTER TABLE sensor_readings
      -- SW420 #1 — Building 1 raw digital signal (0 or 1)
      ADD COLUMN IF NOT EXISTS sw420_1       INTEGER DEFAULT 0,
      -- SW420 #2 — Building 2 raw digital signal (0 or 1)
      ADD COLUMN IF NOT EXISTS sw420_2       INTEGER DEFAULT 0,
      -- Rolling event count (triggers per 50ms window, 0–N)
      ADD COLUMN IF NOT EXISTS vib_count_1   INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS vib_count_2   INTEGER DEFAULT 0;
  `);
  console.log('✅ SW420 migration complete.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
