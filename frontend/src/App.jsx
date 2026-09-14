import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import FrequencyPage from './pages/FrequencyPage';
import VibrationPage from './pages/VibrationPage';
import './App.css';

const SOCKET_SERVER_URL = 'http://localhost:5000';

export default function App() {
  const [labels, setLabels] = useState([]);
  const [accel1, setAccel1] = useState([]);
  const [accel2, setAccel2] = useState([]);
  const [vib1, setVib1] = useState([]);
  const [vib2, setVib2] = useState([]);

  // Full session history log for CSV export
  const [fullSessionData, setFullSessionData] = useState([]);

  useEffect(() => {
    // 1. Fetch initial historical records from Postgres
    fetch(`${SOCKET_SERVER_URL}/api/sensor-data/history`)
      .then((res) => res.json())
      .then((data) => {
        setLabels(data.map((d) => new Date(d.timestamp).toLocaleTimeString()));
        setAccel1(data.map((d) => d.accel_1));
        setAccel2(data.map((d) => d.accel_2));
        setVib1(data.map((d) => d.vib_1));
        setVib2(data.map((d) => d.vib_2));
        setFullSessionData(data);
      })
      .catch((err) => console.error('Fetch error:', err));

    // 2. Real-time WebSockets subscription
    const socket = io(SOCKET_SERVER_URL);

    socket.on('newSensorData', (newRecord) => {
      const timeStr = new Date(newRecord.timestamp).toLocaleTimeString();

      // Maintain chart sliding window (last 40 points)
      setLabels((prev) => [...prev.slice(-40), timeStr]);
      setAccel1((prev) => [...prev.slice(-40), newRecord.accel_1]);
      setAccel2((prev) => [...prev.slice(-40), newRecord.accel_2]);
      setVib1((prev) => [...prev.slice(-40), newRecord.vib_1]);
      setVib2((prev) => [...prev.slice(-40), newRecord.vib_2]);

      // Append to full session log for the CSV export
      setFullSessionData((prev) => [...prev, newRecord]);
    });

    return () => socket.disconnect();
  }, []);

  // Export collected shake data directly to a CSV/Excel file
  const handleExportCSV = () => {
    if (fullSessionData.length === 0) {
      alert('No sensor data collected yet to export!');
      return;
    }

    const headers = 'Timestamp,Accel_1_Unprotected,Accel_2_Resistant,Vib_1,Vib_2\n';
    const rows = fullSessionData
      .map((row) => {
        const time = row.timestamp ? new Date(row.timestamp).toISOString() : new Date().toISOString();
        return `${time},${row.accel_1},${row.accel_2},${row.vib_1},${row.vib_2}`;
      })
      .join('\n');

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headers + rows);
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `shake_test_data_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <BrowserRouter>
      <div className="dashboard-container">
        {/* Navigation & Action Header */}
        <header className="dashboard-header">
          <div className="header-top-row">
            <h1>Sensor Signal Processing Hub</h1>
            <button onClick={handleExportCSV} className="btn-export">
              ⬇ Export Test Data (CSV/Excel)
            </button>
          </div>

          <nav className="nav-bar">
            <NavLink
              to="/frequency"
              className={({ isActive }) => (isActive ? 'nav-tab active' : 'nav-tab')}
            >
              Frequency (Accelerometer)
            </NavLink>
            <NavLink
              to="/vibration"
              className={({ isActive }) => (isActive ? 'nav-tab active' : 'nav-tab')}
            >
              Vibration Sensors
            </NavLink>
          </nav>
        </header>

        {/* Route views */}
        <Routes>
          <Route path="/" element={<Navigate to="/frequency" replace />} />
          <Route
            path="/frequency"
            element={<FrequencyPage labels={labels} accel1={accel1} accel2={accel2} />}
          />
          <Route
            path="/vibration"
            element={<VibrationPage labels={labels} vib1={vib1} vib2={vib2} />}
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}