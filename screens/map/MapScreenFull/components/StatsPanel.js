import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const StatsPanel = ({
  bottomOffset,
  onLayout,
  vehicleName,
  timeText,
  totalDistance,
  maxSpeed,
}) => {
  return (
    <View
      style={[styles.container, { bottom: bottomOffset }]}
      onLayout={onLayout}
    >
      <View style={styles.vehicleRow}>
        <Text style={styles.vehicleText}>{vehicleName || 'Pas de véhicule'}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValueSmall}>{timeText}</Text>
          <Text style={styles.statLabel}>Temps</Text>
        </View>
        <View style={styles.statItemCenter}>
          <Text style={styles.statValueBig}>
            {(totalDistance || 0).toFixed(2)}
          </Text>
          <Text style={styles.statLabelCenter}>Distance (km)</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValueSmall}>{(maxSpeed || 0).toFixed(0)}</Text>
          <Text style={styles.statLabel}>Max</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  vehicleRow: {
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  vehicleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E3A8A',
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statItemCenter: {
    alignItems: 'center',
    flex: 1.2,
  },
  statLabel: {
    color: 'rgba(0, 0, 0, 0.5)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  statLabelCenter: {
    color: 'rgba(0, 0, 0, 0.5)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  statValueSmall: {
    color: '#000000',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  statValueBig: {
    color: '#000000',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
});

export default StatsPanel;



