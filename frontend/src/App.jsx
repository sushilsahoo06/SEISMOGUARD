import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import FrequencyPage   from './pages/FrequencyPage';
import VibrationPage   from './pages/VibrationPage';
import GyroscopePage   from './pages/GyroscopePage';
import OrientationPage from './pages/OrientationPage';
import './App.css';

const SOCKET_SERVER_URL = 'http://localhost:5000';
const WINDOW = 80;

// Sliding window push helper
const push = (setter, val) =>
  setter((prev) => [...prev.slice(-WINDOW), val]);

export default function App() {
  const [labels, setLabels] = useState([]);

  // ── MPU6050 #1 — Building 1 (Unprotected) ──
  const [ax1, setAx1] = useState([]);
  const [ay1, setAy1] = useState([]);
  const [az1, setAz1] = useState([]);
  const [gx1, setGx1] = useState([]);
  const [gy1, setGy1] = useState([]);
  const [gz1, setGz1] = useState([]);
  const [mag1,   setMag1]   = useState([]);
  const [roll1,  setRoll1]  = useState([]);
  const [pitch1, setPitch1] = useState([]);
  const [temp1,  setTemp1]  = useState(null);

  // ── MPU6050 #2 — Building 2 (Resistant) ──
  const [ax2, setAx2] = useState([]);
  const [ay2, setAy2] = useState([]);
  const [az2, setAz2] = useState([]);
  const [gx2, setGx2] = useState([]);
  const [gy2, setGy2] = useState([]);
  const [gz2, setGz2] = useState([]);
  const [mag2,   setMag2]   = useState([]);
  const [roll2,  setRoll2]  = useState([]);
  const [pitch2, setPitch2] = useState([]);
  const [temp2,  setTemp2]  = useState(null);

  // Legacy (for vibration spike page)
  const [vib1, setVib1] = useState([]);
  const [vib2, setVib2] = useState([]);
  // SW420 — digital signal (0/1) and rolling event count
  const [sw420_1,   setSw420_1]   = useState([]);
  const [sw420_2,   setSw420_2]   = useState([]);
  const [vibCount1, setVibCount1] = useState([]);
  const [vibCount2, setVibCount2] = useState([]);

  const [fullSessionData, setFullSessionData] = useState([]);

  const hydrate = (rows) => {
    const r = rows.slice(-WINDOW);
    setLabels(r.map((d) => new Date(d.timestamp).toLocaleTimeString()));
    setAx1(r.map((d) => d.accel_x_1 ?? 0)); setAy1(r.map((d) => d.accel_y_1 ?? 0)); setAz1(r.map((d) => d.accel_z_1 ?? 1));
    setGx1(r.map((d) => d.gyro_x_1  ?? 0)); setGy1(r.map((d) => d.gyro_y_1  ?? 0)); setGz1(r.map((d) => d.gyro_z_1  ?? 0));
    setMag1(r.map((d) => d.magnitude_1 ?? 1)); setRoll1(r.map((d) => d.roll_1 ?? 0)); setPitch1(r.map((d) => d.pitch_1 ?? 0));
    setAx2(r.map((d) => d.accel_x_2 ?? 0)); setAy2(r.map((d) => d.accel_y_2 ?? 0)); setAz2(r.map((d) => d.accel_z_2 ?? 1));
    setGx2(r.map((d) => d.gyro_x_2  ?? 0)); setGy2(r.map((d) => d.gyro_y_2  ?? 0)); setGz2(r.map((d) => d.gyro_z_2  ?? 0));
    setMag2(r.map((d) => d.magnitude_2 ?? 1)); setRoll2(r.map((d) => d.roll_2 ?? 0)); setPitch2(r.map((d) => d.pitch_2 ?? 0));
    setVib1(r.map((d) => d.vib_1 ?? 0)); setVib2(r.map((d) => d.vib_2 ?? 0));
    setSw420_1(r.map((d) => d.sw420_1 ?? 0));
    setSw420_2(r.map((d) => d.sw420_2 ?? 0));
    setVibCount1(r.map((d) => d.vib_count_1 ?? 0));
    setVibCount2(r.map((d) => d.vib_count_2 ?? 0));
    if (r.length > 0) {
      setTemp1(r[r.length - 1].temp_1 ?? null);
      setTemp2(r[r.length - 1].temp_2 ?? null);
    }
  };

  useEffect(() => {
    fetch(`${SOCKET_SERVER_URL}/api/sensor-data/history`)
      .then((res) => res.json())
      .then((data) => { hydrate(data); setFullSessionData(data); })
      .catch((err) => console.error('Fetch error:', err));

    const socket = io(SOCKET_SERVER_URL);
    socket.on('newSensorData', (r) => {
      const t = new Date(r.timestamp).toLocaleTimeString();
      push(setLabels, t);
      push(setAx1, r.accel_x_1 ?? 0); push(setAy1, r.accel_y_1 ?? 0); push(setAz1, r.accel_z_1 ?? 1);
      push(setGx1, r.gyro_x_1  ?? 0); push(setGy1, r.gyro_y_1  ?? 0); push(setGz1, r.gyro_z_1  ?? 0);
      push(setMag1, r.magnitude_1 ?? 1); push(setRoll1, r.roll_1 ?? 0); push(setPitch1, r.pitch_1 ?? 0);
      push(setAx2, r.accel_x_2 ?? 0); push(setAy2, r.accel_y_2 ?? 0); push(setAz2, r.accel_z_2 ?? 1);
      push(setGx2, r.gyro_x_2  ?? 0); push(setGy2, r.gyro_y_2  ?? 0); push(setGz2, r.gyro_z_2  ?? 0);
      push(setMag2, r.magnitude_2 ?? 1); push(setRoll2, r.roll_2 ?? 0); push(setPitch2, r.pitch_2 ?? 0);
      push(setVib1, r.vib_1 ?? 0); push(setVib2, r.vib_2 ?? 0);
      push(setSw420_1,   r.sw420_1     ?? 0);
      push(setSw420_2,   r.sw420_2     ?? 0);
      push(setVibCount1, r.vib_count_1 ?? 0);
      push(setVibCount2, r.vib_count_2 ?? 0);
      if (r.temp_1 != null) setTemp1(r.temp_1);
      if (r.temp_2 != null) setTemp2(r.temp_2);
      setFullSessionData((prev) => [...prev, r]);
    });
    return () => socket.disconnect();
  }, []);

  const handleExportCSV = () => {
    if (!fullSessionData.length) { alert('No data yet!'); return; }
    const header = 'Timestamp,AX1,AY1,AZ1,GX1,GY1,GZ1,T1,Mag1,Roll1,Pitch1,AX2,AY2,AZ2,GX2,GY2,GZ2,T2,Mag2,Roll2,Pitch2\n';
    const rows = fullSessionData.map((r) => {
      const t = r.timestamp ? new Date(r.timestamp).toISOString() : '';
      return `${t},${r.accel_x_1??0},${r.accel_y_1??0},${r.accel_z_1??0},${r.gyro_x_1??0},${r.gyro_y_1??0},${r.gyro_z_1??0},${r.temp_1??25},${r.magnitude_1??1},${r.roll_1??0},${r.pitch_1??0},${r.accel_x_2??0},${r.accel_y_2??0},${r.accel_z_2??0},${r.gyro_x_2??0},${r.gyro_y_2??0},${r.gyro_z_2??0},${r.temp_2??25},${r.magnitude_2??1},${r.roll_2??0},${r.pitch_2??0}`;
    }).join('\n');
    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(header + rows);
    link.download = `dual_mpu6050_${Date.now()}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // Temperature display helpers
  const tempBadge = (temp, label) => {
    if (temp == null) return { color: '#94a3b8', text: `${label}: — °C` };
    const color = temp > 35 ? '#ef4444' : temp > 30 ? '#f59e0b' : '#10b981';
    const icon  = temp > 35 ? '🔴' : temp > 30 ? '🟡' : '🟢';
    return { color, text: `${label}: ${temp.toFixed(1)}°C ${icon}` };
  };

  const b1 = tempBadge(temp1, 'MPU1');
  const b2 = tempBadge(temp2, 'MPU2');

  return (
    <BrowserRouter>
      <div className="dashboard-container">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="dashboard-header">
          <div className="header-top-row">
            <h1>⚡ SHM — Dual MPU6050 Structural Monitor</h1>
            <button onClick={handleExportCSV} className="btn-export">⬇ Export CSV</button>
          </div>

          <nav className="nav-bar">
            <NavLink to="/frequency"   className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>📈 Accelerometer</NavLink>
            <NavLink to="/vibration"   className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>📊 Vibration</NavLink>
            <NavLink to="/gyroscope"   className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>🔄 Gyroscope</NavLink>
            <NavLink to="/orientation" className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>🧭 Orientation</NavLink>
          </nav>
        </header>

        {/* ── Routes ─────────────────────────────────────────────────── */}
        <Routes>
          <Route path="/" element={<Navigate to="/frequency" replace />} />
          <Route path="/frequency"   element={<FrequencyPage   labels={labels} ax1={ax1} ay1={ay1} az1={az1} ax2={ax2} ay2={ay2} az2={az2} />} />
          <Route path="/vibration"   element={<VibrationPage   labels={labels} vib1={vib1} vib2={vib2} sw420_1={sw420_1} sw420_2={sw420_2} vibCount1={vibCount1} vibCount2={vibCount2} />} />
          <Route path="/gyroscope"   element={<GyroscopePage   labels={labels} gx1={gx1} gy1={gy1} gz1={gz1} gx2={gx2} gy2={gy2} gz2={gz2} />} />
          <Route path="/orientation" element={<OrientationPage labels={labels} mag1={mag1} roll1={roll1} pitch1={pitch1} mag2={mag2} roll2={roll2} pitch2={pitch2} />} />
        </Routes>

        {/* ── Temperature Status Bar ─────────────────────────────────── */}
        <footer className="temp-status-bar">
          <span className="temp-icon">🌡️</span>
          <span className="temp-label">Die Temperature:</span>
          <span className="temp-value temp-sensor-badge" style={{ color: b1.color }}>{b1.text}</span>
          <span className="temp-divider">·</span>
          <span className="temp-value temp-sensor-badge" style={{ color: b2.color }}>{b2.text}</span>
          <span className="temp-sensor">· Bldg1 vs Bldg2 · 20 Hz</span>
        </footer>
      </div>
    </BrowserRouter>
  );
}