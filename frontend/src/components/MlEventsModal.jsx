import React, { useEffect, useState } from 'react';

export default function MlEventsModal({ isOpen, onClose, serverUrl }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEvents = () => {
    setLoading(true);
    setError(null);
    fetch(`${serverUrl}/api/sensor-data/ml-events?limit=40`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load seismic events');
        return res.json();
      })
      .then((data) => {
        setEvents(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isOpen) {
      fetchEvents();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content ml-events-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2>🌍 AI-Detected Seismic Event History Log</h2>
            <p>Persistent audit trail of real-time seismic tremors classified by ML</p>
          </div>
          <div className="modal-header-actions">
            <button onClick={fetchEvents} className="btn-refresh" disabled={loading}>
              {loading ? 'Refreshing...' : '🔄 Refresh'}
            </button>
            <button onClick={onClose} className="btn-close">✕</button>
          </div>
        </div>

        {error && <div className="error-alert">Error loading events: {error}</div>}

        <div className="events-table-wrapper">
          {events.length === 0 && !loading ? (
            <div className="empty-events-state">
              <span className="empty-icon">🛡️</span>
              <h3>No Seismic Tremor Events Recorded Yet</h3>
              <p>The AI False-Alarm Filter has successfully rejected local mechanical knocks and ambient noise. Once a sustained shake or earthquake test occurs, it will automatically log here.</p>
            </div>
          ) : (
            <table className="ml-events-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Hazard Tier</th>
                  <th>Peak Accel (B1 vs B2)</th>
                  <th>Attenuation</th>
                  <th>Dominant Freq</th>
                  <th>Duration</th>
                  <th>ML Confidence</th>
                  <th>Damage Index</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const d = new Date(ev.timestamp);
                  const dateStr = d.toLocaleDateString();
                  const timeStr = d.toLocaleTimeString();

                  let badgeClass = 'badge-minor';
                  if (ev.hazard_level === 'STRUCTURAL_HAZARD') badgeClass = 'badge-critical';
                  else if (ev.hazard_level === 'WARNING') badgeClass = 'badge-warning';

                  return (
                    <tr key={ev.id}>
                      <td className="cell-time">
                        <span className="time-primary">{timeStr}</span>
                        <span className="time-secondary">{dateStr}</span>
                      </td>
                      <td>
                        <span className={`hazard-badge ${badgeClass}`}>
                          {ev.hazard_level}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: '#2563eb' }}>{Number(ev.pga_1 || 0).toFixed(3)}g</strong>
                        {' vs '}
                        <strong style={{ color: '#10b981' }}>{Number(ev.pga_2 || 0).toFixed(3)}g</strong>
                      </td>
                      <td>
                        <span className="attenuation-val">
                          {Number(ev.attenuation_pct || 0).toFixed(1)}% Shock Absorbed
                        </span>
                      </td>
                      <td>
                        {Number(ev.dominant_freq_1 || 0).toFixed(2)} Hz vs {Number(ev.dominant_freq_2 || 0).toFixed(2)} Hz
                      </td>
                      <td>{Number(ev.duration_sec || 0).toFixed(1)}s</td>
                      <td>{Math.round((ev.confidence || 0) * 100)}%</td>
                      <td>
                        <span style={{ color: (ev.damage_index || 0) > 0.3 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                          {(Number(ev.damage_index || 0) * 100).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-footer">
          <span className="footer-info">
            Model: Real-Time Tabular & FFT Decision Forest · False-Alarm Filter Active
          </span>
          <button onClick={onClose} className="btn-done">Done</button>
        </div>
      </div>
    </div>
  );
}

