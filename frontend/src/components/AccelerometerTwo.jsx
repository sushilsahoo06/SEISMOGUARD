import React from 'react';
import BaseSensorChart from './BaseSensorChart';

export default function AccelerometerTwo({ labels, data }) {
  const datasets = [
    {
      label: 'Accel 2 Frequency',
      data: data,
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.2)',
      borderWidth: 2,
      tension: 0.2,
    },
  ];

  return <BaseSensorChart title="Accelerometer 2" labels={labels} datasets={datasets} />;
}