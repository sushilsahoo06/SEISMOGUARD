const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Endpoint for ESP32 to POST readings
app.post('/api/sensor-data', async (req, res) => {
  try {
    const { accel_1, accel_2, vib_1, vib_2 } = req.body;

    const query = `
      INSERT INTO sensor_readings (accel_1, accel_2, vib_1, vib_2)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [accel_1, accel_2, vib_1, vib_2];
    const result = await pool.query(query, values);
    const savedRecord = result.rows[0];

    // Broadcast in real-time to React frontend via WebSockets
    io.emit('newSensorData', savedRecord);

    return res.status(201).json({ success: true, data: savedRecord });
  } catch (error) {
    console.error('Error saving sensor data:', error);
    return res.status(500).json({ error: 'Server error saving data' });
  }
});

// Endpoint to fetch historical data for charts
app.get('/api/sensor-data/history', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM sensor_readings ORDER BY timestamp DESC LIMIT 50'
    );
    res.json(result.rows.reverse());
  } catch (error) {
    res.status(500).json({ error: 'Error fetching history' });
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});