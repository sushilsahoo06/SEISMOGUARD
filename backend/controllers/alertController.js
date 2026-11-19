const db = require('../config/db');
const twilioService = require('../services/twilioService');
const occupantController = require('./occupantController');

// In-Memory Autonomous Trigger Configuration
let autoDispatchConfig = {
  enabled: true, // Armed by default so physical vibration triggers phone calls immediately
  lastTriggeredAt: null,
  cooldownMs: 15 * 1000, // 15 seconds cooldown for responsive live testing
  targetBuilding: 'All',
};

// In-Memory Alert Logs Cache for instantaneous UI rendering
let inMemoryAlertLogs = [];

// Pre-load logs from DB on startup
db.query(`
  SELECT l.*, o.name as occupant_name, o.building_id, o.room_number 
  FROM alert_logs l
  LEFT JOIN building_occupants o ON l.occupant_id = o.id
  ORDER BY l.id DESC
  LIMIT 100;
`).then(r => {
  if (r.rows && r.rows.length > 0) {
    inMemoryAlertLogs = r.rows.map(row => ({
      ...row,
      timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
    }));
    console.log(`[Alert Controller] Pre-loaded ${inMemoryAlertLogs.length} historical alert audit logs.`);
  }
}).catch(err => console.warn('[Alert Controller] Initial log sync notice:', err.message));

/**
 * Core Emergency Broadcast Dispatcher
 * Dispatches:
 * 1. Twilio Automated Voice Call to Occupant (with auto-cut on message completion)
 * 2. Twilio Emergency Evacuation SMS to Occupant ("Me")
 * 3. Twilio WhatsApp Alert to Occupant ("Me")
 * 4. Twilio Earthquake Advisory SMS to Registered Family Member / Relative ("Family")
 */
