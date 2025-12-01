import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDistance } from 'geolib';
import simplify from 'simplify-js';
import * as polyline from 'google-polyline';
import logger from '../../../../utils/logger';

// ✅ FIX #1: Sauvegarde immédiate sans debounce (0% perte de données)
const BACKUP_KEY = 'trackingPoints_backup'; // Clé de backup

// Fonction de sauvegarde immédiate
const savePointsImmediate = async (points) => {
  if (!points || points.length === 0) return;

  const pointsJson = JSON.stringify(points);

  try {
    // Double sauvegarde primaire + backup
    await Promise.all([
      AsyncStorage.setItem('trackingPoints', pointsJson),
      AsyncStorage.setItem(BACKUP_KEY, pointsJson),
    ]);
  } catch (error) {
    console.error('❌ Erreur sauvegarde immédiate:', error);
    // Retry une fois après 100ms
    setTimeout(async () => {
      try {
        await Promise.all([
          AsyncStorage.setItem('trackingPoints', pointsJson),
          AsyncStorage.setItem(BACKUP_KEY, pointsJson),
        ]);
      } catch (retryError) {
        console.error('❌ Erreur sauvegarde retry:', retryError);
      }
    }, 100);
    throw error;
  }
};

export const SEGMENTS_STORAGE_KEY = '@trackingSegmentStarts_v1';
export const BG_LAST_SYNC_KEY = '@bgLastLocationTs_v1';

export const getBearing = (point1, point2) => {
  const lat1 = point1.latitude * Math.PI / 180;
  const lat2 = point2.latitude * Math.PI / 180;
  const deltaLng = (point2.longitude - point1.longitude) * Math.PI / 180;

  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
};

const sanitizeSegments = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    return [0];
  }
  return value;
};

