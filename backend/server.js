const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const sensorRoutes = require('./routes/sensorRoutes');
const occupantRoutes = require('./routes/occupantRoutes');
const alertRoutes = require('./routes/alertRoutes');
const alertController = require('./controllers/alertController');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with open CORS for both local and deployed frontend
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Middlewares
app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => res.json({ status: 'ok', server: 'SHM Live Backend', timestamp: new Date() }));

// API Routes
app.use('/api/sensor-data', sensorRoutes);
app.use('/api/occupants', occupantRoutes);
app.use('/api/alerts', alertRoutes);

// WebSocket Broadcast Middleware (runs right after controller's receiveData)
app.use('/api/sensor-data', (req, res) => {
  if (req.newSensorRecord) {
    io.emit('newSensorData', req.newSensorRecord);
    // ⚡ Autonomous Life-Safety Trigger: checks vibration threshold without manual button click!
    alertController.checkAndTriggerAutonomousAlert(req.newSensorRecord, io);
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
