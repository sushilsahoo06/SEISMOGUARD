import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Modal,
  TextInput,
  TouchableOpacity,
  Text,
  Animated,
  Vibration,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';

// Distinct Modular Components
import HeaderComponent from './components/HeaderComponent';
import SeismicHeroComponent from './components/SeismicHeroComponent';
import AudioSettingsComponent from './components/AudioSettingsComponent';
import TelemetryComponent from './components/TelemetryComponent';
import IncidentHistoryComponent from './components/IncidentHistoryComponent';
import EmergencyModalComponent from './components/EmergencyModalComponent';

// Local static asset fallback & online emergency siren
const LOCAL_ASSET_AUDIO = require('./assets/alert.mp3');
const DEFAULT_ALARM_AUDIO = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
const DEFAULT_SERVER_URL = 'https://shm-v5rg.onrender.com';

const STORAGE_KEYS = {
  AUDIO_PATH: '@shm_mobile_audio_path',
  AUDIO_NAME: '@shm_mobile_audio_name',
  SERVER_URL: '@shm_mobile_server_url',
  HISTORY: '@shm_mobile_history',
};

export default function App() {
  // ── State ────────────────────────────────────────────────────────
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [tempUrl, setTempUrl] = useState(DEFAULT_SERVER_URL);
  const [isConnected, setIsConnected] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Audio configuration (public dir / assets / local uri)
  const [audioSource, setAudioSource] = useState('public/alert.mp3');
  const [customAudioUri, setCustomAudioUri] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Real-time telemetry & alerts
  const [latestData, setLatestData] = useState(null);
  const [isCriticalAlarm, setIsCriticalAlarm] = useState(false);
  const [alarmDetails, setAlarmDetails] = useState(null);
  const [alertHistory, setAlertHistory] = useState([]);

  // Refs
  const socketRef = useRef(null);
  const playerRef = useRef(null);
  const previewPlayerRef = useRef(null);
  const hapticIntervalRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

  // ── 1. Init Audio Mode & Load Stored State ─────────────────────────
  useEffect(() => {
    async function init() {
      try {
        if (setAudioModeAsync) {
          await setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: true,
          }).catch(() => {});
        }

        const savedPath = await AsyncStorage.getItem(STORAGE_KEYS.AUDIO_PATH);
        if (savedPath) {
          setAudioSource(savedPath);
        }

        const savedServer = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);
        if (savedServer) {
          setServerUrl(savedServer);
          setTempUrl(savedServer);
        }

        const savedHistory = await AsyncStorage.getItem(STORAGE_KEYS.HISTORY);
        if (savedHistory) {
          setAlertHistory(JSON.parse(savedHistory));
        }
      } catch (e) {
        console.warn('Init notice:', e);
      }
    }
    init();

    return () => {
      stopAlarmAudio();
      stopPreviewAudio();
    };
  }, []);

  // ── 2. Socket.io Real-Time Connection ────────────────────────────
  useEffect(() => {
    if (!serverUrl) return;

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 8000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Mobile App connected to SHM Server:', serverUrl);
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Mobile App disconnected from SHM Server');
      setIsConnected(false);
    });

    socket.on('newSensorData', (data) => {
      setLatestData(data);
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

    socket.on('mlAlert', (alert) => {
      if (alert.hazardLevel === 'CRITICAL' || alert.eventType === 'SEISMIC_TREMOR') {
        triggerEarthquakeAlarm(alert);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [serverUrl]);

  // ── 3. Emergency Flash & Pulse Animations ────────────────────────
  useEffect(() => {
    let pulseLoop = null;
    let flashLoop = null;

    if (isCriticalAlarm) {
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 400, useNativeDriver: true }),
        ])
      );
      flashLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
          Animated.timing(flashAnim, { toValue: 0.3, duration: 300, useNativeDriver: false }),
        ])
      );
      pulseLoop.start();
      flashLoop.start();
    } else {
      pulseAnim.setValue(1);
      flashAnim.setValue(0);
    }

    return () => {
      if (pulseLoop) pulseLoop.stop();
      if (flashLoop) flashLoop.stop();
    };
  }, [isCriticalAlarm]);

  // ── 4. Trigger Earthquake Alarm ──────────────────────────────────
  const triggerEarthquakeAlarm = (info) => {
    setIsCriticalAlarm(true);
    setAlarmDetails(info);

    setAlertHistory((prev) => {
      const updated = [info, ...prev.slice(0, 9)];
      AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });

    startHapticPulse();
    playAlarmAudio();
  };

  // ── 5. Play Audio with expo-audio ─────────────────────────────────
  const getResolvedAudioSource = () => {
    if (customAudioUri) {
      return { uri: customAudioUri };
    }
    // If user specifies a public file, try local asset first, then remote
    if (typeof audioSource === 'string' && audioSource.includes('alert.mp3')) {
      return LOCAL_ASSET_AUDIO;
    }
    return DEFAULT_ALARM_AUDIO;
  };

  const playAlarmAudio = () => {
    try {
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current.release();
        playerRef.current = null;
      }

      const source = getResolvedAudioSource();
      const player = createAudioPlayer(source);
      player.loop = true;
      player.volume = 1.0;
      player.play();
      playerRef.current = player;
    } catch (err) {
      console.warn('Audio play notice, falling back to vibration:', err);
      Vibration.vibrate([500, 250, 500, 250], true);
    }
  };

  const stopAlarmAudio = () => {
    try {
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current.seekTo(0);
        playerRef.current.release();
        playerRef.current = null;
      }
    } catch (e) {}

    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = null;
    }
    Vibration.cancel();
  };

  const handleSilenceAlarm = () => {
    stopAlarmAudio();
    setIsCriticalAlarm(false);
  };

  const startHapticPulse = () => {
    if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current);
    hapticIntervalRef.current = setInterval(() => {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch (e) {
        Vibration.vibrate(400);
      }
    }, 600);
  };

  // ── 6. Preview Audio ─────────────────────────────────────────────
  const handleTogglePreview = () => {
    if (isPreviewing) {
      stopPreviewAudio();
      return;
    }

    try {
      stopPreviewAudio();
      const source = getResolvedAudioSource();
      const player = createAudioPlayer(source);
      player.loop = false;
      player.volume = 1.0;
      player.play();
      previewPlayerRef.current = player;
      setIsPreviewing(true);

      if (player.addListener) {
        player.addListener('playbackStatusUpdate', (status) => {
          if (status && status.didJustFinish) {
            setIsPreviewing(false);
          }
        });
      }
    } catch (err) {
      setIsPreviewing(false);
      Alert.alert('Audio Notice', 'Could not preview file. Playing system vibration instead.');
      Vibration.vibrate(300);
    }
  };

  const stopPreviewAudio = () => {
    try {
      if (previewPlayerRef.current) {
        previewPlayerRef.current.pause();
        previewPlayerRef.current.seekTo(0);
        previewPlayerRef.current.release();
        previewPlayerRef.current = null;
      }
    } catch (e) {}
    setIsPreviewing(false);
  };

  // ── 7. Pick Custom Audio File from Phone ──────────────────────────
  const handlePickAudioFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        setCustomAudioUri(file.uri);
        setAudioSource(`public/${file.name}`);
        await AsyncStorage.setItem(STORAGE_KEYS.AUDIO_PATH, `public/${file.name}`);
        Alert.alert('✅ Audio File Set', `Selected "${file.name}". Tap Preview to test.`);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open file picker.');
    }
  };

  const handleResetDefault = async () => {
    stopPreviewAudio();
    setCustomAudioUri(null);
    setAudioSource('public/alert.mp3');
    await AsyncStorage.removeItem(STORAGE_KEYS.AUDIO_PATH);
    Alert.alert('Reset', 'Restored to default public/alert.mp3');
  };

  const handleAudioSourceChange = async (filename) => {
    const formatted = filename.startsWith('public/') ? filename : `public/${filename}`;
    setAudioSource(formatted);
    setCustomAudioUri(null);
    await AsyncStorage.setItem(STORAGE_KEYS.AUDIO_PATH, formatted);
    Alert.alert('Saved', `Audio track set to ${formatted}`);
  };

  // ── 8. Manual Simulation ─────────────────────────────────────────
  const handleTestCriticalAlarm = () => {
    triggerEarthquakeAlarm({
      eventType: 'SIMULATED_EARTHQUAKE',
      hazardLevel: 'CRITICAL',
      damageIndex: 0.94,
      pga_1: 1.95,
      timestamp: new Date().toISOString(),
    });
  };

  const handleClearHistory = () => {
    setAlertHistory([]);
    AsyncStorage.removeItem(STORAGE_KEYS.HISTORY);
  };

  const handleSaveServerUrl = async (url) => {
    const clean = url.trim().replace(/\/+$/, '');
    setServerUrl(clean);
    await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, clean);
    setShowConfigModal(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0f19" />

      {/* 1. Header Component */}
      <HeaderComponent
        isConnected={isConnected}
        onOpenSettings={() => setShowConfigModal(true)}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 2. Seismic Hero Card */}
        <SeismicHeroComponent
          isCritical={isCriticalAlarm}
          latestData={latestData}
        />

        {/* 3. Audio Settings Card (Public Directory Control) */}
        <AudioSettingsComponent
          audioSource={audioSource}
          onAudioSourceChange={handleAudioSourceChange}
          onPickAudioFile={handlePickAudioFile}
          isPreviewing={isPreviewing}
          onTogglePreview={handleTogglePreview}
          onTestCriticalAlarm={handleTestCriticalAlarm}
          onResetDefault={handleResetDefault}
        />

        {/* 4. Telemetry Card */}
        <TelemetryComponent latestData={latestData} />

        {/* 5. Incident History Card */}
        <IncidentHistoryComponent
          history={alertHistory}
          onClearHistory={handleClearHistory}
        />
      </ScrollView>

      {/* 6. Emergency Fullscreen Takeover Modal */}
      <EmergencyModalComponent
        visible={isCriticalAlarm}
        alertDetails={alarmDetails}
        audioSource={audioSource}
        pulseAnim={pulseAnim}
        flashAnim={flashAnim}
        onSilenceAlarm={handleSilenceAlarm}
      />

      {/* Server Config Modal */}
      <Modal visible={showConfigModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Backend Connection</Text>
              <TouchableOpacity onPress={() => setShowConfigModal(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Enter your SHM backend server IP or Render URL (port 5000) for real-time WebSocket telemetry.
            </Text>

            <TextInput
              style={styles.modalInput}
              value={tempUrl}
              onChangeText={setTempUrl}
              placeholder="e.g. http://192.168.1.100:5000"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.presetRow}>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => setTempUrl('https://shm-v5rg.onrender.com')}
              >
                <Text style={styles.presetText}>Render Cloud</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => setTempUrl('http://192.168.1.100:5000')}
              >
                <Text style={styles.presetText}>Local Wi-Fi</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.btnSaveServer}
              onPress={() => handleSaveServerUrl(tempUrl)}
            >
              <Text style={styles.btnSaveServerText}>Connect & Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
  },
  scroll: {
    padding: 16,
    paddingBottom: 30,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  modalDesc: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
    fontSize: 14,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  presetButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  presetText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  btnSaveServer: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnSaveServerText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
