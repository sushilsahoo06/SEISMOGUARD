import React from 'react';
import BaseSensorChart from '../components/BaseSensorChart';

export default function VibrationPage({ labels, sw420_1, sw420_2, vibCount1, vibCount2 }) {
  return (
    <div>
      <div className="page-header">
        <h2>Vibration — SW420 Digital Switch Sensor (Dual)</h2>
        <p>
          SW420 outputs a <strong>digital HIGH (1)</strong> when vibration/tilt is detected, <strong>LOW (0)</strong> when stable.
          &nbsp;·&nbsp;
          <span style={{ color: '#ef4444', fontWeight: 700 }}>● Building 1 (Unprotected)</span>
          &nbsp;vs&nbsp;
          <span style={{ color: '#10b981', fontWeight: 700 }}>● Building 2 (Resistant)</span>
        </p>
      </div>

      <div className="grid-container">

        {/* Raw digital signal — B1 */}
        <BaseSensorChart
          title="SW420 #1 — Building 1 Raw Digital Signal (0/1)"
          labels={labels}
          datasets={[{
            label: 'B1 SW420 (0=stable / 1=vibrating)',
            data: sw420_1,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.15)',
            fill: true,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0,        // ← sharp step edges (digital signal)
            stepped: 'before', // ← true square pulse wave
          }]}
          chartType="digital"
          yAxisLabel="Signal (0 / 1)"
          yMin={-0.1} yMax={1.3}
        />

        {/* Raw digital signal — B2 */}
        <BaseSensorChart
          title="SW420 #2 — Building 2 Raw Digital Signal (0/1)"
          labels={labels}
          datasets={[{
            label: 'B2 SW420 (0=stable / 1=vibrating)',
            data: sw420_2,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.15)',
            fill: true,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0,
            stepped: 'before',
          }]}
          chartType="digital"
          yAxisLabel="Signal (0 / 1)"
          yMin={-0.1} yMax={1.3}
        />

        {/* Overlay: B1 vs B2 digital signal */}
        <BaseSensorChart
          title="SW420 — B1 vs B2 Signal Overlay"
          labels={labels}
          datasets={[
            {
              label: 'B1 (Unprotected)',
              data: sw420_1,
              borderColor: '#ef4444',
              borderWidth: 1.5,
              pointRadius: 0,
              tension: 0,
              stepped: 'before',
              fill: false,
            },
            {
              label: 'B2 (Resistant)',
              data: sw420_2,
              borderColor: '#10b981',
              borderWidth: 1.5,
              pointRadius: 0,
              tension: 0,
              stepped: 'before',
              fill: false,
            },
          ]}
          chartType="digital"
          yAxisLabel="Signal (0 / 1)"
          yMin={-0.1} yMax={1.3}
        />

        {/* Rolling event count — B1 (vibration intensity curve) */}
        <BaseSensorChart
          title="SW420 #1 — Vibration Pulse Count / Window (B1)"
          labels={labels}
          datasets={[{
            label: 'B1 Vib Pulses / 50ms',
            data: vibCount1,
            borderColor: '#f97316',
            backgroundColor: 'rgba(249,115,22,0.12)',
            fill: true,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.3,
          }]}
          chartType="accel"
          yAxisLabel="Triggers per 50ms window"
          yMin={0} yMax={12}
        />

        {/* Rolling event count — B2 */}
        <BaseSensorChart
          title="SW420 #2 — Vibration Pulse Count / Window (B2)"
          labels={labels}
          datasets={[{
            label: 'B2 Vib Pulses / 50ms',
            data: vibCount2,
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6,182,212,0.12)',
            fill: true,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.3,
          }]}
          chartType="accel"
          yAxisLabel="Triggers per 50ms window"
          yMin={0} yMax={12}
        />

        {/* Pulse count comparison */}
        <BaseSensorChart
          title="Vibration Intensity Curve — B1 vs B2 (SW420 Pulse Count)"
          labels={labels}
          datasets={[
            { label: 'B1 Pulses', data: vibCount1, borderColor: '#f97316', borderWidth: 2, pointRadius: 0, tension: 0.3 },
            { label: 'B2 Pulses', data: vibCount2, borderColor: '#06b6d4', borderWidth: 2, pointRadius: 0, tension: 0.3 },
          ]}
          chartType="accel"
          yAxisLabel="Triggers per 50ms window"
          yMin={0} yMax={12}
        />

      </div>
    </div>
  );
}