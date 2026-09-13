import React from 'react';
import BaseSensorChart from './BaseSensorChart';

export default function VibrationOverlap({ labels, data1, data2 }) {
  const datasets = [
    {
      label: 'Vib 1',
      data: data1,
      borderColor: '#f59e0b',
      borderWidth: 2,
      tension: 0.2,
    },
    {
      label: 'Vib 2',
      data: data2,
      borderColor: '#ef4444',
      borderWidth: 2,
      tension: 0.2,
    },
  ];

  return <BaseSensorChart title="Overlap Vib Freq" labels={labels} datasets={datasets} />;
}