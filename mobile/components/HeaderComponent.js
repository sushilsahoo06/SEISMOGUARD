import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

export default function HeaderComponent({ isConnected, onOpenSettings }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <MaterialCommunityIcons name="shield-alert-outline" size={28} color="#ef4444" style={styles.icon} />
        <View>
          <Text style={styles.title}>SHM Earthquake Alert</Text>
          <Text style={styles.subtitle}>Mobile Emergency Sound Monitor</Text>
        </View>
      </View>

      <View style={styles.headerRight}>
        <View style={[styles.pill, isConnected ? styles.pillOnline : styles.pillOffline]}>
          <View style={[styles.dot, isConnected ? styles.dotOnline : styles.dotOffline]} />
          <Text style={styles.pillText}>{isConnected ? 'LIVE' : 'OFFLINE'}</Text>
        </View>

        <TouchableOpacity style={styles.gearButton} onPress={onOpenSettings}>
          <Ionicons name="settings-sharp" size={18} color="#94a3b8" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 24 : 12,
    paddingBottom: 14,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 10,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  pillOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  pillOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  dotOnline: {
    backgroundColor: '#10b981',
  },
  dotOffline: {
    backgroundColor: '#ef4444',
  },
  pillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  gearButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
});
