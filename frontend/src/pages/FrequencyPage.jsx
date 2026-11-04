import React from 'react';
import BaseSensorChart from '../components/BaseSensorChart';

// Color palette
const C1 = { line: '#2563eb', bg: 'rgba(37,99,235,0.08)' };  // Building 1 — Blue
const C2 = { line: '#10b981', bg: 'rgba(16,185,129,0.08)' }; // Building 2 — Green

export default function FrequencyPage({ labels, ax1, ay1, az1, ax2, ay2, az2 }) {
  return (
    <div>
      <div className="page-header">
        <h2>Accelerometer — X / Y / Z Axes (ADXL345)</h2>
        <p>
          <span style={{ color: C1.line, fontWeight: 700 }}>● Building 1 (Unprotected)</span>
          {' '}vs{' '}
          <span style={{ color: C2.line, fontWeight: 700 }}>● Building 2 (Resistant)</span>
          {' '}— linear acceleration in g &nbsp;·&nbsp;
          <span style={{ color: '#ef4444', fontWeight: 700 }}>🔴 Red Zone Collapse Threshold: &gt; ±1.0g</span>
        </p>
      </div>
      <div className="grid-container">

        {/* X-Axis: B1 vs B2 */}
        <BaseSensorChart
          title="Accel X — B1 vs B2 (Horizontal)"
          labels={labels}
          datasets={[
            { label: 'B1 Accel X (g)', data: ax1, borderColor: C1.line, backgroundColor: C1.bg, fill: true, borderWidth: 2, pointRadius: 0, tension: 0.35 },
            { label: 'B2 Accel X (g)', data: ax2, borderColor: C2.line, backgroundColor: C2.bg, fill: true, borderWidth: 2, pointRadius: 0, tension: 0.35 },
          ]}
          chartType="accel" yAxisLabel="Acceleration (g)" yMin={-2} yMax={2}
        />

        {/* Y-Axis: B1 vs B2 */}
        <BaseSensorChart
          title="Accel Y — B1 vs B2 (Lateral)"
          labels={labels}
          datasets={[
            { label: 'B1 Accel Y (g)', data: ay1, borderColor: C1.line, borderWidth: 2, pointRadius: 0, tension: 0.35 },
            { label: 'B2 Accel Y (g)', data: ay2, borderColor: C2.line, borderWidth: 2, pointRadius: 0, tension: 0.35 },
          ]}
          chartType="accel" yAxisLabel="Acceleration (g)" yMin={-2} yMax={2}
        />

        {/* Z-Axis: B1 vs B2 */}
        <BaseSensorChart
          title="Accel Z — B1 vs B2 (Vertical)"
          labels={labels}
          datasets={[
            { label: 'B1 Accel Z (g)', data: az1, borderColor: C1.line, borderWidth: 2, pointRadius: 0, tension: 0.35 },
            { label: 'B2 Accel Z (g)', data: az2, borderColor: C2.line, borderWidth: 2, pointRadius: 0, tension: 0.35 },
          ]}
          chartType="accel" yAxisLabel="Acceleration (g)" yMin={-2} yMax={2}
        />

        {/* Building 1 — All 3 axes */}
        <BaseSensorChart
          title="Building 1 — All 3 Axes"
          labels={labels}
          datasets={[
            { label: 'X', data: ax1, borderColor: '#2563eb', borderWidth: 1.5, pointRadius: 0, tension: 0.35 },
            { label: 'Y', data: ay1, borderColor: '#7c3aed', borderWidth: 1.5, pointRadius: 0, tension: 0.35 },
            { label: 'Z', data: az1, borderColor: '#0891b2', borderWidth: 1.5, pointRadius: 0, tension: 0.35 },
          ]}
          chartType="accel" yAxisLabel="Acceleration (g)" yMin={-2} yMax={2}
        />

        {/* Building 2 — All 3 axes */}
        <BaseSensorChart
          title="Building 2 — All 3 Axes"
          labels={labels}
          datasets={[
            { label: 'X', data: ax2, borderColor: '#10b981', borderWidth: 1.5, pointRadius: 0, tension: 0.35 },
            { label: 'Y', data: ay2, borderColor: '#059669', borderWidth: 1.5, pointRadius: 0, tension: 0.35 },
            { label: 'Z', data: az2, borderColor: '#34d399', borderWidth: 1.5, pointRadius: 0, tension: 0.35 },
          ]}
          chartType="accel" yAxisLabel="Acceleration (g)" yMin={-2} yMax={2}
        />

      </div>
    </div>
  );
}