import React from 'react';
import BaseSensorChart from './BaseSensorChart';

export default function AccelerometerOne({ labels, data }) {
  const datasets = [
    {
      label: 'Accel 1 Frequency',
      data: data,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      borderWidth: 2,
      tension: 0.2,
    },
  ];

  return <BaseSensorChart title="Accelerometer 1" labels={labels} datasets={datasets} />;
}