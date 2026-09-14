import React from 'react';
import AccelerometerOne from '../components/AccelerometerOne';
import AccelerometerTwo from '../components/AccelerometerTwo';
import AccelerometerOverlap from '../components/AccelerometerOverlap';

export default function FrequencyPage({ labels, accel1, accel2 }) {
  return (
    <div>
      <div className="page-header">
        <h2>Accelerometer Frequency Monitors</h2>
        <p>Real-time readings from Accel 1 and Accel 2</p>
      </div>
      <div className="grid-container">
        <AccelerometerOne labels={labels} data={accel1} />
        <AccelerometerTwo labels={labels} data={accel2} />
        <AccelerometerOverlap labels={labels} data1={accel1} data2={accel2} />
      </div>
    </div>
  );
}