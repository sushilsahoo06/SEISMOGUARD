const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const sensorRoutes = require('./routes/sensorRoutes');
const occupantRoutes = require('./routes/occupantRoutes');
const alertRoutes = require('./routes/alertRoutes');
const sensorController = require('./controllers/sensorController');
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

app.set('io', io);
sensorController.setSocketIO(io);

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
    // 1. Broadcast live sensor telemetry (includes embedded ML prediction)
    io.emit('newSensorData', req.newSensorRecord);

    // 2. Broadcast dedicated ML Seismic Alert if seismic tremor or disturbance is identified
    if (req.newSensorRecord.ml) {
      const ml = req.newSensorRecord.ml;
      if (ml.isNewOnset || ml.eventType === 'SEISMIC_TREMOR' || ml.eventType === 'DISTURBANCE') {
        io.emit('mlAlert', {
          timestamp: req.newSensorRecord.timestamp || new Date().toISOString(),
          eventType: ml.eventType,
          hazardLevel: ml.hazardLevel,
          hazardColor: ml.hazardColor,
          confidence: ml.confidence,
          statusMessage: ml.statusMessage,
          damageIndex: ml.damageIndex,
          pga1: ml.building1?.pga ?? req.newSensorRecord.magnitude_1,
          pga2: ml.building2?.pga ?? req.newSensorRecord.magnitude_2,
          attenuationPct: ml.attenuation?.shockReductionPct ?? 0,
          dominantFreq1: ml.building1?.dominantFreq ?? 0,
          dominantFreq2: ml.building2?.dominantFreq ?? 0,
          eew: ml.eew,
          isNewOnset: ml.isNewOnset,
        });
      }
    }

    // 3. ⚡ Autonomous Life-Safety Trigger (guarded by ML false-alarm filter)
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
// Trigger nodemon restart

