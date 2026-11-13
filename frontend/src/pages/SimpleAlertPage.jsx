import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import AlertHeader from '../components/earthquake/AlertHeader';
import AudioSettingsCard from '../components/earthquake/AudioSettingsCard';
import SeismicMonitorCard from '../components/earthquake/SeismicMonitorCard';
import EmergencyAlertModal from '../components/earthquake/EmergencyAlertModal';
import IncidentLogCard from '../components/earthquake/IncidentLogCard';
import '../components/earthquake/EarthquakeAlert.css';

const SOCKET_SERVER_URL =
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000'
    : (import.meta.env.VITE_BACKEND_URL || 'https://shm-v5rg.onrender.com');

const DEFAULT_AUDIO_PATH = '/alert.mp3'; // Stored directly in frontend/public/alert.mp3

export default function SimpleAlertPage() {
  // ── State ────────────────────────────────────────────────────────
  const [isConnected, setIsConnected] = useState(false);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioFile, setAudioFile] = useState(() => {
    return localStorage.getItem('@shm_public_audio_path') || DEFAULT_AUDIO_PATH;
  });
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('@shm_audio_volume');
    return saved !== null ? parseFloat(saved) : 1.0;
  });

  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [isEarthquake, setIsEarthquake] = useState(false);
  const [alertData, setAlertData] = useState(null);
  const [latestData, setLatestData] = useState(null);
  const [incidentHistory, setIncidentHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('@shm_incident_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // ── Audio Ref ────────────────────────────────────────────────────
  const audioRef = useRef(null);
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  // Initialize Audio instance
  useEffect(() => {
    const audio = new Audio(audioFile);
    audio.loop = true;
    audio.volume = isMuted ? 0 : volume;
    audioRef.current = audio;

    // Detect if browser allows sound
    const unlockOnFirstClick = () => {
      audio.play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          setIsAudioUnlocked(true);
        })
        .catch(() => {
          // Requires user click
        });
      window.removeEventListener('click', unlockOnFirstClick);
    };
    window.addEventListener('click', unlockOnFirstClick);

    return () => {
      audio.pause();
      audio.src = '';
      window.removeEventListener('click', unlockOnFirstClick);
    };
  }, []);

  // Update audio source when audioFile changes
  useEffect(() => {
    if (audioRef.current) {
      const wasPlaying = !audioRef.current.paused;
      audioRef.current.pause();
      audioRef.current.src = audioFile;
      audioRef.current.load();
      if (wasPlaying && !isMutedRef.current) {
        audioRef.current.play().catch(() => {});
      }
    }
    localStorage.setItem('@shm_public_audio_path', audioFile);
  }, [audioFile]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
    localStorage.setItem('@shm_audio_volume', volume.toString());
  }, [volume, isMuted]);

  // ── Browser Audio Unlock Helper ──────────────────────────────────
  const handleUnlockAudio = () => {
    if (audioRef.current) {
      audioRef.current.play()
        .then(() => {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setIsAudioUnlocked(true);
        })
        .catch((err) => {
          console.warn('Audio unlock error:', err);
        });
    }
  };

  const handleToggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  // ── Real-Time WebSocket Connection ───────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      console.log('Earthquake Alert connected to socket:', SOCKET_SERVER_URL);
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Earthquake Alert disconnected from socket');
      setIsConnected(false);
    });

    // 1. Process Live Sensor Stream
    socket.on('newSensorData', (data) => {
      setLatestData(data);

      // Check if ML or threshold flags critical earthquake
      const isCritical =
        (data.ml && data.ml.hazardLevel === 'CRITICAL') ||
        data.alarm_1 === 2 ||
        (data.magnitude_1 && data.magnitude_1 > 1.85);

      if (isCritical) {
        triggerEarthquakeAlarm({
          eventType: data.ml?.eventType || 'SEISMIC_TREMOR',
          hazardLevel: 'CRITICAL',
          damageIndex: data.ml?.damageIndex || 0.88,
          pga_1: data.ml?.building1?.pga || data.magnitude_1 || 1.85,
          timestamp: data.timestamp || new Date().toISOString(),
        });
      }
    });

    // 2. Dedicated ML Seismic Alert Event
    socket.on('mlAlert', (alert) => {
      if (alert.hazardLevel === 'CRITICAL' || alert.eventType === 'SEISMIC_TREMOR') {
        triggerEarthquakeAlarm(alert);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // ── Trigger Earthquake Alarm & Play Audio ────────────────────────
  const triggerEarthquakeAlarm = (info) => {
    setIsEarthquake(true);
    setAlertData(info);

    // Save incident to history
    setIncidentHistory((prev) => {
      const updated = [info, ...prev.slice(0, 9)];
      try {
        localStorage.setItem('@shm_incident_history', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // Start Audio Alert Playback
    if (audioRef.current && !isMutedRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        console.warn('Autoplay prevented. Click anywhere on page to unlock sound.', err);
      });
    }
  };

  // Silence / Dismiss Alarm
  const handleSilenceAlarm = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsEarthquake(false);
    setIsTestingAudio(false);
  };

  // Toggle Test Sound
  const handleToggleTestAudio = () => {
    if (isTestingAudio) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsTestingAudio(false);
    } else {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      setIsTestingAudio(true);
      setIsAudioUnlocked(true);
    }
  };

  // Simulate Earthquake
  const handleSimulateEarthquake = () => {
    triggerEarthquakeAlarm({
      eventType: 'SIMULATED_EARTHQUAKE',
      hazardLevel: 'CRITICAL',
      damageIndex: 0.94,
      pga_1: 1.92,
      timestamp: new Date().toISOString(),
    });
  };

  const handleClearHistory = () => {
    setIncidentHistory([]);
    localStorage.removeItem('@shm_incident_history');
  };

  return (
    <div className="eq-page-container">
      {/* 1. Header Component */}
      <AlertHeader
        isConnected={isConnected}
        isAudioUnlocked={isAudioUnlocked}
        onUnlockAudio={handleUnlockAudio}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />

      {/* 2. Seismic Monitor Card (Status & Telemetry) */}
      <SeismicMonitorCard
        isEarthquake={isEarthquake}
        latestData={latestData}
        onSimulateEarthquake={handleSimulateEarthquake}
      />

      {/* 3. Audio Settings Card (Public Directory Control) */}
      <AudioSettingsCard
        audioFile={audioFile}
        onAudioFileChange={setAudioFile}
        volume={volume}
        onVolumeChange={setVolume}
        isTestingAudio={isTestingAudio}
        onToggleTestAudio={handleToggleTestAudio}
        isAudioUnlocked={isAudioUnlocked}
        onUnlockAudio={handleUnlockAudio}
      />

      {/* 4. Incident Log Card */}
      <IncidentLogCard
        incidentHistory={incidentHistory}
        onClearHistory={handleClearHistory}
      />

      {/* 5. Fullscreen Emergency Alert Modal (Triggers on Earthquake) */}
      <EmergencyAlertModal
        isOpen={isEarthquake}
        alertData={alertData}
        audioFile={audioFile}
        onSilenceAlarm={handleSilenceAlarm}
      />
    </div>
  );
}
