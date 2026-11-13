import React from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, Animated, StatusBar } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

export default function EmergencyModalComponent({
  visible,
  alertDetails,
  audioSource,
  pulseAnim,
  flashAnim,
  onSilenceAlarm,
}) {
  if (!visible) return null;

  const pga = alertDetails?.pga_1 || 1.85;
  const damageIndex = alertDetails?.damageIndex || 0.88;
  const audioName = typeof audioSource === 'string' ? audioSource : 'public/alert.mp3';

  return (
    <Modal visible={visible} transparent={false} animationType="fade">
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: flashAnim.interpolate({
              inputRange: [0.3, 1],
              outputRange: ['#450a0a', '#991b1b'],
            }),
          },
        ]}
      >
        <StatusBar barStyle="light-content" backgroundColor="#7f1d1d" />

        <Animated.View style={[styles.sirenBox, { transform: [{ scale: pulseAnim }] }]}>
          <MaterialCommunityIcons name="alert-octagon" size={90} color="#ffffff" />
        </Animated.View>

        <Text style={styles.title}>EARTHQUAKE ALERT</Text>
        <Text style={styles.hazard}>CRITICAL SHOCK DETECTED</Text>
        <Text style={styles.subtext}>
          Severe ground acceleration registered! Take cover immediately under sturdy furniture.
        </Text>

        {/* Stats Grid */}
        <View style={styles.dataCard}>
          <View style={styles.row}>
            <Text style={styles.label}>Peak Dynamic Accel:</Text>
            <Text style={styles.val}>{typeof pga === 'number' ? pga.toFixed(3) : pga} g</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Damage Risk:</Text>
            <Text style={styles.val}>{Math.round(damageIndex * 100)}% (Severe)</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Playing Audio:</Text>
            <Text style={styles.valAudio} numberOfLines={1}>{audioName}</Text>
          </View>
        </View>

        {/* Silence Alarm Button */}
        <TouchableOpacity style={styles.silenceBtn} onPress={onSilenceAlarm} activeOpacity={0.85}>
          <Ionicons name="volume-mute" size={24} color="#991b1b" />
          <Text style={styles.silenceBtnText}>DISMISS & SILENCE ALARM</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sirenBox: {
    marginBottom: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  hazard: {
    color: '#fca5a5',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 4,
    marginBottom: 10,
  },
  subtext: {
    color: '#fecaca',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  dataCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 14,
    padding: 14,
    width: '100%',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  val: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  valAudio: {
    color: '#facc15',
    fontSize: 13,
    fontWeight: '700',
    maxWidth: '55%',
  },
  silenceBtn: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 30,
    width: '100%',
    gap: 8,
    elevation: 8,
  },
  silenceBtnText: {
    color: '#991b1b',
    fontSize: 15,
    fontWeight: '900',
  },
});
