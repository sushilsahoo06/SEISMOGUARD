/**
 * Master Database Initializer for Neon PostgreSQL
 * Sets up all tables: sensor_readings, ml_events, building_occupants, alert_logs
 */
const { Pool } = require('pg');
require('dotenv').config({ path: __dirname + '/.env' });

if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL is not set in backend/.env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initAllTables() {
  console.log('🔄 Connecting to Neon PostgreSQL...');
  try {
    const client = await pool.connect();
    console.log('✅ Connected to database successfully!');

    // 1. sensor_readings table
    console.log('Creating table "sensor_readings"...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS sensor_readings (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        accel_1 FLOAT DEFAULT 0,
        accel_2 FLOAT DEFAULT 0,
        vib_1 FLOAT DEFAULT 0,
        vib_2 FLOAT DEFAULT 0,
        accel_x_1 FLOAT DEFAULT 0,
        accel_y_1 FLOAT DEFAULT 0,
        accel_z_1 FLOAT DEFAULT 1,
        gyro_x_1 FLOAT DEFAULT 0,
        gyro_y_1 FLOAT DEFAULT 0,
        gyro_z_1 FLOAT DEFAULT 0,
        temp_1 FLOAT DEFAULT 25,
        magnitude_1 FLOAT DEFAULT 1,
        roll_1 FLOAT DEFAULT 0,
        pitch_1 FLOAT DEFAULT 0,
        accel_x_2 FLOAT DEFAULT 0,
        accel_y_2 FLOAT DEFAULT 0,
        accel_z_2 FLOAT DEFAULT 1,
        gyro_x_2 FLOAT DEFAULT 0,
        gyro_y_2 FLOAT DEFAULT 0,
        gyro_z_2 FLOAT DEFAULT 0,
        temp_2 FLOAT DEFAULT 25,
        magnitude_2 FLOAT DEFAULT 1,
        roll_2 FLOAT DEFAULT 0,
        pitch_2 FLOAT DEFAULT 0,
        sw420_1 INTEGER DEFAULT 0,
        sw420_2 INTEGER DEFAULT 0,
        vib_count_1 INTEGER DEFAULT 0,
        vib_count_2 INTEGER DEFAULT 0,
        ml_event_type VARCHAR(50) DEFAULT 'NORMAL',
        ml_confidence REAL DEFAULT 0.0,
        ml_hazard_level VARCHAR(20) DEFAULT 'SAFE',
        ml_damage_index REAL DEFAULT 0.0,
        ml_pga_1 REAL DEFAULT 0.0,
        ml_dominant_freq_1 REAL DEFAULT 0.0,
        ml_attenuation REAL DEFAULT 0.0
      );
    `);
    console.log('✅ "sensor_readings" table ready.');

    // 2. ml_events table
    console.log('Creating table "ml_events"...');
    await client.query(`
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
    console.log('✅ "ml_events" table ready.');

    // 3. building_occupants table
    console.log('Creating table "building_occupants"...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS building_occupants (
        id SERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        phone VARCHAR(40) NOT NULL,
        building_id VARCHAR(50) DEFAULT 'Building 1',
        room_number VARCHAR(50) DEFAULT 'Room 101',
        floor INT DEFAULT 1,
        status VARCHAR(50) DEFAULT 'Inside Building',
        relative_name VARCHAR(120),
        relative_phone VARCHAR(40),
        relative_relation VARCHAR(50) DEFAULT 'Family',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ "building_occupants" table ready.');

    // 4. alert_logs table
    console.log('Creating table "alert_logs"...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS alert_logs (
        id SERIAL PRIMARY KEY,
        occupant_id INT REFERENCES building_occupants(id) ON DELETE SET NULL,
        recipient_name VARCHAR(120),
        recipient_phone VARCHAR(40),
        recipient_type VARCHAR(40),
        alert_type VARCHAR(40),
        status VARCHAR(50),
        message_body TEXT,
        twilio_sid VARCHAR(100),
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ "alert_logs" table ready.');

    // Seed sample occupants if table is empty
    const occCount = await client.query('SELECT COUNT(*) FROM building_occupants');
    if (parseInt(occCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO building_occupants 
        (name, phone, building_id, room_number, floor, status, relative_name, relative_phone, relative_relation)
        VALUES 
        ('Sushil Sahoo', '+919876543210', 'Building 1', 'Flat 402', 4, 'Inside Building', 'Ramesh Sahoo (Father)', '+919123456789', 'Father'),
        ('Ananya Sharma', '+919811223344', 'Building 1', 'Flat 201', 2, 'Inside Building', 'Vikram Sharma (Spouse)', '+919899001122', 'Spouse'),
        ('Rajesh Kumar', '+919765432100', 'Building 2', 'Suite 105', 1, 'Inside Building', 'Pooja Kumar (Sister)', '+919755443322', 'Sister'),
        ('Priya Patel', '+919988776655', 'Building 1', 'Flat 303', 3, 'Evacuated / Safe', 'Amit Patel (Brother)', '+919977665544', 'Brother');
      `);
      console.log('✅ Inserted initial sample occupants.');
    }

    client.release();
    console.log('\n🎉 ALL TABLES INITIALIZED SUCCESSFULLY!');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Table initialization failed:', err);
    process.exit(1);
  }
}

initAllTables();