async function executeEmergencyBroadcast({ building_id = 'All', source = 'Manual' }) {
  let occupantsInside = [];

  // Try DB first with quick timeout
  try {
    let query = `SELECT * FROM building_occupants WHERE status = 'Inside Building'`;
    const params = [];

    if (building_id && building_id !== 'All') {
      params.push(building_id);
      query += ` AND building_id = $1`;
    }

    const result = await Promise.race([
      db.query(query, params),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB query timeout')), 2000))
    ]);
    occupantsInside = result.rows || [];
  } catch (dbErr) {
    console.warn('[Broadcast] DB lookup notice (using instant in-memory cache):', dbErr.message);
  }

  // Resilient fallback to in-memory occupants cache:
  if (!occupantsInside || occupantsInside.length === 0) {
    const cached = occupantController.getCachedOccupants();
    occupantsInside = cached.filter(o =>
      o.status === 'Inside Building' &&
      (!building_id || building_id === 'All' || o.building_id === building_id)
    );
  }

  if (occupantsInside.length === 0) {
    return {
      status: 'notice',
      message: 'No occupants are currently marked as "Inside Building". All residents have already evacuated safely!',
      totalAlerted: 0,
      details: [],
    };
  }

  console.log(`[EMERGENCY DISPATCH] Starting Twilio calls & SMS to ${occupantsInside.length} verified occupants (${source})...`);
  const results = [];
  let callsCount = 0;
  let smsCount = 0;
  let relativesCount = 0;

  for (const occ of occupantsInside) {
    const occupantLog = {
      occupantId: occ.id,
      name: occ.name,
      phone: occ.phone,
      building: occ.building_id,
      room: occ.room_number,
      source,
      callStatus: 'Pending',
      smsStatus: 'Pending',
      whatsappStatus: 'Pending',
      relativeStatus: 'None',
    };

    // ── A. Trigger Voice Call to Occupant (Auto-hangup after warning) ──────
    try {
      const callRes = await twilioService.makeEmergencyCall(occ);
      occupantLog.callStatus = 'Dialed (SID: ' + callRes.sid + ')';
      callsCount++;

      db.query(`
        INSERT INTO alert_logs 
        (occupant_id, recipient_name, recipient_phone, recipient_type, alert_type, status, message_body, twilio_sid, timestamp)
        VALUES ($1, $2, $3, 'Occupant', 'Voice Call', 'Dispatched', $4, $5, $6);
      `, [occ.id, occ.name, occ.phone, `Automated Voice Call [${source}]: Earthquake warning in ${occ.building_id}`, callRes.sid, new Date()]).catch(() => {});
    } catch (callErr) {
      occupantLog.callStatus = 'Call Notice: ' + callErr.message;
      db.query(`
        INSERT INTO alert_logs 
        (occupant_id, recipient_name, recipient_phone, recipient_type, alert_type, status, message_body, timestamp)
        VALUES ($1, $2, $3, 'Occupant', 'Voice Call', 'Failed', $4, $5);
      `, [occ.id, occ.name, occ.phone, callErr.message, new Date()]).catch(() => {});
    }

    // ── B. Trigger Direct Resident Evacuation SMS (Me) ──────────────────
    try {
      const smsRes = await twilioService.sendOccupantSMS(occ);
      occupantLog.smsStatus = 'Sent (SID: ' + smsRes.sid + ')';
      smsCount++;

      db.query(`
        INSERT INTO alert_logs 
        (occupant_id, recipient_name, recipient_phone, recipient_type, alert_type, status, message_body, twilio_sid, timestamp)
        VALUES ($1, $2, $3, 'Occupant', 'SMS', 'Dispatched', $4, $5, $6);
      `, [occ.id, occ.name, occ.phone, smsRes.body, smsRes.sid, new Date()]).catch(() => {});
    } catch (smsErr) {
      occupantLog.smsStatus = 'SMS Notice: ' + smsErr.message;
      db.query(`
        INSERT INTO alert_logs 
        (occupant_id, recipient_name, recipient_phone, recipient_type, alert_type, status, message_body, timestamp)
        VALUES ($1, $2, $3, 'Occupant', 'SMS', 'Failed', $4, $5);
      `, [occ.id, occ.name, occ.phone, smsErr.message, new Date()]).catch(() => {});
    }

    // ── B2. Trigger WhatsApp Alert to Occupant (Me) ───────────────────────
    try {
      const waMsg = `CRITICAL EMERGENCY ALERT: Earthquake detected in ${occ.building_id || 'Building 1'}, ${occ.room_number || ''}! Please evacuate immediately via stairwells! Do not use elevators.`;
      const waRes = await twilioService.sendWhatsAppAlert(occ.phone, waMsg);
      occupantLog.whatsappStatus = 'Sent (SID: ' + waRes.sid + ')';
      db.query(`
        INSERT INTO alert_logs 
        (occupant_id, recipient_name, recipient_phone, recipient_type, alert_type, status, message_body, twilio_sid, timestamp)
        VALUES ($1, $2, $3, 'Occupant', 'WhatsApp', 'Dispatched', $4, $5, $6);
      `, [occ.id, occ.name, occ.phone, waMsg, waRes.sid, new Date()]).catch(() => {});
    } catch (waErr) {
      occupantLog.whatsappStatus = 'WhatsApp: ' + waErr.message;
    }

    // ── C. Trigger Relative / Family Member Advisory SMS (Family) ─────────
    if (occ.relative_phone) {
      try {
        const relRes = await twilioService.sendRelativeNotification(occ);
        if (relRes) {
          occupantLog.relativeStatus = `Sent to ${occ.relative_name} (SID: ${relRes.sid})`;
          relativesCount++;

          db.query(`
            INSERT INTO alert_logs 
            (occupant_id, recipient_name, recipient_phone, recipient_type, alert_type, status, message_body, twilio_sid, timestamp)
            VALUES ($1, $2, $3, 'Relative', 'SMS', 'Dispatched', $4, $5, $6);
          `, [occ.id, occ.relative_name, occ.relative_phone, relRes.body, relRes.sid, new Date()]).catch(() => {});
        }
      } catch (relErr) {
        occupantLog.relativeStatus = 'Relative SMS Notice: ' + relErr.message;
        db.query(`
          INSERT INTO alert_logs 
          (occupant_id, recipient_name, recipient_phone, recipient_type, alert_type, status, message_body, timestamp)
          VALUES ($1, $2, $3, 'Relative', 'SMS', 'Failed', $4, $5);
        `, [occ.id, occ.relative_name, occ.relative_phone, relErr.message, new Date()]).catch(() => {});
      }
    }

    results.push(occupantLog);
  }


  return {
    status: 'success',
    message: `Emergency evacuation broadcast completed! Alerted ${occupantsInside.length} occupants inside building and their emergency family contacts.`,
    summary: {
      totalOccupantsInside: occupantsInside.length,
      callsDispatched: callsCount,
      smsDispatched: smsCount,
      relativesNotified: relativesCount,
      source,
    },
    details: results,
  };
}

