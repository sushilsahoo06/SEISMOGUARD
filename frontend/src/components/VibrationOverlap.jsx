import React from 'react';
import BaseSensorChart from './BaseSensorChart';

export default function VibrationOverlap({ labels, data1, data2 }) {
  const datasets = [
    {
      label: 'Bldg 1 Impacts',
      data: data1,
      borderColor: '#ef4444', // Red for chaotic spikes
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      fill: true, // Fill under the spikes
      borderWidth: 1.5,
    },
    {
      label: 'Bldg 2 Damped Impacts',
      data: data2,
      borderColor: '#10b981', // Green for suppressed spikes
      borderWidth: 2,
    },
  ];

  return (
    <BaseSensorChart 
      title="Comparative Impact Analysis (Overlap)" 
      labels={labels} 
      datasets={datasets}
      chartType="spike" // CRUCIAL: Forces sharp angles and jagged rendering
    />
  );
}