import React from 'react';

export default function AlertHeader({ isConnected, isAudioUnlocked, onUnlockAudio, isMuted, onToggleMute }) {
  return (
    <header className="eq-header">
      <div className="eq-header-left">
        <span className="eq-header-icon">🚨</span>
        <div>
          <h1 className="eq-header-title">Earthquake Emergency Sound Alert</h1>
          <p className="eq-header-subtitle">Real-Time Seismic Shock & Collapse Audio Alarm</p>
        </div>
      </div>

      <div className="eq-header-actions">
        {/* Socket Status Pill */}
        <div className={`eq-status-pill ${isConnected ? 'eq-pill-online' : 'eq-pill-offline'}`}>
          <span className="eq-status-dot"></span>
          <span>{isConnected ? 'LIVE WEBSOCKET' : 'DISCONNECTED'}</span>
        </div>

        {/* Browser Audio Unlock Button */}
        {!isAudioUnlocked ? (
          <button className="eq-btn-unlock-audio" onClick={onUnlockAudio} title="Click to allow browser sound autoplay">
            🔔 Click to Enable Sound
          </button>
        ) : (
          <button
            className={`eq-btn-audio-status ${isMuted ? 'eq-btn-muted' : 'eq-btn-unmuted'}`}
            onClick={onToggleMute}
            title={isMuted ? 'Audio is Muted' : 'Audio is Armed & Ready'}
          >
            {isMuted ? '🔇 Audio Muted' : '🔊 Sound Armed'}
          </button>
        )}
      </div>
    </header>
  );
}
