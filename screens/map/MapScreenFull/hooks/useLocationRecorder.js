import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { getDistance } from 'geolib';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeSetItem } from '../utils/asyncStorageWithLoading';
import {
  setLocationCallback,
  getQueuedLocations,
  clearLocationQueue,
  checkTrackingHealth,
  restartLocationTracking,
  getLastLocationTime,
  isLocationTrackingActive,
} from '../../../../services/BackgroundLocationService';
import logger from '../../../../utils/logger';

const STILL_SPEED_THRESHOLD = 1; // km/h
const SPIKE_SPEED_THRESHOLD = 5; // km/h
const SPIKE_CONFIRM_WINDOW_MS = 3000;

// Intervalle de polling de la queue : IDENTIQUE en background et foreground
// Pour avoir exactement le même comportement dans les deux modes
const QUEUE_POLL_INTERVAL = 100; // 100ms partout pour traitement identique
const QUEUE_POLL_INTERVAL_STARTUP = 50; // 50ms pendant les 5 premières secondes pour éviter le délai initial

// Intervalle de vérification de santé (30 secondes)
const HEALTH_CHECK_INTERVAL = 30000;

// Temps maximum sans location avant auto-restart (60 secondes)
const MAX_SILENCE_MS = 60000;

// ✅ FIX #2: Heartbeat check pour détecter TaskManager mort
const HEARTBEAT_CHECK_INTERVAL = 10000; // Vérifier toutes les 10s
const MAX_HEARTBEAT_AGE = 60000; // Max 60s sans heartbeat (augmenté pour éviter faux positifs)

/**
 * Hook pour enregistrer les locations GPS depuis la queue TaskManager
 * Remplace useLocationTracking avec un système unifié basé sur polling
 */
