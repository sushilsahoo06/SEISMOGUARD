import React from 'react';

export default function StructuralHealthCard({ ml }) {
  const b1 = ml?.building1 || {};
  const b2 = ml?.building2 || {};
  const att = ml?.attenuation || {};

  const pga1 = (b1.pga || 0).toFixed(3);
  const pga2 = (b2.pga || 0).toFixed(3);
  const rms1 = (b1.rms || 0).toFixed(4);
  const rms2 = (b2.rms || 0).toFixed(4);
  const freq1 = (b1.dominantFreq || 0).toFixed(2);
  const freq2 = (b2.dominantFreq || 0).toFixed(2);
  const tilt1 = (b1.maxTilt || 0).toFixed(1);
  const tilt2 = (b2.maxTilt || 0).toFixed(1);

  const shockReduction = Math.min(100, Math.max(0, Math.round(att.shockReductionPct || 0)));
  const energyDissipation = Math.min(100, Math.max(0, Math.round(att.energyDissipationPct || 0)));
  const damageIndexPct = Math.min(100, Math.max(0, Math.round((ml?.damageIndex || 0) * 100)));

  return (
    <div className="structural-health-card">
      <div className="shm-card-header">
        <div>
          <h3>🌍 Structural Health & Dynamic Response Comparison</h3>
          <p>Real-time mechanical resonance shift, shock absorption & stiffness evaluation</p>
        </div>
        <div className="shm-header-pills">
          {!ml && <span className="shm-pill" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>⏳ Syncing ML Pipeline...</span>}
          <span className="shm-pill b1-pill">Building 1: Unprotected Conventional</span>
          <span className="shm-pill b2-pill">Building 2: Base-Isolated Damped</span>
        </div>
      </div>

      <div className="shm-comparison-grid">
        {/* Building 1 Metrics */}
        <div className="shm-building-col b1-col">
          <div className="building-badge-title">
            <span className="dot b1-dot">●</span>
            <h4>Building 1 (Unprotected)</h4>
          </div>
          <div className="stat-row">
            <span className="stat-lbl">Peak Dynamic Acceleration:</span>
            <span className="stat-val highlight-red">{pga1} g</span>
          </div>
          <div className="stat-row">
            <span className="stat-lbl">RMS Vibration Intensity:</span>
            <span className="stat-val">{rms1} g</span>
          </div>
          <div className="stat-row">
            <span className="stat-lbl">Dominant Resonance Frequency:</span>
            <span className="stat-val stat-freq">{freq1} Hz</span>
          </div>
          <div className="stat-row">
            <span className="stat-lbl">Peak Dynamic Drift / Sway:</span>
            <span className="stat-val">{tilt1}°</span>
          </div>
        </div>

        {/* Building 2 Metrics */}
        <div className="shm-building-col b2-col">
          <div className="building-badge-title">
            <span className="dot b2-dot">●</span>
            <h4>Building 2 (Resistant)</h4>
          </div>
          <div className="stat-row">
            <span className="stat-lbl">Superstructure Peak Accel:</span>
            <span className="stat-val highlight-green">{pga2} g</span>
          </div>
          <div className="stat-row">
            <span className="stat-lbl">RMS Vibration Intensity:</span>
            <span className="stat-val">{rms2} g</span>
          </div>
          <div className="stat-row">
            <span className="stat-lbl">Dominant Resonance Frequency:</span>
            <span className="stat-val stat-freq">{freq2} Hz</span>
          </div>
          <div className="stat-row">
            <span className="stat-lbl">Peak Dynamic Drift / Sway:</span>
            <span className="stat-val">{tilt2}°</span>
          </div>
        </div>

        {/* Comparative SHM Gauges */}
        <div className="shm-gauges-col">
          <h4>Attenuation & Health Indices</h4>

          {/* Shock Reduction Bar */}
          <div className="gauge-item">
            <div className="gauge-label-row">
              <span>B2 Shock Wave Attenuation:</span>
              <strong>{shockReduction}%</strong>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill fill-green"
                style={{ width: `${shockReduction}%` }}
              />
            </div>
          </div>

          {/* Kinetic Energy Dissipation Bar */}
          <div className="gauge-item">
            <div className="gauge-label-row">
              <span>Seismic Kinetic Energy Dissipated:</span>
              <strong>{energyDissipation}%</strong>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill fill-blue"
                style={{ width: `${energyDissipation}%` }}
              />
            </div>
          </div>

          {/* Structural Damage Index Meter */}
          <div className="gauge-item">
            <div className="gauge-label-row">
              <span>Building 1 Damage / Plastic Yield Index:</span>
              <strong style={{ color: damageIndexPct > 40 ? '#ef4444' : damageIndexPct > 15 ? '#f59e0b' : '#10b981' }}>
                {damageIndexPct}%
              </strong>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${damageIndexPct}%`,
                  backgroundColor: damageIndexPct > 40 ? '#ef4444' : damageIndexPct > 15 ? '#f59e0b' : '#10b981',
                }}
              />
            </div>
          </div>

          <div className="shm-frequency-shift">
            <span>Period Elongation / Frequency Delta:</span>
            <strong>{att.frequencyDelta ? `${att.frequencyDelta} Hz` : 'Synchronized'}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

