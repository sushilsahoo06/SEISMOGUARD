import React, { useRef } from 'react';
import { Line } from 'react-chartjs-2';

export default function ChartModal({ isOpen, onClose, title, labels, datasets, chartType = 'wave' }) {
  const chartRef = useRef(null);

  if (!isOpen) return null;

  const handleZoomIn = () => chartRef.current && chartRef.current.zoom(1.2);
  const handleZoomOut = () => chartRef.current && chartRef.current.zoom(0.8);
  const handleResetZoom = () => chartRef.current && chartRef.current.resetZoom();

  const modalOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: `${title} (Enlarged Diagnostic View)` },
      zoom: {
        pan: { enabled: true, mode: 'xy' },
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' },
      },
    },
    scales: {
      x: { title: { display: true, text: 'Time (s)' } },
      y: { 
        title: { 
          display: true, 
          text: chartType === 'spike' ? 'Vibration Intensity (Normalized)' : 'Acceleration (g)' 
        } 
      },
    },
    elements: {
      line: {
        tension: chartType === 'spike' ? 0 : 0.4,
      },
      point: {
        radius: chartType === 'spike' ? 1.5 : 0,
      },
    },
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <div className="modal-actions">
            <button onClick={handleZoomIn} className="btn btn-zoom">Zoom In (+)</button>
            <button onClick={handleZoomOut} className="btn btn-zoom">Zoom Out (-)</button>
            <button onClick={handleResetZoom} className="btn btn-reset">Reset</button>
            <button onClick={onClose} className="btn btn-close">✕</button>
          </div>
        </div>
        <div className="modal-chart-container">
          <Line ref={chartRef} data={{ labels, datasets }} options={modalOptions} />
        </div>
        <p className="modal-hint">Tip: Use scroll wheel to zoom or drag to pan.</p>
      </div>
    </div>
  );
}