const useLocationRecorder = ({
  isTrackingRef,
  isPaused,
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
  setCurrentLocation,
  startTime, // Timestamp de début de session
  isTracking, // ✅ FIX: État réactif pour le useEffect
}) => {
  const lastStableSpeedRef = useRef(0);
  const pendingSpikeRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const healthCheckIntervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const isProcessingRef = useRef(false);
  const trackingStartTimeRef = useRef(null); // Timestamp de démarrage du tracking

  // Détection d'immobilité
  const stationaryPointsBufferRef = useRef([]); // Buffer des 3 derniers points pour détecter immobilité
  const isStationaryModeRef = useRef(false); // Mode "arrêté" actif
  const lastRecordedPointRef = useRef(null); // Dernier point enregistré (pour détecter reprise)
  const stationaryModeStartTimeRef = useRef(null); // Timestamp de début du mode stationnaire
  const resumeSpeedBufferRef = useRef([]); // Buffer de vitesse pour détecter reprise stable

  // Buffer de confirmation : garder 3-5 derniers points suspect en tampon
  const confirmationBufferRef = useRef([]); // Buffer des points en attente de confirmation
  const MAX_CONFIRMATION_BUFFER = 5;

  // Gestion perte de signal tunnels
  const lastLocationTimeRef = useRef(Date.now()); // Timestamp de la dernière location reçue
  const estimatedSegmentsRef = useRef([]); // Segments estimés (perte de signal > 30s)

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

  const processLocation = useCallback(
    (loc) => {
      if (!isTrackingRef.current || isPaused) {
        return;
      }

      try {
        const processStartTime = Date.now();
        const { coords } = loc ?? {};

        // Log pour voir quand processLocation est appelé
        if (!processLocation.callCount) processLocation.callCount = 0;
        processLocation.callCount++;
        if (processLocation.callCount % 10 === 0 || processLocation.callCount === 1) {
          logger.log(`📥 processLocation appelé (appState: ${appStateRef.current}, call #${processLocation.callCount})`, 'LocationRecorder');
        }
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
          logger.warn(`Coordonnées GPS invalides: ${JSON.stringify(coords)}`, 'LocationRecorder');
          return;
        }

        // Validation supplémentaire des coordonnées
        if (Math.abs(coords.latitude) > 90 || Math.abs(coords.longitude) > 180) {
          logger.warn(`Coordonnées GPS hors limites: ${JSON.stringify(coords)}`, 'LocationRecorder');
          return;
        }

        const pointTimestamp = loc?.timestamp || Date.now();

        // 🛡️ FILTRE ANTI-ZOMBIE : Ignorer les points antérieurs au début de la session
        // On laisse une marge de 2 secondes pour les délais de transmission
        if (startTime && pointTimestamp < (startTime - 2000)) {
          logger.warn(`👻 Point zombie ignoré: ${new Date(pointTimestamp).toLocaleTimeString()} < Start: ${new Date(startTime).toLocaleTimeString()}`, 'LocationRecorder');
          return;
        }

        // Initialiser si premier point
        if (!lastLocationTimeRef.current || lastLocationTimeRef.current === 0) {
          lastLocationTimeRef.current = pointTimestamp;
        }
        const timeSinceLastLocation = pointTimestamp - lastLocationTimeRef.current;
        lastLocationTimeRef.current = pointTimestamp;

        // GESTION TUNNELS / PERTE DE SIGNAL
        let isEstimatedPoint = false;
        // Vérifier perte de signal seulement si temps significatif (ignore les petites variations normales)
        if (timeSinceLastLocation > 3000 && timeSinceLastLocation <= 30000) {
          // Perte de signal < 30s : interpolation linéaire
          if (lastRecordedPointRef.current) {
            // Créer des points intermédiaires par interpolation linéaire
            const interpolatedPoints = [];
            const lastPoint = lastRecordedPointRef.current;
            const numInterpolated = Math.min(Math.floor(timeSinceLastLocation / 1000), 10); // Max 10 points

            if (numInterpolated > 0) {
              for (let i = 1; i <= numInterpolated; i += 1) {
                const ratio = i / (numInterpolated + 1);
                const interpolatedPoint = {
                  latitude: lastPoint.latitude + (coords.latitude - lastPoint.latitude) * ratio,
                  longitude: lastPoint.longitude + (coords.longitude - lastPoint.longitude) * ratio,
                  timestamp: lastPoint.timestamp + (timeSinceLastLocation * ratio),
                  speed: coords.speed || 0,
                  altitude: coords.altitude || 0,
                  interpolated: true, // Marquer comme interpolé
                };
                interpolatedPoints.push(interpolatedPoint);
              }

              // Ajouter les points interpolés
              interpolatedPoints.forEach((interpPoint) => {
                const interpKalman = safeApplyKalmanFilter(interpPoint.latitude, interpPoint.longitude);
                const interpProcessed = {
                  ...interpPoint,
                  latitude: interpKalman.latitude,
                  longitude: interpKalman.longitude,
                  segmentIndex: currentSegmentIndexRef.current || 0,
                };

                const interpBearing = safeGetBearing(
                  { latitude: lastPoint.latitude, longitude: lastPoint.longitude },
                  { latitude: interpProcessed.latitude, longitude: interpProcessed.longitude },
                );

                const interpPointWithHeading = {
                  ...interpProcessed,
                  heading: interpBearing,
                };

                appendTrackingPoint(interpPointWithHeading);
              });
            }
          }
        } else if (timeSinceLastLocation > 30000) {
          // Perte de signal > 30s : segment estimé (marquer pointillés)
          isEstimatedPoint = true;

          // Créer un segment estimé
          if (lastRecordedPointRef.current) {
            const estimatedSegment = {
              startPoint: lastRecordedPointRef.current,
              endPoint: null, // Sera mis à jour avec le point actuel
              duration: timeSinceLastLocation,
              estimated: true,
            };

            estimatedSegmentsRef.current.push(estimatedSegment);

            // Marquer le dernier point avant perte
            if (trackingPointsRef.current.length > 0) {
              const lastPointIndex = trackingPointsRef.current.length - 1;
              trackingPointsRef.current[lastPointIndex] = {
                ...trackingPointsRef.current[lastPointIndex],
                isEstimatedSegmentStart: true,
              };
            }
          }
        }

        const rawPoint = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          timestamp: loc?.timestamp || Date.now(),
          speed: coords.speed || 0,
          altitude: coords.altitude || 0,
          isEstimated: isEstimatedPoint, // Marquer comme estimé si perte > 30s
        };

        const kalmanFiltered = safeApplyKalmanFilter(rawPoint.latitude, rawPoint.longitude);
        const processedPoint = {
          ...rawPoint,
          latitude: kalmanFiltered.latitude,
          longitude: kalmanFiltered.longitude,
        };

        // ⚡ UPDATE UI IMMEDIATEMENT (Zero Latency)
        // On met à jour la position affichée AVANT tout traitement lourd ou validation
        if (typeof setCurrentLocation === 'function') {
          let tempHeading = 0;
          if (lastRecordedPointRef.current) {
            tempHeading = safeGetBearing(lastRecordedPointRef.current, processedPoint);
          }
          // Mise à jour immédiate pour fluidité maximale
          setCurrentLocation({ ...processedPoint, heading: tempHeading });
        }

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

        // FILTRE E : Détection d'immobilité
        // Vérifier si vitesse < 2 km/h
        if (currentSpeedKmh < 2) {
          // Ajouter à buffer de points stationnaires
          stationaryPointsBufferRef.current.push({
            point: processedPoint,
            speed: currentSpeedKmh,
            timestamp: processedPoint.timestamp,
          });

          // Garder seulement les 3 derniers points
          if (stationaryPointsBufferRef.current.length > 3) {
            stationaryPointsBufferRef.current.shift();
          }

          // Si 3 points consécutifs stationnaires, activer mode arrêté
          if (stationaryPointsBufferRef.current.length >= 3 && !isStationaryModeRef.current) {
            isStationaryModeRef.current = true;
            stationaryModeStartTimeRef.current = Date.now();

            // Enregistrer un point "stop" avec timestamp
            const stopPoint = {
              ...processedPoint,
              isStopPoint: true,
              stopTimestamp: processedPoint.timestamp,
            };
            appendTrackingPoint(stopPoint);
            lastRecordedPointRef.current = stopPoint;

            logger.log('Mode arrêté activé', 'LocationRecorder');
            return; // Ne plus enregistrer de points en mode arrêté
          }

          // Si déjà en mode arrêté, ne rien enregistrer
          if (isStationaryModeRef.current) {
            return;
          }
        } else {
          // Vitesse > 2 km/h : vérifier reprise depuis mode arrêté
          if (isStationaryModeRef.current) {
            // Ajouter vitesse au buffer de reprise
            resumeSpeedBufferRef.current.push({
              speed: currentSpeedKmh,
              timestamp: processedPoint.timestamp,
            });

            // Garder seulement les vitesses des 2 dernières secondes
            const now = Date.now();
            resumeSpeedBufferRef.current = resumeSpeedBufferRef.current.filter(
              (entry) => now - entry.timestamp < 2000
            );

            // Vérifier distance depuis dernier point enregistré
            let shouldResume = false;
            if (lastRecordedPointRef.current) {
              const distanceToLast = getDistance(
                { latitude: lastRecordedPointRef.current.latitude, longitude: lastRecordedPointRef.current.longitude },
                { latitude: processedPoint.latitude, longitude: processedPoint.longitude },
              );

              if (distanceToLast > 15) {
                shouldResume = true; // Distance > 15m → reprise
              }
            }

            // Vérifier si vitesse > 5 km/h stable sur 2s
            if (!shouldResume && resumeSpeedBufferRef.current.length >= 2) {
              const allSpeedsAboveThreshold = resumeSpeedBufferRef.current.every(
                (entry) => entry.speed > 5
              );
              if (allSpeedsAboveThreshold) {
                shouldResume = true; // Vitesse > 5 km/h stable → reprise
              }
            }

            if (shouldResume) {
              isStationaryModeRef.current = false;
              stationaryPointsBufferRef.current = [];
              resumeSpeedBufferRef.current = [];
              stationaryModeStartTimeRef.current = null;
              logger.log('Reprise depuis mode arrêté', 'LocationRecorder');
              // Continuer pour enregistrer le point actuel
            } else {
              return; // Pas encore de reprise
            }
          } else {
            // Pas en mode arrêté : vider le buffer de points stationnaires
            stationaryPointsBufferRef.current = [];
          }
        }
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

        // Préparer les données de qualité GPS pour les filtres
        // Identique en background et foreground
        const gpsQuality = {
          accuracy: coords.accuracy ?? null,
          satellites: coords.satellites ?? null, // Peut ne pas être disponible sur toutes les plateformes
        };

        // Valider les points en attente dans le buffer de confirmation si le nouveau point confirme la trajectoire
        const validatedFromBuffer = [];
        if (confirmationBufferRef.current.length > 0) {
          // Vérifier si le nouveau point confirme la trajectoire des points en attente
          const lastPendingPoint = confirmationBufferRef.current[confirmationBufferRef.current.length - 1];

          // Calculer l'angle entre le dernier point en attente et le nouveau point
          const bearingFromPending = safeGetBearing(
            { latitude: lastPendingPoint.point.latitude, longitude: lastPendingPoint.point.longitude },
            { latitude: pointWithSegment.latitude, longitude: pointWithSegment.longitude },
          );

          // Calculer l'angle entre l'avant-dernier point en attente et le dernier point en attente
          let bearingFromPrevPending = null;
          if (confirmationBufferRef.current.length >= 2) {
            const prevPendingPoint = confirmationBufferRef.current[confirmationBufferRef.current.length - 2];
            bearingFromPrevPending = safeGetBearing(
              { latitude: prevPendingPoint.point.latitude, longitude: prevPendingPoint.point.longitude },
              { latitude: lastPendingPoint.point.latitude, longitude: lastPendingPoint.point.longitude },
            );
          }

          // Si les angles sont cohérents (différence < 45°), valider les points en attente
          if (bearingFromPrevPending === null || Math.abs(bearingFromPending - bearingFromPrevPending) < 45 ||
            (Math.abs(bearingFromPending - bearingFromPrevPending) > 315)) {
            // Valider tous les points en attente
            validatedFromBuffer.push(...confirmationBufferRef.current);
            confirmationBufferRef.current = [];
          }
        }

        // Log avant validation
        logger.log(`🔍 Validation point: lat=${pointWithSegment.latitude?.toFixed(6)}, lng=${pointWithSegment.longitude?.toFixed(6)}, acc=${gpsQuality.accuracy?.toFixed(1)}m, sats=${gpsQuality.satellites || 'N/A'}`, 'LocationRecorder');

        const validation = validateAndFilterPoint(pointWithSegment, trackingPointsRef.current, segmentIndex, gpsQuality);

        // Log résultat validation
        if (!validation.isValid) {
          logger.warn(`❌ Point rejeté: ${validation.reason} (lat=${pointWithSegment.latitude?.toFixed(6)}, lng=${pointWithSegment.longitude?.toFixed(6)})`, 'LocationRecorder');
        }

        // Déterminer si le point est suspect (peut être validé rétroactivement)
        const isSuspiciousPoint = !validation.isValid && (
          validation.reason === 'sharp_zigzag' ||
          validation.reason === 'zigzag_close' ||
          validation.reason === 'zigzag_noise' ||
          validation.reason === 'speed_incoherence'
        );

        if (!validation.isValid && !isSuspiciousPoint) {
          // Point clairement invalide : rejeter définitivement
          const coordsInfo = coords ? `lat=${coords.latitude?.toFixed(6)}, lng=${coords.longitude?.toFixed(6)}, acc=${coords.accuracy?.toFixed(1)}m` : 'no coords';
          logger.log(
            `⏭️ Point rejeté: ${validation.reason} (${coordsInfo}, appState: ${appStateRef.current})`,
            'LocationRecorder',
            validation.distance ? `distance: ${validation.distance}m` : '',
          );
          recordRejectedPoint();
          return;
        }

        if (isSuspiciousPoint) {
          // Point suspect : ajouter au buffer de confirmation
          confirmationBufferRef.current.push({
            point: pointWithSegment,
            validation,
            timestamp: processedPoint.timestamp,
          });

          // Limiter la taille du buffer
          if (confirmationBufferRef.current.length > MAX_CONFIRMATION_BUFFER) {
            // Rejeter le plus ancien point suspect si le buffer est plein
            const oldestPending = confirmationBufferRef.current.shift();
            logger.log(`⏭️ Point suspect rejeté (buffer plein): ${oldestPending.validation.reason}`, 'LocationRecorder');
            recordRejectedPoint();
          }

          // Ne pas valider immédiatement, attendre le point suivant
          return;
        }

        // Point valide : traiter normalement
        // D'abord valider et ajouter les points du buffer si cohérents
        if (validatedFromBuffer.length > 0) {
          validatedFromBuffer.forEach((buffered) => {
            const lastRecorded = trackingPointsRef.current.length > 0
              ? trackingPointsRef.current[trackingPointsRef.current.length - 1]
              : null;

            if (lastRecorded) {
              const bearing = safeGetBearing(
                { latitude: lastRecorded.latitude, longitude: lastRecorded.longitude },
                { latitude: buffered.point.latitude, longitude: buffered.point.longitude },
              );

              const pointWithHeading = {
                ...buffered.point,
                heading: bearing,
                confirmedFromBuffer: true,
              };

              appendTrackingPoint(pointWithHeading);
              lastRecordedPointRef.current = pointWithHeading;
            }
          });
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

        // Log pour chaque point accepté (mais pas trop souvent pour éviter spam)
        if (!processLocation.lastAcceptedLog || (Date.now() - processLocation.lastAcceptedLog > 2000)) {
          const coordsInfo = coords ? `lat=${coords.latitude?.toFixed(6)}, lng=${coords.longitude?.toFixed(6)}, acc=${coords.accuracy?.toFixed(1)}m, speed=${coords.speed ? (coords.speed * 3.6).toFixed(1) : 'N/A'}km/h` : 'no coords';
          logger.log(`✅ Point accepté: ${coordsInfo} (appState: ${appStateRef.current}, total: ${trackingPointsRef.current.length + 1})`, 'LocationRecorder');
          processLocation.lastAcceptedLog = Date.now();
        }

        appendTrackingPoint(pointWithHeading);
        lastRecordedPointRef.current = pointWithHeading; // Mettre à jour dernier point enregistré

        if (coords.speed !== null && coords.speed !== undefined) {
          const { raw: rawKmh } = safeSmoothSpeed(coords.speed);
          const instantKmh = Number.isFinite(rawKmh) ? rawKmh : coords.speed * 3.6;
          const usableSpeed = resolveSpeedForMax(instantKmh, pointWithSegment.timestamp);

          // Toujours mettre à jour la vitesse actuelle pour l'UI
          setCurrentSpeed(instantKmh);

          // Mettre à jour la fréquence adaptative selon vitesse
          // Utiliser debounce pour éviter trop de redémarrages
          if (Math.abs(instantKmh - lastStableSpeedRef.current) > 10) {
            // Plus de mise à jour de fréquence - fixe à 3 Hz
            // updateLocationFrequency(instantKmh).catch((err) => {
            //   logger.warn(`Erreur mise à jour fréquence: ${err?.message || err}`, 'LocationRecorder');
            // });
          }

          if (usableSpeed && usableSpeed > maxSpeedRef.current) {
            maxSpeedRef.current = usableSpeed;
            setMaxSpeed(usableSpeed);
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
            safeSetItem('altitudeData', newAlt, { silent: true });
            return newAlt;
          });
        }
      } catch (error) {
        logger.error('Erreur traitement point GPS', error, 'LocationRecorder');
      }
    },
    [
      isTrackingRef,
      isPaused,
      safeApplyKalmanFilter,
      appendTrackingPoint,
      detectStop,
      safeGetBearing,
      incrementTotalPoints,
      recordRejectedPoint,
      setAltitudeData,
      setMaxSpeed,
      setCurrentSpeed,
      resolveSpeedForMax,
      shouldSamplePoint,
      safeSmoothSpeed,
      validateAndFilterPoint,
    ],
  );

  // ⚡ NOUVEAU: S'enregistrer pour recevoir les callbacks GPS directs
  useEffect(() => {
    // Utiliser isTracking (état) pour l'activation/désactivation
    // Utiliser isTrackingRef (ref) pour la logique interne du callback
    if (!isTracking || isPaused) {
      // Désinscrire le callback si tracking arrêté/pause
      setLocationCallback(null);
      return;
    }

    // S'inscrire pour recevoir les locations directement
    logger.log('📡 Inscription au callback GPS direct', 'LocationRecorder');
    setLocationCallback((location) => {
      processLocation(location);
    });

    return () => {
      logger.log('📡 Désinscription du callback GPS', 'LocationRecorder');
      setLocationCallback(null);
    };
  }, [isTracking, isPaused, processLocation]);

  // ✅ FIX #2: Vérifier heartbeat TaskManager toutes les 5s
  useEffect(() => {
    if (!isTrackingRef.current || isPaused) {
      return;
    }

    const heartbeatInterval = setInterval(async () => {
      try {
        const heartbeatStr = await AsyncStorage.getItem('tracking_heartbeat');

        if (!heartbeatStr) {
          logger.error('❌ HEARTBEAT: Aucun heartbeat trouvé', 'LocationRecorder');
          return;
        }

        const lastHeartbeat = parseInt(heartbeatStr, 10);
        const now = Date.now();
        const age = now - lastHeartbeat;

        if (age > MAX_HEARTBEAT_AGE) {
          logger.warn(`⚠️ HEARTBEAT: TaskManager inactif (${age}ms), tentative de REDÉMARRAGE...`, 'LocationRecorder');
          await restartLocationTracking();
        } else {
          // Log seulement toutes les 30s pour éviter spam
          if (age > 7000) { // Proche de la limite
            logger.log(`⚠️ HEARTBEAT: ${age}ms (proche limite 10s)`, 'LocationRecorder');
          }
        }
      } catch (error) {
        logger.error('Erreur heartbeat check', error, 'LocationRecorder');
      }
    }, HEARTBEAT_CHECK_INTERVAL);

    return () => clearInterval(heartbeatInterval);
  }, [isTrackingRef.current, isPaused]);

  // Gérer les transitions AppState : drainer la queue quand l'app revient au foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;

      // Transition vers background : même polling qu'en foreground (pas de changement)
      if (previousState === 'active' && nextAppState.match(/inactive|background/)) {
        if (isTrackingRef.current && !isPaused) {
          const transitionTime = Date.now();
          logger.log(`🔄 Transition → BACKGROUND à ${new Date(transitionTime).toLocaleTimeString()}`, 'LocationRecorder');

          // CRITIQUE : Sauvegarder les points avant de passer en background
          if (trackingPointsRef.current && trackingPointsRef.current.length > 0) {
            const pointsJson = JSON.stringify(trackingPointsRef.current);
            try {
              await Promise.all([
                AsyncStorage.setItem('trackingPoints', pointsJson),
                AsyncStorage.setItem('trackingPoints_backup', pointsJson),
              ]);
              logger.log(`💾 Points sauvegardés avant background (${trackingPointsRef.current.length} points)`, 'LocationRecorder');
            } catch (err) {
              logger.error('Erreur sauvegarde avant background', err, 'LocationRecorder');
              // Dernière tentative : au moins le backup
              try {
                await AsyncStorage.setItem('trackingPoints_backup', pointsJson);
                logger.log('💾 Backup sauvegardé avant background', 'LocationRecorder');
              } catch (backupErr) {
                logger.error('Erreur sauvegarde backup avant background', backupErr, 'LocationRecorder');
              }
            }
          }

          // Vérifier l'état du TaskManager avant transition
          const isTaskActive = await isLocationTrackingActive();
          const lastTime = await getLastLocationTime();
          logger.log(`   TaskManager actif: ${isTaskActive}`, 'LocationRecorder');
          if (lastTime) {
            const timeSinceLast = transitionTime - lastTime;
            logger.log(`   Dernière location: ${timeSinceLast < 60000 ? `${Math.floor(timeSinceLast / 1000)}s` : `${Math.floor(timeSinceLast / 60000)}min`} ago`, 'LocationRecorder');
          }

          // Plus de polling - callback direct continue en background
          logger.log('   Callback GPS continue en background', 'LocationRecorder');
        }
      }

      // Transition vers foreground : drainer immédiatement toute la queue accumulée
      if (
        previousState.match(/inactive|background/)
        && nextAppState === 'active'
        && isTrackingRef.current
        && !isPaused
      ) {
        const transitionTime = Date.now();
        logger.log(`🔄 Transition → FOREGROUND à ${new Date(transitionTime).toLocaleTimeString()}`, 'LocationRecorder');

        // Vérifier l'état du TaskManager après retour
        const isTaskActive = await isLocationTrackingActive();
        const lastTime = await getLastLocationTime();
        logger.log(`   TaskManager actif: ${isTaskActive}`, 'LocationRecorder');
        if (lastTime) {
          const timeSinceLast = transitionTime - lastTime;
          const minutesSinceLast = Math.floor(timeSinceLast / 60000);
          const secondsSinceLast = Math.floor((timeSinceLast % 60000) / 1000);
          logger.log(`   Dernière location: ${minutesSinceLast > 0 ? `${minutesSinceLast}min ` : ''}${secondsSinceLast}s ago`, 'LocationRecorder');

          if (timeSinceLast > 120000) { // Plus de 2 minutes
            logger.warn(`⚠️ ⚠️ ⚠️ PAS DE POINTS DEPUIS ${Math.floor(timeSinceLast / 60000)} MINUTES !`, 'LocationRecorder');
          }
        }

        logger.log('   Démarrage drainage complet de la queue...', 'LocationRecorder');

        // Drainer la queue plusieurs fois pour s'assurer de tout récupérer
        // (au cas où il y aurait beaucoup de points accumulés)
        let attempts = 0;
        const maxAttempts = 10; // Max 10 tentatives

        while (attempts < maxAttempts) {
          const queuedLocations = await getQueuedLocations();

          if (queuedLocations.length === 0) {
            logger.log(`✅ Queue vide après ${attempts} tentative(s)`, 'LocationRecorder');
            break; // Queue vide, on a tout récupéré
          }

          logger.log(`🔄 Drainage tentative ${attempts + 1}/${maxAttempts}: ${queuedLocations.length} point(s) en attente`, 'LocationRecorder');

          // Traiter toutes les locations
          const processStartTime = Date.now();
          let processedCount = 0;
          for (const location of queuedLocations) {
            processLocation(location);
            processedCount++;
          }

          const processDuration = Date.now() - processStartTime;
          logger.log(`   ${processedCount} point(s) traité(s) en ${processDuration}ms`, 'LocationRecorder');

          // Vider la queue après traitement
          await clearLocationQueue();

          attempts += 1;

          // Si beaucoup de points, faire une petite pause pour éviter de bloquer l'UI
          if (queuedLocations.length > 50) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }

        // Callback GPS direct actif automatiquement
        logger.log('   Drainage terminé, callback GPS actif', 'LocationRecorder');

        // Vérifier l'état final
        const finalTaskActive = await isLocationTrackingActive();
        const finalLastTime = await getLastLocationTime();
        const finalTimeSinceLast = finalLastTime ? Date.now() - finalLastTime : null;
        logger.log(`✅ Retour en foreground terminé`, 'LocationRecorder');
        logger.log(`   TaskManager actif: ${finalTaskActive}`, 'LocationRecorder');
        if (finalLastTime && finalTimeSinceLast !== null) {
          logger.log(`   Dernière location: ${finalTimeSinceLast < 60000 ? `${Math.floor(finalTimeSinceLast / 1000)}s` : `${Math.floor(finalTimeSinceLast / 60000)}min`} ago`, 'LocationRecorder');

          if (finalTimeSinceLast > 120000) { // Plus de 2 minutes
            logger.warn(`⚠️ ⚠️ ⚠️ PROBLÈME: PAS DE POINTS DEPUIS ${Math.floor(finalTimeSinceLast / 60000)} MINUTES !`, 'LocationRecorder');
          }
        } else {
          logger.warn(`⚠️ Aucune location enregistrée depuis le démarrage`, 'LocationRecorder');
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isTrackingRef, isPaused, processLocation]);

  // Drainer la queue au montage si tracking actif (fallback pour données anciennes)
  useEffect(() => {
    if (isTrackingRef.current && !isPaused) {
      // Drainer queue legacy si elle existe
      getQueuedLocations().then(locations => {
        if (locations.length > 0) {
          logger.log(`🔄 Drainage queue legacy: ${locations.length} points`, 'LocationRecorder');
          locations.forEach(loc => processLocation(loc));
          clearLocationQueue();
        }
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    handleLocationUpdate: processLocation, // Compatibilité avec l'ancien système
  };
};

export default useLocationRecorder;

