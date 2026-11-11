import React from 'react';

export default function AiSeismicBanner({ ml, onOpenEventsModal, serverUrl }) {
  const [simulating, setSimulating] = React.useState(false);

  const handleSimulate = async (mode) => {
    try {
      setSimulating(true);
      const url = serverUrl || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:5000' : '');
      await fetch(`${url}/api/sensor-data/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      setTimeout(() => setSimulating(false), 2200);
    } catch (e) {
      console.warn('Simulate error:', e);
      setSimulating(false);
    }
  };

  const eventType = ml?.eventType || 'NORMAL';
  const hazardLevel = ml?.hazardLevel || 'SAFE';
  const confidence = Math.round((ml?.confidence || 1.0) * 100);
  const damageIndexPct = ((ml?.damageIndex || 0) * 100).toFixed(1);
  const shockReduction = ml?.attenuation?.shockReductionPct ?? 0;
  const isPWave = ml?.eew?.pWaveDetected;
  const leadTime = ml?.eew?.estimatedLeadTimeSec || 0;
  const duration = ml?.eventDurationSec || 0;

  // Visual Themes based on ML State
  let bannerClass = 'ml-banner-ambient';
  let icon = '🟢';
  let title = 'AI SEISMIC MONITOR — NOMINAL AMBIENT';
  let subtitle = 'Ground motion within normal baseline. Real-time false-alarm rejection active.';

  if (eventType === 'DISTURBANCE') {
    bannerClass = 'ml-banner-disturbance';
    icon = '🟡';
    title = 'AI FALSE-ALARM REJECTOR — BENIGN DISTURBANCE FILTERED';
    subtitle = 'Isolated impact/knock detected and suppressed. Autonomous evacuation siren safely held.';
  } else if (eventType === 'SEISMIC_TREMOR') {
    if (hazardLevel === 'STRUCTURAL_HAZARD') {
      bannerClass = 'ml-banner-critical';
      icon = '🚨';
      title = 'CRITICAL SEISMIC COLLAPSE RISK CONFIRMED BY ML';
      subtitle = 'Severe ground shaking exceeding elastic limits. Building 1 at plastic yield threshold!';
    } else if (hazardLevel === 'WARNING') {
      bannerClass = 'ml-banner-warning';
      icon = '⚠️';
      title = 'SEISMIC EVENT CONFIRMED — MODERATE TREMOR WARNING';
      subtitle = 'Sustained harmonic ground oscillation detected. Superstructure resonant response active.';
    } else {
      bannerClass = 'ml-banner-minor';
      icon = '⚡';
      title = 'SEISMIC EVENT DETECTED — MINOR TREMOR';
      subtitle = 'Low-amplitude seismic wave train identified. Structural monitoring engaged.';
    }
  }

  return (
    <div className={`ai-seismic-banner ${bannerClass}`}>
      <div className="ai-banner-left">
        <span className="ai-banner-icon">{icon}</span>
        <div className="ai-banner-text">
          <div className="ai-banner-header-row">
            <h3 className="ai-banner-title">{title}</h3>
            {isPWave && (
              <span className="ai-eew-badge animate-pulse">
                ⚡ EEW P-Wave Alert (~{leadTime}s S-Wave Lead Time)
              </span>
            )}
          </div>
          <p className="ai-banner-desc">{subtitle}</p>

          <div className="ai-banner-metrics">
            <span className="ai-metric-tag">
              <strong>Classification:</strong> {eventType}
            </span>
            <span className="ai-metric-tag">
              <strong>AI Confidence:</strong> {confidence}%
            </span>
            <span className="ai-metric-tag">
              <strong>Structural Damage Index:</strong> {damageIndexPct}%
            </span>
            <span className="ai-metric-tag highlight-b2">
              <strong>B2 Base Isolator Attenuation:</strong> {shockReduction}% Reduction
            </span>
            {duration > 0 && (
              <span className="ai-metric-tag">
                <strong>Duration:</strong> {duration}s
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="ai-banner-right">
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleSimulate('earthquake')}
            disabled={simulating}
            className="btn-ai-events"
            style={{ background: '#fee2e2', borderColor: '#fca5a5', color: '#991b1b' }}
            title="Simulate 3.5 Hz harmonic earthquake tremor"
          >
            {simulating ? '⏳ Shaking...' : '⚡ Test Quake'}
          </button>
          <button
            onClick={() => handleSimulate('knock')}
            disabled={simulating}
            className="btn-ai-events"
            style={{ background: '#fef3c7', borderColor: '#fcd34d', color: '#92400e' }}
            title="Simulate single table knock (demonstrates false-alarm rejection)"
          >
            🛡️ Test Knock
          </button>
          <button
            onClick={onOpenEventsModal}
            className="btn-ai-events"
            title="Open detected seismic events history"
          >
            📜 Event Log
          </button>
        </div>
      </div>
    </div>
  );
}