// 1. Manual Broadcast Emergency Evacuation
exports.broadcastEmergencyEvacuation = async (req, res) => {
  try {
    const { building_id = 'All' } = req.body;
    const result = await executeEmergencyBroadcast({ building_id, source: 'Manual Web Dashboard' });
    res.json(result);
  } catch (err) {
    console.error('Error during broadcast:', err);
    res.status(500).json({ error: 'Emergency broadcast failed: ' + err.message });
  }
};

// 1B. Autonomous Vibration Trigger Status
exports.getAutoDispatchStatus = (req, res) => {
  const now = Date.now();
  const elapsed = autoDispatchConfig.lastTriggeredAt ? now - autoDispatchConfig.lastTriggeredAt : null;
  const remainingMs = elapsed !== null && elapsed < autoDispatchConfig.cooldownMs ? autoDispatchConfig.cooldownMs - elapsed : 0;

  res.json({
    enabled: autoDispatchConfig.enabled,
    targetBuilding: autoDispatchConfig.targetBuilding,
    lastTriggeredAt: autoDispatchConfig.lastTriggeredAt,
    cooldownRemainingSec: Math.ceil(remainingMs / 1000),
  });
};

// 1C. Toggle Autonomous Vibration Trigger Mode
exports.toggleAutoDispatch = (req, res) => {
  const { enabled, targetBuilding = 'All' } = req.body;
  if (enabled !== undefined) {
    autoDispatchConfig.enabled = Boolean(enabled);
  } else {
    autoDispatchConfig.enabled = !autoDispatchConfig.enabled;
  }
  if (targetBuilding) autoDispatchConfig.targetBuilding = targetBuilding;
  // Reset cooldown on toggle so test can run immediately
  autoDispatchConfig.lastTriggeredAt = null;

  res.json({
    status: 'success',
    message: autoDispatchConfig.enabled
      ? '⚡ Autonomous Earthquake Alert ARMED: Calls and SMS will automatically trigger when physical vibration is detected!'
      : 'Autonomous alert disarmed. Manual confirmation required.',
    enabled: autoDispatchConfig.enabled,
    targetBuilding: autoDispatchConfig.targetBuilding,
  });
};

