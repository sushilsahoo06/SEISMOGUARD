import React, { useRef, useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';

export default function ChartModal({ isOpen, onClose, title, labels, datasets, chartType = 'wave', yMin, yMax, yAxisLabel }) {
  const chartRef = useRef(null);
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

  const handleZoomIn = () => {
    if (chartRef.current) {
      chartRef.current.zoom(1.25);
      recordZoom(chartRef.current);
    }
  };

  const handleZoomOut = () => {
    if (chartRef.current) {
      chartRef.current.zoom(0.8);
      recordZoom(chartRef.current);
    }
  };

  const handleResetZoom = () => {
    zoomLimitsRef.current = { xMin: null, xMax: null, yMin: null, yMax: null };
    setIsZoomed(false);
    if (chartRef.current) {
      if (chartRef.current.scales.x) {
        delete chartRef.current.scales.x.options.min;
        delete chartRef.current.scales.x.options.max;
      }
      if (chartRef.current.scales.y) {
        if (yMin !== undefined) {
          chartRef.current.scales.y.options.min = yMin;
          chartRef.current.scales.y.options.max = yMax;
        } else {
          delete chartRef.current.scales.y.options.min;
          delete chartRef.current.scales.y.options.max;
        }
      }
      chartRef.current.resetZoom();
      chartRef.current.update();
    }
  };

  const keepZoomPlugin = useMemo(() => ({
    id: 'keepModalZoomPlugin',
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

  if (!isOpen) return null;

  const isSpike = chartType === 'spike';
  const isGyro  = chartType === 'gyro';

  const resolvedYLabel = yAxisLabel !== undefined ? yAxisLabel
    : isSpike ? 'Vibration Intensity (Normalized)'
    : isGyro  ? 'Angular Velocity (°/s)'
    : 'Acceleration (g)';

  const modalOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { position: 'top' },
      title:  { display: true, text: `${title} (Enlarged Diagnostic View)` },
      zoom: {
        pan: {
          enabled: true,
          mode: 'xy',
          onPan: ({ chart }) => recordZoom(chart),
          onPanComplete: ({ chart }) => recordZoom(chart),
        },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'xy',
          onZoom: ({ chart }) => recordZoom(chart),
          onZoomComplete: ({ chart }) => recordZoom(chart),
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Time (s)' },
        ...(isZoomed && zoomLimitsRef.current.xMin !== null ? {
          min: zoomLimitsRef.current.xMin,
          max: zoomLimitsRef.current.xMax,
        } : {}),
      },
      y: {
        min: (isZoomed && zoomLimitsRef.current.yMin !== null) ? zoomLimitsRef.current.yMin : yMin,
        max: (isZoomed && zoomLimitsRef.current.yMax !== null) ? zoomLimitsRef.current.yMax : yMax,
        title: { display: true, text: resolvedYLabel },
      },
    },
    elements: {
      line:  { tension: isSpike ? 0 : 0.4 },
      point: { radius: isSpike ? 1.5 : 0 },
    },
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <div className="modal-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isZoomed && (
              <span style={{ fontSize: '0.75rem', background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
                Zoom Locked
              </span>
            )}
            <button onClick={handleZoomIn} className="btn btn-zoom">Zoom In (+)</button>
            <button onClick={handleZoomOut} className="btn btn-zoom">Zoom Out (-)</button>
            <button onClick={handleResetZoom} className="btn btn-reset">Reset</button>
            <button onClick={onClose} className="btn btn-close">✕</button>
          </div>
        </div>
        <div className="modal-chart-container">
          <Line ref={chartRef} data={{ labels, datasets }} options={modalOptions} plugins={[keepZoomPlugin]} />
        </div>
        <p className="modal-hint">Tip: Scroll/Pinch to zoom · Drag to pan · Zoom stays locked until Reset is clicked</p>
      </div>
    </div>
  );
}
