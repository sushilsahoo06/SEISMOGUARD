import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { io } from 'socket.io-client';
import FrequencyPage from './pages/FrequencyPage';
import AiSeismicBanner from './components/AiSeismicBanner';
import MlEventsModal from './components/MlEventsModal';
import './App.css';

const SOCKET_SERVER_URL =
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000'
    : (import.meta.env.VITE_BACKEND_URL || 'https://shm-v5rg.onrender.com');
const WINDOW = 80;

// Sliding window push helper
const push = (setter, val) =>
  setter((prev) => [...prev.slice(-WINDOW), val]);

export default function App() {
  const [labels, setLabels] = useState([]);

  // ── ADXL345 #1 — Building 1 (Unprotected) ──
  const [ax1, setAx1] = useState([]);
  const [ay1, setAy1] = useState([]);
  const [az1, setAz1] = useState([]);

  // ── ADXL345 #2 — Building 2 (Resistant) ──
  const [ax2, setAx2] = useState([]);
  const [ay2, setAy2] = useState([]);
  const [az2, setAz2] = useState([]);

  // Civil Engineering Alarms: 0=Safe, 1=Warning, 2=Critical Collapse
  const [alarm1, setAlarm1] = useState(0);
  const [alarm2, setAlarm2] = useState(0);

  // Machine Learning Real-Time State
  const [mlState, setMlState] = useState(null);
  const [isEventsModalOpen, setIsEventsModalOpen] = useState(false);

  const [fullSessionData, setFullSessionData] = useState([]);

  const hydrate = (rows) => {
    const r = rows.slice(-WINDOW);
    setLabels(r.map((d) => new Date(d.timestamp).toLocaleTimeString()));
    setAx1(r.map((d) => d.accel_x_1 ?? 0)); setAy1(r.map((d) => d.accel_y_1 ?? 0)); setAz1(r.map((d) => d.accel_z_1 ?? 1));
    setAx2(r.map((d) => d.accel_x_2 ?? 0)); setAy2(r.map((d) => d.accel_y_2 ?? 0)); setAz2(r.map((d) => d.accel_z_2 ?? 1));
    if (r.length > 0) {
      const lastR = r[r.length - 1];
      const isB1Offline = (lastR.magnitude_1 === 0 || lastR.magnitude_1 < 0.2 || (lastR.accel_x_1 === 0 && lastR.accel_y_1 === 0 && lastR.accel_z_1 === 0));
      const isB2Offline = (lastR.magnitude_2 === 0 || lastR.magnitude_2 < 0.2 || (lastR.accel_x_2 === 0 && lastR.accel_y_2 === 0 && lastR.accel_z_2 === 0));
      setAlarm1(isB1Offline ? 0 : (lastR.alarm_1 ?? 0));
      setAlarm2(isB2Offline ? 0 : (lastR.alarm_2 ?? 0));
    }
  };

  useEffect(() => {
    // 1. Fetch initial sensor history
    fetch(`${SOCKET_SERVER_URL}/api/sensor-data/history`)
      .then((res) => res.json())
      .then((data) => { hydrate(data); setFullSessionData(data); })
      .catch((err) => console.error('Fetch error:', err));

    // 2. Fetch ML status & keep polled as safety net
    const fetchMl = () => {
      fetch(`${SOCKET_SERVER_URL}/api/sensor-data/ml-status`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.prediction) {
            setMlState(data.prediction);
          }
        })
        .catch((err) => console.warn('ML status fetch notice:', err.message));
    };

    fetchMl();
    const mlTimer = setInterval(fetchMl, 2500);

    // 3. Setup WebSocket listener for real-time telemetry & ML alerts
    const socket = io(SOCKET_SERVER_URL);
    socket.on('newSensorData', (r) => {
      const t = new Date(r.timestamp).toLocaleTimeString();
      push(setLabels, t);
      push(setAx1, r.accel_x_1 ?? 0); push(setAy1, r.accel_y_1 ?? 0); push(setAz1, r.accel_z_1 ?? 1);
      push(setAx2, r.accel_x_2 ?? 0); push(setAy2, r.accel_y_2 ?? 0); push(setAz2, r.accel_z_2 ?? 1);

      // Determine active alarm level (guard against offline / dead sensors)
      const isB1Offline = (r.magnitude_1 === 0 || r.magnitude_1 < 0.2 || (r.accel_x_1 === 0 && r.accel_y_1 === 0 && r.accel_z_1 === 0));
      const isB2Offline = (r.magnitude_2 === 0 || r.magnitude_2 < 0.2 || (r.accel_x_2 === 0 && r.accel_y_2 === 0 && r.accel_z_2 === 0));
      const b1Alarm = isB1Offline ? 0 : (r.alarm_1 ?? ((r.magnitude_1 > 1.8 || Math.abs(r.roll_1 || 0) > 12 || Math.abs(r.pitch_1 || 0) > 12) ? 2 : (r.magnitude_1 > 1.4 ? 1 : 0)));
      const b2Alarm = isB2Offline ? 0 : (r.alarm_2 ?? 0);
      setAlarm1(b1Alarm);
      setAlarm2(b2Alarm);

      if (r.ml) {
        setMlState(r.ml);
      }

      setFullSessionData((prev) => [...prev, r]);
    });

    socket.on('mlAlert', (alert) => {
      setMlState((prev) => ({ ...prev, ...alert }));
    });

    return () => {
      clearInterval(mlTimer);
      socket.disconnect();
    };
  }, []);

  const handleExportCSV = () => {
    if (!fullSessionData.length) { alert('No data yet!'); return; }
    const header = 'Timestamp,AX1,AY1,AZ1,Mag1,Roll1,Pitch1,SW420_1,VibCount1,Alarm1,AX2,AY2,AZ2,Mag2,Roll2,Pitch2,SW420_2,VibCount2,Alarm2\n';
    const rows = fullSessionData.map((r) => {
      const t = r.timestamp ? new Date(r.timestamp).toISOString() : '';
      return `${t},${r.accel_x_1 ?? 0},${r.accel_y_1 ?? 0},${r.accel_z_1 ?? 0},${r.magnitude_1 ?? 1},${r.roll_1 ?? 0},${r.pitch_1 ?? 0},${r.sw420_1 ?? 0},${r.vib_count_1 ?? 0},${r.alarm_1 ?? 0},${r.accel_x_2 ?? 0},${r.accel_y_2 ?? 0},${r.accel_z_2 ?? 0},${r.magnitude_2 ?? 1},${r.roll_2 ?? 0},${r.pitch_2 ?? 0},${r.sw420_2 ?? 0},${r.vib_count_2 ?? 0},${r.alarm_2 ?? 0}`;
    }).join('\n');
    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(header + rows);
    link.download = `shm_adxl345_session_${Date.now()}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <BrowserRouter>
      <div className="dashboard-container">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="dashboard-header">
          <div className="header-top-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ margin: 0 }}>SHM — Structural Health Monitor (ADXL345 Accelerometer)</h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                Real-Time Dual Node Structural Acceleration, Resonant Peak & Health Decomposition
              </p>
            </div>
            <button onClick={handleExportCSV} className="btn-export">⬇ Export CSV</button>
          </div>
        </header>

        {/* ── Phase 4: Machine Learning Seismic Detection & EEW Banner ─ */}
        <AiSeismicBanner
          ml={mlState}
          onOpenEventsModal={() => setIsEventsModalOpen(true)}
          serverUrl={SOCKET_SERVER_URL}
        />

        {/* ── Civil Engineering Structural Collapse Alert Banner ─────── */}
        <div className={`structural-alert-banner ${alarm1 === 2 ? 'alert-critical' : alarm1 === 1 ? 'alert-warning' : 'alert-normal'}`}>
          <div className="alert-content">
            <span className="alert-icon">
              {alarm1 === 2 ? '🚨' : alarm1 === 1 ? '⚠️' : '🛡️'}
            </span>
            <div className="alert-text-block">
              <div className="alert-title">
                {alarm1 === 2
                  ? 'CRITICAL COLLAPSE IMMINENT — BUILDING 1 (UNPROTECTED) EXCEEDING ULTIMATE CAPACITY'
                  : alarm1 === 1
                    ? 'STRUCTURAL YIELD WARNING — BUILDING 1 UNDER SEVERE RESONANT EXCITATION'
                    : 'STRUCTURAL INTEGRITY SECURE — VIBRATION WITHIN DESIGN ELASTIC LIMITS'}
              </div>
              <div className="alert-desc">
                Building 1: {alarm1 === 2 ? '🔴 RED ZONE SPIKE (Buzzer Siren Active)' : alarm1 === 1 ? '🟡 YELLOW ZONE (Intermittent Warning Beeps)' : '🟢 GREEN ZONE (Safe Elastic Vibration)'}
                &nbsp;·&nbsp;
                Building 2 (Resistant): {alarm2 === 2 ? '🔴 CRITICAL' : alarm2 === 1 ? '🟡 WARNING' : '🟢 DAMPED & PROTECTED (No Buzzer)'}
              </div>
            </div>
          </div>
          <div className="alert-badges">
            <span className={`status-pill ${alarm1 === 2 ? 'pill-danger' : alarm1 === 1 ? 'pill-warning' : 'pill-safe'}`}>
              B1 Buzzer: {alarm1 === 2 ? 'SIREN ON 🔊' : alarm1 === 1 ? 'PULSING ⚠️' : 'SILENT ⚪'}
            </span>
            <span className="status-pill pill-b2">
              B2 Isolation: ACTIVE 🛡️
            </span>
          </div>
        </div>

        {/* ── Routes (Single Page: Accelerometer) ────────────────────── */}
        <Routes>
          <Route path="*" element={<FrequencyPage labels={labels} ax1={ax1} ay1={ay1} az1={az1} ax2={ax2} ay2={ay2} az2={az2} ml={mlState} />} />
        </Routes>

        {/* ── Modal: AI-Detected Seismic Event History ───────────────── */}
        <MlEventsModal
          isOpen={isEventsModalOpen}
          onClose={() => setIsEventsModalOpen(false)}
          serverUrl={SOCKET_SERVER_URL}
        />

        {/* ── Live System Status Bar ─────────────────────────────────── */}
        <footer className="temp-status-bar">
          <span className="temp-label">Sensor Telemetry:</span>
          <span className="temp-value" style={{ color: alarm1 === 2 ? '#ef4444' : alarm1 === 1 ? '#f59e0b' : '#10b981' }}>
            {alarm1 === 2 ? '🔴 RED ZONE SPIKE DETECTED (Imminent Collapse Limit)' : alarm1 === 1 ? '🟡 WARNING ZONE (Resonance Fatigue)' : '🟢 ADXL345 Normal Accelerometer Shaking Range'}
          </span>
          <span className="temp-divider">·</span>
          <span className="temp-sensor">Dual Node · 20 Hz Live Telemetry</span>
        </footer>
      </div>
    </BrowserRouter>
  );
}
