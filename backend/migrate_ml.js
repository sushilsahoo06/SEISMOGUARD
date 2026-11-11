/**
 * migrate_ml.js
 * Adds ML prediction columns to sensor_readings and creates ml_events table.
 */
const db = require('./config/db');
require('dotenv').config();

async function migrate() {
  console.log('Running ML Schema Migration on PostgreSQL / Neon...');

  // 1. Extend sensor_readings with ML metadata
  await db.query(`
    ALTER TABLE sensor_readings
      ADD COLUMN IF NOT EXISTS ml_event_type       VARCHAR(50) DEFAULT 'NORMAL',
      ADD COLUMN IF NOT EXISTS ml_confidence       REAL DEFAULT 0.0,
      ADD COLUMN IF NOT EXISTS ml_hazard_level     VARCHAR(20) DEFAULT 'SAFE',
      ADD COLUMN IF NOT EXISTS ml_damage_index     REAL DEFAULT 0.0,
      ADD COLUMN IF NOT EXISTS ml_pga_1            REAL DEFAULT 0.0,
      ADD COLUMN IF NOT EXISTS ml_dominant_freq_1   REAL DEFAULT 0.0,
      ADD COLUMN IF NOT EXISTS ml_attenuation      REAL DEFAULT 0.0;
  `);
  console.log('✅ Added ML columns to sensor_readings table.');

  // 2. Create ml_events table for logging persistent earthquake tremor events
  await db.query(`
    CREATE TABLE IF NOT EXISTS ml_events (
      id SERIAL PRIMARY KEY,
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      event_type VARCHAR(50) NOT NULL,
      hazard_level VARCHAR(20) NOT NULL,
      confidence REAL DEFAULT 0.0,
      pga_1 REAL DEFAULT 0.0,
      pga_2 REAL DEFAULT 0.0,
      attenuation_pct REAL DEFAULT 0.0,
      dominant_freq_1 REAL DEFAULT 0.0,
      dominant_freq_2 REAL DEFAULT 0.0,
      damage_index REAL DEFAULT 0.0,
      duration_sec REAL DEFAULT 0.0,
      status_message TEXT,
      features JSONB
    );
  `);
  console.log('✅ Created ml_events table.');

  process.exit(0);
}

migrate().catch((err) => {
  console.error('ML Migration failed:', err);
  process.exit(1);
});