const useTrackingPoints = () => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [trackingPoints, setTrackingPoints] = useState([]);
  const trackingPointsRef = useRef([]);

  const [segmentStartIndices, setSegmentStartIndices] = useState([0]);
  const segmentStartIndicesRef = useRef([0]);
  const currentSegmentIndexRef = useRef(0);
  const lastBgSyncRef = useRef(0);

  const [lastSampledPoint, setLastSampledPoint] = useState(null);
  const [lastSampledTime, setLastSampledTime] = useState(null);
  const [lastSampledBearing, setLastSampledBearing] = useState(null);

  // Refs for stable callbacks
  const lastSampledPointRef = useRef(null);
  const lastSampledTimeRef = useRef(null);
  const lastSampledBearingRef = useRef(null);

  // Sync refs with state
  useEffect(() => {
    lastSampledPointRef.current = lastSampledPoint;
  }, [lastSampledPoint]);

  useEffect(() => {
    lastSampledTimeRef.current = lastSampledTime;
  }, [lastSampledTime]);

  useEffect(() => {
    lastSampledBearingRef.current = lastSampledBearing;
  }, [lastSampledBearing]);

  const [totalPointsReceived, setTotalPointsReceived] = useState(0);
  const [pointsRejected, setPointsRejected] = useState(0);

  const [simplifiedPoints, setSimplifiedPoints] = useState([]);
  const [simplificationRatio, setSimplificationRatio] = useState(0);
  const [compressedPolyline, setCompressedPolyline] = useState('');
  const [compressionRatio, setCompressionRatio] = useState(0);

  useEffect(() => {
    trackingPointsRef.current = trackingPoints;
  }, [trackingPoints]);

  const updateSegmentStarts = useCallback((updater) => {
    setSegmentStartIndices((prev) => {
      const nextValue = typeof updater === 'function' ? updater(prev) : updater;
      const sanitized = sanitizeSegments(nextValue);
      segmentStartIndicesRef.current = sanitized;
      AsyncStorage.setItem(SEGMENTS_STORAGE_KEY, JSON.stringify(sanitized)).catch(() => { });
      return sanitized;
    });
  }, []);

  const getSegmentIndexForPosition = useCallback((pointIndex) => {
    const starts = segmentStartIndicesRef.current || [0];
    if (!starts.length) {
      return 0;
    }
    let segment = 0;
    for (let i = 0; i < starts.length; i += 1) {
      if (pointIndex >= starts[i]) {
        segment = i;
      } else {
        break;
      }
    }
    return segment;
  }, []);

  const splitPointsIntoSegments = useCallback((points) => {
    if (!points || points.length === 0) {
      return [];
    }
    const segments = [];
    let currentSegment = [];
    let currentIndex = typeof points[0]?.segmentIndex === 'number'
      ? points[0].segmentIndex
      : getSegmentIndexForPosition(0);

    points.forEach((point, idx) => {
      if (!point) {
        return;
      }
      const segIndex = typeof point.segmentIndex === 'number'
        ? point.segmentIndex
        : getSegmentIndexForPosition(idx);
      if (currentSegment.length === 0) {
        currentSegment.push(point);
        currentIndex = segIndex;
        return;
      }
      if (segIndex !== currentIndex) {
        segments.push(currentSegment);
        currentSegment = [point];
        currentIndex = segIndex;
      } else {
        currentSegment.push(point);
      }
    });
    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }
    return segments;
  }, [getSegmentIndexForPosition]);

  const flattenSegments = useCallback((segments) => {
    if (!segments || segments.length === 0) {
      return [];
    }
    return segments.reduce((accumulator, segment) => {
      if (segment && segment.length > 0) {
        accumulator.push(...segment);
      }
      return accumulator;
    }, []);
  }, []);

  const compressPolylineMemo = useCallback((points) => {
    try {
      if (!points || points.length < 2) {
        return '';
      }
      const coordinates = points.map((point) => [point.latitude, point.longitude]);
      const encoded = polyline.encode(coordinates);
      const originalSize = JSON.stringify(points).length;
      const compressedSize = encoded.length;
      const ratio = originalSize > 0 ? (compressedSize / originalSize) * 100 : 0;
      setCompressionRatio(ratio);
      return encoded;
    } catch (error) {
      console.error('Erreur compression polyline:', error);
      return '';
    }
  }, []);

  const decompressPolylineMemo = useCallback((encodedString) => {
    try {
      if (!encodedString) return [];
      const coordinates = polyline.decode(encodedString);
      const points = coordinates.map((coord, index) => ({
        latitude: coord[0],
        longitude: coord[1],
        timestamp: Date.now() + index,
        speed: 0,
        altitude: 0,
      }));
      return points;
    } catch (error) {
      console.error('Erreur décompression polyline:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    if (trackingPoints.length === 0) {
      setSimplifiedPoints([]);
      setSimplificationRatio(0);
      return;
    }

    // ⚡ OPTIMISATION PERFORMANCE LONG TRAJETS
    // Ne pas simplifier à chaque point si le tableau est grand
    // < 200 points : temps réel (chaque point)
    // > 200 points : tous les 5 points
    // > 1000 points : tous les 10 points
    // > 5000 points : tous les 20 points
    const throttleThreshold = trackingPoints.length > 5000 ? 20 : (trackingPoints.length > 1000 ? 10 : (trackingPoints.length > 200 ? 5 : 1));

    // Toujours simplifier le dernier point pour avoir la position exacte
    // Sinon respecter le throttle
    if (trackingPoints.length % throttleThreshold !== 0) {
      return;
    }

    // Simplification sélective selon les specs :
    // - Toujours simplifier pour réduire la charge de rendu
    // - Tolérance dynamique selon la vitesse

    // Calculer vitesse moyenne du trajet (sur les 50 derniers points)
    const recentPoints = trackingPoints.slice(-50);
    let averageSpeedKmh = 0;
    let pointsWithSpeed = 0;

    if (recentPoints.length > 0) {
      // Calculer vitesse moyenne basée sur distance/temps
      for (let i = 1; i < recentPoints.length; i += 1) {
        const prevPoint = recentPoints[i - 1];
        const currPoint = recentPoints[i];

        if (prevPoint && currPoint && prevPoint.timestamp && currPoint.timestamp) {
          const distance = getDistance(
            { latitude: prevPoint.latitude, longitude: prevPoint.longitude },
            { latitude: currPoint.latitude, longitude: currPoint.longitude },
          );
          const timeDiff = (currPoint.timestamp - prevPoint.timestamp) / 1000; // en secondes

          if (timeDiff > 0 && distance > 0) {
            const speedKmh = (distance / timeDiff) * 3.6;
            if (Number.isFinite(speedKmh) && speedKmh > 0) {
              averageSpeedKmh += speedKmh;
              pointsWithSpeed += 1;
            }
          }
        }
      }

      if (pointsWithSpeed > 0) {
        averageSpeedKmh = averageSpeedKmh / pointsWithSpeed;
      }
    }

    // Convertir en format simplify-js (array de {x, y})
    const pointsForSimplify = trackingPoints.map((point, index) => ({
      x: point.longitude,
      y: point.latitude,
      originalIndex: index,
      timestamp: point.timestamp,
      speed: point.speed,
      altitude: point.altitude,
      heading: point.heading,
      segmentIndex: point.segmentIndex,
    }));

    // Tolérance dynamique :
    // < 50 km/h : 1m (0.00001) - Haute précision urbaine
    // 50-100 km/h : 3m (0.000027) - Moyenne précision
    // > 100 km/h : 5m (0.000045) - Basse précision autoroute
    let tolerance = 0.00001;
    if (averageSpeedKmh >= 100) {
      tolerance = 0.000045;
    } else if (averageSpeedKmh >= 50) {
      tolerance = 0.000027;
    }

    // Appliquer Douglas-Peucker
    const simplified = simplify(pointsForSimplify, tolerance, true);

    // Convertir back en format points avec toutes les propriétés originales
    const simplifiedPointsWithProps = simplified.map((simp) => {
      const originalIndex = simp.originalIndex ?? simp.x; // simplify-js peut changer la structure
      const originalPoint = trackingPoints[originalIndex] || trackingPoints[Math.round(originalIndex)];

      if (originalPoint) {
        return {
          ...originalPoint,
          latitude: simp.y,
          longitude: simp.x,
        };
      }

      // Fallback si point original non trouvé
      return {
        latitude: simp.y,
        longitude: simp.x,
        timestamp: simp.timestamp || Date.now(),
        speed: simp.speed || 0,
        altitude: simp.altitude || 0,
        heading: simp.heading || 0,
        segmentIndex: simp.segmentIndex || 0,
      };
    });

    // S'assurer que le premier et dernier point sont toujours présents
    if (simplifiedPointsWithProps.length > 0) {
      if (simplifiedPointsWithProps[0].timestamp !== trackingPoints[0].timestamp) {
        simplifiedPointsWithProps.unshift(trackingPoints[0]);
      }
      const lastOriginal = trackingPoints[trackingPoints.length - 1];
      const lastSimplified = simplifiedPointsWithProps[simplifiedPointsWithProps.length - 1];
      if (lastSimplified && lastSimplified.timestamp !== lastOriginal.timestamp) {
        simplifiedPointsWithProps.push(lastOriginal);
      }
    } else if (trackingPoints.length > 0) {
      // Si simplification échoue mais qu'il y a des points, garder au moins le dernier
      simplifiedPointsWithProps.push(...trackingPoints);
    }

    setSimplifiedPoints(simplifiedPointsWithProps);
    const ratio = simplifiedPointsWithProps.length > 0
      ? (simplifiedPointsWithProps.length / trackingPoints.length) * 100
      : 100;
    setSimplificationRatio(ratio);

  }, [trackingPoints]);

  useEffect(() => {
    if (simplifiedPoints.length > 1) {
      const compressed = compressPolylineMemo(simplifiedPoints);
      setCompressedPolyline(compressed);
    } else {
      setCompressedPolyline('');
      setCompressionRatio(0);
    }
  }, [simplifiedPoints, compressPolylineMemo]);

  const trackingSegments = useMemo(
    () => splitPointsIntoSegments(trackingPoints),
    [trackingPoints, splitPointsIntoSegments],
  );

  const simplifiedSegments = useMemo(
    () => splitPointsIntoSegments(simplifiedPoints),
    [simplifiedPoints, splitPointsIntoSegments],
  );

  const activeRouteSegments = useMemo(() => {
    const source = simplifiedSegments.length > 0 ? simplifiedSegments : trackingSegments;
    return source.filter((segment) => segment && segment.length > 0);
  }, [simplifiedSegments, trackingSegments]);

  useEffect(() => {
    if (trackingPoints.length > 0) {
      // ✅ FIX #1: Sauvegarde déplacée dans useEffect pour ne pas bloquer le rendu UI
      // ✅ FIX #4: Throttling de la sauvegarde (tous les 50 points ou < 10 points)
      // Évite de sérialiser le JSON géant à chaque frame
      if (trackingPoints.length % 50 === 0 || trackingPoints.length < 10) {
        savePointsImmediate(trackingPoints).catch((err) => {
          console.error('❌ Erreur sauvegarde points:', err);
        });
      }
    }
  }, [trackingPoints]);

  const appendTrackingPoint = useCallback((pointWithHeading) => {
    setTrackingPoints((prev) => {
      const newPoints = [...prev, pointWithHeading];
      // Log pour diagnostic (léger)
      // logger.log(\`➕ Point ajouté au state: lat=\${pointWithHeading.latitude?.toFixed(6)}, lng=\${pointWithHeading.longitude?.toFixed(6)}, total=\${newPoints.length}\`, 'TrackingPoints');
      return newPoints;
    });

    setCurrentLocation(pointWithHeading);
    setLastSampledPoint(pointWithHeading);
    setLastSampledTime(Date.now());
    setLastSampledBearing(
      typeof pointWithHeading.heading === 'number' && Number.isFinite(pointWithHeading.heading)
        ? pointWithHeading.heading
        : null,
    );
    setTotalPointsReceived((prevTotal) => prevTotal + 1);

    if (pointWithHeading.timestamp) {
      const ts = Number(pointWithHeading.timestamp);
      if (!Number.isNaN(ts)) {
        lastBgSyncRef.current = ts;
        AsyncStorage.setItem(BG_LAST_SYNC_KEY, ts.toString()).catch(() => { });
      }
    }
  }, []);

  const incrementTotalPoints = useCallback(() => {
    setTotalPointsReceived((prev) => prev + 1);
  }, []);

  const recordRejectedPoint = useCallback(() => {
    setPointsRejected((prev) => prev + 1);
    setTotalPointsReceived((prev) => prev + 1);
  }, []);

  const resetTrackingState = useCallback(() => {
    setCurrentLocation(null);
    setTrackingPoints([]);
    trackingPointsRef.current = [];
    setSegmentStartIndices([0]);
    segmentStartIndicesRef.current = [0];
    currentSegmentIndexRef.current = 0;
    AsyncStorage.setItem(SEGMENTS_STORAGE_KEY, JSON.stringify([0])).catch(() => { });
    lastBgSyncRef.current = 0;

    setLastSampledPoint(null);
    setLastSampledTime(null);
    setLastSampledBearing(null);

    setTotalPointsReceived(0);
    setPointsRejected(0);

    setSimplifiedPoints([]);
    setSimplificationRatio(0);
    setCompressedPolyline('');
    setCompressionRatio(0);
  }, []);

  const restoreTrackingState = useCallback(
    ({ points = [], segmentStarts = [0], lastBgTimestamp = 0 } = {}) => {
      const sanitizedSegments = sanitizeSegments(segmentStarts);
      setSegmentStartIndices(sanitizedSegments);
      segmentStartIndicesRef.current = sanitizedSegments;
      currentSegmentIndexRef.current = Math.max(0, sanitizedSegments.length - 1);

      setTrackingPoints(points);
      trackingPointsRef.current = points;

      if (points.length > 0) {
        setCurrentLocation(points[points.length - 1]);
      } else {
        setCurrentLocation(null);
      }

      if (Number.isFinite(lastBgTimestamp) && lastBgTimestamp > 0) {
        lastBgSyncRef.current = lastBgTimestamp;
      }
    },
    [],
  );

  const validateAndFilterPoint = useCallback((newPoint, existingPoints, targetSegment = 0, gpsQuality = {}) => {
    const segmentPoints = [];
    for (let i = existingPoints.length - 1; i >= 0; i -= 1) {
      const candidate = existingPoints[i];
      if (!candidate) continue;
      const candidateSegment = typeof candidate.segmentIndex === 'number' ? candidate.segmentIndex : 0;
      if (candidateSegment !== targetSegment) {
        break;
      }
      segmentPoints.unshift(candidate);
    }

    if (segmentPoints.length === 0) {
      logger.log(`✅ Point validé: premier point du segment ${targetSegment}`, 'TrackingPoints');
      return { isValid: true, reason: 'first_point' };
    }

    const lastPoint = segmentPoints[segmentPoints.length - 1];

    // Vérification coordonnées valides
    if (!newPoint.latitude || !newPoint.longitude ||
      Number.isNaN(newPoint.latitude) || Number.isNaN(newPoint.longitude) ||
      Math.abs(newPoint.latitude) > 90 || Math.abs(newPoint.longitude) > 180) {
      logger.warn(`❌ Rejeté: coordonnées invalides`, 'TrackingPoints');
      return { isValid: false, reason: 'invalid_coordinates' };
    }

    // Calculer distance et temps
    const distance = getDistance(
      { latitude: lastPoint.latitude, longitude: lastPoint.longitude },
      { latitude: newPoint.latitude, longitude: newPoint.longitude },
    );
    const timeDiff = Math.max(1, newPoint.timestamp - lastPoint.timestamp);
    const currentSpeed = timeDiff > 0 ? (distance / (timeDiff / 1000)) * 3.6 : 0;

    // 🛡️ FILTRE 1: Bruit GPS à l'arrêt (< 3m et vitesse < 1 km/h)
    if (distance < 3 && currentSpeed < 1) {
      return { isValid: false, reason: 'stationary_noise', distance };
    }

    // 🛡️ FILTRE 2: Distance maximale (pas de téléportation)
    const maxExpectedDistance = Math.max(500, currentSpeed * 2.78 * (timeDiff / 1000) * 3); // 3x vitesse max
    if (distance > maxExpectedDistance && distance > 1000) {
      logger.warn(`❌ Rejeté: téléportation (${distance.toFixed(0)}m en ${timeDiff}ms)`, 'TrackingPoints');
      return { isValid: false, reason: 'teleportation', distance };
    }

    // Calculer bearings pour analyses géométriques
    if (segmentPoints.length >= 2) {
      const prevPoint = segmentPoints[segmentPoints.length - 2];

      const bearingOld = getBearing(
        { latitude: prevPoint.latitude, longitude: prevPoint.longitude },
        { latitude: lastPoint.latitude, longitude: lastPoint.longitude }
      );

      const bearingNew = getBearing(
        { latitude: lastPoint.latitude, longitude: lastPoint.longitude },
        { latitude: newPoint.latitude, longitude: newPoint.longitude }
      );

      // Différence d'angle (normalisée -180 à +180)
      let bearingDiff = bearingNew - bearingOld;
      if (bearingDiff > 180) bearingDiff -= 360;
      if (bearingDiff < -180) bearingDiff += 360;
      const absBearingDiff = Math.abs(bearingDiff);

      // 🛡️ FILTRE 3: Zigzag serré (angle > 120° + distance < 30m)
      // Élimine les retours brusques physiquement impossibles
      if (absBearingDiff > 120 && distance < 30 && currentSpeed > 5) {
        logger.warn(`❌ Rejeté: zigzag serré (${absBearingDiff.toFixed(0)}° sur ${distance.toFixed(0)}m)`, 'TrackingPoints');
        return { isValid: false, reason: 'sharp_zigzag', distance, bearingDiff: absBearingDiff };
      }

      // 🛡️ FILTRE 3b: Micro Zigzag (angle > 60° + distance < 10m + vitesse > 10km/h)
      // Impossible de tourner sec à haute vitesse sur courte distance
      if (absBearingDiff > 60 && distance < 10 && currentSpeed > 10) {
        logger.warn(`❌ Rejeté: micro zigzag (${absBearingDiff.toFixed(0)}° sur ${distance.toFixed(0)}m à ${currentSpeed.toFixed(0)}km/h)`, 'TrackingPoints');
        return { isValid: false, reason: 'micro_zigzag', distance, bearingDiff: absBearingDiff };
      }

      // 🛡️ FILTRE 4: Retour arrière (angle > 160° + distance < 30m)
      // Détecte les mouvements "avant-arrière" aberrants
      if (absBearingDiff > 160 && distance < 30) {
        logger.warn(`❌ Rejeté: retour arrière (${absBearingDiff.toFixed(0)}° sur ${distance.toFixed(0)}m)`, 'TrackingPoints');
        return { isValid: false, reason: 'backward_movement', distance, bearingDiff: absBearingDiff };
      }

      // 🛡️ FILTRE 5: Zigzag rapide (changement > 90° en < 1s + distance < 20m)
      if (absBearingDiff > 90 && timeDiff < 1000 && distance < 20) {
        logger.warn(`❌ Rejeté: zigzag rapide (${absBearingDiff.toFixed(0)}° en ${timeDiff}ms)`, 'TrackingPoints');
        return { isValid: false, reason: 'zigzag_rapid', distance, bearingDiff: absBearingDiff };
      }

      // 🛡️ FILTRE 6: Bearing instable (changement > 45° en < 500ms à vitesse élevée)
      if (absBearingDiff > 45 && timeDiff < 500 && currentSpeed > 30 && distance > 5) {
        return { isValid: false, reason: 'bearing_unstable', distance, bearingDiff: absBearingDiff };
      }
    }

    // 🛡️ FILTRE 7: Incohérence vitesse GPS vs calculée
    // Rejeter si la vitesse calculée est 3x supérieure à la vitesse GPS déclarée
    if (newPoint.speed !== undefined && newPoint.speed !== null) {
      const declaredSpeedKmh = newPoint.speed * 3.6;
      if (declaredSpeedKmh > 5 && currentSpeed > declaredSpeedKmh * 3) {
        logger.warn(`❌ Rejeté: incohérence vitesse (GPS: ${declaredSpeedKmh.toFixed(0)}, calc: ${currentSpeed.toFixed(0)})`, 'TrackingPoints');
        return { isValid: false, reason: 'speed_incoherence', distance };
      }
    }

    // 🛡️ FILTRE 8: Précision GPS trop faible (> 40m)
    if (gpsQuality.accuracy && gpsQuality.accuracy > 40) {
      logger.warn(`❌ Rejeté: précision GPS faible (${gpsQuality.accuracy.toFixed(0)}m)`, 'TrackingPoints');
      return { isValid: false, reason: 'low_accuracy', distance };
    }

    // ✅ Point validé
    return { isValid: true, reason: 'valid', distance, speed: currentSpeed };
  }, []);

  // ✅ FIX #3: Validation stricte avec 3 règles simples
  // Utilise les refs pour rester stable et éviter de recréer la fonction à chaque point
  const shouldSamplePoint = useCallback((newPoint, currentSpeed = 0) => {
    // RÈGLE 1 : Coordonnées valides
    if (!newPoint.latitude || !newPoint.longitude ||
      Math.abs(newPoint.latitude) > 90 ||
      Math.abs(newPoint.longitude) > 180) {
      logger.warn('❌ Point rejeté : coordonnées invalides', 'TrackingPoints');
      return false;
    }

    // RÈGLE 2 : Distance minimale depuis dernier point (éviter bruit GPS)
    if (lastSampledPointRef.current) {
      const distance = getDistance(
        { latitude: lastSampledPointRef.current.latitude, longitude: lastSampledPointRef.current.longitude },
        { latitude: newPoint.latitude, longitude: newPoint.longitude }
      );

      const timeDiff = (Date.now() - (lastSampledTimeRef.current || Date.now())) / 1000; // secondes

      // Éviter points trop proches (bruit GPS)
      // Si vitesse < 5 km/h : min 8m entre points (réduit bruit à l'arrêt)
      // Si vitesse >= 5 km/h : min 5m entre points (lisse la trajectoire)
      const minDistance = currentSpeed < 5 ? 8 : 5;

      if (distance < minDistance && timeDiff < 5) { // Augmenté timeout à 5s pour forcer distance
        logger.log(`⏭️ Point ignoré : trop proche (${distance.toFixed(1)}m, min ${minDistance}m)`, 'TrackingPoints');
        return false;
      }
    }

    // RÈGLE 3 : Vitesse max physique (400 km/h = voiture sport max)
    if (currentSpeed > 400) {
      logger.warn(`❌ Point rejeté : vitesse aberrante (${currentSpeed.toFixed(1)} km/h)`, 'TrackingPoints');
      return false;
    }

    logger.log(`✅ Point accepté (dist=${lastSampledPointRef.current ? getDistance({ latitude: lastSampledPointRef.current.latitude, longitude: lastSampledPointRef.current.longitude }, { latitude: newPoint.latitude, longitude: newPoint.longitude }).toFixed(1) : 'N/A'}m, speed=${currentSpeed.toFixed(1)}km/h)`, 'TrackingPoints');
    return true;
  }, []); // Plus de dépendances instables !

  return {
    currentLocation,
    setCurrentLocation,
    trackingPoints,
    trackingPointsRef,
    segmentStartIndices,
    updateSegmentStarts,
    segmentStartIndicesRef,
    currentSegmentIndexRef,
    lastBgSyncRef,
    lastSampledPoint,
    setLastSampledPoint,
    lastSampledTime,
    setLastSampledTime,
    lastSampledBearing,
    setLastSampledBearing,
    totalPointsReceived,
    pointsRejected,
    trackingSegments,
    activeRouteSegments,
    simplifiedPoints,
    simplificationRatio,
    compressedPolyline,
    compressionRatio,
    appendTrackingPoint,
    incrementTotalPoints,
    recordRejectedPoint,
    resetTrackingState,
    restoreTrackingState,
    getSegmentIndexForPosition,
    splitPointsIntoSegments,
    flattenSegments,
    compressPolyline: compressPolylineMemo,
    decompressPolyline: decompressPolylineMemo,
    shouldSamplePoint,
    validateAndFilterPoint,
  };
};

// Export de la fonction de sauvegarde pour usage externe (pause, stop, etc.)
export const forceSaveTrackingPoints = async (points) => {
  return await savePointsRobust(points, true);
};

export default useTrackingPoints;
