const db = require('../config/db');

// Helper: compute derived orientation values from accel axes
function deriveOrientation(ax, ay, az) {
  const magnitude = parseFloat(Math.sqrt(ax * ax + ay * ay + az * az).toFixed(4));
  const roll      = parseFloat((Math.atan2(ay, az) * (180 / Math.PI)).toFixed(3));
  const pitch     = parseFloat((Math.atan2(-ax, Math.sqrt(ay * ay + az * az)) * (180 / Math.PI)).toFixed(3));
  return { magnitude, roll, pitch };
}

// Ingest dual MPU6050 sensor readings from ESP32
// Expects flat JSON: { accel_x_1, accel_y_1, accel_z_1, gyro_x_1 ... temp_1, accel_x_2 ... temp_2 }
exports.receiveData = async (req, res, next) => {
  try {
    const {
      // MPU6050 #1 — Building 1 (Unprotected)
      accel_x_1 = 0, accel_y_1 = 0, accel_z_1 = 1,
      gyro_x_1  = 0, gyro_y_1  = 0, gyro_z_1  = 0,
      temp_1    = 25,
      // MPU6050 #2 — Building 2 (Resistant)
      accel_x_2 = 0, accel_y_2 = 0, accel_z_2 = 1,
      gyro_x_2  = 0, gyro_y_2  = 0, gyro_z_2  = 0,
      temp_2    = 25,
      // SW420 vibration switches (digital: 0 or 1)
      sw420_1     = 0, sw420_2     = 0,
      // Rolling pulse count per sample window
      vib_count_1 = 0, vib_count_2 = 0,
    } = req.body;

    // Compute derived values for both sensors
    const d1 = deriveOrientation(accel_x_1, accel_y_1, accel_z_1);
    const d2 = deriveOrientation(accel_x_2, accel_y_2, accel_z_2);

    // Legacy scalar fields (kept for backward compat with old simulator / old charts)
    const vib_1  = parseFloat(Math.min(5.0, d1.magnitude * 3).toFixed(2));
    const vib_2  = parseFloat(Math.min(1.6, d2.magnitude * 0.8).toFixed(2));
    const accel_1 = parseFloat(accel_x_1.toFixed(4));
    const accel_2 = parseFloat(accel_x_2.toFixed(4));

    const queryText = `
      INSERT INTO sensor_readings (
        accel_1, accel_2, vib_1, vib_2,
        accel_x_1, accel_y_1, accel_z_1, gyro_x_1, gyro_y_1, gyro_z_1, temp_1, magnitude_1, roll_1, pitch_1,
        accel_x_2, accel_y_2, accel_z_2, gyro_x_2, gyro_y_2, gyro_z_2, temp_2, magnitude_2, roll_2, pitch_2,
        sw420_1, sw420_2, vib_count_1, vib_count_2
      ) VALUES (
        $1,$2,$3,$4,
        $5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
        $15,$16,$17,$18,$19,$20,$21,$22,$23,$24,
        $25,$26,$27,$28
      ) RETURNING *;
    `;

    const values = [
      accel_1, accel_2, vib_1, vib_2,
      accel_x_1, accel_y_1, accel_z_1, gyro_x_1, gyro_y_1, gyro_z_1, temp_1, d1.magnitude, d1.roll, d1.pitch,
      accel_x_2, accel_y_2, accel_z_2, gyro_x_2, gyro_y_2, gyro_z_2, temp_2, d2.magnitude, d2.roll, d2.pitch,
      sw420_1 ? 1 : 0, sw420_2 ? 1 : 0,
      Math.max(0, parseInt(vib_count_1) || 0),
      Math.max(0, parseInt(vib_count_2) || 0),
    ];

    const result = await db.query(queryText, values);
    req.newSensorRecord = result.rows[0];

    res.status(201).json({ status: 'success' });
    next();
  } catch (err) {
    console.error('Error recording sensor data:', err);
    res.status(500).json({ error: 'Database write error' });
  }
};

// Retrieve last 100 records for history load
exports.getHistory = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM sensor_readings
      ORDER BY timestamp DESC
      LIMIT 100;
    `);
    res.json(result.rows.reverse());
  } catch (err) {
    console.error('Error querying sensor history:', err);
    res.status(500).json({ error: 'Failed to retrieve records' });
  }
};

// Export full session as CSV (all dual-sensor fields)
exports.exportAllData = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM sensor_readings ORDER BY timestamp ASC');

    const header = [
      'Timestamp',
      'AX1','AY1','AZ1','GX1','GY1','GZ1','Temp1','Mag1','Roll1','Pitch1',
      'AX2','AY2','AZ2','GX2','GY2','GZ2','Temp2','Mag2','Roll2','Pitch2',
      'SW420_1','SW420_2','VibCount1','VibCount2',
    ].join(',') + '\n';

    const rows = result.rows.map((r) => {
      const t = r.timestamp ? new Date(r.timestamp).toISOString() : '';
      return [
        t,
        r.accel_x_1??0, r.accel_y_1??0, r.accel_z_1??0, r.gyro_x_1??0, r.gyro_y_1??0, r.gyro_z_1??0, r.temp_1??25, r.magnitude_1??1, r.roll_1??0, r.pitch_1??0,
        r.accel_x_2??0, r.accel_y_2??0, r.accel_z_2??0, r.gyro_x_2??0, r.gyro_y_2??0, r.gyro_z_2??0, r.temp_2??25, r.magnitude_2??1, r.roll_2??0, r.pitch_2??0,
        r.sw420_1??0, r.sw420_2??0, r.vib_count_1??0, r.vib_count_2??0,
      ].join(',');
    }).join('\n');

    res.header('Content-Type', 'text/csv');
    res.attachment(`dual_mpu6050_export_${Date.now()}.csv`);
    return res.send(header + rows);
  } catch (err) {
    console.error('CSV export error:', err);
    res.status(500).json({ error: 'CSV export error' });
  }
};