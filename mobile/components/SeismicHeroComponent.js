import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function SeismicHeroComponent({ isCritical, latestData }) {
  const b1Pga = latestData?.magnitude_1?.toFixed(3) || '0.000';
  const b2Pga = latestData?.magnitude_2?.toFixed(3) || '0.000';
  const attenuation = latestData?.ml?.attenuation?.shockReductionPct?.toFixed(1) || '0.0';

  return (
    <View style={[styles.heroCard, isCritical ? styles.heroCritical : styles.heroSafe]}>
      <View style={styles.heroRow}>
        <View style={[styles.iconBox, isCritical ? styles.iconCritical : styles.iconSafe]}>
          <MaterialCommunityIcons
            name={isCritical ? 'alert-decagram' : 'shield-check'}
            size={34}
            color={isCritical ? '#ef4444' : '#10b981'}
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.statusLabel}>
            {isCritical ? 'CRITICAL SEISMIC TREMOR' : 'SYSTEM ARMED & MONITORING'}
          </Text>
          <Text style={styles.statusDesc}>
            {isCritical
              ? 'Severe structural shaking detected! Seek shelter.'
              : 'Streaming 20 Hz dual-building seismic telemetry.'}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>B1 Accel</Text>
          <Text style={[styles.metricVal, { color: '#f87171' }]}>{b1Pga} g</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>B2 Damped</Text>
          <Text style={[styles.metricVal, { color: '#34d399' }]}>{b2Pga} g</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Attenuation</Text>
          <Text style={[styles.metricVal, { color: '#38bdf8' }]}>{attenuation}%</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  heroSafe: {
    backgroundColor: '#092327',
    borderColor: '#065f46',
  },
  heroCritical: {
    backgroundColor: '#450a0a',
    borderColor: '#ef4444',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconSafe: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  iconCritical: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  textContainer: {
    flex: 1,
  },
  statusLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  statusDesc: {
    color: '#94a3b8',
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    color: '#94a3b8',
    fontSize: 10,
    marginBottom: 3,
  },
  metricVal: {
    fontSize: 16,
    fontWeight: '800',
  },
});

