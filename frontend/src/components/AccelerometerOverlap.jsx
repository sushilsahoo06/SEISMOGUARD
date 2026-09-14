import React from 'react';
import BaseSensorChart from './BaseSensorChart';

export default function AccelerometerOverlap({ labels, data1, data2 }) {
  const datasets = [
    {
      label: 'Accelerometer 1',
      data: data1,
      borderColor: '#2563eb', // Blue
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.35,
    },
    {
      label: 'Accelerometer 2',
      data: data2,
      borderColor: '#10b981', // Emerald Green
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.35,
    },
  ];

  return <BaseSensorChart title="Overlap Accel Freq" labels={labels} datasets={datasets} />;
}