import React, { useMemo, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const MIN_DELTA = 0.00001;

const buildPath = (coords, width, height, padding) => {
  if (!Array.isArray(coords) || coords.length === 0 || width <= 0 || height <= 0) {
    return '';
  }

  let minLat = coords[0].latitude;
  let maxLat = coords[0].latitude;
  let minLng = coords[0].longitude;
  let maxLng = coords[0].longitude;

  for (let i = 1; i < coords.length; i += 1) {
    const point = coords[i];
    if (typeof point?.latitude !== 'number' || typeof point?.longitude !== 'number') {
      continue;
    }
    if (point.latitude < minLat) minLat = point.latitude;
    if (point.latitude > maxLat) maxLat = point.latitude;
    if (point.longitude < minLng) minLng = point.longitude;
    if (point.longitude > maxLng) maxLng = point.longitude;
  }

  const spanLat = Math.max(maxLat - minLat, MIN_DELTA);
  const spanLng = Math.max(maxLng - minLng, MIN_DELTA);

  const innerWidth = Math.max(width - padding * 2, 1);
  const innerHeight = Math.max(height - padding * 2, 1);

  const scale = Math.min(innerWidth / spanLng, innerHeight / spanLat);

  const offsetX = (width - spanLng * scale) / 2 - minLng * scale;
  const offsetY = (height - spanLat * scale) / 2 + maxLat * scale;

  let d = '';
  coords.forEach((point, index) => {
    if (typeof point?.latitude !== 'number' || typeof point?.longitude !== 'number') {
      return;
    }
    const x = point.longitude * scale + offsetX;
    const y = -point.latitude * scale + offsetY;
    d += index === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  });

  return d;
};

const RouteThumbnail = React.memo(function RouteThumbnail({
  coordinates = [],
  style,
  backgroundColor = '#111827',
  strokeColor = '#1E3A8A',
  strokeWidth = 5,
  outlineColor = 'rgba(255, 255, 255, 0.55)',
  outlineWidth = 8,
  padding = 18,
  fallback = null,
}) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const handleLayout = useCallback((event) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== layout.width || height !== layout.height) {
      setLayout({ width, height });
    }
  }, [layout.width, layout.height]);

  const path = useMemo(() => {
    if (layout.width <= 0 || layout.height <= 0) {
      return '';
    }
    return buildPath(coordinates, layout.width, layout.height, padding);
  }, [coordinates, layout.width, layout.height, padding]);

  const hasRoute = path.length > 0;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor },
        style,
      ]}
      onLayout={handleLayout}
    >
      {hasRoute ? (
        <Svg width={layout.width} height={layout.height}>
          {outlineColor && outlineWidth > strokeWidth && (
            <Path
              d={path}
              stroke={outlineColor}
              strokeWidth={outlineWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}
          <Path
            d={path}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      ) : (
        fallback || <View style={styles.fallback} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
  },
});

export default RouteThumbnail;

