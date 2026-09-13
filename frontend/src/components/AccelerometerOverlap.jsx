import React from 'react';
import BaseSensorChart from './BaseSensorChart';

export default function AccelerometerOverlap({ labels, data1, data2 }) {
  const datasets = [
    {
      label: 'Accel 1',
      data: data1,
      borderColor: '#3b82f6',
      borderWidth: 2,
      tension: 0.2,
    },
    {
      label: 'Accel 2',
      data: data2,
      borderColor: '#10b981',
      borderWidth: 2,
      tension: 0.2,
    },
  ];

  return <BaseSensorChart title="Overlap Accel Freq" labels={labels} datasets={datasets} />;
}