import React from 'react';

export default function EmergencyAlertModal({
  isOpen,
  alertData,
  audioFile,
  onSilenceAlarm,
}) {
  if (!isOpen) return null;

  const pga = alertData?.pga_1 || alertData?.magnitude_1 || 1.85;
  const damageIndex = alertData?.damageIndex || 0.88;
  const eventType = alertData?.eventType || 'SEISMIC_TREMOR';
  const timestamp = alertData?.timestamp
    ? new Date(alertData.timestamp).toLocaleTimeString()
    : new Date().toLocaleTimeString();

  return (
    <div className="eq-modal-overlay">
      <div className="eq-modal-box">
        {/* Pulsing Siren Animation */}
        <div className="eq-siren-wrapper">
          <span className="eq-siren-icon">🚨</span>
        </div>

        <h1 className="eq-modal-title">CRITICAL EARTHQUAKE DETECTED!</h1>
        <p className="eq-modal-warning">SEISMIC COLLAPSE HAZARD IMMINENT</p>

        <p className="eq-modal-instructions">
          ⚠️ <strong>Take cover immediately!</strong> Drop, Cover, and Hold On. Move away from glass, exterior walls, and heavy fixtures.
        </p>

        {/* Real-time Earthquake Stats */}
        <div className="eq-stats-grid">
          <div className="eq-stat-item">
            <span className="eq-stat-label">Peak Accel (PGA):</span>
            <span className="eq-stat-val">{typeof pga === 'number' ? pga.toFixed(3) : pga} g</span>
          </div>
          <div className="eq-stat-item">
            <span className="eq-stat-label">Damage Risk:</span>
            <span className="eq-stat-val">{Math.round(damageIndex * 100)}% (Severe)</span>
          </div>
          <div className="eq-stat-item">
            <span className="eq-stat-label">Event Type:</span>
            <span className="eq-stat-val">{eventType}</span>
          </div>
          <div className="eq-stat-item">
            <span className="eq-stat-label">Detected At:</span>
            <span className="eq-stat-val">{timestamp}</span>
          </div>
        </div>

        {/* Audio Status Info */}
        <div className="eq-audio-playing-indicator">
          <span className="eq-pulse-dot"></span>
          <span>Alert audio playing from <code>public{audioFile}</code></span>
        </div>

        {/* Silence Alarm Button */}
        <button
          className="eq-btn-silence"
          onClick={onSilenceAlarm}
          title="Silence audio alarm"
        >
          🔇 DISMISS & SILENCE ALARM
        </button>
      </div>
    </div>
  );
}
