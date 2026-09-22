// Run once: node migrate_dual.js
// Adds all dual MPU6050 columns to sensor_readings table
const db = require('./config/db');
require('dotenv').config();

async function migrate() {
  console.log('Running Dual MPU6050 schema migration...');
  await db.query(`
    ALTER TABLE sensor_readings
      -- MPU6050 #1 (Building 1 — Unprotected)
      ADD COLUMN IF NOT EXISTS accel_x_1    FLOAT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS accel_y_1    FLOAT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS accel_z_1    FLOAT DEFAULT 1,
      ADD COLUMN IF NOT EXISTS gyro_x_1     FLOAT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS gyro_y_1     FLOAT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS gyro_z_1     FLOAT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS temp_1       FLOAT DEFAULT 25,
      ADD COLUMN IF NOT EXISTS magnitude_1  FLOAT DEFAULT 1,
      ADD COLUMN IF NOT EXISTS roll_1       FLOAT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pitch_1      FLOAT DEFAULT 0,
      -- MPU6050 #2 (Building 2 — Resistant)
      ADD COLUMN IF NOT EXISTS accel_x_2    FLOAT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS accel_y_2    FLOAT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS accel_z_2    FLOAT DEFAULT 1,
      ADD COLUMN IF NOT EXISTS gyro_x_2     FLOAT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS gyro_y_2     FLOAT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS gyro_z_2     FLOAT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS temp_2       FLOAT DEFAULT 25,
      ADD COLUMN IF NOT EXISTS magnitude_2  FLOAT DEFAULT 1,
      ADD COLUMN IF NOT EXISTS roll_2       FLOAT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pitch_2      FLOAT DEFAULT 0;
  `);
  console.log('✅ Dual MPU6050 migration complete — all columns added.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
