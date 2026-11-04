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

// Download raw session records as CSV
router.get('/export', sensorController.exportAllData);

module.exports = router;
