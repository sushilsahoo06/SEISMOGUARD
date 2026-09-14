import React from 'react';
import BaseSensorChart from './BaseSensorChart';

export default function VibrationTwo({ labels, data }) {
  const datasets = [
    {
      label: 'Bldg 2 (Resistant) - Dampened Impacts',
      data: data,
      borderColor: '#10b981', // Emerald green for safe/isolated shocks
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      fill: true,
      borderWidth: 1.5,
    },
  ];

  return (
    <BaseSensorChart 
      title="Building 2 (Resistant) - Impact Spikes" 
      labels={labels} 
      datasets={datasets} 
      chartType="spike" // Enforces jagged lines and point rendering
    />
  );
}