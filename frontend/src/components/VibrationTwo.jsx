import React from 'react';
import BaseSensorChart from './BaseSensorChart';

export default function VibrationTwo({ labels, data }) {
  const datasets = [
    {
      label: 'Vib 2 Frequency',
      data: data,
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
      borderWidth: 2,
      tension: 0.2,
    },
  ];

  return <BaseSensorChart title="Vibration Data 2" labels={labels} datasets={datasets} />;
}