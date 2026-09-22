import React, { useState, useRef } from "react";
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
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import { Line } from "react-chartjs-2";
import ChartModal from "./ChartModal";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin,
);

// Danger band plugin — only active for "spike" chart type
const dangerBandPlugin = {
  id: "dangerBandPlugin",
  beforeDraw(chart) {
    const { ctx, chartArea, scales: { y } } = chart;
    if (!chartArea || !y) return;
    if (chart.config.options?.customChartType !== "spike") return;

    ctx.save();
    ctx.fillStyle = "rgba(255, 180, 180, 0.45)";

    // Upper Hazard Band: >= +3.0 to +5.0
    const topBandTop    = y.getPixelForValue(5.0);
    const topBandBottom = y.getPixelForValue(3.0);
    ctx.fillRect(chartArea.left, topBandTop, chartArea.width, topBandBottom - topBandTop);

    // Lower Hazard Band: <= -0.25 to -0.5
    const bottomBandTop    = y.getPixelForValue(-0.25);
    const bottomBandBottom = y.getPixelForValue(-0.5);
    ctx.fillRect(chartArea.left, bottomBandTop, chartArea.width, bottomBandBottom - bottomBandTop);

    ctx.restore();
  },
};

export default function BaseSensorChart({
  title,
  labels,
  datasets,
  chartType = "wave",
  // New generic props — override y-axis range and label for any chart type
  yMin,
  yMax,
  yAxisLabel,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const chartRef = useRef(null);

  const resetZoom = (e) => {
    e.stopPropagation();
    if (chartRef.current) chartRef.current.resetZoom();
  };

  const isSpike   = chartType === "spike";
  const isGyro    = chartType === "gyro";
  const isDigital = chartType === "digital";

  // Resolve y-axis bounds: explicit props take priority, then per-type defaults
  const resolvedYMin = yMin !== undefined ? yMin
    : isSpike   ? -0.5
    : isGyro    ? -50
    : isDigital ? -0.1
    : undefined;

  const resolvedYMax = yMax !== undefined ? yMax
    : isSpike   ? 5.0
    : isGyro    ? 50
    : isDigital ? 1.3
    : undefined;

  const resolvedYLabel = yAxisLabel !== undefined ? yAxisLabel
    : isSpike   ? "Vibration Intensity (normalized)"
    : isGyro    ? "Angular Velocity (°/s)"
    : isDigital ? "Signal (0 / 1)"
    : "Acceleration (g)";

  // Resolve step size
  const resolvedStep = isSpike   ? 1.0
    : isGyro               ? 10
    : isDigital            ? 1
    : 0.2;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    customChartType: chartType,
    plugins: {
      legend: { display: false },
      title:  { display: false },
      zoom: {
        pan:  { enabled: true, mode: "xy" },
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "xy" },
      },
    },
    scales: {
      x: {
        grid:  { color: "#f1f5f9" },
        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 },
        title: { display: true, text: "Time (s)", font: { size: 11, weight: "bold" } },
      },
      y: {
        min:  resolvedYMin,
        max:  resolvedYMax,
        grid: { color: "#e2e8f0" },
        title: {
          display: true,
          text: resolvedYLabel,
          font: { size: 11, weight: "bold" },
        },
        ticks: {
          stepSize: resolvedStep,
          callback: (value) => {
            const n = Number(value);
            if (isNaN(n)) return value;
            // Digital charts: only show 0 and 1 labels
            if (isDigital) {
              if (n === 0) return '0 — stable';
              if (n === 1) return '1 — vibrating';
              return '';
            }
            return n >= 0 ? `+${n.toFixed(isSpike ? 1 : 2)}` : n.toFixed(isSpike ? 1 : 2);
          },
        },
      },
    },
    elements: {
      line:  { tension: isSpike ? 0 : 0.4 },
      point: { radius: 0 },
    },
  };

  return (
    <>
      <div className="card clickable-card" onClick={() => setIsModalOpen(true)}>
        <div className="card-header">
          <h3>{title}</h3>
          <div className="header-actions">
            <button onClick={resetZoom} className="reset-btn">↺ Reset Zoom</button>
            <span className="expand-badge">🔗 Click to enlarge</span>
          </div>
        </div>
        <div className="chart-container" style={{ height: "320px" }}>
          <Line
            ref={chartRef}
            data={{ labels, datasets }}
            options={chartOptions}
            plugins={[dangerBandPlugin]}
          />
        </div>
      </div>

      <ChartModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={title}
        labels={labels}
        datasets={datasets}
        chartType={chartType}
        yMin={resolvedYMin}
        yMax={resolvedYMax}
        yAxisLabel={resolvedYLabel}
      />
    </>
  );
}
