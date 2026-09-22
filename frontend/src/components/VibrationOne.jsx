import React from 'react';
import BaseSensorChart from './BaseSensorChart';

export default function VibrationOne({ labels, data }) {
  const datasets = [
    {
      label: 'Bldg 1 (Unprotected) - Impact Spikes',
      data: data,
      borderColor: 'rgb(225, 60, 60)',
      borderWidth: 1.5,
      fill: false,
      pointRadius: 0,
      tension: 0,
    },
  ];

  return (
    <BaseSensorChart 
      title="Building 1 (Unprotected) - Impact Spikes" 
      labels={labels} 
      datasets={datasets} 
      chartType="spike"
    />
  );
}