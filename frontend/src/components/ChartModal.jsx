import React, { useRef } from 'react';
import { Line } from 'react-chartjs-2';

export default function ChartModal({ isOpen, onClose, title, labels, datasets, chartType = 'wave', yMin, yMax, yAxisLabel }) {
  const chartRef = useRef(null);

  if (!isOpen) return null;

  const handleZoomIn    = () => chartRef.current?.zoom(1.2);
  const handleZoomOut   = () => chartRef.current?.zoom(0.8);
  const handleResetZoom = () => chartRef.current?.resetZoom();

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
        pan:  { enabled: true, mode: 'xy' },
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' },
      },
    },
    scales: {
      x: { title: { display: true, text: 'Time (s)' } },
      y: {
        min: yMin,
        max: yMax,
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
          <div className="modal-actions">
            <button onClick={handleZoomIn}    className="btn btn-zoom">Zoom In (+)</button>
            <button onClick={handleZoomOut}   className="btn btn-zoom">Zoom Out (-)</button>
            <button onClick={handleResetZoom} className="btn btn-reset">Reset</button>
            <button onClick={onClose}         className="btn btn-close">✕</button>
          </div>
        </div>
        <div className="modal-chart-container">
          <Line ref={chartRef} data={{ labels, datasets }} options={modalOptions} />
        </div>
        <p className="modal-hint">Tip: Scroll to zoom · Drag to pan</p>
      </div>
    </div>
  );
}