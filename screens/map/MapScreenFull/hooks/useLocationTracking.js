import { useCallback, useRef } from 'react';
import { safeSetItem } from '../utils/asyncStorageWithLoading';

const STILL_SPEED_THRESHOLD = 1; // km/h
const SPIKE_SPEED_THRESHOLD = 5; // km/h
const SPIKE_CONFIRM_WINDOW_MS = 3000;

const useLocationTracking = ({
  isTrackingRef,
  applyKalmanFilter,
  shouldSamplePoint,
  incrementTotalPoints,
  recordRejectedPoint,
  trackingPointsRef,
  currentSegmentIndexRef,
  validateAndFilterPoint,
  appendTrackingPoint,
  getBearing,
  smoothSpeed,
  maxSpeedRef,
  setMaxSpeed,
  detectStop,
  setAltitudeData,
  setCurrentSpeed,
}) => {
  const lastStableSpeedRef = useRef(0);
  const pendingSpikeRef = useRef(null);

  const safeApplyKalmanFilter =
    typeof applyKalmanFilter === 'function'
      ? applyKalmanFilter
      : (lat, lng) => ({ latitude: lat, longitude: lng });

  const safeGetBearing =
    typeof getBearing === 'function'
      ? getBearing
      : (point1, point2) => {
          const lat1 = point1.latitude * Math.PI / 180;
          const lat2 = point2.latitude * Math.PI / 180;
          const deltaLng = (point2.longitude - point1.longitude) * Math.PI / 180;

          const y = Math.sin(deltaLng) * Math.cos(lat2);
          const x =
            Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

          let bearing = Math.atan2(y, x) * 180 / Math.PI;
          return (bearing + 360) % 360;
        };

  const safeSmoothSpeed =
    typeof smoothSpeed === 'function'
      ? smoothSpeed
      : (rawSpeed) => {
          const speed = Number(rawSpeed ?? 0);
          const speedKmh = Number.isFinite(speed) ? speed * 3.6 : 0;
          return {
            raw: speedKmh,
            kalman: speedKmh,
            smoothed: speedKmh,
          };
        };

  const resolveSpeedForMax = useCallback(
    (instantKmh, timestamp) => {
      if (!Number.isFinite(instantKmh)) {
        return null;
      }

      const pending = pendingSpikeRef.current;
      if (
        pending
        && timestamp - pending.timestamp > SPIKE_CONFIRM_WINDOW_MS
      ) {
        pendingSpikeRef.current = null;
      }

      if (pendingSpikeRef.current) {
        if (instantKmh <= STILL_SPEED_THRESHOLD) {
          pendingSpikeRef.current = null;
          lastStableSpeedRef.current = instantKmh;
          return null;
        }
        const confirmedValue = Math.max(pendingSpikeRef.current.value, instantKmh);
        pendingSpikeRef.current = null;
        lastStableSpeedRef.current = instantKmh;
        return confirmedValue;
      }

      if (instantKmh <= STILL_SPEED_THRESHOLD) {
        lastStableSpeedRef.current = instantKmh;
        return null;
      }

      if (
        (lastStableSpeedRef.current ?? 0) <= STILL_SPEED_THRESHOLD
        && instantKmh >= SPIKE_SPEED_THRESHOLD
      ) {
        pendingSpikeRef.current = { value: instantKmh, timestamp };
        return null;
      }

      lastStableSpeedRef.current = instantKmh;
      return instantKmh;
    },
    [],
  );

  const handleLocationUpdate = useCallback(
    (loc) => {
      if (!isTrackingRef.current) {
        return;
      }

      try {
        const { coords } = loc ?? {};
        if (
          !coords ||
          coords.latitude === undefined ||
          coords.latitude === null ||
          coords.longitude === undefined ||
          coords.longitude === null ||
          isNaN(coords.latitude) ||
          isNaN(coords.longitude) ||
          !Number.isFinite(coords.latitude) ||
          !Number.isFinite(coords.longitude)
        ) {
          console.warn('Coordonnées GPS invalides dans watchPosition:', coords);
          return;
        }

        // Validation supplémentaire des coordonnées
        if (Math.abs(coords.latitude) > 90 || Math.abs(coords.longitude) > 180) {
          console.warn('Coordonnées GPS hors limites:', coords);
          return;
        }

        const rawPoint = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          timestamp: loc?.timestamp || Date.now(),
          speed: coords.speed || 0,
          altitude: coords.altitude || 0,
        };

        const kalmanFiltered = safeApplyKalmanFilter(rawPoint.latitude, rawPoint.longitude);
        const processedPoint = {
          ...rawPoint,
          latitude: kalmanFiltered.latitude,
          longitude: kalmanFiltered.longitude,
        };

        if (
          !processedPoint.latitude ||
          !processedPoint.longitude ||
          isNaN(processedPoint.latitude) ||
          isNaN(processedPoint.longitude) ||
          Math.abs(processedPoint.latitude) > 90 ||
          Math.abs(processedPoint.longitude) > 180
        ) {
          return;
        }

        const currentSpeedKmh = coords.speed ? coords.speed * 3.6 : 0;
        const keepSample = shouldSamplePoint(processedPoint, currentSpeedKmh);
        if (!keepSample) {
          incrementTotalPoints();
          return;
        }

        const segmentIndex = currentSegmentIndexRef.current || 0;
        const pointWithSegment = {
          ...processedPoint,
          segmentIndex,
        };

        const validation = validateAndFilterPoint(pointWithSegment, trackingPointsRef.current, segmentIndex);
        if (!validation.isValid) {
          console.log(
            `⏭️ Point rejeté: ${validation.reason}`,
            validation.distance ? `distance: ${validation.distance}m` : '',
          );
          recordRejectedPoint();
          return;
        }

        const lastPoint = (() => {
          const existingPoints = trackingPointsRef.current;
          for (let i = existingPoints.length - 1; i >= 0; i -= 1) {
            const candidate = existingPoints[i];
            if (candidate && (candidate.segmentIndex ?? 0) === segmentIndex) {
              return candidate;
            }
          }
          return pointWithSegment;
        })();

        const bearing = safeGetBearing(
          { latitude: lastPoint.latitude, longitude: lastPoint.longitude },
          { latitude: pointWithSegment.latitude, longitude: pointWithSegment.longitude },
        );

        const pointWithHeading = {
          ...pointWithSegment,
          heading: bearing,
        };

        appendTrackingPoint(pointWithHeading);

        if (coords.speed !== null && coords.speed !== undefined) {
          const { raw: rawKmh } = safeSmoothSpeed(coords.speed);
          const instantKmh = Number.isFinite(rawKmh) ? rawKmh : coords.speed * 3.6;
          const usableSpeed = resolveSpeedForMax(instantKmh, pointWithSegment.timestamp);

          // Toujours mettre à jour la vitesse actuelle pour l'UI, même si on ne met pas à jour maxSpeed
          setCurrentSpeed(instantKmh);

          if (usableSpeed && usableSpeed > maxSpeedRef.current) {
            maxSpeedRef.current = usableSpeed;
            setMaxSpeed(usableSpeed);
            // Sauvegarde asynchrone avec gestion d'erreur silencieuse
            safeSetItem('maxSpeed', usableSpeed.toString(), { silent: true });
          }

          detectStop(coords.speed);
        } else {
          safeSmoothSpeed(0);
          setCurrentSpeed(0);
        }

        if (coords.altitude !== undefined && coords.altitude !== null) {
          setAltitudeData((prev) => {
            const newAlt = [...prev, coords.altitude];
            // Sauvegarde asynchrone avec gestion d'erreur silencieuse
            safeSetItem('altitudeData', newAlt, { silent: true });
            return newAlt;
          });
        }
      } catch (error) {
        console.error('Erreur traitement point GPS:', error);
      }
    },
    [
      safeApplyKalmanFilter,
      appendTrackingPoint,
      detectStop,
      safeGetBearing,
      incrementTotalPoints,
      recordRejectedPoint,
      setAltitudeData,
      setMaxSpeed,
      setCurrentSpeed,
      setCurrentSpeed,
      resolveSpeedForMax,
      shouldSamplePoint,
      safeSmoothSpeed,
      validateAndFilterPoint,
    ],
  );

  return { handleLocationUpdate };
};

export default useLocationTracking;

