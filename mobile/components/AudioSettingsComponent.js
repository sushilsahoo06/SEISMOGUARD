import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput } from 'react-native';
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';

export default function AudioSettingsComponent({
  audioSource,
  onAudioSourceChange,
  onPickAudioFile,
  isPreviewing,
  onTogglePreview,
  onTestCriticalAlarm,
  onResetDefault,
}) {
  const [inputVal, setInputVal] = useState(typeof audioSource === 'string' ? audioSource : 'alert.mp3');

  const handleApplyFilename = () => {
    if (!inputVal.trim()) return;
    onAudioSourceChange(inputVal.trim());
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name="music-box-multiple" size={22} color="#f59e0b" />
        <Text style={styles.cardTitle}>Public Directory Audio Config</Text>
      </View>

      <Text style={styles.cardDesc}>
        Put any audio file into your app's <Text style={styles.codeText}>public/</Text> or{' '}
        <Text style={styles.codeText}>assets/</Text> folder (e.g. <Text style={styles.codeText}>alert.mp3</Text>).
      </Text>

      {/* Active Audio Banner */}
      <View style={styles.activeBanner}>
        <MaterialCommunityIcons name="file-music" size={22} color="#38bdf8" />
        <View style={styles.activeTextContainer}>
          <Text style={styles.activeLabel}>ACTIVE AUDIO TRACK:</Text>
          <Text style={styles.activePath} numberOfLines={1}>
            {typeof audioSource === 'string' ? audioSource : 'public/alert.mp3'}
          </Text>
        </View>
        <TouchableOpacity style={styles.resetBadge} onPress={onResetDefault} title="Reset to default">
          <Ionicons name="refresh-circle" size={22} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {/* Public Filename Input Row */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={inputVal}
          onChangeText={setInputVal}
          placeholder="alert.mp3"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.btnApply} onPress={handleApplyFilename}>
          <Text style={styles.btnApplyText}>Set File</Text>
        </TouchableOpacity>
      </View>

      {/* Audio Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.btnPick} onPress={onPickAudioFile}>
          <Ionicons name="folder-open" size={16} color="#ffffff" />
          <Text style={styles.btnText}>Choose From Phone</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnPreview, isPreviewing && styles.btnPreviewActive]}
          onPress={onTogglePreview}
        >
          <Ionicons name={isPreviewing ? 'stop-circle' : 'play-circle'} size={18} color="#ffffff" />
          <Text style={styles.btnText}>{isPreviewing ? 'Stop' : 'Preview'}</Text>
        </TouchableOpacity>
      </View>

      {/* Test Critical Alarm Trigger */}
      <TouchableOpacity style={styles.btnTestAlarm} onPress={onTestCriticalAlarm}>
        <FontAwesome5 name="volume-up" size={15} color="#ef4444" />
        <Text style={styles.btnTestAlarmText}>🚨 Test Critical Earthquake Alarm</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#131d31',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  cardDesc: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  codeText: {
    color: '#38bdf8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 8,
  },
  activeTextContainer: {
    flex: 1,
  },
  activeLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activePath: {
    color: '#facc15',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  resetBadge: {
    padding: 4,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  btnApply: {
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  btnApplyText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  btnPick: {
    flex: 1.4,
    backgroundColor: '#1e40af',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  btnPreview: {
    flex: 1,
    backgroundColor: '#0284c7',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  btnPreviewActive: {
    backgroundColor: '#e11d48',
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  btnTestAlarm: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingVertical: 11,
    borderRadius: 8,
    gap: 8,
    marginTop: 2,
  },
  btnTestAlarmText: {
    color: '#ef4444',
    fontWeight: '800',
    fontSize: 13,
  },
});
