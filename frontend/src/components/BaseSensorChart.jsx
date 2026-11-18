import React, { useState, useRef, useMemo } from "react";
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
  yMin,
  yMax,
  yAxisLabel,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const chartRef = useRef(null);
  const zoomLimitsRef = useRef({ xMin: null, xMax: null, yMin: null, yMax: null });

  const isSpike   = chartType === "spike";
  const isGyro    = chartType === "gyro";
  const isDigital = chartType === "digital";

  // Resolve y-axis bounds
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

  const resolvedStep = isSpike   ? 1.0
    : isGyro               ? 10
    : isDigital            ? 1
    : 0.2;

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

  const resetZoom = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    zoomLimitsRef.current = { xMin: null, xMax: null, yMin: null, yMax: null };
    setIsZoomed(false);
    if (chartRef.current) {
      if (chartRef.current.scales.x) {
        delete chartRef.current.scales.x.options.min;
        delete chartRef.current.scales.x.options.max;
      }
      if (chartRef.current.scales.y) {
        if (resolvedYMin !== undefined) {
          chartRef.current.scales.y.options.min = resolvedYMin;
          chartRef.current.scales.y.options.max = resolvedYMax;
        } else {
          delete chartRef.current.scales.y.options.min;
          delete chartRef.current.scales.y.options.max;
        }
      }
      chartRef.current.resetZoom();
      chartRef.current.update();
    }
  };

  const handleZoomIn = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (chartRef.current) {
      chartRef.current.zoom(1.25);
      recordZoom(chartRef.current);
    }
  };

  const handleZoomOut = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (chartRef.current) {
      chartRef.current.zoom(0.8);
      recordZoom(chartRef.current);
    }
  };

  // Enforces that user zoom scale boundaries stick during incoming real-time telemetry updates
  const keepZoomPlugin = useMemo(() => ({
    id: 'keepBaseZoomPlugin',
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

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    customChartType: chartType,
    plugins: {
      legend: { display: false },
      title:  { display: false },
      zoom: {
        pan: {
          enabled: true,
          mode: "xy",
          onPan: ({ chart }) => recordZoom(chart),
          onPanComplete: ({ chart }) => recordZoom(chart),
        },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: "xy",
          onZoom: ({ chart }) => recordZoom(chart),
          onZoomComplete: ({ chart }) => recordZoom(chart),
        },
      },
    },
    scales: {
      x: {
        grid:  { color: "#f1f5f9" },
        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 },
        title: { display: true, text: "Time (s)", font: { size: 11, weight: "bold" } },
        ...(isZoomed && zoomLimitsRef.current.xMin !== null ? {
          min: zoomLimitsRef.current.xMin,
          max: zoomLimitsRef.current.xMax,
        } : {}),
      },
      y: {
        min: (isZoomed && zoomLimitsRef.current.yMin !== null) ? zoomLimitsRef.current.yMin : resolvedYMin,
        max: (isZoomed && zoomLimitsRef.current.yMax !== null) ? zoomLimitsRef.current.yMax : resolvedYMax,
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
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isZoomed && (
              <span style={{ fontSize: '0.75rem', background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                Zoomed
              </span>
            )}
            <button onClick={handleZoomIn} className="reset-btn" title="Zoom In">+</button>
            <button onClick={handleZoomOut} className="reset-btn" title="Zoom Out">-</button>
            <button onClick={resetZoom} className="reset-btn">Reset</button>
            <span className="expand-badge">Expand</span>
          </div>
        </div>
        <div className="chart-container" style={{ height: "320px" }}>
          <Line
            ref={chartRef}
            data={{ labels, datasets }}
            options={chartOptions}
            plugins={[keepZoomPlugin, dangerBandPlugin]}
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
