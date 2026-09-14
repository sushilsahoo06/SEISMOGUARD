import React from 'react';
import BaseSensorChart from './BaseSensorChart';

export default function VibrationOne({ labels, data }) {
  const datasets = [
    {
      label: 'Bldg 1 (Unprotected) - Impact Spikes',
      data: data,
      borderColor: '#ef4444', // Red for dangerous impact spikes
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
      fill: true,
      borderWidth: 1.5,
    },
  ];

  return (
    <BaseSensorChart 
      title="Building 1 (Unprotected) - Impact Spikes" 
      labels={labels} 
      datasets={datasets} 
      chartType="spike" // Enforces jagged lines and point rendering
    />
  );
}