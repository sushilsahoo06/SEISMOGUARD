import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './OccupantsPage.css';

const BACKEND_URL =
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000'
    : (import.meta.env.VITE_BACKEND_URL || 'https://shm-v5rg.onrender.com');

export default function OccupantsPage() {
  const [occupants, setOccupants] = useState([]);
  const [stats, setStats] = useState({ total: 0, inside: 0, evacuated: 0, b1Count: 0, b2Count: 0 });
  const [loading, setLoading] = useState(true);
  const [filterBuilding, setFilterBuilding] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Forms
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOccupant, setEditingOccupant] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    building_id: 'Building 1',
    room_number: '',
    floor: 1,
    status: 'Inside Building',
    relative_name: '',
    relative_phone: '',
    relative_relation: 'Family',
  });

  // Emergency Broadcast State
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastBuilding, setBroadcastBuilding] = useState('All');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);

  // Autonomous Vibration-Trigger State (No manual confirmation needed)
  const [autoArmed, setAutoArmed] = useState(false);
  const [autoCooldownSec, setAutoCooldownSec] = useState(0);
  const [autonomousNotice, setAutonomousNotice] = useState(null);
  const [liveVibrating, setLiveVibrating] = useState(false);

  // Quick Test Modal / Controls
  const [testPhone, setTestPhone] = useState('+91');
  const [testingCall, setTestingCall] = useState(false);
  const [testingSMS, setTestingSMS] = useState(false);
  const [testingWA, setTestingWA] = useState(false);
  const [testFeedback, setTestFeedback] = useState(null);

  // File Upload State
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState(null);
  const fileInputRef = useRef(null);

  // Alert Logs
  const [alertLogs, setAlertLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Load Occupants
  const loadOccupants = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterBuilding !== 'All') params.append('building', filterBuilding);
      if (filterStatus !== 'All') params.append('status', filterStatus);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`${BACKEND_URL}/api/occupants?${params.toString()}`);
      const data = await res.json();
      setOccupants(data.occupants || []);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error('Failed to load occupants:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load Alert Logs
  const loadAlertLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await fetch(`${BACKEND_URL}/api/alerts/logs`);
      const data = await res.json();
      setAlertLogs(data.logs || []);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Load Autonomous Vibration Mode Status
  const loadAutoDispatchStatus = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/alerts/auto-dispatch-status`);
      const data = await res.json();
      setAutoArmed(Boolean(data.enabled));
      setAutoCooldownSec(data.cooldownRemainingSec || 0);
    } catch (err) {
      console.error('Failed to load auto dispatch status:', err);
    }
  };

  // Toggle Autonomous Vibration Mode (Bypasses manual confirm button)
  const handleToggleAuto = async () => {
    try {
      const nextState = !autoArmed;
      const res = await fetch(`${BACKEND_URL}/api/alerts/auto-dispatch-toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState, targetBuilding: broadcastBuilding }),
      });
      const data = await res.json();
      setAutoArmed(Boolean(data.enabled));
    } catch (err) {
      console.error('Failed to toggle auto dispatch:', err);
    }
  };

  useEffect(() => {
    loadOccupants();
    loadAlertLogs();
    loadAutoDispatchStatus();

    // Listen for live autonomous alert events from socket
    const socket = io(BACKEND_URL);
    socket.on('autonomousAlertDispatched', (payload) => {
      setAutonomousNotice(
        `⚡ VIBRATION DETECTED! Emergency calls (auto-cut) & SMS automatically dispatched to both residents and family contacts!`
      );
      loadOccupants();
      loadAlertLogs();
      loadAutoDispatchStatus();
      setTimeout(() => setAutonomousNotice(null), 12000);
    });

    socket.on('newSensorData', (r) => {
      if (r.sw420_1 === 1 || r.sw420_2 === 1 || (r.magnitude_1 && r.magnitude_1 > 1.35)) {
        setLiveVibrating(true);
        setTimeout(() => setLiveVibrating(false), 2000);
      }
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    loadOccupants();
    loadAlertLogs();
  }, [filterBuilding, filterStatus, searchQuery]);

  // Handle Form Change
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Open Add Modal
  const openAddModal = () => {
    setEditingOccupant(null);
    setFormData({
      name: '',
      phone: '',
      building_id: 'Building 1',
      room_number: '',
      floor: 1,
      status: 'Inside Building',
      relative_name: '',
      relative_phone: '',
      relative_relation: 'Family',
    });
    setShowAddModal(true);
  };

  // Open Edit Modal
  const openEditModal = (occ) => {
    setEditingOccupant(occ);
    setFormData({
      name: occ.name || '',
      phone: occ.phone || '',
      building_id: occ.building_id || 'Building 1',
      room_number: occ.room_number || '',
      floor: occ.floor || 1,
      status: occ.status || 'Inside Building',
      relative_name: occ.relative_name || '',
      relative_phone: occ.relative_phone || '',
      relative_relation: occ.relative_relation || 'Family',
    });
    setShowAddModal(true);
  };

  // Save Occupant (Create or Update)
  const handleSaveOccupant = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      alert('Please provide occupant Name and Phone Number.');
      return;
    }

    try {
      const url = editingOccupant
        ? `${BACKEND_URL}/api/occupants/${editingOccupant.id}`
        : `${BACKEND_URL}/api/occupants`;
      const method = editingOccupant ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save');
      }

      setShowAddModal(false);
      loadOccupants();
    } catch (err) {
      alert('Error saving occupant: ' + err.message);
    }
  };

  // Delete Occupant
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove "${name}" from the directory?`)) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/occupants/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadOccupants();
      } else {
        alert('Failed to delete occupant');
      }
    } catch (err) {
      alert('Error deleting: ' + err.message);
    }
  };

  // Toggle Status
  const toggleStatus = async (occ) => {
    const nextStatus = occ.status === 'Inside Building' ? 'Evacuated / Safe' : 'Inside Building';
    try {
      const res = await fetch(`${BACKEND_URL}/api/occupants/${occ.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        loadOccupants();
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  // Trigger Emergency Evacuation Broadcast
  const handleBroadcast = async () => {
    try {
      setBroadcasting(true);
      setBroadcastResult(null);

      const res = await fetch(`${BACKEND_URL}/api/alerts/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ building_id: broadcastBuilding }),
      });

      const data = await res.json();
      setBroadcastResult(data);
      loadOccupants();
      loadAlertLogs();
    } catch (err) {
      setBroadcastResult({ status: 'error', message: err.message });
    } finally {
      setBroadcasting(false);
    }
  };

  // Direct Call to single occupant
  const handleDirectCall = async (phone, name, building) => {
    if (!window.confirm(`Initiate emergency voice call to ${name} (${phone})?\nCall will speak emergency evacuation instructions and auto-cut upon delivery.`)) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/alerts/test-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, building_id: building }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ Twilio call dispatched to ${name} (${phone})!\nSID: ${data.result?.sid}`);
      } else {
        alert(`⚠️ Twilio Note: ${data.error}`);
      }
      loadAlertLogs();
    } catch (err) {
      alert('Call failed: ' + err.message);
    }
  };

  // Direct SMS to single occupant
  const handleDirectSMS = async (phone, name, building) => {
    if (!window.confirm(`Send emergency evacuation SMS to ${name} (${phone})?`)) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/alerts/test-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          message: `EMERGENCY ALERT: Earthquake detected at ${building}! Evacuate immediately using emergency stairs. Do not use elevators.`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ SMS dispatched to ${name} (${phone})!\nSID: ${data.sid}`);
      } else {
        alert(`⚠️ Twilio Note: ${data.error}`);
      }
      loadAlertLogs();
    } catch (err) {
      alert('SMS failed: ' + err.message);
    }
  };

  // Test Tool Call
  const runTestCall = async () => {
    if (!testPhone || testPhone.length < 8) {
      alert('Enter a valid phone number with country code (e.g. +919876543210)');
      return;
    }
    setTestingCall(true);
    setTestFeedback(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/alerts/test-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, name: 'System Verification' }),
      });
      const data = await res.json();
      setTestFeedback({
        type: res.ok ? 'success' : 'error',
        text: res.ok
          ? `📞 Voice Call Dispatched! Twilio SID: ${data.result?.sid}. Receiver will hear the automated evacuation alert and the call will automatically hang up.`
          : `⚠️ Call Notice: ${data.error}`,
      });
      loadAlertLogs();
    } catch (err) {
      setTestFeedback({ type: 'error', text: err.message });
    } finally {
      setTestingCall(false);
    }
  };

  // Test Tool SMS
  const runTestSMS = async () => {
    if (!testPhone || testPhone.length < 8) {
      alert('Enter a valid phone number with country code (e.g. +919876543210)');
      return;
    }
    setTestingSMS(true);
    setTestFeedback(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/alerts/test-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone,
          message: 'SHM TEST ALERT: Structural Health Monitoring emergency notification verified on your device!',
        }),
      });
      const data = await res.json();
      setTestFeedback({
        type: res.ok ? 'success' : 'error',
        text: res.ok
          ? `💬 Test SMS Dispatched! Twilio SID: ${data.sid}.`
          : `⚠️ SMS Notice: ${data.error}`,
      });
      loadAlertLogs();
    } catch (err) {
      setTestFeedback({ type: 'error', text: err.message });
    } finally {
      setTestingSMS(false);
    }
  };

  // Test Tool WhatsApp
  const runTestWA = async () => {
    if (!testPhone || testPhone.length < 8) {
      alert('Enter a valid phone number with country code (e.g. +919876543210)');
      return;
    }
    setTestingWA(true);
    setTestFeedback(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/alerts/test-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone,
          message: 'SHM TEST: WhatsApp Earthquake Alert System active & ready.',
        }),
      });
      const data = await res.json();
      setTestFeedback({
        type: res.ok ? 'success' : 'error',
        text: res.ok
          ? `🟢 WhatsApp Message Dispatched! SID: ${data.sid}`
          : `⚠️ WhatsApp Notice: ${data.error}`,
      });
      loadAlertLogs();
    } catch (err) {
      setTestFeedback({ type: 'error', text: err.message });
    } finally {
      setTestingWA(false);
    }
  };

  // Handle Excel File Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      setUploadingFile(true);
      setUploadFeedback(null);

      const res = await fetch(`${BACKEND_URL}/api/occupants/upload`, {
        method: 'POST',
        body: formDataUpload,
      });

      const data = await res.json();
      if (res.ok) {
        setUploadFeedback({
          type: 'success',
          text: `🎉 Imported ${data.insertedCount} residents successfully from "${file.name}"!`,
        });
        loadOccupants();
      } else {
        setUploadFeedback({ type: 'error', text: data.error || 'Upload failed' });
      }
    } catch (err) {
      setUploadFeedback({ type: 'error', text: err.message });
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="occupants-page">
      {/* ── Top Header & KPI Summary Cards ────────────────────────── */}
      <div className="page-header-flex">
        <div>
          <h2>👥 Emergency Directory & Automated Calling Dispatch</h2>
          <p>Manage building occupants, emergency family contacts, and dispatch automated Twilio voice calls, SMS, and WhatsApp alerts.</p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className={`btn-auto-pill ${autoArmed ? 'pill-auto-armed' : 'pill-auto-off'}`}
            onClick={handleToggleAuto}
            title="Toggle autonomous emergency dispatch on vibration"
          >
            {autoArmed ? '⚡ Auto-Dispatch on Vibration: ARMED (ON) 🔴' : '⚡ Auto-Dispatch: OFF ⚪'}
          </button>
          <button className="btn-broadcast-main" onClick={() => setShowBroadcastModal(true)}>
            🚨 TRIGGER EVACUATION BROADCAST
          </button>
        </div>
      </div>

      {/* ── Real-Time Autonomous Live Incident Banners ────────────── */}
      {autonomousNotice && (
        <div className="autonomous-live-alert-banner">
          <span className="pulse-icon">🚨</span>
          <div>
            <strong>AUTONOMOUS EMERGENCY ALERT DISPATCHED!</strong>
            <div>{autonomousNotice}</div>
          </div>
        </div>
      )}

      {autoArmed && (
        <div className="auto-armed-status-strip">
          <span className="pulse-dot">🔴</span>
          <span>
            <strong>AUTONOMOUS LIFE-SAFETY MODE ARMED:</strong> Monitoring live vibration from SW-420 & ADXL345 sensors.
            {liveVibrating
              ? ' 💥 SEISMIC SHAKING DETECTED! Processing alert dispatch...'
              : ' No manual button click needed — calls and messages will dispatch automatically to you and your family the instant shaking begins!'}
          </span>
        </div>
      )}

      {/* ── KPI Metric Badges ─────────────────────────────────────── */}
      <div className="metrics-row">
        <div className="metric-box box-total">
          <div className="metric-label">Total Occupants</div>
          <div className="metric-val">{stats.total}</div>
          <div className="metric-sub">Registered across buildings</div>
        </div>
        <div className="metric-box box-danger">
          <div className="metric-label">Inside Building 🔴</div>
          <div className="metric-val">{stats.inside}</div>
          <div className="metric-sub">Target for Voice Call & Evacuation SMS</div>
        </div>
        <div className="metric-box box-safe">
          <div className="metric-label">Evacuated / Safe 🟢</div>
          <div className="metric-val">{stats.evacuated}</div>
          <div className="metric-sub">Assembly ground confirmed</div>
        </div>
        <div className="metric-box box-b1">
          <div className="metric-label">Building 1 (Unprotected)</div>
          <div className="metric-val">{stats.b1Count}</div>
          <div className="metric-sub">Fixed-Base High-Risk Zone</div>
        </div>
        <div className="metric-box box-b2">
          <div className="metric-label">Building 2 (Resistant)</div>
          <div className="metric-val">{stats.b2Count}</div>
          <div className="metric-sub">Base-Isolated Structure</div>
        </div>
      </div>

      {/* ── Twilio Direct Test & System Verification Bar ───────────── */}
      <div className="test-bar-card">
        <div className="test-bar-header">
          <span className="test-icon">🛠️</span>
          <div>
            <strong>Twilio Telecom Live Verification</strong>
            <span className="test-sub"> — Test Automated Voice Call (with auto-cut on pickup), SMS, or WhatsApp on any phone:</span>
          </div>
        </div>
        <div className="test-bar-controls">
          <input
            type="text"
            className="input-test-phone"
            placeholder="+919876543210"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
          />
          <button className="btn-test-action btn-call" onClick={runTestCall} disabled={testingCall}>
            {testingCall ? 'Dialing...' : '📞 Test Voice Call (Auto-Cut)'}
          </button>
          <button className="btn-test-action btn-sms" onClick={runTestSMS} disabled={testingSMS}>
            {testingSMS ? 'Sending...' : '💬 Test SMS'}
          </button>
          <button className="btn-test-action btn-wa" onClick={runTestWA} disabled={testingWA}>
            {testingWA ? 'Sending...' : '🟢 Test WhatsApp'}
          </button>
        </div>
        {testFeedback && (
          <div className={`feedback-alert ${testFeedback.type === 'success' ? 'feedback-success' : 'feedback-error'}`}>
            {testFeedback.text}
          </div>
        )}
      </div>

      {/* ── Main Toolbar: Search, Filters, Excel Import / Export ──── */}
      <div className="directory-toolbar">
        <div className="toolbar-left">
          <input
            type="text"
            className="search-input"
            placeholder="🔍 Search resident name, phone, flat, or relative..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className="filter-select"
            value={filterBuilding}
            onChange={(e) => setFilterBuilding(e.target.value)}
          >
            <option value="All">All Buildings</option>
            <option value="Building 1">Building 1</option>
            <option value="Building 2">Building 2</option>
          </select>

          <select
            className="filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Inside Building">🔴 Inside Building</option>
            <option value="Evacuated / Safe">🟢 Evacuated / Safe</option>
          </select>
        </div>

        <div className="toolbar-right">
          <button className="btn-action btn-add" onClick={openAddModal}>
            ➕ Add Resident
          </button>

          <label className="btn-action btn-upload">
            📁 {uploadingFile ? 'Importing...' : 'Import Excel / CSV'}
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls, .csv"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
              disabled={uploadingFile}
            />
          </label>

          <a
            href={`${BACKEND_URL}/api/occupants/template`}
            download="SHM_Occupants_Template.xlsx"
            className="btn-action btn-secondary"
          >
            📥 Excel Template
          </a>

          <a
            href={`${BACKEND_URL}/api/occupants/export`}
            download="SHM_Occupants_Export.xlsx"
            className="btn-action btn-secondary"
          >
            📤 Export Excel
          </a>
        </div>
      </div>

      {uploadFeedback && (
        <div className={`feedback-alert ${uploadFeedback.type === 'success' ? 'feedback-success' : 'feedback-error'}`}>
          {uploadFeedback.text}
        </div>
      )}

      {/* ── Occupants Table ───────────────────────────────────────── */}
      <div className="table-card">
        <table className="occupants-table">
          <thead>
            <tr>
              <th>Resident Name</th>
              <th>Location</th>
              <th>Resident Phone</th>
              <th>Evacuation Status</th>
              <th>Emergency Contact (Family)</th>
              <th style={{ textAlign: 'center' }}>Immediate Alert</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="text-center py-6 text-gray-500">
                  Loading emergency directory...
                </td>
              </tr>
            ) : occupants.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-8 text-gray-500">
                  No occupants match your current filters. Click <strong>"➕ Add Resident"</strong> or <strong>"Import Excel"</strong> to add occupants.
                </td>
              </tr>
            ) : (
              occupants.map((occ) => {
                const isInside = occ.status === 'Inside Building';
                return (
                  <tr key={occ.id} className={isInside ? 'row-inside' : 'row-safe'}>
                    <td>
                      <div className="occupant-name">{occ.name}</div>
                      <div className="occupant-sub">ID: #{occ.id}</div>
                    </td>
                    <td>
                      <div className="building-badge">{occ.building_id}</div>
                      <div className="room-sub">Floor {occ.floor} · {occ.room_number}</div>
                    </td>
                    <td>
                      <div className="phone-tag">{occ.phone}</div>
                    </td>
                    <td>
                      <div className="status-cell">
                        <span className={`status-pill ${isInside ? 'pill-inside' : 'pill-evacuated'}`}>
                          {isInside ? '🔴 Inside Building' : '🟢 Evacuated / Safe'}
                        </span>
                        <button
                          className="btn-toggle-status"
                          onClick={() => toggleStatus(occ)}
                          title="Click to toggle status"
                        >
                          {isInside ? 'Mark Safe' : 'Mark Inside'}
                        </button>
                      </div>
                    </td>
                    <td>
                      {occ.relative_name ? (
                        <div>
                          <div className="relative-name">
                            {occ.relative_name}
                            {occ.relative_relation && (
                              <span className="relation-tag">{occ.relative_relation}</span>
                            )}
                          </div>
                          <div className="relative-phone">📞 {occ.relative_phone || 'No phone'}</div>
                        </div>
                      ) : (
                        <span className="text-muted">None registered</span>
                      )}
                    </td>
                    <td>
                      <div className="direct-alert-btns">
                        <button
                          className="btn-direct-call"
                          title="Auto-Hangup Voice Call"
                          onClick={() => handleDirectCall(occ.phone, occ.name, occ.building_id)}
                        >
                          📞 Call
                        </button>
                        <button
                          className="btn-direct-sms"
                          title="Evacuation SMS"
                          onClick={() => handleDirectSMS(occ.phone, occ.name, occ.building_id)}
                        >
                          💬 SMS
                        </button>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn-icon" onClick={() => openEditModal(occ)} title="Edit Details">
                        ✏️
                      </button>
                      <button
                        className="btn-icon btn-icon-del"
                        onClick={() => handleDelete(occ.id, occ.name)}
                        title="Delete Occupant"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Alert Logs Audit Table ─────────────────────────────────── */}
      <div className="logs-card">
        <div className="logs-header">
          <div>
            <h3>📋 Live Emergency Alert Audit Trail</h3>
            <p className="logs-sub">Real-time log of automated calls, resident SMS, and family advisory messages sent via Twilio.</p>
          </div>
          <button className="btn-action btn-secondary" onClick={loadAlertLogs} disabled={loadingLogs}>
            🔄 {loadingLogs ? 'Refreshing...' : 'Refresh Logs'}
          </button>
        </div>

        <table className="logs-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Recipient</th>
              <th>Role</th>
              <th>Channel</th>
              <th>Status</th>
              <th>Message / Twilio SID</th>
            </tr>
          </thead>
          <tbody>
            {alertLogs.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-4 text-gray-500">
                  No alerts have been dispatched yet.
                </td>
              </tr>
            ) : (
              alertLogs.slice(0, 15).map((log) => (
                <tr key={log.id}>
                  <td className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td>
                    <strong>{log.recipient_name}</strong>
                    <div className="log-phone">{log.recipient_phone}</div>
                  </td>
                  <td>
                    <span className={`log-badge badge-${log.recipient_type?.toLowerCase()}`}>
                      {log.recipient_type}
                    </span>
                  </td>
                  <td>
                    <span className="log-channel">{log.alert_type}</span>
                  </td>
                  <td>
                    <span className={`status-pill ${log.status === 'Dispatched' ? 'pill-safe' : 'pill-danger'}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="log-msg">
                    <div>{log.message_body}</div>
                    {log.twilio_sid && <div className="log-sid">SID: {log.twilio_sid}</div>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── MODAL: Add / Edit Occupant ─────────────────────────────── */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingOccupant ? '✏️ Edit Occupant Details' : '➕ Add Resident to Emergency Directory'}</h3>
              <button className="btn-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveOccupant}>
              <div className="modal-body">
                <div className="form-section-title">🏢 Resident Information</div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="e.g. Sushil Sahoo"
                      value={formData.name}
                      onChange={handleFormChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Resident Phone Number *</label>
                    <input
                      type="text"
                      name="phone"
                      required
                      placeholder="e.g. +919876543210"
                      value={formData.phone}
                      onChange={handleFormChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Building</label>
                    <select name="building_id" value={formData.building_id} onChange={handleFormChange}>
                      <option value="Building 1">Building 1 (Unprotected)</option>
                      <option value="Building 2">Building 2 (Resistant)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Room / Flat Number</label>
                    <input
                      type="text"
                      name="room_number"
                      placeholder="e.g. Flat 402"
                      value={formData.room_number}
                      onChange={handleFormChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Floor</label>
                    <input
                      type="number"
                      name="floor"
                      min="0"
                      max="50"
                      value={formData.floor}
                      onChange={handleFormChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Current Evacuation Status</label>
                    <select name="status" value={formData.status} onChange={handleFormChange}>
                      <option value="Inside Building">🔴 Inside Building (High Risk)</option>
                      <option value="Evacuated / Safe">🟢 Evacuated / Safe</option>
                    </select>
                  </div>
                </div>

                <div className="form-section-title" style={{ marginTop: '20px' }}>
                  👨‍👩‍👦 Emergency Family / Relative Contact (Receives Advisory SMS)
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Relative / Family Name</label>
                    <input
                      type="text"
                      name="relative_name"
                      placeholder="e.g. Ramesh Sahoo"
                      value={formData.relative_name}
                      onChange={handleFormChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Relative Phone Number</label>
                    <input
                      type="text"
                      name="relative_phone"
                      placeholder="e.g. +919123456789"
                      value={formData.relative_phone}
                      onChange={handleFormChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Relationship</label>
                    <select name="relative_relation" value={formData.relative_relation} onChange={handleFormChange}>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Brother">Brother</option>
                      <option value="Sister">Sister</option>
                      <option value="Child">Son / Daughter</option>
                      <option value="Friend">Friend</option>
                      <option value="Guardian">Guardian / Colleague</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingOccupant ? 'Save Changes' : 'Add Resident to Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Emergency Broadcast Confirmation ────────────────── */}
      {showBroadcastModal && (
        <div className="modal-backdrop">
          <div className="modal-content modal-broadcast">
            <div className="modal-header modal-header-danger">
              <h3>🚨 Emergency Evacuation Calling & SMS Broadcast</h3>
              <button className="btn-close" onClick={() => setShowBroadcastModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="broadcast-warning-box">
                <strong>CRITICAL LIFE-SAFETY ACTION:</strong>
                <p>
                  You are preparing to dispatch automated evacuation calls and emergency messages to all residents currently registered as <strong>"Inside Building"</strong>.
                </p>
                <ul>
                  <li><strong>Automated Voice Call:</strong> Places phone calls speaking evacuation instructions in English/Hindi and automatically hangs up upon completion.</li>
                  <li><strong>Occupant SMS:</strong> Sends direct high-priority evacuation instructions to residents inside the building.</li>
                  <li><strong>WhatsApp Alert:</strong> Delivers emergency warnings directly to WhatsApp mobile devices.</li>
                  <li><strong>Relative Advisory Notification:</strong> Sends an alert message to each resident's emergency family contact (e.g. <em>"⚠️ Your relative Sushil is in an earthquake-affected building. Rescue operations underway."</em>).</li>
                </ul>
              </div>

              {/* ── AUTONOMOUS VIBRATION DISPATCH TOGGLE (NO CONFIRM BUTTON NEEDED) ── */}
              <div className={`autonomous-modal-card ${autoArmed ? 'auto-card-active' : 'auto-card-idle'}`}>
                <div className="auto-modal-header">
                  <div className="auto-modal-text">
                    <div className="auto-modal-badge">
                      {autoArmed ? '⚡ AUTONOMOUS DISPATCH: ON (ARMED)' : '⚪ AUTONOMOUS DISPATCH: OFF'}
                    </div>
                    <h4>Auto-Dispatch on Vibration (Bypasses Confirm Button)</h4>
                    <p>
                      When this is <strong>ON</strong>, you <strong>do not need to click the Confirm Dispatch button</strong>.
                      As soon as physical vibration is detected by the ESP32 (SW-420 or ADXL345), the system will automatically call and text <strong>both you and your family contacts</strong>!
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`btn-auto-toggle-switch ${autoArmed ? 'btn-switch-on' : 'btn-switch-off'}`}
                    onClick={handleToggleAuto}
                  >
                    {autoArmed ? '⚡ ARMED (ON)' : '⚪ TURN ON'}
                  </button>
                </div>

                {autoArmed && (
                  <div className="auto-armed-callout">
                    <span className="live-radar-dot">🔴</span>
                    <div>
                      <strong>MANUAL CONFIRMATION BYPASSED:</strong> The system is actively waiting for vibration.
                      Start shaking the building or sensors to trigger automated calls and messages immediately!
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label><strong>Target Building:</strong></label>
                <select
                  value={broadcastBuilding}
                  onChange={(e) => setBroadcastBuilding(e.target.value)}
                  className="filter-select"
                  style={{ width: '100%', marginTop: '6px' }}
                >
                  <option value="All">All Buildings (Building 1 & Building 2)</option>
                  <option value="Building 1">Building 1 Only (Unprotected - Severe Risk)</option>
                  <option value="Building 2">Building 2 Only (Damped / Resistant)</option>
                </select>
              </div>

              {broadcastResult && (
                <div className={`broadcast-result-box ${broadcastResult.status === 'success' ? 'res-success' : 'res-error'}`}>
                  <h4>{broadcastResult.status === 'success' ? '🎉 Broadcast Dispatched Successfully!' : 'Broadcast Response'}</h4>
                  <p>{broadcastResult.message}</p>
                  {broadcastResult.summary && (
                    <div className="result-stats-grid">
                      <div><strong>{broadcastResult.summary.totalOccupantsInside}</strong> Residents Inside</div>
                      <div><strong>{broadcastResult.summary.callsDispatched}</strong> Voice Calls Dispatched</div>
                      <div><strong>{broadcastResult.summary.smsDispatched}</strong> SMS Dispatched</div>
                      <div><strong>{broadcastResult.summary.relativesNotified}</strong> Relatives Notified</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setShowBroadcastModal(false); setBroadcastResult(null); }}
              >
                Close
              </button>
              <button
                type="button"
                className={`btn-danger-execute ${autoArmed ? 'btn-pulse-glow' : ''}`}
                onClick={handleBroadcast}
                disabled={broadcasting}
              >
                {broadcasting
                  ? '⏳ Dispatching Emergency Calls & SMS...'
                  : autoArmed
                    ? '⚡ Armed on Vibration (Or Click to Dispatch Manually Now)'
                    : '🚨 Confirm & Dispatch Emergency Broadcast'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

