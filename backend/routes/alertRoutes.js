const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');

// 1. Broadcast Emergency Evacuation (Calling + SMS + Relatives)
router.post('/broadcast', alertController.broadcastEmergencyEvacuation);

// 1B. Autonomous Vibration Dispatch Config & Toggle
router.get('/auto-dispatch-status', alertController.getAutoDispatchStatus);
router.post('/auto-dispatch-toggle', alertController.toggleAutoDispatch);

// 2. Direct Test Calls (Verifies Twilio Voice Calling + Hangup)
router.post('/test-call', alertController.testCall);

// 3. Direct Test SMS
router.post('/test-sms', alertController.testSMS);

// 4. Direct Test WhatsApp
router.post('/test-whatsapp', alertController.testWhatsApp);

// 5. Alert Dispatch History Logs
router.get('/logs', alertController.getAlertLogs);

// 6. Public TwiML Webhook for Twilio Voice Calls (GET & POST)
router.get('/twiml', alertController.getEmergencyTwiml);
router.post('/twiml', alertController.getEmergencyTwiml);

module.exports = router;

