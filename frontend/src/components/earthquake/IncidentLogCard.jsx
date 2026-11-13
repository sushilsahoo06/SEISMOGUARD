import React from 'react';

export default function IncidentLogCard({ incidentHistory, onClearHistory }) {
  return (
    <div className="eq-card eq-history-card">
      <div className="eq-card-header-row">
        <div className="eq-card-header">
          <span className="eq-card-icon">📋</span>
          <h2 className="eq-card-title">Seismic Alert History</h2>
        </div>
        {incidentHistory.length > 0 && (
          <button className="eq-btn-clear" onClick={onClearHistory}>Clear History</button>
        )}
      </div>

      {incidentHistory.length === 0 ? (
        <div className="eq-empty-log">
          <span>🛡️ No earthquake incidents recorded. System standing by.</span>
        </div>
      ) : (
        <div className="eq-history-list">
          {incidentHistory.map((item, idx) => {
            const timeStr = item.timestamp
              ? new Date(item.timestamp).toLocaleTimeString()
              : new Date().toLocaleTimeString();
            const pgaStr = item.pga_1 ? `${Number(item.pga_1).toFixed(2)} g` : 'Critical';

            return (
              <div key={idx} className="eq-history-item">
                <div className="eq-history-left">
                  <span className="eq-history-badge">CRITICAL</span>
                  <div className="eq-history-details">
                    <span className="eq-history-type">{item.eventType || 'SEISMIC_TREMOR'}</span>
                    <span className="eq-history-time">{timeStr}</span>
                  </div>
                </div>
                <div className="eq-history-right">
                  <span className="eq-history-pga">PGA: {pgaStr}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
