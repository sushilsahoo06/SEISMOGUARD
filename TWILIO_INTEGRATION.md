# 🚨 Twilio Integration Guide: Automated Emergency Calls & WhatsApp Alerts

This guide provides a step-by-step walkthrough for integrating **Twilio** into your Structural Health Monitoring (SHM) backend to trigger:
1. 📞 **Automated Phone Calls (Voice):** Loudly rings and vibrates your phone when a **Critical Collapse Risk (`alarm == 2`)** is detected.
2. 💬 **WhatsApp Notifications:** Sends detailed structural telemetry (peak acceleration, tilt angle, timestamp) for **Warning Alerts (`alarm == 1`)**.

---

## 📋 Architecture Overview

```
 [ ESP32 Sensor Stream ] 
          │ (20 Hz)
          ▼
 [ backend/controllers/sensorController.js ]
          │
          ├──▶ Evaluates Collapse Level (0 = Safe, 1 = Warning, 2 = Critical)
          │
          ▼ If alarm triggered + cooldown passed:
 [ backend/services/twilioService.js ]
          │
          ├──▶ Level 2 (Critical): Twilio Voice API ──▶ Dials your phone & speaks warning
          │
          └──▶ Level 1 (Warning):  Twilio WhatsApp API ──▶ Sends telemetry report
```

---

## 🛠️ Step 1: Set Up Your Free Twilio Account

