import React from 'react';
import BaseSensorChart from '../components/BaseSensorChart';

export default function GyroscopePage({ labels, gx1, gy1, gz1, gx2, gy2, gz2 }) {
  return (
    <div>
      <div className="page-header">
        <h2>Gyroscope — Roll / Pitch / Yaw Rate (Dual MPU6050)</h2>
        <p>
          <span style={{ color: '#dc2626', fontWeight: 700 }}>● Building 1 (Unprotected)</span>
          {' '}vs{' '}
          <span style={{ color: '#059669', fontWeight: 700 }}>● Building 2 (Resistant)</span>
          {' '}— angular velocity in °/s
        </p>
      </div>
      <div className="grid-container">

        {/* Gyro X — Roll Rate */}
        <BaseSensorChart
          title="Gyro X — Roll Rate: B1 vs B2"
          labels={labels}
          datasets={[
            { label: 'B1 Gyro X (°/s)', data: gx1, borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.07)', fill: true, borderWidth: 2, pointRadius: 0, tension: 0.35 },
            { label: 'B2 Gyro X (°/s)', data: gx2, borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.07)',  fill: true, borderWidth: 2, pointRadius: 0, tension: 0.35 },
          ]}
          chartType="gyro" yAxisLabel="Angular Velocity (°/s)" yMin={-50} yMax={50}
        />

        {/* Gyro Y — Pitch Rate */}
        <BaseSensorChart
          title="Gyro Y — Pitch Rate: B1 vs B2"
          labels={labels}
          datasets={[
            { label: 'B1 Gyro Y (°/s)', data: gy1, borderColor: '#b91c1c', borderWidth: 2, pointRadius: 0, tension: 0.35 },
            { label: 'B2 Gyro Y (°/s)', data: gy2, borderColor: '#047857', borderWidth: 2, pointRadius: 0, tension: 0.35 },
          ]}
          chartType="gyro" yAxisLabel="Angular Velocity (°/s)" yMin={-50} yMax={50}
        />

        {/* Gyro Z — Yaw Rate */}
        <BaseSensorChart
          title="Gyro Z — Yaw Rate: B1 vs B2"
          labels={labels}
          datasets={[
            { label: 'B1 Gyro Z (°/s)', data: gz1, borderColor: '#e11d48', borderWidth: 2, pointRadius: 0, tension: 0.35 },
            { label: 'B2 Gyro Z (°/s)', data: gz2, borderColor: '#0d9488', borderWidth: 2, pointRadius: 0, tension: 0.35 },
          ]}
          chartType="gyro" yAxisLabel="Angular Velocity (°/s)" yMin={-50} yMax={50}
        />

        {/* Building 1 — All gyro axes */}
        <BaseSensorChart
          title="Building 1 — Gyro XYZ Combined"
          labels={labels}
          datasets={[
            { label: 'X (Roll)',  data: gx1, borderColor: '#dc2626', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
            { label: 'Y (Pitch)', data: gy1, borderColor: '#d97706', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
            { label: 'Z (Yaw)',   data: gz1, borderColor: '#7c3aed', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
          ]}
          chartType="gyro" yAxisLabel="Angular Velocity (°/s)" yMin={-50} yMax={50}
        />

        {/* Building 2 — All gyro axes */}
        <BaseSensorChart
          title="Building 2 — Gyro XYZ Combined"
          labels={labels}
          datasets={[
            { label: 'X (Roll)',  data: gx2, borderColor: '#059669', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
            { label: 'Y (Pitch)', data: gy2, borderColor: '#0891b2', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
            { label: 'Z (Yaw)',   data: gz2, borderColor: '#8b5cf6', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
          ]}
          chartType="gyro" yAxisLabel="Angular Velocity (°/s)" yMin={-50} yMax={50}
        />

      </div>
    </div>
  );
}
