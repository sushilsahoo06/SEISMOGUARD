const db = require('../config/db');

// Ingest sensor readings sent from ESP32
exports.receiveData = async (req, res, next) => {
  try {
    const { accel_1, accel_2, vib_1, vib_2 } = req.body;

    if (accel_1 === undefined || accel_2 === undefined) {
      return res.status(400).json({ error: 'Missing accelerometer readings' });
    }

    const queryText = `
      INSERT INTO sensor_readings (accel_1, accel_2, vib_1, vib_2)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [accel_1, accel_2, vib_1 ?? 0, vib_2 ?? 0];
    const result = await db.query(queryText, values);

    // Attach stored row to the request object for the WebSocket middleware
    req.newSensorRecord = result.rows[0];

    // Respond immediately to ESP32
    res.status(201).json({ status: 'success' });

    // Hand off to WebSocket broadcaster in server.js
    next();
  } catch (err) {
    console.error('Error recording sensor data:', err);
    res.status(500).json({ error: 'Database write error' });
  }
};

// Retrieve historical data to populate the frontend on page load
exports.getHistory = async (req, res) => {
  try {
    const queryText = `
      SELECT * FROM sensor_readings 
      ORDER BY timestamp DESC 
      LIMIT 100;
    `;
    const result = await db.query(queryText);
    res.json(result.rows.reverse()); // Chronological order for chart rendering
  } catch (err) {
    console.error('Error querying sensor history:', err);
    res.status(500).json({ error: 'Failed to retrieve records' });
  }
};

// Export full session data directly as CSV
exports.exportAllData = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM sensor_readings ORDER BY timestamp ASC');

    let csv = 'Timestamp,Accel_1,Accel_2,Vib_1,Vib_2\n';
    result.rows.forEach((row) => {
      const time = row.timestamp ? new Date(row.timestamp).toISOString() : '';
      csv += `${time},${row.accel_1},${row.accel_2},${row.vib_1},${row.vib_2}\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment(`shake_test_export_${Date.now()}.csv`);
    return res.send(csv);
  } catch (err) {
    console.error('Error generating CSV export:', err);
    res.status(500).json({ error: 'CSV export error' });
  }
};