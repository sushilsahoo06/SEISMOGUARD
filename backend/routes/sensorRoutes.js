const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');

// Ingestion endpoint for ESP32
router.post('/', sensorController.receiveData);

// Fetch initial historical window for React dashboard
router.get('/history', sensorController.getHistory);

// Post-event final earthquake comparative analysis
router.get('/analysis', sensorController.getPostEventAnalysis);

// Generate AI Civil Engineering Forensic Report (Gemini API)
router.post('/ai-report', sensorController.generateAIReport);

// Clear session data to start a new earthquake experiment
router.delete('/session', sensorController.clearSessionData);

// Real-Time Machine Learning Status & Dominant Resonance Spectrum
router.get('/ml-status', sensorController.getMLStatus);

// Logged Seismic Events detected by ML
router.get('/ml-events', sensorController.getMLEvents);

// Interactive Simulation Test (Simulate Earthquake or Knock)
router.post('/simulate', sensorController.simulateShake);

// Download raw session records as CSV
router.get('/export', sensorController.exportAllData);

module.exports = router;