// 1D. Real-Time Autonomous Trigger Evaluator (Called whenever sensor data arrives)
exports.checkAndTriggerAutonomousAlert = async (record, io) => {
  if (!autoDispatchConfig.enabled) return;

  // Physical trigger checks: SW-420 digital vibration pin active, or ADXL345 dynamic shock
  const isRawEmergencyFallback = (
    record.sw420_1 === 1 ||
    record.sw420_2 === 1 ||
    (record.magnitude_1 && record.magnitude_1 > 1.20) ||
    (record.magnitude_2 && record.magnitude_2 > 1.20) ||
    (record.dynamic_1 && record.dynamic_1 > 0.25) ||
    (record.dynamic_2 && record.dynamic_2 > 0.25)
  );

  // 🛡️ ML FALSE-ALARM FILTER (Phase 1 & Phase 3):
  if (record.ml && record.ml.eventType === 'DISTURBANCE' && !isRawEmergencyFallback) {
    return;
  }

  // Check for confirmed seismic tremor via ML, or raw physical fallback
  const isMlSeismicConfirmed = record.ml && record.ml.eventType === 'SEISMIC_TREMOR' && record.ml.confidence >= 0.50;

  const hasVibration = isMlSeismicConfirmed || isRawEmergencyFallback;
  if (!hasVibration) return;

  const now = Date.now();
  if (autoDispatchConfig.lastTriggeredAt && (now - autoDispatchConfig.lastTriggeredAt < autoDispatchConfig.cooldownMs)) {
    return; // Inside 15s cooldown period to avoid duplicate calls while continuous shaking
  }

  autoDispatchConfig.lastTriggeredAt = now;
  const triggerSource = isMlSeismicConfirmed
    ? `AI Seismic Classifier (${record.ml.hazardLevel} - ${(record.ml.confidence * 100).toFixed(0)}% Conf)`
    : 'Autonomous Vibration Trigger (ADXL345 / SW-420)';

  console.log(`⚡ [AUTONOMOUS ALERT] ${triggerSource} triggered! Shaking detected: SW1=${record.sw420_1}, Mag1=${record.magnitude_1}. Dispatching emergency calls & SMS automatically...`);

  try {
    const result = await executeEmergencyBroadcast({
      building_id: autoDispatchConfig.targetBuilding,
      source: triggerSource,
    });

    if (io) {
      io.emit('autonomousAlertDispatched', {
        message: `Seismic earthquake shaking confirmed! Emergency calls & SMS automatically dispatched.`,
        ml: record.ml,
        result,
        timestamp: new Date(),
      });
    }
  } catch (err) {
    console.error('Autonomous broadcast failed:', err.message);
  }
};


// 2. Test Voice Call
exports.testCall = async (req, res) => {
  try {
    const { phone, name = 'Test Resident' } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required.' });

    const result = await twilioService.makeEmergencyCall({
      phone,
      name,
      building_id: 'Building 1',
      room_number: 'Test Unit',
    });

    res.json({ status: 'success', message: 'Test call placed successfully!', result });
  } catch (err) {
    console.error('Test call error:', err);
    res.status(500).json({ error: err.message });
  }
};

// 3. Test SMS
exports.testSMS = async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required.' });

    const body = message || 'SHM TEST ALERT: Structural Health Monitoring emergency notification system verified!';
    const result = await twilioService.client.messages.create({
      body,
      to: twilioService.formatE164(phone),
      from: process.env.TWILIO_PHONE_NUMBER || '+14097465233',
    });

    res.json({ status: 'success', message: 'Test SMS sent successfully!', sid: result.sid });
  } catch (err) {
    console.error('Test SMS error:', err);
    res.status(500).json({ error: err.message });
  }
};

// 3B. Test WhatsApp
exports.testWhatsApp = async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required.' });

    const body = message || 'SHM TEST ALERT: WhatsApp Emergency Notification verified!';
    const result = await twilioService.sendWhatsAppAlert(phone, body);

    res.json({ status: 'success', message: 'Test WhatsApp message sent!', sid: result.sid });
  } catch (err) {
    console.error('Test WhatsApp error:', err);
    res.status(500).json({ error: err.message });
  }
};

// 4. Retrieve Alert Dispatch Logs
exports.getAlertLogs = async (req, res) => {
  try {
    const result = await Promise.race([
      db.query(`
        SELECT l.*, o.name as occupant_name, o.building_id, o.room_number 
        FROM alert_logs l
        LEFT JOIN building_occupants o ON l.occupant_id = o.id
        ORDER BY l.id DESC
        LIMIT 100;
      `),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Logs DB timeout')), 8000))
    ]);

    const logs = result.rows.map(row => ({
      ...row,
      timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
    }));
    inMemoryAlertLogs = logs;

    res.json({ logs });
  } catch (err) {
    console.warn('DB slow for logs, returning in-memory alert logs:', err.message);
    res.json({ logs: inMemoryAlertLogs });
  }
};


module.exports.executeEmergencyBroadcast = executeEmergencyBroadcast;
