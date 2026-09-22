import React from 'react';
import BaseSensorChart from './BaseSensorChart';

export default function VibrationOverlap({ labels, data1, data2 }) {
  const datasets = [
    {
      label: 'Bldg 2 Damped Impacts',
      data: data2,
      borderColor: 'rgb(20, 160, 120)',
      backgroundColor: 'rgba(32, 178, 138, 0.55)', // Green area fill on bottom
      fill: 'origin',
      borderWidth: 1.8,
      pointRadius: 0,
      tension: 0.1,
      order: 2,
    },
    {
      label: 'Bldg 1 Impacts',
      data: data1,
      borderColor: 'rgb(225, 60, 60)', // Jagged red spikes on top
      borderWidth: 1.5,
      fill: false,
      pointRadius: 0,
      tension: 0,
      order: 1,
    },
  ];

  return (
    <BaseSensorChart 
      title="Comparative Seismic Response (Overlap)" 
      labels={labels} 
      datasets={datasets} 
      chartType="spike"
    />
  );
}