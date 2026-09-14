const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const sensorRoutes = require('./routes/sensorRoutes');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173', // Vite default development URL
    methods: ['GET', 'POST'],
  },
});

// Middlewares
app.use(cors());
app.use(express.json());

// Main Sensor API Routes
app.use('/api/sensor-data', sensorRoutes);

// WebSocket Broadcast Middleware (runs right after controller's receiveData)
app.use('/api/sensor-data', (req, res) => {
  if (req.newSensorRecord) {
    io.emit('newSensorData', req.newSensorRecord);
  }
});

// WebSocket Connection Events
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// Start HTTP + WebSocket Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('===================================================');
  console.log(`Structural Health Monitoring Server running on port ${PORT}`);
  console.log(`Local Access: http://localhost:${PORT}`);
  console.log('===================================================');
});