1. Go to [twilio.com](https://www.twilio.com/) and click **Sign Up** (a free trial gives you ~\$15 in free credits).
2. Verify your email and your **personal mobile phone number**.
3. On the **Twilio Console Dashboard**, copy your credentials:
   * **Account SID** (e.g., `ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`)
   * **Auth Token** (e.g., `your_auth_token_here`)
4. Click **Get a Trial Phone Number** to generate your virtual Twilio number (e.g., `+12345678901`).

> [!NOTE]
> In trial mode, Twilio only allows outgoing calls/messages to **verified phone numbers**. Ensure your personal phone number is added under **Phone Numbers $\rightarrow$ Manage $\rightarrow$ Verified Caller IDs**.

---

## 📦 Step 2: Install the Twilio SDK in Backend

Open a terminal in your project's `backend` folder and run:

```bash
cd backend
npm install twilio
```

---

## 🔐 Step 3: Configure Environment Variables

Open (or create) [`backend/.env`](file:///c:/Users/HP/OneDrive/ドキュメント/GitHub/shm/backend/.env) and append your Twilio credentials:

```env
# Existing settings
PORT=5000
DATABASE_URL=postgresql://...

# ── Twilio Emergency Alert Configuration ──
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+12345678901

# Your personal verified phone number (Include Country Code, e.g., +91 for India):
EMERGENCY_CONTACT_PHONE=+919876543210

# Twilio Sandbox WhatsApp number (standard default for all accounts):
TWILIO_WHATSAPP_NUMBER=+14155238886
```

---

## 📄 Step 4: Create the Twilio Alert Service

Create a new file at [`backend/services/twilioService.js`](file:///c:/Users/HP/OneDrive/ドキュメント/GitHub/shm/backend/services/twilioService.js):

```javascript
// backend/services/twilioService.js
const twilio = require('twilio');
require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken  = process.env.TWILIO_AUTH_TOKEN;

// Initialize Twilio client only if credentials exist
const client = (accountSid && authToken) ? twilio(accountSid, authToken) : null;

// ── Anti-Spam / Cooldown Management ───────────────────────────────
// Prevents the system from calling your phone 20 times a second during continuous shaking
let lastCallTimestamp = 0;
let lastWhatsAppTimestamp = 0;
const CALL_COOLDOWN_MS     = 3 * 60 * 1000; // 3 minutes lockout between calls
const WHATSAPP_COOLDOWN_MS = 60 * 1000;     // 1 minute lockout between texts

/**
 * Trigger an Automated Voice Phone Call (for Critical Collapse / Severe Shaking)
 */
async function triggerEmergencyPhoneCall(buildingName, peakG, tiltDeg) {
  if (!client) {
    console.warn('[Twilio] Credentials missing. Call skipped.');
    return;
  }

  const now = Date.now();
  if (now - lastCallTimestamp < CALL_COOLDOWN_MS) {
    console.log(`[Twilio] Call cooldown active (${Math.round((CALL_COOLDOWN_MS - (now - lastCallTimestamp))/1000)}s remaining)`);
    return;
  }

  lastCallTimestamp = now;

  const twimlMessage = `
    <Response>
      <Say voice="alice" language="en-US">
        Emergency Alert! Severe seismic vibration detected on ${buildingName}.
        Peak acceleration reached ${peakG} g, with a tilt of ${tiltDeg} degrees.
        Evacuate or inspect structure immediately.
      </Say>
    </Response>
  `;

  try {
    const call = await client.calls.create({
      twiml: twimlMessage,
      to: process.env.EMERGENCY_CONTACT_PHONE,
      from: process.env.TWILIO_PHONE_NUMBER,
    });
    console.log(`[Twilio] Emergency Phone Call triggered! Call SID: ${call.sid}`);
  } catch (err) {
    console.error('[Twilio] Failed to make emergency call:', err.message);
  }
}

/**
 * Trigger a WhatsApp Notification (for Structural Warnings)
 */
async function triggerWhatsAppAlert(buildingName, peakG, tiltDeg) {
  if (!client) return;

  const now = Date.now();
  if (now - lastWhatsAppTimestamp < WHATSAPP_COOLDOWN_MS) return;
  lastWhatsAppTimestamp = now;

  const body = `*SHM STRUCTURAL WARNING*\n` +
               `Location: ${buildingName}\n` +
               `Peak Motion: ${peakG} g\n` +
               `Tilt Angle: ${tiltDeg} deg\n` +
               `Time: ${new Date().toLocaleTimeString()}\n` +
               `Live Dashboard: http://localhost:5173`;

  try {
    const message = await client.messages.create({
      body: body,
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${process.env.EMERGENCY_CONTACT_PHONE}`,
    });
    console.log(`[Twilio] WhatsApp alert sent! Message SID: ${message.sid}`);
  } catch (err) {
    console.error('[Twilio] Failed to send WhatsApp message:', err.message);
  }
}

module.exports = {
  triggerEmergencyPhoneCall,
  triggerWhatsAppAlert,
};
```

---

## 🔗 Step 5: Connect Twilio Service to `sensorController.js`

In [`backend/controllers/sensorController.js`](file:///c:/Users/HP/OneDrive/ドキュメント/GitHub/shm/backend/controllers/sensorController.js), import the service and trigger alerts whenever high vibrations or alarms arrive:

```javascript
// At the top of backend/controllers/sensorController.js:
const { triggerEmergencyPhoneCall, triggerWhatsAppAlert } = require('../services/twilioService');

// Inside exports.receiveData:
// Check Building 1:
if (alarm_1 === 2 || d1.magnitude > 1.8) {
  triggerEmergencyPhoneCall('Building 1 (Unprotected)', d1.magnitude, Math.max(d1.roll, d1.pitch));
} else if (alarm_1 === 1 || d1.magnitude > 1.2) {
  triggerWhatsAppAlert('Building 1 (Unprotected)', d1.magnitude, Math.max(d1.roll, d1.pitch));
}

// Check Building 2:
if (alarm_2 === 2 || d2.magnitude > 1.8) {
  triggerEmergencyPhoneCall('Building 2 (Damped)', d2.magnitude, Math.max(d2.roll, d2.pitch));
}
```

---

## 🧪 Step 6: Standalone Test Script

You can test phone calls immediately **without waiting for an earthquake or sensor reading**.

Create [`backend/scripts/test_twilio.js`](file:///c:/Users/HP/OneDrive/ドキュメント/GitHub/shm/backend/scripts/test_twilio.js):

```javascript
// backend/scripts/test_twilio.js
const { triggerEmergencyPhoneCall, triggerWhatsAppAlert } = require('../services/twilioService');

console.log('Testing Emergency Phone Call...');
triggerEmergencyPhoneCall('Building 1 (Test)', 1.45, 8.2);
```

Run it with:
```bash
cd backend
node scripts/test_twilio.js
```
Your phone will ring within 3 to 5 seconds!

---

## 💡 Setting Up Twilio WhatsApp Sandbox (One-Time Step)

To receive WhatsApp messages from Twilio's free trial:
1. Open WhatsApp on your phone.
2. Send a message to **`+1 415 523 8886`** (Twilio Sandbox number).
3. The message text must be your unique sandbox join code shown in your Twilio Console (for example: `join heavy-elephant`).
4. Twilio will reply: *"You are all set!"* — Now your backend can send WhatsApp notifications to your phone.

