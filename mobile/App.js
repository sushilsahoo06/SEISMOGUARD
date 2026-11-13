import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Animated,
  Vibration,
  Platform,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';

// Default Cloud backend & local fallback presets
const DEFAULT_SERVER_URL = 'https://shm-v5rg.onrender.com';
const LOCAL_SERVER_URL = 'http://192.168.1.100:5000';
const DEFAULT_ALARM_AUDIO = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'; // High-intensity emergency siren

const STORAGE_KEYS = {
  AUDIO_URI: '@shm_custom_audio_uri',
  AUDIO_NAME: '@shm_custom_audio_name',
  SERVER_URL: '@shm_server_url',
  ALERT_HISTORY: '@shm_alert_history',
};

export default function App() {
  // ── State ────────────────────────────────────────────────────────
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [tempUrl, setTempUrl] = useState(DEFAULT_SERVER_URL);
  const [isConnected, setIsConnected] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Audio configuration
  const [customAudioUri, setCustomAudioUri] = useState(null);
  const [customAudioName, setCustomAudioName] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Real-time telemetry & alerts
  const [latestData, setLatestData] = useState(null);
  const [isCriticalAlarm, setIsCriticalAlarm] = useState(false);
  const [alarmDetails, setAlarmDetails] = useState(null);
  const [alertHistory, setAlertHistory] = useState([]);

  // Refs
  const socketRef = useRef(null);
  const soundRef = useRef(null);
  const previewSoundRef = useRef(null);
  const hapticIntervalRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

  // ── 1. Initialize Audio Mode & Load Stored Preferences ───────────
  useEffect(() => {
    async function initApp() {
      try {
        // Setup Expo Audio configuration for high-priority emergency playback
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });

        // Load saved custom audio
        const savedUri = await AsyncStorage.getItem(STORAGE_KEYS.AUDIO_URI);
        const savedName = await AsyncStorage.getItem(STORAGE_KEYS.AUDIO_NAME);
        if (savedUri) {
          setCustomAudioUri(savedUri);
          setCustomAudioName(savedName || 'Custom Audio Alarm');
        }

        // Load saved server URL
        const savedServer = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);
        if (savedServer) {
          setServerUrl(savedServer);
          setTempUrl(savedServer);
        }

        // Load alert history
        const savedHistory = await AsyncStorage.getItem(STORAGE_KEYS.ALERT_HISTORY);
        if (savedHistory) {
          setAlertHistory(JSON.parse(savedHistory));
        }
      } catch (err) {
        console.warn('Initialization error:', err);
      }
    }
    initApp();

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
      console.log('Connected to SHM WebSocket Server:', serverUrl);
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from SHM WebSocket Server');
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket connect error:', err.message);
      setIsConnected(false);
    });

    // Real-time sensor stream
    socket.on('newSensorData', (data) => {
      setLatestData(data);
      // Auto-trigger if ML or civil engineering flags CRITICAL
      if (data.ml && data.ml.hazardLevel === 'CRITICAL') {
        triggerCriticalEarthquakeAlarm({
          eventType: data.ml.eventType || 'SEISMIC_TREMOR',
          hazardLevel: 'CRITICAL',
          damageIndex: data.ml.damageIndex || 0.85,
          pga_1: data.ml.building1?.pga || (data.magnitude_1 ? data.magnitude_1 : 1.8),
          attenuation: data.ml.attenuation?.shockReductionPct || 0,
          timestamp: data.timestamp || new Date().toISOString(),
          message: 'CRITICAL: Severe seismic tremor detected! High collapse hazard.',
        });
      }
    });

    // Dedicated ML Seismic Alert event
    socket.on('mlAlert', (alert) => {
      console.log('Received ML Alert:', alert);
      if (alert.hazardLevel === 'CRITICAL' || alert.eventType === 'SEISMIC_TREMOR') {
        triggerCriticalEarthquakeAlarm(alert);
      }
    });

    // Occupants Emergency Broadcast
    socket.on('occupantsAlert', (alert) => {
      triggerCriticalEarthquakeAlarm({
        eventType: 'EMERGENCY_DISPATCH',
        hazardLevel: 'CRITICAL',
        damageIndex: 0.9,
        pga_1: 2.0,
        attenuation: 0,
        timestamp: new Date().toISOString(),
        message: alert.message || 'EMERGENCY BROADCAST: Structural integrity compromised!',
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [serverUrl]);

  // ── 3. Alarm Animations (Pulsing Red Screen) ─────────────────────
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

  // ── 4. Trigger Critical Earthquake Alarm ─────────────────────────
  const triggerCriticalEarthquakeAlarm = async (alertInfo) => {
    setIsCriticalAlarm(true);
    setAlarmDetails(alertInfo);

    // Save to incident history
    setAlertHistory((prev) => {
      const updated = [alertInfo, ...prev.slice(0, 9)];
      AsyncStorage.setItem(STORAGE_KEYS.ALERT_HISTORY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });

    // Start aggressive haptic vibration
    startHapticAlarm();

    // Play User's Custom Audio or Default Emergency Siren
    await playAlarmAudio();
  };

  // ── 5. Play / Stop Alert Audio ───────────────────────────────────
  const playAlarmAudio = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
      }

      const audioUri = customAudioUri || DEFAULT_ALARM_AUDIO;
      console.log('Playing Emergency Audio:', audioUri);

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      soundRef.current = sound;
      await sound.playAsync();
    } catch (err) {
      console.error('Failed to play alarm audio:', err);
      // Fallback: system vibration pattern
      Vibration.vibrate([500, 250, 500, 250], true);
    }
  };

  const stopAlarmAudio = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    } catch (e) {}

    // Stop haptics & vibration
    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = null;
    }
    Vibration.cancel();
  };

  const silenceAlarm = () => {
    stopAlarmAudio();
    setIsCriticalAlarm(false);
  };

  // Continuous haptic pulse
  const startHapticAlarm = () => {
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

  // ── 6. Custom Audio Picker ───────────────────────────────────────
  const pickCustomAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setCustomAudioUri(file.uri);
        setCustomAudioName(file.name);

        await AsyncStorage.setItem(STORAGE_KEYS.AUDIO_URI, file.uri);
        await AsyncStorage.setItem(STORAGE_KEYS.AUDIO_NAME, file.name);

        Alert.alert(
          '✅ Custom Alert Sound Set!',
          `"${file.name}" will now play whenever a critical earthquake is detected. Tap "Preview Audio" to test it.`
        );
      }
    } catch (err) {
      Alert.alert('Selection Error', 'Could not load the selected audio file. Please choose an MP3, WAV, or M4A file.');
    }
  };

  // ── 7. Preview Audio Toggle ──────────────────────────────────────
  const toggleAudioPreview = async () => {
    if (isPreviewing) {
      stopPreviewAudio();
      return;
    }

    try {
      stopPreviewAudio();
      const targetUri = customAudioUri || DEFAULT_ALARM_AUDIO;

      const { sound } = await Audio.Sound.createAsync(
        { uri: targetUri },
        { shouldPlay: true, isLooping: false, volume: 1.0 }
      );
      previewSoundRef.current = sound;
      setIsPreviewing(true);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsPreviewing(false);
        }
      });

      await sound.playAsync();
    } catch (err) {
      setIsPreviewing(false);
      Alert.alert('Playback Error', 'Could not preview this audio file. Please verify format.');
    }
  };

  const stopPreviewAudio = async () => {
    try {
      if (previewSoundRef.current) {
        await previewSoundRef.current.stopAsync().catch(() => {});
        await previewSoundRef.current.unloadAsync().catch(() => {});
        previewSoundRef.current = null;
      }
    } catch (e) {}
    setIsPreviewing(false);
  };

  // ── 8. Reset to Default Siren ────────────────────────────────────
  const resetToDefaultAudio = async () => {
    stopPreviewAudio();
    setCustomAudioUri(null);
    setCustomAudioName(null);
    await AsyncStorage.removeItem(STORAGE_KEYS.AUDIO_URI);
    await AsyncStorage.removeItem(STORAGE_KEYS.AUDIO_NAME);
    Alert.alert('Reset Complete', 'Alert sound restored to Default Emergency Siren.');
  };

  // ── 9. Save Server URL ───────────────────────────────────────────
  const saveServerUrl = async (urlToSave) => {
    const trimmed = (urlToSave || tempUrl).trim().replace(/\/+$/, '');
    setServerUrl(trimmed);
    await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, trimmed);
    setShowConfigModal(false);
  };

  // ── 10. Manual Test Trigger ──────────────────────────────────────
  const testCriticalAlert = () => {
    triggerCriticalEarthquakeAlarm({
      eventType: 'SIMULATED_EARTHQUAKE',
      hazardLevel: 'CRITICAL',
      damageIndex: 0.92,
      pga_1: 1.84,
      attenuation: 48.5,
      timestamp: new Date().toISOString(),
      message: 'TEST SIMULATION: Critical earthquake alarm triggered manually for sound & vibration check.',
    });
  };

  // ── Derived Display Values ───────────────────────────────────────
  const b1Pga = latestData?.magnitude_1?.toFixed(3) || '0.000';
  const b2Pga = latestData?.magnitude_2?.toFixed(3) || '0.000';
  const attenuation = latestData?.ml?.attenuation?.shockReductionPct?.toFixed(1) || '0.0';
  const sw420_1_active = latestData?.sw420_1 === 1;
  const sw420_2_active = latestData?.sw420_2 === 1;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0f19" />

      {/* ═══════════ HEADER ═══════════ */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <MaterialCommunityIcons name="shield-alert-outline" size={28} color="#ef4444" style={styles.headerIcon} />
          <View>
            <Text style={styles.headerTitle}>SHM Seismic Alert</Text>
            <Text style={styles.headerSubtitle}>Real-Time Earthquake Emergency Monitor</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.statusPill, isConnected ? styles.pillConnected : styles.pillDisconnected]}
            onPress={() => setShowConfigModal(true)}
          >
            <View style={[styles.statusDot, isConnected ? styles.dotConnected : styles.dotDisconnected]} />
            <Text style={styles.statusPillText}>{isConnected ? 'LIVE' : 'OFFLINE'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gearButton} onPress={() => setShowConfigModal(true)}>
            <Ionicons name="settings-sharp" size={20} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ═══════════ SYSTEM ARMED HERO CARD ═══════════ */}
        <View style={[styles.heroCard, isCriticalAlarm ? styles.heroCardCritical : styles.heroCardSafe]}>
          <View style={styles.heroRow}>
            <View style={[styles.heroIconBox, isCriticalAlarm ? styles.heroIconBoxCritical : styles.heroIconBoxSafe]}>
              <MaterialCommunityIcons
                name={isCriticalAlarm ? 'alert-decagram' : 'shield-check'}
                size={34}
                color={isCriticalAlarm ? '#ef4444' : '#10b981'}
              />
            </View>
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroStatusLabel}>
                {isCriticalAlarm ? 'CRITICAL SEISMIC TREMOR DETECTED' : 'SYSTEM ARMED & MONITORING'}
              </Text>
              <Text style={styles.heroStatusDesc}>
                {isCriticalAlarm
                  ? 'High collapse hazard! Seek shelter immediately.'
                  : 'Analyzing 20 Hz dual-building telemetry & ML features.'}
              </Text>
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroMetricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>B1 Unprotected</Text>
              <Text style={[styles.metricValue, { color: '#f87171' }]}>{b1Pga} g</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>B2 Damped</Text>
              <Text style={[styles.metricValue, { color: '#34d399' }]}>{b2Pga} g</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Attenuation</Text>
              <Text style={[styles.metricValue, { color: '#38bdf8' }]}>{attenuation}%</Text>
            </View>
          </View>
        </View>

        {/* ═══════════ CUSTOM AUDIO ALERT CARD (FEATURE) ═══════════ */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="music-box-multiple" size={22} color="#f59e0b" />
            <Text style={styles.cardTitle}>Emergency Audio Alert</Text>
          </View>
          <Text style={styles.cardDescription}>
            Choose your own custom MP3/WAV audio from your phone to play as the loud emergency alarm sound when a
            critical earthquake strikes.
          </Text>

          {/* Active Audio Banner */}
          <View style={styles.activeAudioBox}>
            <MaterialCommunityIcons
              name={customAudioUri ? 'file-music' : 'alarm-light'}
              size={24}
              color={customAudioUri ? '#38bdf8' : '#f59e0b'}
            />
            <View style={styles.activeAudioTextContainer}>
              <Text style={styles.activeAudioLabel}>CURRENT ALERT SOUND:</Text>
              <Text style={styles.activeAudioName} numberOfLines={1}>
                {customAudioName || 'Default Emergency Siren (Built-in)'}
              </Text>
            </View>
            {customAudioUri && (
              <TouchableOpacity onPress={resetToDefaultAudio} style={styles.resetBadge}>
                <Ionicons name="close-circle" size={18} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>

          {/* Audio Action Buttons */}
          <View style={styles.audioButtonsRow}>
            <TouchableOpacity style={styles.pickButton} onPress={pickCustomAudio}>
              <Ionicons name="folder-open" size={18} color="#fff" />
              <Text style={styles.pickButtonText}>Pick Custom Sound</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.previewButton, isPreviewing && styles.previewButtonActive]}
              onPress={toggleAudioPreview}
            >
              <Ionicons name={isPreviewing ? 'stop-circle' : 'play-circle'} size={18} color="#fff" />
              <Text style={styles.previewButtonText}>{isPreviewing ? 'Stop' : 'Preview'}</Text>
            </TouchableOpacity>
          </View>

          {/* Manual Test Alarm Button */}
          <TouchableOpacity style={styles.testAlarmButton} onPress={testCriticalAlert}>
            <FontAwesome5 name="volume-up" size={16} color="#ef4444" />
            <Text style={styles.testAlarmText}>Test Critical Alarm (Simulate)</Text>
          </TouchableOpacity>
        </View>

        {/* ═══════════ LIVE TELEMETRY STATUS ═══════════ */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="sine-wave" size={22} color="#38bdf8" />
            <Text style={styles.cardTitle}>Dual-Building Telemetry</Text>
          </View>

          <View style={styles.buildingGrid}>
            {/* Building 1 */}
            <View style={styles.buildingCol}>
              <View style={styles.buildingBadgeB1}>
                <Text style={styles.buildingBadgeText}>BUILDING 1</Text>
              </View>
              <Text style={styles.buildingType}>Unprotected Conventional</Text>
              <View style={styles.sensorRow}>
                <Text style={styles.sensorLabel}>Vib Switch:</Text>
                <Text style={[styles.sensorStatus, sw420_1_active ? styles.textRed : styles.textGreen]}>
                  {sw420_1_active ? 'TRIGGERED' : 'IDLE'}
                </Text>
              </View>
              <View style={styles.sensorRow}>
                <Text style={styles.sensorLabel}>Peak Accel:</Text>
                <Text style={styles.sensorValue}>{b1Pga} g</Text>
              </View>
            </View>

            {/* Building 2 */}
            <View style={styles.buildingCol}>
              <View style={styles.buildingBadgeB2}>
                <Text style={styles.buildingBadgeText}>BUILDING 2</Text>
              </View>
              <Text style={styles.buildingType}>Base-Isolated Damped</Text>
              <View style={styles.sensorRow}>
                <Text style={styles.sensorLabel}>Vib Switch:</Text>
                <Text style={[styles.sensorStatus, sw420_2_active ? styles.textRed : styles.textGreen]}>
                  {sw420_2_active ? 'TRIGGERED' : 'IDLE'}
                </Text>
              </View>
              <View style={styles.sensorRow}>
                <Text style={styles.sensorLabel}>Superstructure:</Text>
                <Text style={styles.sensorValue}>{b2Pga} g</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ═══════════ RECENT ALERTS LOG ═══════════ */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="history" size={22} color="#a855f7" />
            <Text style={styles.cardTitle}>Recent Incident Log</Text>
          </View>

          {alertHistory.length === 0 ? (
            <Text style={styles.emptyText}>No seismic emergency incidents recorded.</Text>
          ) : (
            alertHistory.slice(0, 4).map((item, index) => (
              <View key={index} style={styles.historyItem}>
                <View style={styles.historyLeft}>
                  <View style={styles.historyBadge}>
                    <Text style={styles.historyBadgeText}>{item.hazardLevel || 'ALERT'}</Text>
                  </View>
                  <View>
                    <Text style={styles.historyTitle}>{item.eventType || 'SEISMIC_TREMOR'}</Text>
                    <Text style={styles.historyTime}>
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </Text>
                  </View>
                </View>
                <Text style={styles.historyPga}>{item.pga_1 ? `${item.pga_1.toFixed(2)} g` : 'Critical'}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>SHM Civil Structural Health • Auto-Alert Engine v2.4</Text>
        </View>
      </ScrollView>

      {/* ═══════════ FULL-SCREEN CRITICAL ALARM MODAL ═══════════ */}
      <Modal visible={isCriticalAlarm} transparent={false} animationType="fade">
        <Animated.View
          style={[
            styles.criticalModalContainer,
            {
              backgroundColor: flashAnim.interpolate({
                inputRange: [0.3, 1],
                outputRange: ['#450a0a', '#991b1b'],
              }),
            },
          ]}
        >
          <StatusBar barStyle="light-content" backgroundColor="#7f1d1d" />

          <Animated.View style={[styles.sirenContainer, { transform: [{ scale: pulseAnim }] }]}>
            <MaterialCommunityIcons name="alert-octagon" size={96} color="#ffffff" />
          </Animated.View>

          <Text style={styles.criticalTitle}>EARTHQUAKE ALERT</Text>
          <Text style={styles.criticalHazard}>CRITICAL SHOCK DETECTED</Text>
          <Text style={styles.criticalSubtext}>
            Severe structural ground motion registered! Drop, cover, and hold on immediately.
          </Text>

          {/* Incident Data Box */}
          <View style={styles.criticalDataCard}>
            <View style={styles.criticalDataRow}>
              <Text style={styles.criticalDataLabel}>Peak Dynamic Accel:</Text>
              <Text style={styles.criticalDataValue}>{alarmDetails?.pga_1 || b1Pga} g</Text>
            </View>
            <View style={styles.criticalDataRow}>
              <Text style={styles.criticalDataLabel}>Damage Index:</Text>
              <Text style={styles.criticalDataValue}>
                {Math.round((alarmDetails?.damageIndex || 0.88) * 100)}% (Severe)
              </Text>
            </View>
            <View style={styles.criticalDataRow}>
              <Text style={styles.criticalDataLabel}>Playing Audio:</Text>
              <Text style={styles.criticalDataAudio} numberOfLines={1}>
                {customAudioName || 'Emergency Siren'}
              </Text>
            </View>
          </View>

          {/* Dismiss Alarm Button */}
          <TouchableOpacity style={styles.silenceButton} onPress={silenceAlarm} activeOpacity={0.85}>
            <Ionicons name="volume-mute" size={26} color="#991b1b" />
            <Text style={styles.silenceButtonText}>DISMISS & SILENCE ALARM</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>

      {/* ═══════════ SERVER CONFIGURATION MODAL ═══════════ */}
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
              Enter your SHM backend server IP or Render cloud URL (port 5000) for real-time WebSocket telemetry.
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

            <TouchableOpacity style={styles.modalSaveButton} onPress={() => saveServerUrl(tempUrl)}>
              <Text style={styles.modalSaveText}>Connect & Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Stylesheet ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'android' ? 24 : 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 10,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  headerSubtitle: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginRight: 8,
  },
  pillConnected: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  pillDisconnected: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  dotConnected: {
    backgroundColor: '#10b981',
  },
  dotDisconnected: {
    backgroundColor: '#ef4444',
  },
  statusPillText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
  },
  gearButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },

  // Hero Card
  heroCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
  },
  heroCardSafe: {
    backgroundColor: '#092327',
    borderColor: '#065f46',
  },
  heroCardCritical: {
    backgroundColor: '#450a0a',
    borderColor: '#ef4444',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  heroIconBoxSafe: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  heroIconBoxCritical: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  heroTextContainer: {
    flex: 1,
  },
  heroStatusLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
  },
  heroStatusDesc: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 14,
  },
  heroMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '800',
  },

  // Base Card
  card: {
    backgroundColor: '#131d31',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  cardDescription: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },

  // Custom Audio Section
  activeAudioBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeAudioTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  activeAudioLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeAudioName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  resetBadge: {
    padding: 4,
  },
  audioButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  pickButton: {
    flex: 1.6,
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  pickButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  previewButton: {
    flex: 1,
    backgroundColor: '#0ea5e9',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  previewButtonActive: {
    backgroundColor: '#e11d48',
  },
  previewButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  testAlarmButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingVertical: 11,
    borderRadius: 10,
    gap: 8,
    marginTop: 4,
  },
  testAlarmText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 13,
  },

  // Dual Building Grid
  buildingGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  buildingCol: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  buildingBadgeB1: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  buildingBadgeB2: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  buildingBadgeText: {
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: '800',
  },
  buildingType: {
    color: '#94a3b8',
    fontSize: 10,
    marginBottom: 10,
  },
  sensorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sensorLabel: {
    color: '#64748b',
    fontSize: 11,
  },
  sensorStatus: {
    fontSize: 11,
    fontWeight: '700',
  },
  sensorValue: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
  },
  textRed: {
    color: '#ef4444',
  },
  textGreen: {
    color: '#10b981',
  },

  // Incident History
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  historyBadgeText: {
    color: '#ef4444',
    fontSize: 9,
    fontWeight: '800',
  },
  historyTitle: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  historyTime: {
    color: '#64748b',
    fontSize: 10,
  },
  historyPga: {
    color: '#f87171',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 10,
  },
  footer: {
    marginTop: 10,
    alignItems: 'center',
  },
  footerText: {
    color: '#475569',
    fontSize: 11,
  },

  // Critical Alert Fullscreen Modal
  criticalModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sirenContainer: {
    marginBottom: 20,
  },
  criticalTitle: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  criticalHazard: {
    color: '#fca5a5',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 4,
    marginBottom: 12,
  },
  criticalSubtext: {
    color: '#fecaca',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  criticalDataCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  criticalDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  criticalDataLabel: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  criticalDataValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  criticalDataAudio: {
    color: '#facc15',
    fontSize: 13,
    fontWeight: '700',
    maxWidth: '55%',
  },
  silenceButton: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 30,
    width: '100%',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  silenceButtonText: {
    color: '#991b1b',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Config Sheet Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'android' ? 30 : 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  modalDesc: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
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
  modalSaveButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
