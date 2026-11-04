// Run once: node migrate.js
// Adds all MPU6050 columns to sensor_readings table
const db = require('./config/db');
require('dotenv').config();

async function migrate() {
  console.log('Running MPU6050 schema migration...');
  await db.query(`
    ALTER TABLE sensor_readings
      ADD COLUMN IF NOT EXISTS accel_x    FLOAT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS accel_y    FLOAT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS accel_z    FLOAT DEFAULT 1,
      ADD COLUMN IF NOT EXISTS gyro_x     FLOAT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS gyro_y     FLOAT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS gyro_z     FLOAT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS temperature FLOAT DEFAULT 25,
      ADD COLUMN IF NOT EXISTS magnitude  FLOAT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS roll       FLOAT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pitch      FLOAT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS sensor_id  TEXT  DEFAULT 'mpu_1';
  `);
  console.log('Migration complete — all MPU6050 columns added.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
