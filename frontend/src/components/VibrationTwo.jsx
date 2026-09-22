import React from 'react';
import BaseSensorChart from './BaseSensorChart';

export default function VibrationTwo({ labels, data }) {
  const datasets = [
    {
      label: 'Bldg 2 (Resistant) - Dampened Impacts',
      data: data,
      borderColor: 'rgb(20, 160, 120)',
      backgroundColor: 'rgba(32, 178, 138, 0.55)', // Solid green fill matching the target image
      fill: 'origin',
      borderWidth: 1.8,
      pointRadius: 0,
      tension: 0.1,
    },
  ];

  return (
    <BaseSensorChart 
      title="Building 2 (Resistant) - Impact Spikes" 
      labels={labels} 
      datasets={datasets} 
      chartType="spike"
    />
  );
}