import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Mapbox from '@rnmapbox/maps';

const MiniRoutePreview = ({
  coordinates = [],
  style,
  strokeColor = '#1E3A8A',
  outlineColor = 'rgba(255, 255, 255, 0.6)',
  backgroundColor = '#F1F5F9',
  strokeWidth = 4,
  outlineWidth = 7,
  mapType = 'standard',
}) => {
  const hasRoute = Array.isArray(coordinates) && coordinates.length > 1;

  const routeGeoJSON = useMemo(() => {
    if (!hasRoute) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coordinates.map(c => [c.longitude, c.latitude]),
      },
    };
  }, [coordinates, hasRoute]);

  const bounds = useMemo(() => {
    if (!hasRoute) return null;
    let minLat = coordinates[0].latitude;
    let maxLat = coordinates[0].latitude;
    let minLng = coordinates[0].longitude;
    let maxLng = coordinates[0].longitude;

    coordinates.forEach(p => {
      minLat = Math.min(minLat, p.latitude);
      maxLat = Math.max(maxLat, p.latitude);
      minLng = Math.min(minLng, p.longitude);
      maxLng = Math.max(maxLng, p.longitude);
    });

    return {
      ne: [maxLng, maxLat],
      sw: [minLng, minLat],
    };
  }, [coordinates, hasRoute]);

  return (
    <View style={[styles.mapWrapper, { backgroundColor }, style]}>
      <Mapbox.MapView
        style={styles.map}
        styleURL={Mapbox.StyleURL.Street}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
      >
        {bounds && (
          <Mapbox.Camera
            bounds={bounds}
            padding={{ top: 20, bottom: 20, left: 20, right: 20 }}
            animationDuration={0}
          />
        )}

        {routeGeoJSON && (
          <Mapbox.ShapeSource id="miniRouteSource" shape={routeGeoJSON}>
            {/* Outline */}
            <Mapbox.LineLayer
              id="miniRouteOutline"
              style={{
                lineColor: outlineColor,
                lineWidth: outlineWidth,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {/* Stroke */}
            <Mapbox.LineLayer
              id="miniRouteStroke"
              style={{
                lineColor: strokeColor,
                lineWidth: strokeWidth,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </Mapbox.ShapeSource>
        )}
      </Mapbox.MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  mapWrapper: {
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  map: {
    flex: 1,
  },
});

export default MiniRoutePreview;
