import React, { useState, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { Line } from 'react-chartjs-2';
import ChartModal from './ChartModal';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin
);

export default function BaseSensorChart({ title, labels, datasets, chartType = 'wave' }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const chartRef = useRef(null);

  const resetZoom = (e) => {
    e.stopPropagation();
    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  };

  // Dynamically set Chart.js options based on whether we are plotting waves or spikes
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: false },
      zoom: {
        pan: { enabled: true, mode: 'xy' },
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' },
      },
    },
    scales: {
      x: {
        grid: { color: '#f1f5f9' },
        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        title: { display: true, text: 'Time (s)' }
      },
      y: {
        grid: { color: '#f1f5f9' },
        title: { display: true, text: chartType === 'spike' ? 'Vibration (Impact Counts)' : 'Acceleration (g)' }
      }
    },
    // Define how lines are drawn globally for this chart instance
    elements: {
      line: {
        // If 'spike' type, disable Bezier curves for sharp angles
        tension: chartType === 'spike' ? 0 : 0.4, 
      },
      point: {
        // If 'spike' type, show small dots at each impact point
        radius: chartType === 'spike' ? 1.5 : 0, 
      }
    }
  };

  return (
    <>
      <div className="card clickable-card" onClick={() => setIsModalOpen(true)}>
        <div className="card-header">
          <h3>{title}</h3>
          <div className="header-actions">
            <button onClick={resetZoom} className="reset-btn">Reset</button>
            <span className="expand-badge">⛶ Enlarge</span>
          </div>
        </div>
        <div className="chart-container">
          <Line ref={chartRef} data={{ labels, datasets }} options={chartOptions} />
        </div>
      </div>

      <ChartModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={title}
        labels={labels}
        datasets={datasets}
        chartType={chartType} // Pass type to modal as well
      />
    </>
  );
}