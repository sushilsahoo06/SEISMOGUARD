import React from 'react';
import BaseSensorChart from './BaseSensorChart';

export default function VibrationOne({ labels, data }) {
  const datasets = [
    {
      label: 'Vib 1 Frequency',
      data: data,
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.2)',
      borderWidth: 2,
      tension: 0.2,
    },
  ];

  return <BaseSensorChart title="Vibration Data 1" labels={labels} datasets={datasets} />;
}