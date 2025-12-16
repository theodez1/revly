import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Mapbox from '@rnmapbox/maps';

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface MiniRoutePreviewProps {
  coordinates?: Coordinate[];
  segments?: Coordinate[][]; // Optionnel: segments séparés pour éviter de relier début/fin
  style?: ViewStyle;
  strokeColor?: string;
  outlineColor?: string;
  backgroundColor?: string;
  strokeWidth?: number;
  outlineWidth?: number;
  mapType?: 'standard' | 'satellite' | 'hybrid';
}

const MiniRoutePreview: React.FC<MiniRoutePreviewProps> = ({
  coordinates = [],
  segments,
  style,
  strokeColor = '#60A5FA',
  outlineColor = 'rgba(59, 130, 246, 0.5)',
  backgroundColor = '#F8FAFC',
  strokeWidth = 4,
  outlineWidth = 7,
  mapType = 'standard',
}) => {
  // Calculer la distance entre deux points (Haversine)
  const calculateDistance = (p1: Coordinate, p2: Coordinate): number => {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = (p1.latitude * Math.PI) / 180;
    const φ2 = (p2.latitude * Math.PI) / 180;
    const Δφ = ((p2.latitude - p1.latitude) * Math.PI) / 180;
    const Δλ = ((p2.longitude - p1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Détecter les segments dans les coordonnées en détectant les gaps
  const detectSegments = useMemo(() => {
    if (!coordinates || coordinates.length < 2) return [];
    
    const TIME_GAP_THRESHOLD = 30000; // 30 secondes
    const DISTANCE_GAP_THRESHOLD = 500; // 500 mètres
    
    const segments: Coordinate[][] = [];
    let currentSegment: Coordinate[] = [coordinates[0]];
    
    for (let i = 1; i < coordinates.length; i++) {
      const prev = coordinates[i - 1];
      const curr = coordinates[i];
      
      // Vérifier si on a un timestamp (optionnel)
      const timeDelta = (curr as any).timestamp && (prev as any).timestamp
        ? (curr as any).timestamp - (prev as any).timestamp
        : 0;
      
      const distance = calculateDistance(prev, curr);
      
      // Si gap détecté, créer un nouveau segment
      if (timeDelta > TIME_GAP_THRESHOLD || distance > DISTANCE_GAP_THRESHOLD) {
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
        }
        currentSegment = [curr];
      } else {
        currentSegment.push(curr);
      }
    }
    
    // Ajouter le dernier segment
    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }
    
    return segments.length > 0 ? segments : [coordinates];
  }, [coordinates]);

  // Utiliser segments fournis ou détectés
  const routeSegments = segments || detectSegments;
  const hasRoute = routeSegments.length > 0 && routeSegments.some(seg => seg.length > 1);

  const routeGeoJSON = useMemo(() => {
    if (!hasRoute) return null;
    
    // Si un seul segment, utiliser LineString (compatibilité)
    if (routeSegments.length === 1) {
      return {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: routeSegments[0].map(c => [c.longitude, c.latitude]),
        },
      };
    }
    
    // Plusieurs segments: utiliser MultiLineString pour éviter de relier début/fin
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'MultiLineString' as const,
        coordinates: routeSegments
          .filter(seg => seg.length > 1) // Filtrer les segments trop courts
          .map(segment => segment.map(c => [c.longitude, c.latitude])),
      },
    };
  }, [routeSegments, hasRoute]);

  // Calculer un rectangle englobant simple (extrémités haut/bas/gauche/droite)
  const bounds = useMemo(() => {
    if (!hasRoute) return null;

    // Utiliser tous les points de tous les segments
    const allPoints = routeSegments.flat();
    if (allPoints.length === 0) return null;

    let minLat = allPoints[0].latitude;
    let maxLat = allPoints[0].latitude;
    let minLng = allPoints[0].longitude;
    let maxLng = allPoints[0].longitude;

    allPoints.forEach((p) => {
      minLat = Math.min(minLat, p.latitude);
      maxLat = Math.max(maxLat, p.latitude);
      minLng = Math.min(minLng, p.longitude);
      maxLng = Math.max(maxLng, p.longitude);
    });

    // Ajouter une petite marge proportionnelle pour ne pas coller aux bords
    const latDelta = maxLat - minLat;
    const lngDelta = maxLng - minLng;

    const latPadding = (latDelta || 0.0005) * 0.15; // au moins ~50m
    const lngPadding = (lngDelta || 0.0005) * 0.15;

    return {
      ne: [maxLng + lngPadding, maxLat + latPadding],
      sw: [minLng - lngPadding, minLat - latPadding],
    };
  }, [routeSegments, hasRoute]);

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
            // @ts-ignore - padding typé de manière plus stricte que la réalité
            bounds={bounds}
            padding={{ top: 10, bottom: 10, left: 10, right: 10 } as any}
            animationDuration={0}
          />
        )}

        {routeGeoJSON && (
          <Mapbox.ShapeSource id="miniRouteSource" shape={routeGeoJSON}>
            {/* Contour */}
            <Mapbox.LineLayer
              id="miniRouteOutline"
              style={{
                lineColor: outlineColor,
                lineWidth: outlineWidth,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {/* Ligne principale */}
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
    borderRadius: 0, // pas de coins arrondis, laissé au parent si besoin
    backgroundColor: '#F8FAFC',
  },
  map: {
    flex: 1,
  },
});

export default MiniRoutePreview;

