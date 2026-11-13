import React, { useState } from 'react';

export default function AudioSettingsCard({
  audioFile,
  onAudioFileChange,
  volume,
  onVolumeChange,
  isTestingAudio,
  onToggleTestAudio,
  isAudioUnlocked,
  onUnlockAudio,
}) {
  const [inputVal, setInputVal] = useState(audioFile);

  const handleApply = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    const formatted = inputVal.trim().startsWith('/') ? inputVal.trim() : `/${inputVal.trim()}`;
    onAudioFileChange(formatted);
  };

  return (
    <div className="eq-card eq-audio-card">
      <div className="eq-card-header">
        <span className="eq-card-icon">🎵</span>
        <h2 className="eq-card-title">Public Directory Audio Config</h2>
      </div>

      <p className="eq-card-desc">
        Drop any custom audio file (e.g. <code>alert.mp3</code>, <code>siren.wav</code>) into your 
        <strong><code>frontend/public/</code></strong> directory. It is served directly by React!
      </p>

      {/* Audio File Input Form */}
      <form onSubmit={handleApply} className="eq-audio-form">
        <div className="eq-input-group">
          <label className="eq-label">Audio Path in Public Dir:</label>
          <div className="eq-input-row">
            <input
              type="text"
              className="eq-input"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="/alert.mp3"
            />
            <button type="submit" className="eq-btn-apply">Set File</button>
          </div>
        </div>
      </form>

      {/* Current Active Audio Display */}
      <div className="eq-active-audio-banner">
        <span className="eq-banner-label">ACTIVE AUDIO TRACK:</span>
        <span className="eq-banner-path">public{audioFile}</span>
      </div>

      {/* Controls Row: Volume Slider & Test Button */}
      <div className="eq-audio-controls-grid">
        <div className="eq-volume-control">
          <label className="eq-label">Alarm Volume: {Math.round(volume * 100)}%</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="eq-slider"
          />
        </div>

        <div className="eq-test-actions">
          <button
            type="button"
            className={`eq-btn-test ${isTestingAudio ? 'eq-btn-test-active' : ''}`}
            onClick={() => {
              if (!isAudioUnlocked) onUnlockAudio();
              onToggleTestAudio();
            }}
          >
            {isTestingAudio ? '⏹ Stop Audio Test' : '▶ Test Alert Sound'}
          </button>
        </div>
      </div>
    </div>
  );
}
