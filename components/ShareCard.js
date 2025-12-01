import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const SHARE_WIDTH = 1080;
const SHARE_HEIGHT = 1920;

export default function ShareCard({ ride }) {
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const buildRoutePath = (coords, width, height, padding = 12) => {
    const points = (coords || []).filter(Boolean);
    if (points.length === 0) return '';
    let minLat = points[0].latitude, maxLat = points[0].latitude;
    let minLng = points[0].longitude, maxLng = points[0].longitude;
    for (let i = 1; i < points.length; i += 1) {
      const c = points[i];
      if (c.latitude < minLat) minLat = c.latitude;
      if (c.latitude > maxLat) maxLat = c.latitude;
      if (c.longitude < minLng) minLng = c.longitude;
      if (c.longitude > maxLng) maxLng = c.longitude;
    }
    const spanLat = Math.max(maxLat - minLat, 1e-6);
    const spanLng = Math.max(maxLng - minLng, 1e-6);
    const innerW = width - padding * 2;
    const innerH = height - padding * 2;
    const scale = Math.min(innerW / spanLng, innerH / spanLat);
    const offsetX = (width - spanLng * scale) / 2 - minLng * scale;
    const offsetY = (height - spanLat * scale) / 2 + maxLat * scale;
    const toXY = (lat, lng) => {
      const x = lng * scale + offsetX;
      const y = -lat * scale + offsetY;
      return { x, y };
    };
    let d = '';
    for (let i = 0; i < points.length; i += 1) {
      const p = toXY(points[i].latitude, points[i].longitude);
      d += i === 0 ? `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}` : ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    }
    return d;
  };

  const distanceKm = ((ride?.distance || 0) / 1000).toFixed(1);
  const duration = formatDuration(ride?.duration || 0);
  const avgSpeed = ride?.averageSpeed ? ride.averageSpeed.toFixed(1) : '0.0';
  const boxW = 700;
  const boxH = 500;
  const path = buildRoutePath(ride?.routeCoordinates || [], boxW, boxH, 30);
  const vehicleName = (ride?.vehicle || 'Véhicule').toUpperCase();

  return (
    <View style={styles.stickerContainer}>
      {/* REVLY en haut */}
      <View style={styles.stickerHeader}>
        <Text style={styles.stickerTitle}>REVLY</Text>
      </View>

      {/* Distance et Durée */}
      <View style={styles.stickerStats}>
        <View style={styles.stickerDistanceContainer}>
          <Text style={styles.stickerDistance}>{distanceKm}</Text>
          <Text style={styles.stickerDistanceUnit}>km</Text>
        </View>
        <Text style={styles.stickerDuration}>{duration}</Text>
      </View>

      {/* Tracé de route - centré */}
      <View style={styles.stickerRouteContainer}>
        <Svg width={boxW} height={boxH}>
          <Path 
            d={path} 
            stroke="#2563EB" 
            strokeWidth={5} 
            fill="none" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </Svg>
      </View>

      {/* Véhicule et vitesse moyenne */}
      <View style={styles.stickerFooter}>
        <Text style={styles.stickerVehicle}>{vehicleName}</Text>
        <Text style={styles.stickerSpeed}>Vitesse moy {avgSpeed} km/h</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stickerContainer: {
    width: SHARE_WIDTH,
    height: SHARE_HEIGHT,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerHeader: {
    alignItems: 'center',
    paddingTop: 60,
  },
  stickerTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 32,
    letterSpacing: 4,
  },
  stickerStats: {
    alignItems: 'center',
    marginTop: 20,
  },
  stickerDistanceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  stickerDistance: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 140,
    letterSpacing: -4,
  },
  stickerDistanceUnit: {
    color: '#FFFFFF',
    fontWeight: '400',
    fontSize: 40,
    marginLeft: 8,
  },
  stickerDuration: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 80,
    letterSpacing: -2,
    marginTop: 4,
  },
  stickerRouteContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 20,
  },
  stickerFooter: {
    alignItems: 'center',
    paddingBottom: 60,
  },
  stickerVehicle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 54,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  stickerSpeed: {
    color: '#CBD5E1',
    fontWeight: '700',
    fontSize: 46,
    marginTop: 4,
  },
});
