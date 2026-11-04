const { Pool } = require('pg');
require('dotenv').config({ path: __dirname + '/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log('Connecting to Neon PostgreSQL to set up Occupants & Emergency Alerts schema...');

    await pool.query(`
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
    console.log('✅ Table "building_occupants" ready.');

    await pool.query(`
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
    console.log('✅ Table "alert_logs" ready.');

    // Insert sample initial occupants if table is empty
    const countRes = await pool.query('SELECT COUNT(*) FROM building_occupants');
    if (parseInt(countRes.rows[0].count) === 0) {
      await pool.query(`
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

    console.log('🎉 Migration completed successfully!');
    await pool.end();
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
