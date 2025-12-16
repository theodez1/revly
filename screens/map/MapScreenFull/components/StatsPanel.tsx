import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

const formatDistanceKm = (meters?: number) => {
  const km = Math.max(0, meters || 0) / 1000;
  if (km >= 100) return km.toFixed(0);
  if (km >= 10) return km.toFixed(1);
  return km.toFixed(2);
};

const formatSpeedValue = (speed?: number) => {
  const safe = Math.max(0, Number.isFinite(speed) ? speed || 0 : 0);
  return safe >= 100 ? Math.round(safe).toString() : safe.toFixed(1);
};

const formatDuration = (seconds?: number) => {
  const totalSeconds = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}H`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  
  return parts.join('');
};

const StatsPanel = ({
  bottomOffset,
  onLayout,
  vehicleName,
  timeText,
  elapsedTime,
  totalDistance,
  maxSpeed,
}) => {
  const Container = Platform.OS === 'ios' ? BlurView : View;
  const containerProps = Platform.OS === 'ios' ? { intensity: 90, tint: 'light' as const } : {};

  const distanceValue = formatDistanceKm(totalDistance);
  const maxSpeedValue = formatSpeedValue(maxSpeed);
  const durationText = elapsedTime !== undefined ? formatDuration(elapsedTime) : timeText || '0s';

  return (
    <View 
      style={[styles.wrapper, { bottom: bottomOffset }]} 
      onLayout={onLayout}
      pointerEvents="box-none"
    >
      <Container
        style={styles.container}
        {...containerProps}
      >
        <View style={styles.contentRow}>
          {/* Main Distance Block (Hero) */}
          <View style={styles.mainBlock}>
            <View style={styles.valueRow}>
              <Text style={styles.mainValue}>{distanceValue}</Text>
              <Text style={styles.mainUnit}>KM</Text>
            </View>
            <Text style={styles.vehicleLabel} numberOfLines={1}>
              {vehicleName || 'Non défini'}
            </Text>
          </View>

          {/* Divider */}
          <View style={styles.verticalDivider} />

          {/* Secondary Stats Column */}
          <View style={styles.secondaryStats}>
            {/* Time */}
            <View style={styles.statRow}>
              <Text 
                style={styles.statValue}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.7}
              >
                {durationText}
              </Text>
              <Text style={styles.statLabel}>DURÉE</Text>
            </View>
            
            <View style={styles.horizontalDivider} />
            
            {/* Max Speed */}
            <View style={styles.statRow}>
              <Text 
                style={styles.statValue}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.7}
              >
                {maxSpeedValue}
              </Text>
              <Text style={styles.statLabel}>MAX</Text>
            </View>
          </View>
        </View>
      </Container>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  container: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.85)' : '#FFFFFF',
    borderRadius: 32,
    paddingVertical: 24,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    overflow: 'hidden',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mainBlock: {
    flex: 1.4,
    justifyContent: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  mainValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    lineHeight: 52,
  },
  mainUnit: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2563EB', // Electric Blue for emphasis
    marginBottom: 8,
  },
  vehicleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  verticalDivider: {
    width: 1,
    height: 64,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginHorizontal: 24,
  },
  secondaryStats: {
    flex: 1,
    flexShrink: 1,
    justifyContent: 'space-between',
    gap: 12,
    minWidth: 0,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    flexShrink: 1,
    minWidth: 0,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    minWidth: 40,
    textAlign: 'right',
  },
  horizontalDivider: {
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
});

export default StatsPanel;
