const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');

// Ingestion endpoint for ESP32
router.post('/', sensorController.receiveData);

// Fetch initial historical window for React dashboard
router.get('/history', sensorController.getHistory);

// Download raw session records as CSV
router.get('/export', sensorController.exportAllData);

module.exports = router;