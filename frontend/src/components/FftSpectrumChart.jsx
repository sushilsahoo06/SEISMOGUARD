import React, { useState, useRef, useMemo } from 'react';
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
  const modalChartRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const zoomLimitsRef = useRef({ xMin: null, xMax: null, yMin: null, yMax: null });

  const recordZoom = (chart) => {
    if (!chart || !chart.scales) return;
    const x = chart.scales.x;
    const y = chart.scales.y;
    if (x && typeof x.min === 'number' && typeof x.max === 'number') {
      zoomLimitsRef.current.xMin = x.min;
      zoomLimitsRef.current.xMax = x.max;
    }
    if (y && typeof y.min === 'number' && typeof y.max === 'number') {
      zoomLimitsRef.current.yMin = y.min;
      zoomLimitsRef.current.yMax = y.max;
    }
    setIsZoomed(true);
  };

  const handleResetZoom = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    zoomLimitsRef.current = { xMin: null, xMax: null, yMin: null, yMax: null };
    setIsZoomed(false);
    [chartRef.current, modalChartRef.current].forEach((ch) => {
      if (ch) {
        if (ch.scales.x) {
          delete ch.scales.x.options.min;
          delete ch.scales.x.options.max;
        }
        if (ch.scales.y) {
          delete ch.scales.y.options.min;
          delete ch.scales.y.options.max;
        }
        ch.resetZoom();
        ch.update();
      }
    });
  };

  const handleZoomIn = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const target = isModalOpen ? modalChartRef.current : chartRef.current;
    if (target) {
      target.zoom(1.25);
      recordZoom(target);
    }
  };

  const handleZoomOut = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const target = isModalOpen ? modalChartRef.current : chartRef.current;
    if (target) {
      target.zoom(0.8);
      recordZoom(target);
    }
  };

  // Enforces that user zoom scale boundaries stick during incoming real-time telemetry updates
  const keepZoomPlugin = useMemo(() => ({
    id: 'keepFftZoomPlugin',
    beforeUpdate(chart) {
      if (zoomLimitsRef.current && zoomLimitsRef.current.xMin !== null) {
        if (chart.scales.x) {
          chart.scales.x.options.min = zoomLimitsRef.current.xMin;
          chart.scales.x.options.max = zoomLimitsRef.current.xMax;
        }
        if (chart.scales.y && zoomLimitsRef.current.yMin !== null) {
          chart.scales.y.options.min = zoomLimitsRef.current.yMin;
          chart.scales.y.options.max = zoomLimitsRef.current.yMax;
        }
      }
    },
  }), []);

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
        pan: {
          enabled: true,
          mode: 'x',
          onPan: ({ chart }) => recordZoom(chart),
          onPanComplete: ({ chart }) => recordZoom(chart),
        },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x',
          onZoom: ({ chart }) => recordZoom(chart),
          onZoomComplete: ({ chart }) => recordZoom(chart),
        },
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
        ...(isZoomed && zoomLimitsRef.current.xMin !== null ? {
          min: zoomLimitsRef.current.xMin,
          max: zoomLimitsRef.current.xMax,
        } : {}),
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
        ...(isZoomed && zoomLimitsRef.current.yMin !== null ? {
          min: zoomLimitsRef.current.yMin,
          max: zoomLimitsRef.current.yMax,
        } : {}),
      },
    },
  };

  return (
    <div className="fft-spectrum-card">
      <div className="fft-header">
        <div className="fft-title-group">
          <h3>Live Fast Fourier Transform (FFT) Power Spectrum</h3>
          <p>
            Real-time mechanical frequency decomposition (64-Point Radix-2 Cooley-Tukey + Hanning Window)
          </p>
        </div>
        <div className="fft-actions">
          <span className="fft-badge-b1">B1 Resonant Peak: {domFreq1 > 0 ? `${domFreq1} Hz` : '0 Hz (Idle)'}</span>
          <span className="fft-badge-b2">B2 Damped: {domFreq2 > 0 ? `${domFreq2} Hz` : '0 Hz (Idle)'}</span>
          {isZoomed && (
            <span style={{ fontSize: '0.75rem', background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
              Zoom Locked
            </span>
          )}
          <button onClick={handleZoomIn} className="btn-chart-action">Zoom In (+)</button>
          <button onClick={handleZoomOut} className="btn-chart-action">Zoom Out (-)</button>
          <button
            onClick={handleResetZoom}
            className="btn-chart-action"
            style={isZoomed ? { background: '#fef2f2', color: '#dc2626', borderColor: '#fca5a5' } : {}}
          >
            Reset Zoom
          </button>
          <button onClick={() => setIsModalOpen(true)} className="btn-chart-action">Expand</button>
        </div>
      </div>

      <div className="fft-chart-wrapper" style={{ height: '260px' }}>
        <Line ref={chartRef} data={data} options={options} plugins={[keepZoomPlugin]} />
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" style={{ width: '90%', height: '80vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Live FFT Resonant Frequency Spectrum (Full Screen)</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={handleZoomIn} className="btn-chart-action">Zoom In (+)</button>
                <button onClick={handleZoomOut} className="btn-chart-action">Zoom Out (-)</button>
                <button onClick={handleResetZoom} className="btn-chart-action">Reset</button>
                <button onClick={() => setIsModalOpen(false)} className="btn-close">✕</button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <Line ref={modalChartRef} data={data} options={options} plugins={[keepZoomPlugin]} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
