import React from 'react';
import BaseSensorChart from './BaseSensorChart';

export default function AccelerometerTwo({ labels, data }) {
  const datasets = [
    {
      label: 'Accelerometer 2',
      data: data,
      borderColor: '#10b981', // Emerald Green
      backgroundColor: 'rgba(16, 185, 129, 0.08)',
      fill: true,
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.35,
    },
  ];

  return <BaseSensorChart title="Accelerometer 2" labels={labels} datasets={datasets} />;
}