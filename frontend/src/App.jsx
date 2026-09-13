import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import AccelerometerOne from './components/AccelerometerOne';
import AccelerometerTwo from './components/AccelerometerTwo';
import AccelerometerOverlap from './components/AccelerometerOverlap';
import VibrationOne from './components/VibrationOne';
import VibrationTwo from './components/VibrationTwo';
import VibrationOverlap from './components/VibrationOverlap';
import './App.css';

const SOCKET_SERVER_URL = 'http://localhost:5000';

export default function App() {
  const [labels, setLabels] = useState([]);
  const [accel1, setAccel1] = useState([]);
  const [accel2, setAccel2] = useState([]);
  const [vib1, setVib1] = useState([]);
  const [vib2, setVib2] = useState([]);

  useEffect(() => {
    // 1. Fetch historical readings on mount
    fetch(`${SOCKET_SERVER_URL}/api/sensor-data/history`)
      .then((res) => res.json())
      .then((data) => {
        setLabels(data.map((d) => new Date(d.timestamp).toLocaleTimeString()));
        setAccel1(data.map((d) => d.accel_1));
        setAccel2(data.map((d) => d.accel_2));
        setVib1(data.map((d) => d.vib_1));
        setVib2(data.map((d) => d.vib_2));
      })
      .catch((err) => console.error('Fetch error:', err));

    // 2. Real-time WebSockets subscription from ESP32
    const socket = io(SOCKET_SERVER_URL);

    socket.on('newSensorData', (newRecord) => {
      const timeStr = new Date(newRecord.timestamp).toLocaleTimeString();

      setLabels((prev) => [...prev.slice(-30), timeStr]);
      setAccel1((prev) => [...prev.slice(-30), newRecord.accel_1]);
      setAccel2((prev) => [...prev.slice(-30), newRecord.accel_2]);
      setVib1((prev) => [...prev.slice(-30), newRecord.vib_1]);
      setVib2((prev) => [...prev.slice(-30), newRecord.vib_2]);
    });

    return () => socket.disconnect();
  }, []);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Dual Accelerometer & Vibration Monitor</h1>
        <p>Real-time frequency demonstration with pan & zoom</p>
      </header>

      {/* Grid containing the 6 boxes corresponding to the layout */}
      <main className="grid-container">
        {/* Row 1 */}
        <AccelerometerOne labels={labels} data={accel1} />
        <AccelerometerTwo labels={labels} data={accel2} />
        <AccelerometerOverlap labels={labels} data1={accel1} data2={accel2} />

        {/* Row 2 */}
        <VibrationOne labels={labels} data={vib1} />
        <VibrationTwo labels={labels} data={vib2} />
        <VibrationOverlap labels={labels} data1={vib1} data2={vib2} />
      </main>
    </div>
  );
}