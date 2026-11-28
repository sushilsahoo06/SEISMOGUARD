const twilio = require('twilio');
require('dotenv').config({ path: __dirname + '/../.env' });

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken  = process.env.TWILIO_AUTH_TOKEN;
const fromPhone  = process.env.TWILIO_PHONE_NUMBER || '+17372212163';
const whatsappFrom = process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886';

let client = null;
if (accountSid && authToken) {
  try {
    client = twilio(accountSid, authToken);
  } catch (err) {
    console.error('Failed to initialize Twilio client:', err.message);
  }
}

/**
 * Format phone numbers to standard E.164 (e.g. +91XXXXXXXXXX)
 */
function formatE164(phone) {
  if (!phone) return '';
  let clean = phone.replace(/[^\d+]/g, '');
  if (!clean.startsWith('+')) {
    // Default to +91 (India) if 10 digits without prefix
    if (clean.length === 10) clean = '+91' + clean;
    else clean = '+' + clean;
  }
  return clean;
}

/**
 * 1. Automated Voice Call to Occupant (Speaks emergency evacuation alert and auto-cuts / hangs up)
 */
async function makeEmergencyCall(occupant) {
  if (!client) throw new Error('Twilio is not configured');

  const to = formatE164(occupant.phone);
  const building = occupant.building_id || 'Building 1';
  const room = occupant.room_number || 'your unit';

  // TwiML that speaks emergency evacuation warning and automatically terminates
  const twiml = `
    <Response>
      <Say>
        EMERGENCY EARTHQUAKE WARNING! A severe seismic tremor has struck ${building}.
        You are registered inside ${room}.
        Evacuate immediately using emergency stairs. Do not use elevators! Proceed to the open ground assembly area now.
      </Say>
      <Pause length="1"/>
      <Say>
        Repeat: Evacuate immediately!
      </Say>
      <Hangup/>
    </Response>
  `.trim();

  const call = await client.calls.create({
    twiml,
    to,
    from: fromPhone,
  });

  return {
    sid: call.sid,
    status: call.status,
    to,
  };
}

/**
 * 2. Emergency SMS to Occupant who is still inside the building
 */
async function sendOccupantSMS(occupant) {
  if (!client) throw new Error('Twilio is not configured');

  const to = formatE164(occupant.phone);
  const building = occupant.building_id || 'Building 1';
  const room = occupant.room_number || 'your unit';

  const body = `CRITICAL EARTHQUAKE ALERT: Severe seismic tremor detected in ${building}, ${room}. You are listed as INSIDE THE BUILDING. EVACUATE IMMEDIATELY via stairs! Do not use elevators. Once safe outside, notify emergency staff.`;

  const message = await client.messages.create({
    body,
    to,
    from: fromPhone,
  });

  return {
    sid: message.sid,
    status: message.status,
    to,
    body,
  };
}

/**
 * 3. Notification SMS to Relative / Family Member
 */
async function sendRelativeNotification(occupant) {
  if (!client) throw new Error('Twilio is not configured');
  if (!occupant.relative_phone) return null;

  const to = formatE164(occupant.relative_phone);
  const building = occupant.building_id || 'Building 1';
  const room = occupant.room_number || '';
  const relation = occupant.relative_relation || 'contact';
  const occupantName = occupant.name || 'Resident';

  const body = `EARTHQUAKE ADVISORY: An earthquake has affected ${building} (${room}), where your ${relation} ${occupantName} resides. Emergency rescue & evacuation protocols are underway. You will receive updates as soon as they confirm safe evacuation.`;

  const message = await client.messages.create({
    body,
    to,
    from: fromPhone,
  });

  return {
    sid: message.sid,
    status: message.status,
    to,
    body,
  };
}

/**
 * 4. WhatsApp Evacuation Alert (Optional)
 */
async function sendWhatsAppAlert(toPhone, messageText) {
  if (!client) throw new Error('Twilio is not configured');

  const to = formatE164(toPhone);
  const message = await client.messages.create({
    body: messageText,
    from: `whatsapp:${whatsappFrom}`,
    to: `whatsapp:${to}`,
  });

  return {
    sid: message.sid,
    status: message.status,
  };
}

module.exports = {
  client,
  makeEmergencyCall,
  sendOccupantSMS,
  sendRelativeNotification,
  sendWhatsAppAlert,
  formatE164,
};

