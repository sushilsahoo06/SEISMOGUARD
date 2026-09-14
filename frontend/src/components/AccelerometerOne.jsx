import React from 'react';
import BaseSensorChart from './BaseSensorChart';

export default function AccelerometerOne({ labels, data }) {
  const datasets = [
    {
      label: 'Accelerometer 1',
      data: data,
      borderColor: '#2563eb', // Blue
      backgroundColor: 'rgba(37, 99, 235, 0.08)',
      fill: true,
      borderWidth: 2,
      pointRadius: 0,         // Clean line, no dots
      tension: 0.35,          // Smooth oscillation wave
    },
  ];

  return <BaseSensorChart title="Accelerometer 1" labels={labels} datasets={datasets} />;
}