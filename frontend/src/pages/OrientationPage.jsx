import React from 'react';
import BaseSensorChart from '../components/BaseSensorChart';

// Sanitizes angles into [-90°, +90°] continuous range, eliminating any ±180° wrapping spikes
const cleanAngle = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.map((v) => {
    let a = parseFloat(v);
    if (isNaN(a)) return 0;
    while (a > 90) a -= 180;
    while (a < -90) a += 180;
    return parseFloat(a.toFixed(2));
  });
};

export default function OrientationPage({ labels, mag1, roll1, pitch1, mag2, roll2, pitch2 }) {
  const cRoll1  = cleanAngle(roll1);
  const cPitch1 = cleanAngle(pitch1);
  const cRoll2  = cleanAngle(roll2);
  const cPitch2 = cleanAngle(pitch2);

  return (
    <div>
      <div className="page-header">
        <h2>Orientation & Magnitude — Derived Tilt & Shock</h2>
        <p>
          <span style={{ color: '#f59e0b', fontWeight: 700 }}>● Building 1 (Unprotected)</span>
          {' '}vs{' '}
          <span style={{ color: '#8b5cf6', fontWeight: 700 }}>● Building 2 (Resistant)</span>
          {' '}— magnitude (g) · roll (°) · pitch (°)
        </p>
      </div>
      <div className="grid-container">

        {/* Magnitude comparison */}
        <BaseSensorChart
          title="Accel Magnitude — B1 vs B2 (√ax²+ay²+az²)"
          labels={labels}
          datasets={[
            { label: 'B1 Magnitude (g)', data: mag1, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.10)', fill: true, borderWidth: 2.5, pointRadius: 0, tension: 0.4 },
            { label: 'B2 Magnitude (g)', data: mag2, borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.08)', fill: true, borderWidth: 2.5, pointRadius: 0, tension: 0.4 },
          ]}
          chartType="accel" yAxisLabel="Magnitude (g)" yMin={0} yMax={3}
        />

        {/* Roll comparison */}
        <BaseSensorChart
          title="Roll Angle — B1 vs B2"
          labels={labels}
          datasets={[
            { label: 'B1 Roll (°)', data: cRoll1, borderColor: '#f59e0b', borderWidth: 2, pointRadius: 0, tension: 0.4 },
            { label: 'B2 Roll (°)', data: cRoll2, borderColor: '#8b5cf6', borderWidth: 2, pointRadius: 0, tension: 0.4 },
          ]}
          chartType="gyro" yAxisLabel="Angle (°)" yMin={-90} yMax={90}
        />

        {/* Pitch comparison */}
        <BaseSensorChart
          title="Pitch Angle — B1 vs B2"
          labels={labels}
          datasets={[
            { label: 'B1 Pitch (°)', data: cPitch1, borderColor: '#ec4899', borderWidth: 2, pointRadius: 0, tension: 0.4 },
            { label: 'B2 Pitch (°)', data: cPitch2, borderColor: '#0891b2', borderWidth: 2, pointRadius: 0, tension: 0.4 },
          ]}
          chartType="gyro" yAxisLabel="Angle (°)" yMin={-90} yMax={90}
        />

        {/* Building 1 — Roll + Pitch */}
        <BaseSensorChart
          title="Building 1 — Roll vs Pitch"
          labels={labels}
          datasets={[
            { label: 'Roll (°)',  data: cRoll1,  borderColor: '#f59e0b', borderWidth: 1.8, pointRadius: 0, tension: 0.4 },
            { label: 'Pitch (°)', data: cPitch1, borderColor: '#ec4899', borderWidth: 1.8, pointRadius: 0, tension: 0.4 },
          ]}
          chartType="gyro" yAxisLabel="Angle (°)" yMin={-90} yMax={90}
        />

        {/* Building 2 — Roll + Pitch */}
        <BaseSensorChart
          title="Building 2 — Roll vs Pitch"
          labels={labels}
          datasets={[
            { label: 'Roll (°)',  data: cRoll2,  borderColor: '#8b5cf6', borderWidth: 1.8, pointRadius: 0, tension: 0.4 },
            { label: 'Pitch (°)', data: cPitch2, borderColor: '#0891b2', borderWidth: 1.8, pointRadius: 0, tension: 0.4 },
          ]}
          chartType="gyro" yAxisLabel="Angle (°)" yMin={-90} yMax={90}
        />

      </div>
    </div>
  );
}

