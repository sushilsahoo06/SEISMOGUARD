const db = require('../config/db');
const twilioService = require('../services/twilioService');

// 1. Broadcast Emergency Evacuation (Voice Call + Occupant SMS + Relative Notifications)
exports.broadcastEmergencyEvacuation = async (req, res) => {
  try {
    const { building_id, test_mode = false } = req.body;

    // Fetch all occupants who are still INSIDE the building
    let query = `SELECT * FROM building_occupants WHERE status = 'Inside Building'`;
    const params = [];

    if (building_id && building_id !== 'All') {
      params.push(building_id);
      query += ` AND building_id = $1`;
    }

    const result = await db.query(query, params);
    const occupantsInside = result.rows;

    if (occupantsInside.length === 0) {
      return res.json({
        status: 'notice',
        message: 'No occupants are currently marked as "Inside Building". All residents have already evacuated safely!',
        totalAlerted: 0,
      });
    }

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
        callStatus: 'Pending',
        smsStatus: 'Pending',
        relativeStatus: 'None',
      };

      // ── A. Trigger Voice Call (Auto-hangup after warning) ──────
      try {
        const callRes = await twilioService.makeEmergencyCall(occ);
        occupantLog.callStatus = 'Dialed (SID: ' + callRes.sid + ')';
        callsCount++;

        await db.query(`
          INSERT INTO alert_logs 
          (occupant_id, recipient_name, recipient_phone, recipient_type, alert_type, status, message_body, twilio_sid)
          VALUES ($1, $2, $3, 'Occupant', 'Voice Call', 'Dispatched', $4, $5);
        `, [occ.id, occ.name, occ.phone, `Automated Voice Call: Earthquake warning in ${occ.building_id}`, callRes.sid]);
      } catch (callErr) {
        occupantLog.callStatus = 'Call Failed: ' + callErr.message;
        await db.query(`
          INSERT INTO alert_logs 
          (occupant_id, recipient_name, recipient_phone, recipient_type, alert_type, status, message_body)
          VALUES ($1, $2, $3, 'Occupant', 'Voice Call', 'Failed', $4);
        `, [occ.id, occ.name, occ.phone, callErr.message]);
      }

      // ── B. Trigger Direct Resident Evacuation SMS ──────────────
      try {
        const smsRes = await twilioService.sendOccupantSMS(occ);
        occupantLog.smsStatus = 'Sent (SID: ' + smsRes.sid + ')';
        smsCount++;

        await db.query(`
          INSERT INTO alert_logs 
          (occupant_id, recipient_name, recipient_phone, recipient_type, alert_type, status, message_body, twilio_sid)
          VALUES ($1, $2, $3, 'Occupant', 'SMS', 'Dispatched', $4, $5);
        `, [occ.id, occ.name, occ.phone, smsRes.body, smsRes.sid]);
      } catch (smsErr) {
        occupantLog.smsStatus = 'SMS Failed: ' + smsErr.message;
        await db.query(`
          INSERT INTO alert_logs 
          (occupant_id, recipient_name, recipient_phone, recipient_type, alert_type, status, message_body)
          VALUES ($1, $2, $3, 'Occupant', 'SMS', 'Failed', $4);
        `, [occ.id, occ.name, occ.phone, smsErr.message]);
      }

      // ── B2. Optional WhatsApp Alert to Occupant ───────────────
      try {
        const waMsg = `🚨 CRITICAL EMERGENCY ALERT: Earthquake detected in ${occ.building_id || 'Building 1'}! Please evacuate the building immediately via stairwells!`;
        const waRes = await twilioService.sendWhatsAppAlert(occ.phone, waMsg);
        occupantLog.whatsappStatus = 'Sent (SID: ' + waRes.sid + ')';
        await db.query(`
          INSERT INTO alert_logs 
          (occupant_id, recipient_name, recipient_phone, recipient_type, alert_type, status, message_body, twilio_sid)
          VALUES ($1, $2, $3, 'Occupant', 'WhatsApp', 'Dispatched', $4, $5);
        `, [occ.id, occ.name, occ.phone, waMsg, waRes.sid]);
      } catch (waErr) {
        occupantLog.whatsappStatus = 'WhatsApp: ' + waErr.message;
      }

      // ── C. Trigger Relative / Family Member Notification ──────
      if (occ.relative_phone) {
        try {
          const relRes = await twilioService.sendRelativeNotification(occ);
          if (relRes) {
            occupantLog.relativeStatus = `Sent to ${occ.relative_name} (SID: ${relRes.sid})`;
            relativesCount++;

            await db.query(`
              INSERT INTO alert_logs 
              (occupant_id, recipient_name, recipient_phone, recipient_type, alert_type, status, message_body, twilio_sid)
              VALUES ($1, $2, $3, 'Relative', 'SMS', 'Dispatched', $4, $5);
            `, [occ.id, occ.relative_name, occ.relative_phone, relRes.body, relRes.sid]);
          }
        } catch (relErr) {
          occupantLog.relativeStatus = 'Relative SMS Failed: ' + relErr.message;
          await db.query(`
            INSERT INTO alert_logs 
            (occupant_id, recipient_name, recipient_phone, recipient_type, alert_type, status, message_body)
            VALUES ($1, $2, $3, 'Relative', 'SMS', 'Failed', $4);
          `, [occ.id, occ.relative_name, occ.relative_phone, relErr.message]);
        }
      }

      results.push(occupantLog);
    }

    res.json({
      status: 'success',
      message: `Emergency evacuation broadcast completed! Alerted ${occupantsInside.length} occupants inside building.`,
      summary: {
        totalOccupantsInside: occupantsInside.length,
        callsDispatched: callsCount,
        smsDispatched: smsCount,
        relativesNotified: relativesCount,
      },
      details: results,
    });
  } catch (err) {
    console.error('Error during broadcast:', err);
    res.status(500).json({ error: 'Emergency broadcast failed: ' + err.message });
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

    const body = message || '🚨 SHM TEST ALERT: Structural Health Monitoring emergency notification system verified!';
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

    const body = message || '🚨 SHM TEST ALERT: WhatsApp Emergency Notification verified!';
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
    const result = await db.query(`
      SELECT l.*, o.name as occupant_name, o.building_id, o.room_number 
      FROM alert_logs l
      LEFT JOIN building_occupants o ON l.occupant_id = o.id
      ORDER BY l.timestamp DESC
      LIMIT 100;
    `);

    res.json({ logs: result.rows });
  } catch (err) {
    console.error('Error fetching logs:', err);
    res.status(500).json({ error: 'Failed to retrieve alert logs' });
  }
};
