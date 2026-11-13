import React from 'react';

export default function SeismicMonitorCard({
  isEarthquake,
  latestData,
  onSimulateEarthquake,
}) {
  const b1Accel = latestData?.magnitude_1?.toFixed(3) || '0.000';
  const b2Accel = latestData?.magnitude_2?.toFixed(3) || '0.000';
  const sw420_1 = latestData?.sw420_1 === 1;
  const sw420_2 = latestData?.sw420_2 === 1;
  const attenuation = latestData?.ml?.attenuation?.shockReductionPct?.toFixed(1) || '0.0';
  const eventType = latestData?.ml?.eventType || (isEarthquake ? 'SEISMIC_TREMOR' : 'NORMAL');
  const hazardLevel = latestData?.ml?.hazardLevel || (isEarthquake ? 'CRITICAL' : 'SAFE');

  return (
    <div className={`eq-card eq-monitor-card ${isEarthquake ? 'eq-card-critical' : 'eq-card-safe'}`}>
      {/* Status Hero */}
      <div className="eq-hero-banner">
        <div className="eq-hero-icon-box">
          <span className="eq-hero-icon">{isEarthquake ? '🚨' : '🛡️'}</span>
        </div>
        <div className="eq-hero-text">
          <div className="eq-hero-title">
            {isEarthquake ? 'CRITICAL EARTHQUAKE DETECTED!' : 'SYSTEM ARMED & MONITORING'}
          </div>
          <div className="eq-hero-subtitle">
            {isEarthquake
              ? 'Severe ground acceleration registered! Sound alert playing continuously.'
              : 'Listening for 20 Hz dual-building seismic sensor spikes and ML tremor onset.'}
          </div>
        </div>
        <div className="eq-hero-badge">
          <span className={`eq-badge-pill ${isEarthquake ? 'badge-critical' : 'badge-safe'}`}>
            {hazardLevel}
          </span>
        </div>
      </div>

      {/* Dual Building Comparison Grid */}
      <div className="eq-telemetry-grid">
        {/* Building 1 */}
        <div className="eq-building-card eq-b1">
          <div className="eq-bldg-header">
            <span className="eq-bldg-tag tag-b1">BUILDING 1</span>
            <span className="eq-bldg-sub">Unprotected Conventional</span>
          </div>
          <div className="eq-metric-row">
            <span className="eq-metric-label">Peak Accel:</span>
            <span className="eq-metric-value val-red">{b1Accel} g</span>
          </div>
          <div className="eq-metric-row">
            <span className="eq-metric-label">SW-420 Sensor:</span>
            <span className={`eq-status-indicator ${sw420_1 ? 'indicator-active' : 'indicator-idle'}`}>
              {sw420_1 ? '⚡ TRIGGERED' : '○ IDLE'}
            </span>
          </div>
        </div>

        {/* Building 2 */}
        <div className="eq-building-card eq-b2">
          <div className="eq-bldg-header">
            <span className="eq-bldg-tag tag-b2">BUILDING 2</span>
            <span className="eq-bldg-sub">Base-Isolated Damped</span>
          </div>
          <div className="eq-metric-row">
            <span className="eq-metric-label">Superstructure:</span>
            <span className="eq-metric-value val-green">{b2Accel} g</span>
          </div>
          <div className="eq-metric-row">
            <span className="eq-metric-label">SW-420 Sensor:</span>
            <span className={`eq-status-indicator ${sw420_2 ? 'indicator-active' : 'indicator-idle'}`}>
              {sw420_2 ? '⚡ TRIGGERED' : '○ IDLE'}
            </span>
          </div>
        </div>

        {/* Attenuation Metric */}
        <div className="eq-building-card eq-attenuation">
          <div className="eq-bldg-header">
            <span className="eq-bldg-tag tag-blue">SHOCK ATTENUATION</span>
            <span className="eq-bldg-sub">Base Isolation Efficiency</span>
          </div>
          <div className="eq-metric-row">
            <span className="eq-metric-label">Energy Dissipated:</span>
            <span className="eq-metric-value val-blue">{attenuation}%</span>
          </div>
          <div className="eq-metric-row">
            <span className="eq-metric-label">ML Classification:</span>
            <span className="eq-metric-value">{eventType}</span>
          </div>
        </div>
      </div>

      {/* Manual Simulation Button */}
      <div className="eq-simulation-bar">
        <button
          type="button"
          className="eq-btn-simulate"
          onClick={onSimulateEarthquake}
          title="Manually trigger an earthquake alert to test sound & UI takeover"
        >
          🚨 Simulate Earthquake Tremor (Test Alert Sound)
        </button>
      </div>
    </div>
  );
}
