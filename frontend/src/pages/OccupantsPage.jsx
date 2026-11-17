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
  const [broadcastBuilding, setBroadcastBuilding] = useState('All');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);

  // Autonomous Vibration-Trigger State (No manual confirmation needed)
  const [autoArmed, setAutoArmed] = useState(false);
  const [autoCooldownSec, setAutoCooldownSec] = useState(0);
  const [autonomousNotice, setAutonomousNotice] = useState(null);
  const [liveVibrating, setLiveVibrating] = useState(false);

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
          text: `Imported ${data.insertedCount} residents successfully from "${file.name}"!`,
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
      {/* ── Top Header & Master Alert Dispatch Toggle ─────────────── */}
      <div className="page-header-flex">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>
              Emergency Directory & Automated Alert Dispatch
            </h2>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
              Telecom Service
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
            Automated evacuation calling and SMS notification system for building occupants and registered emergency contacts.
          </p>
        </div>

        {/* ── Single Master Alert Toggle (Safe Testing vs Live Broadcast) ── */}
        <div className="header-actions">
          <button
            type="button"
            className={`btn-alert-master-toggle ${autoArmed ? 'toggle-armed' : 'toggle-testing'}`}
            onClick={handleToggleAuto}
            title={autoArmed ? 'Click to pause calls/SMS and enter safe sensor testing mode' : 'Click to arm emergency calls and SMS for live events'}
          >
            <span className={`toggle-dot ${autoArmed ? 'dot-armed' : 'dot-testing'}`} />
            <div className="toggle-label-wrap">
              <span className="toggle-title">
                {autoArmed ? 'Emergency Alerts: ARMED (Live Mode)' : 'Emergency Alerts: OFF (Testing Mode)'}
              </span>
              <span className="toggle-subtitle">
                {autoArmed
                  ? 'Calls & SMS active — critical shaking will alert all occupants'
                  : 'Calls & SMS paused — safe to shake and test sensors'}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* ── Real-Time Status & Incident Banners ─────────────────────── */}
      {autonomousNotice && (
        <div className="autonomous-live-alert-banner">
          <div>
            <strong>AUTONOMOUS EMERGENCY ALERT DISPATCHED:</strong> {autonomousNotice}
          </div>
        </div>
      )}

      <div className={`auto-armed-status-strip ${autoArmed ? 'strip-armed' : 'strip-testing'}`}>
        <span className={`status-indicator-dot ${autoArmed ? 'dot-danger' : 'dot-neutral'}`} />
        <span>
          {autoArmed ? (
            <>
              <strong>Emergency Life-Safety Mode Armed:</strong> Monitoring live vibration from SW-420 & ADXL345 sensors.
              {liveVibrating
                ? ' Seismic vibration detected — processing automated emergency calls and SMS...'
                : ' Automated phone calls and SMS alerts will automatically dispatch to all registered occupants and relatives if critical structural shaking is detected.'}
            </>
          ) : (
            <>
              <strong>Sensor Testing Mode Active:</strong> Automatic voice calls and SMS alerts are currently paused. You can shake, tap, or tilt sensors freely for demonstration and testing without dispatching phone notifications.
            </>
          )}
        </span>
      </div>

      {/* ── KPI Metric Badges ─────────────────────────────────────── */}
      <div className="metrics-row">
        <div className="metric-box">
          <div className="metric-label">Total Occupants</div>
          <div className="metric-val">{stats.total}</div>
          <div className="metric-sub">Registered across buildings</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">Inside Building</div>
          <div className="metric-val" style={{ color: '#dc2626' }}>{stats.inside}</div>
          <div className="metric-sub">Target for Voice Call & Evacuation SMS</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">Evacuated / Safe</div>
          <div className="metric-val" style={{ color: '#16a34a' }}>{stats.evacuated}</div>
          <div className="metric-sub">Assembly ground confirmed</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">Building 1 (Unprotected)</div>
          <div className="metric-val">{stats.b1Count}</div>
          <div className="metric-sub">Fixed-Base Structure</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">Building 2 (Resistant)</div>
          <div className="metric-val">{stats.b2Count}</div>
          <div className="metric-sub">Base-Isolated Structure</div>
        </div>
      </div>

      {/* ── Main Toolbar: Search, Filters, Excel Import / Export ──── */}
      <div className="directory-toolbar">
        <div className="toolbar-left">
          <input
            type="text"
            className="search-input"
            placeholder="Search resident name, phone, flat, or relative..."
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
            <option value="Inside Building">Inside Building</option>
            <option value="Evacuated / Safe">Evacuated / Safe</option>
          </select>
        </div>

        <div className="toolbar-right">
          <button className="btn-action btn-add" onClick={openAddModal}>
            Add Resident
          </button>

          <label className="btn-action btn-upload">
            {uploadingFile ? 'Importing...' : 'Import Excel / CSV'}
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
            Excel Template
          </a>

          <a
            href={`${BACKEND_URL}/api/occupants/export`}
            download="SHM_Occupants_Export.xlsx"
            className="btn-action btn-secondary"
          >
            Export Excel
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
                  No occupants match your current filters. Click <strong>"Add Resident"</strong> or <strong>"Import Excel"</strong> to register occupants.
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
                          {isInside ? 'Inside Building' : 'Evacuated / Safe'}
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
                          <div className="relative-phone">{occ.relative_phone || 'No phone'}</div>
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
                          Call
                        </button>
                        <button
                          className="btn-direct-sms"
                          title="Evacuation SMS"
                          onClick={() => handleDirectSMS(occ.phone, occ.name, occ.building_id)}
                        >
                          SMS
                        </button>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn-icon" onClick={() => openEditModal(occ)} title="Edit Details">
                        Edit
                      </button>
                      <button
                        className="btn-icon btn-icon-del"
                        onClick={() => handleDelete(occ.id, occ.name)}
                        title="Delete Occupant"
                      >
                        Delete
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
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
              Emergency Alert Audit Trail
            </h3>
            <p className="logs-sub" style={{ margin: '4px 0 0 0', fontSize: '0.825rem', color: '#64748b' }}>
              Real-time persistent log of automated voice calls, resident SMS, and family advisory notifications dispatched via Twilio.
            </p>
          </div>
          <button className="btn-action btn-secondary" onClick={loadAlertLogs} disabled={loadingLogs}>
            {loadingLogs ? 'Refreshing...' : 'Refresh Logs'}
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
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                {editingOccupant ? 'Edit Resident Details' : 'Add Resident to Emergency Directory'}
              </h3>
              <button className="btn-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveOccupant}>
              <div className="modal-body">
                <div className="form-section-title">Resident Information</div>
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
                      <option value="Inside Building">Inside Building (High Priority)</option>
                      <option value="Evacuated / Safe">Evacuated / Safe</option>
                    </select>
                  </div>
                </div>

                <div className="form-section-title" style={{ marginTop: '20px' }}>
                  Emergency Family / Relative Contact (Receives Advisory SMS)
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
    </div>
  );
}
