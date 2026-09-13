import React, { useRef } from 'react';
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

export default function BaseSensorChart({ title, labels, datasets }) {
  const chartRef = useRef(null);

  const resetZoom = () => {
    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: title },
      zoom: {
        pan: {
          enabled: true,
          mode: 'xy', // Pan both horizontally and vertically
        },
        zoom: {
          wheel: { enabled: true }, // Scroll mouse wheel to zoom
          pinch: { enabled: true }, // Pinch on touchscreen to zoom
          mode: 'xy', // Zoom both axes
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Time' },
      },
      y: {
        title: { display: true, text: 'Frequency (Hz) / Mag' },
      },
    },
  };

  const chartData = {
    labels: labels,
    datasets: datasets,
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>{title}</h3>
        <button onClick={resetZoom} className="reset-btn">Reset Zoom</button>
      </div>
      <div className="chart-container">
        <Line ref={chartRef} data={chartData} options={options} />
      </div>
    </div>
  );
}