import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function IncidentHistoryComponent({ history, onClearHistory }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="history" size={20} color="#a855f7" />
          <Text style={styles.cardTitle}>Recent Incident Log</Text>
        </View>
        {history.length > 0 && (
          <TouchableOpacity onPress={onClearHistory} style={styles.clearBtn}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {history.length === 0 ? (
        <Text style={styles.emptyText}>No emergency incidents recorded. System standing by.</Text>
      ) : (
        history.slice(0, 4).map((item, idx) => {
          const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const pga = item.pga_1 ? `${Number(item.pga_1).toFixed(2)} g` : 'Critical';

          return (
            <View key={idx} style={styles.item}>
              <View style={styles.left}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>CRITICAL</Text>
                </View>
                <View>
                  <Text style={styles.type}>{item.eventType || 'SEISMIC_TREMOR'}</Text>
                  <Text style={styles.time}>{time}</Text>
                </View>
              </View>
              <Text style={styles.pga}>{pga}</Text>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#131d31',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  clearBtn: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#1e293b',
  },
  clearText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 12,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
  badgeText: {
    color: '#ef4444',
    fontSize: 9,
    fontWeight: '800',
  },
  type: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  time: {
    color: '#64748b',
    fontSize: 10,
  },
  pga: {
    color: '#f87171',
    fontWeight: '700',
    fontSize: 12,
  },
});
