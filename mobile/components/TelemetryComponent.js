import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TelemetryComponent({ latestData }) {
  const b1Accel = latestData?.magnitude_1?.toFixed(3) || '0.000';
  const b2Accel = latestData?.magnitude_2?.toFixed(3) || '0.000';
  const sw420_1 = latestData?.sw420_1 === 1;
  const sw420_2 = latestData?.sw420_2 === 1;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name="sine-wave" size={20} color="#38bdf8" />
        <Text style={styles.cardTitle}>Dual-Building Telemetry</Text>
      </View>

      <View style={styles.grid}>
        {/* Building 1 */}
        <View style={styles.col}>
          <View style={styles.tagB1}>
            <Text style={styles.tagText}>BUILDING 1</Text>
          </View>
          <Text style={styles.typeText}>Unprotected Conventional</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Vib Switch:</Text>
            <Text style={[styles.status, sw420_1 ? styles.redText : styles.greenText]}>
              {sw420_1 ? 'TRIGGERED' : 'IDLE'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Peak Accel:</Text>
            <Text style={styles.val}>{b1Accel} g</Text>
          </View>
        </View>

        {/* Building 2 */}
        <View style={styles.col}>
          <View style={styles.tagB2}>
            <Text style={styles.tagText}>BUILDING 2</Text>
          </View>
          <Text style={styles.typeText}>Base-Isolated Damped</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Vib Switch:</Text>
            <Text style={[styles.status, sw420_2 ? styles.redText : styles.greenText]}>
              {sw420_2 ? 'TRIGGERED' : 'IDLE'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Superstructure:</Text>
            <Text style={styles.val}>{b2Accel} g</Text>
          </View>
        </View>
      </View>
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
    marginBottom: 12,
    gap: 8,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  tagB1: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  tagB2: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  tagText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  typeText: {
    color: '#64748b',
    fontSize: 10,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    color: '#94a3b8',
    fontSize: 10,
  },
  status: {
    fontSize: 10,
    fontWeight: '800',
  },
  val: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  redText: { color: '#ef4444' },
  greenText: { color: '#10b981' },
});
