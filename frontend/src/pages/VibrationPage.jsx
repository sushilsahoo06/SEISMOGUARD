import React from 'react';
import VibrationOne from '../components/VibrationOne';
import VibrationTwo from '../components/VibrationTwo';
import VibrationOverlap from '../components/VibrationOverlap';

export default function VibrationPage({ labels, vib1, vib2 }) {
  return (
    <div>
      <div className="page-header">
        <h2>Vibration Sensor Monitors</h2>
        <p>Real-time readings from Vibration Sensor 1 and Vibration Sensor 2</p>
      </div>
      <div className="grid-container">
        <VibrationOne labels={labels} data={vib1} />
        <VibrationTwo labels={labels} data={vib2} />
        <VibrationOverlap labels={labels} data1={vib1} data2={vib2} />
      </div>
    </div>
  );
}