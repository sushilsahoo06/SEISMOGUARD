import React, { useState, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin
);

export default function FftSpectrumChart({ ml }) {
  const chartRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const spectrum = ml?.spectrum;
  const rawFreqs = spectrum?.frequencies || [
    0, 0.31, 0.63, 0.94, 1.25, 1.56, 1.88, 2.19, 2.5, 2.81, 3.13, 3.44,
    3.75, 4.06, 4.38, 4.69, 5, 5.31, 5.63, 5.94, 6.25, 6.56, 6.88, 7.19,
    7.5, 7.81, 8.13, 8.44, 8.75, 9.06, 9.38, 9.69,
  ];

  const labels = rawFreqs.map((f) => `${Number(f).toFixed(2)} Hz`);
  const power1 = spectrum?.power1 || new Array(rawFreqs.length).fill(0);
  const power2 = spectrum?.power2 || new Array(rawFreqs.length).fill(0);

  // If power spectral density is flatline / zero, force resonant peak to 0 Hz
  const isB1Active = power1.some((p) => p >= 0.00005);
  const isB2Active = power2.some((p) => p >= 0.00005);
  const domFreq1 = isB1Active ? (ml?.building1?.dominantFreq ?? 0) : 0;
  const domFreq2 = isB2Active ? (ml?.building2?.dominantFreq ?? 0) : 0;

  // Dynamic scale calculation so micro-vibrations and ambient peaks are visually clear
  const maxVal = Math.max(0, ...power1, ...power2);
  const suggestedMax = maxVal > 0.0001 ? maxVal * 1.3 : 0.005;

  const data = {
    labels,
    datasets: [
      {
        label: domFreq1 > 0 ? `B1 (Unprotected) — Resonant Peak: ${domFreq1} Hz` : 'B1 (Unprotected) — Peak: 0 Hz (Idle / Off)',
        data: power1,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.15)',
        fill: true,
        borderWidth: 2.2,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        tension: 0.3,
      },
      {
        label: domFreq2 > 0 ? `B2 (Base-Isolated) — Damped Peak: ${domFreq2} Hz` : 'B2 (Base-Isolated) — Peak: 0 Hz (Idle / Off)',
        data: power2,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        fill: true,
        borderWidth: 2.2,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        tension: 0.3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { font: { size: 11, weight: 'bold' } },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(6)} g²/Hz`,
        },
      },
      zoom: {
        pan: { enabled: true, mode: 'x' },
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Vibration Frequency (Hz) — Seismic Band: 0.5 Hz to 8.0 Hz',
          font: { weight: 'bold' },
        },
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
      },
      y: {
        title: {
          display: true,
          text: 'Power Spectral Density (g²/Hz)',
          font: { weight: 'bold' },
        },
        beginAtZero: true,
        suggestedMax,
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        ticks: {
          callback: (val) => (val < 0.001 ? Number(val).toExponential(1) : Number(val).toFixed(4)),
        },
      },
    },
  };

  const handleResetZoom = (e) => {
    e.stopPropagation();
    if (chartRef.current) chartRef.current.resetZoom();
  };

  return (
    <div className="fft-spectrum-card">
      <div className="fft-header">
        <div className="fft-title-group">
          <h3>⚡ Live Fast Fourier Transform (FFT) Power Spectrum</h3>
          <p>
            Real-time mechanical frequency decomposition (64-Point Radix-2 Cooley-Tukey + Hanning Window)
          </p>
        </div>
        <div className="fft-actions">
          <span className="fft-badge-b1">B1 Resonant Peak: {domFreq1 > 0 ? `${domFreq1} Hz` : '0 Hz (Idle)'}</span>
          <span className="fft-badge-b2">B2 Damped: {domFreq2 > 0 ? `${domFreq2} Hz` : '0 Hz (Idle)'}</span>
          <button onClick={handleResetZoom} className="btn-chart-action">↺ Reset Zoom</button>
          <button onClick={() => setIsModalOpen(true)} className="btn-chart-action">⛶ Expand</button>
        </div>
      </div>

      <div className="fft-chart-wrapper" style={{ height: '260px' }}>
        <Line ref={chartRef} data={data} options={options} />
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" style={{ width: '90%', height: '80vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Live FFT Resonant Frequency Spectrum (Full Screen)</h3>
              <button onClick={() => setIsModalOpen(false)} className="btn-close">✕</button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <Line data={data} options={options} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

