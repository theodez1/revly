import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Linking, AppState } from 'react-native';
import * as Location from 'expo-location';
import {
  safeGetItem,
  safeSetItem,
  safeMultiGet,
} from '../screens/map/MapScreenFull/utils/asyncStorageWithLoading';
import useLoadingState from '../screens/map/MapScreenFull/hooks/useLoadingState';
import {
  calculateDistance,
  calculateSpeed,
  calculateBearing,
  filterGPSPoint,
  detectPause,
  calculateCalories,
} from '../screens/map/MapScreenFull/utils/trackingUtils';

import { useTracking } from './TrackingContext';
import useTrackingPoints, {
  SEGMENTS_STORAGE_KEY,
  BG_LAST_SYNC_KEY,
  getBearing,
} from '../screens/map/MapScreenFull/hooks/useTrackingPoints';
import useTripTimer from '../screens/map/MapScreenFull/hooks/useTripTimer';
import useTripMetrics from '../screens/map/MapScreenFull/hooks/useTripMetrics';
import useKalmanFilters from '../screens/map/MapScreenFull/hooks/useKalmanFilters';
import useLocationRecorder from '../screens/map/MapScreenFull/hooks/useLocationRecorder';
import useTrackingSession from '../screens/map/MapScreenFull/hooks/useTrackingSession';
import useTrackingPersistence from '../screens/map/MapScreenFull/hooks/useTrackingPersistence';
import {
  hasStartedBackgroundLocationUpdatesAsync,
} from '../services/BackgroundLocationService';

const TrackingEngineContext = createContext(null);

const TIMER_STORAGE_KEY = '@tripTimerState_v2';

const defaultAnimationHandlers = {
  animateStartButtonOut: () => { },
  animateControlsIn: () => { },
  animateControlsOut: () => { },
  animateStartButtonIn: () => { },
  startPulseAnimation: () => { },
  stopPulseAnimation: () => { },
};

export const TrackingEngineProvider = ({ children }) => {
  const { setTrackingStatus } = useTracking();

  // Gestion centralisée des états de chargement
  const loadingState = useLoadingState({ initialState: false });

  const [isTracking, setIsTracking] = useState(false);
  const isTrackingRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);

  const [locationPermission, setLocationPermission] = useState(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const hasAskedPermissionRef = useRef(false);

  const [backgroundStatus, setBackgroundStatus] = useState('unknown');
  const [lastHeartbeat, setLastHeartbeat] = useState(null);

  const syncBackgroundLocationsRef = useRef(null);
  const hasHydratedTrackingRef = useRef(false);
  // speedWatchRef conservé pour compatibilité avec l'API publique mais non utilisé
  const speedWatchRef = useRef(null);
  const pauseToggleInProgressRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  const {
    currentLocation,
    setCurrentLocation,
    trackingPoints,
    trackingPointsRef,
    segmentStartIndices,
    updateSegmentStarts,
    segmentStartIndicesRef,
    currentSegmentIndexRef,
    lastBgSyncRef,
    setLastSampledPoint,
    setLastSampledTime,
    lastSampledBearing,
    setLastSampledBearing,
    trackingSegments,
    activeRouteSegments,
    simplifiedPoints,
    compressedPolyline,
    appendTrackingPoint,
    incrementTotalPoints,
    recordRejectedPoint,
    flattenSegments: flattenSegmentsFromHook,
    resetTrackingState,
    restoreTrackingState,
    getSegmentIndexForPosition: getSegmentIndexForPositionFromHook,
    compressPolyline: compressPolylineFromHook,
    decompressPolyline: decompressPolylineFromHook,
    shouldSamplePoint,
    validateAndFilterPoint,
  } = useTrackingPoints();

  const flattenSegments = useCallback(
    (segments) => {
      if (typeof flattenSegmentsFromHook === 'function') {
        return flattenSegmentsFromHook(segments);
      }
      if (!Array.isArray(segments) || segments.length === 0) {
        return [];
      }
      return segments.reduce((accumulator, segment) => {
        if (Array.isArray(segment) && segment.length > 0) {
          accumulator.push(...segment);
        }
        return accumulator;
      }, []);
    },
    [flattenSegmentsFromHook],
  );

  const getSegmentIndexForPosition = useCallback(
    (pointIndex) => {
      if (typeof getSegmentIndexForPositionFromHook === 'function') {
        return getSegmentIndexForPositionFromHook(pointIndex);
      }
      if (!Number.isFinite(pointIndex) || pointIndex < 0) {
        return 0;
      }
      return 0;
    },
    [getSegmentIndexForPositionFromHook],
  );

  const compressPolyline = useCallback(
    (points) => {
      if (typeof compressPolylineFromHook === 'function') {
        return compressPolylineFromHook(points);
      }
      return '';
    },
    [compressPolylineFromHook],
  );

  const decompressPolyline = useCallback(
    (encoded) => {
      if (typeof decompressPolylineFromHook === 'function') {
        return decompressPolylineFromHook(encoded);
      }
      return [];
    },
    [decompressPolylineFromHook],
  );

  const tripTimer = useTripTimer();
  const {
    seconds: timerSeconds,
    start: startTripTimer,
    pause: pauseTripTimer,
    resume: resumeTripTimer,
    stop: stopTripTimer,
    reset: resetTripTimer,
    hydrate: hydrateTimerState,
    getElapsedSeconds,
  } = tripTimer;

  const {
    startTime,
    setStartTime,
    maxSpeed,
    setMaxSpeed: setMaxSpeedFromMetrics,
    maxSpeedRef,
    totalStops,
    setTotalStops: setTotalStopsFromMetrics,
    totalStopTime,
    setTotalStopTime: setTotalStopTimeFromMetrics,
    lastStopTime,
    setLastStopTime: setLastStopTimeFromMetrics,
    isStopped,
    setIsStopped: setIsStoppedFromMetrics,
    altitudeData,
    setAltitudeData: setAltitudeDataFromMetrics,
    drivingScore,
    setDrivingScore: setDrivingScoreFromMetrics,
    currentSpeed,
    setCurrentSpeed: setCurrentSpeedFromMetrics,
    smoothedSpeed,
    setSmoothedSpeed: setSmoothedSpeedFromMetrics,
    speedHistory,
    setSpeedHistory: setSpeedHistoryFromMetrics,
    totalDistance,
    formatDisplaySpeed,
    detectStop,
    scheduleInactivityPrompt,
    resetInactivityTracking,
    showInactivityPrompt,
    setShowInactivityPrompt,
    inactiveDurationMs,
    setInactiveDurationMs,
    inactivityAlertShownRef,
    INACTIVITY_SPEED_THRESHOLD_KMH,
    INACTIVITY_DURATION_MS,
    timeText,
    formatTripTime,
    calculateElevationGain,
    getCurrentTripTime,
  } = useTripMetrics({
    trackingPoints,
    timerSeconds,
    getElapsedSeconds,
    isPaused,
  });

  const setMaxSpeed = useCallback(
    (...args) => {
      if (typeof setMaxSpeedFromMetrics === 'function') {
        return setMaxSpeedFromMetrics(...args);
      }
      return undefined;
    },
    [setMaxSpeedFromMetrics],
  );

  const setTotalStops = useCallback(
    (...args) => {
      if (typeof setTotalStopsFromMetrics === 'function') {
        return setTotalStopsFromMetrics(...args);
      }
      return undefined;
    },
    [setTotalStopsFromMetrics],
  );

  const setTotalStopTime = useCallback(
    (...args) => {
      if (typeof setTotalStopTimeFromMetrics === 'function') {
        return setTotalStopTimeFromMetrics(...args);
      }
      return undefined;
    },
    [setTotalStopTimeFromMetrics],
  );

  const setLastStopTime = useCallback(
    (...args) => {
      if (typeof setLastStopTimeFromMetrics === 'function') {
        return setLastStopTimeFromMetrics(...args);
      }
      return undefined;
    },
    [setLastStopTimeFromMetrics],
  );

  const setIsStopped = useCallback(
    (...args) => {
      if (typeof setIsStoppedFromMetrics === 'function') {
        return setIsStoppedFromMetrics(...args);
      }
      return undefined;
    },
    [setIsStoppedFromMetrics],
  );

  const setAltitudeData = useCallback(
    (...args) => {
      if (typeof setAltitudeDataFromMetrics === 'function') {
        return setAltitudeDataFromMetrics(...args);
      }
      return undefined;
    },
    [setAltitudeDataFromMetrics],
  );

  const setDrivingScore = useCallback(
    (...args) => {
      if (typeof setDrivingScoreFromMetrics === 'function') {
        return setDrivingScoreFromMetrics(...args);
      }
      return undefined;
    },
    [setDrivingScoreFromMetrics],
  );

  const setCurrentSpeed = useCallback(
    (...args) => {
      if (typeof setCurrentSpeedFromMetrics === 'function') {
        return setCurrentSpeedFromMetrics(...args);
      }
      return undefined;
    },
    [setCurrentSpeedFromMetrics],
  );

  const setSmoothedSpeed = useCallback(
    (...args) => {
      if (typeof setSmoothedSpeedFromMetrics === 'function') {
        return setSmoothedSpeedFromMetrics(...args);
      }
      return undefined;
    },
    [setSmoothedSpeedFromMetrics],
  );

  const setSpeedHistory = useCallback(
    (...args) => {
      if (typeof setSpeedHistoryFromMetrics === 'function') {
        return setSpeedHistoryFromMetrics(...args);
      }
      return undefined;
    },
    [setSpeedHistoryFromMetrics],
  );

  const [tripName, setTripName] = useState('');
  const [tripDescription, setTripDescription] = useState('');
  const [showTripSummary, setShowTripSummary] = useState(false);
  const [showStepsEditor, setShowStepsEditor] = useState(false);
  const [tripSteps, setTripSteps] = useState([]);

  const { applyKalmanFilter, smoothSpeed, resetKalmanFilters } = useKalmanFilters({
    formatDisplaySpeed,
    setCurrentSpeed,
    setSmoothedSpeed,
    setSpeedHistory,
    speedHistory,
  });

  const { handleLocationUpdate } = useLocationRecorder({
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
    setCurrentLocation,
    startTime, // Passer le startTime pour filtrer les vieux points
    isTracking, // ✅ FIX: Passer l'état isTracking pour la dépendance du useEffect
  });

  const animationHandlersRef = useRef(defaultAnimationHandlers);

  const registerAnimationHandlers = useCallback((handlers = {}) => {
    animationHandlersRef.current = {
      ...defaultAnimationHandlers,
      ...handlers,
    };
  }, []);

  const animateStartButtonOut = useCallback(
    () => animationHandlersRef.current.animateStartButtonOut?.(),
    [],
  );
  const animateControlsIn = useCallback(
    () => animationHandlersRef.current.animateControlsIn?.(),
    [],
  );
  const animateControlsOut = useCallback(
    () => animationHandlersRef.current.animateControlsOut?.(),
    [],
  );
  const animateStartButtonIn = useCallback(
    () => animationHandlersRef.current.animateStartButtonIn?.(),
    [],
  );
  const startPulseAnimation = useCallback(
    () => animationHandlersRef.current.startPulseAnimation?.(),
    [],
  );
  const stopPulseAnimation = useCallback(
    () => animationHandlersRef.current.stopPulseAnimation?.(),
    [],
  );

  const requestLocationPermission = useCallback(async () => {
    setIsRequestingPermission(true);
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== 'granted') {
        Alert.alert(
          'Permission refusée',
          'La localisation est nécessaire pour tracer votre parcours. Veuillez autoriser l\'accès dans les paramètres.',
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Paramètres', onPress: () => Linking.openSettings() },
          ],
        );
        setLocationPermission('denied');
        return false;
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

      if (backgroundStatus !== 'granted') {
        Alert.alert(
          'Permission "Toujours" requise',
          'Pour que le tracking fonctionne écran éteint, vous DEVEZ choisir "Toujours autoriser" dans les paramètres de localisation.',
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Ouvrir les Paramètres', onPress: () => Linking.openSettings() },
          ],
        );
        setLocationPermission('foreground-only');
        return false;
      }

      setLocationPermission('granted');
      return true;
    } catch (error) {
      console.error('Erreur lors de la demande de permission:', error);
      Alert.alert('Erreur', 'Impossible de demander les permissions de localisation');
      setLocationPermission('error');
      return false;
    } finally {
      setIsRequestingPermission(false);
    }
  }, []);

  const checkLocationPermission = useCallback(async () => {
    try {
      const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
      const { status: backgroundStatusPermission } = await Location.getBackgroundPermissionsAsync();

      if (foregroundStatus === 'granted' && backgroundStatusPermission === 'granted') {
        setLocationPermission('granted');
      } else if (foregroundStatus === 'granted') {
        setLocationPermission('foreground-only');
      } else {
        setLocationPermission('denied');
      }
    } catch (error) {
      console.error('Erreur lors de la vérification des permissions:', error);
      setLocationPermission('error');
    }
  }, []);

  useEffect(() => {
    checkLocationPermission();
  }, [checkLocationPermission]);

  useEffect(() => {
    if (hasAskedPermissionRef.current) {
      return;
    }

    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          hasAskedPermissionRef.current = true;
          await requestLocationPermission();
        }
      } catch (error) {
        console.warn('Auto-permission request failed:', error);
      }
    })();
  }, [requestLocationPermission]);

  useEffect(() => {
    isTrackingRef.current = isTracking;
    if (setTrackingStatus) {
      setTrackingStatus(isTracking);
    }
  }, [isTracking, setTrackingStatus]);

  // Sauvegarder automatiquement les étapes du trajet
  useEffect(() => {
    if (isTracking) {
      safeSetItem('tripSteps', tripSteps, { silent: true });
    }
  }, [tripSteps, isTracking]);

  // Sauvegarder automatiquement le nom du trajet
  useEffect(() => {
    if (isTracking && tripName) {
      safeSetItem('tripName', tripName, { silent: true });
    }
  }, [tripName, isTracking]);

  // Sauvegarder automatiquement la description du trajet
  useEffect(() => {
    if (isTracking) {
      safeSetItem('tripDescription', tripDescription, { silent: true });
    }
  }, [tripDescription, isTracking]);

  useEffect(() => {
    const initTrackingState = async () => {
      await loadingState.executeWithLoading(async () => {
        try {
          // Vérifier d'abord si la session a été explicitement terminée
          const sessionEndReason = await safeGetItem('sessionEndReason', { defaultValue: null });
          if (sessionEndReason && sessionEndReason !== 'none') {
            // Session terminée par l'utilisateur, ne pas restaurer
            console.log(`[TrackingEngine] Session terminée (${sessionEndReason}), ne pas restaurer`);
            await safeSetItem('isTracking', 'false', { silent: true });
            return;
          }

          const hasBgUpdates = await hasStartedBackgroundLocationUpdatesAsync();
          const savedState = await safeGetItem('isTracking', { defaultValue: null });

          // Ne restaurer QUE si TaskManager est actif ET isTracking est 'true'
          if ((hasBgUpdates || savedState === 'true') && (!sessionEndReason || sessionEndReason === 'none')) {
            setIsTracking(true);
            isTrackingRef.current = true;
            setIsPaused(false);
            if (setTrackingStatus) {
              setTrackingStatus(true);
            }

            const savedData = await safeMultiGet([
              'trackingPoints',
              SEGMENTS_STORAGE_KEY,
              BG_LAST_SYNC_KEY,
            ]);

            // Extraire les valeurs du résultat de multiGet (format: [[key, value], ...])
            const pointsValue = savedData.find(([key]) => key === 'trackingPoints')?.[1];
            const segmentsValue = savedData.find(([key]) => key === SEGMENTS_STORAGE_KEY)?.[1];
            const bgSyncValue = savedData.find(([key]) => key === BG_LAST_SYNC_KEY)?.[1];

            let restoredSegmentStarts = [0];
            if (segmentsValue) {
              try {
                const parsedStarts = typeof segmentsValue === 'string'
                  ? JSON.parse(segmentsValue)
                  : segmentsValue;
                if (Array.isArray(parsedStarts) && parsedStarts.length > 0) {
                  restoredSegmentStarts = parsedStarts;
                }
              } catch (segmentError) {
                console.warn('Error parsing stored segment starts:', segmentError);
              }
            }

            if (bgSyncValue) {
              const parsedBgTs = typeof bgSyncValue === 'string'
                ? parseInt(bgSyncValue, 10)
                : bgSyncValue;
              if (!Number.isNaN(parsedBgTs)) {
                lastBgSyncRef.current = parsedBgTs;
              }
            }

            let restoredPoints = [];
            if (pointsValue) {
              const computeSegmentForIndex = (idx) => {
                for (let seg = restoredSegmentStarts.length - 1; seg >= 0; seg -= 1) {
                  if (idx >= restoredSegmentStarts[seg]) {
                    return seg;
                  }
                }
                return 0;
              };

              const parsedPoints = typeof pointsValue === 'string'
                ? JSON.parse(pointsValue)
                : pointsValue;

              restoredPoints = parsedPoints.map((point, index) => ({
                ...point,
                segmentIndex:
                  typeof point?.segmentIndex === 'number'
                    ? point.segmentIndex
                    : computeSegmentForIndex(index),
              }));
            }

            restoreTrackingState({
              points: restoredPoints,
              segmentStarts: restoredSegmentStarts,
              lastBgTimestamp: lastBgSyncRef.current,
            });

            const savedMaxSpeed = await safeGetItem('maxSpeed', {
              parser: (value) => parseFloat(value),
              defaultValue: null,
            });
            if (savedMaxSpeed !== null && !Number.isNaN(savedMaxSpeed)) {
              setMaxSpeed(savedMaxSpeed);
              maxSpeedRef.current = savedMaxSpeed;
            }

            const savedAltitudeData = await safeGetItem('altitudeData', {
              defaultValue: null,
            });
            if (savedAltitudeData) {
              setAltitudeData(savedAltitudeData);
            }

            const [savedTripStartTime, savedIsPaused] = await Promise.all([
              safeGetItem('tripStartTime', { defaultValue: null }),
              safeGetItem('isPaused', { defaultValue: null }),
            ]);

            if (savedTripStartTime) {
              const startTimestamp = typeof savedTripStartTime === 'string'
                ? parseInt(savedTripStartTime, 10)
                : savedTripStartTime;
              if (!Number.isNaN(startTimestamp)) {
                setStartTime(startTimestamp);
              }
            }

            const timerSnapshot = await hydrateTimerState();
            const wasPaused = savedIsPaused === 'true' || timerSnapshot.status === 'paused';
            setIsPaused(wasPaused);

            // Restaurer les étapes du trajet
            const savedTripSteps = await safeGetItem('tripSteps', { defaultValue: null });
            if (savedTripSteps && Array.isArray(savedTripSteps)) {
              setTripSteps(savedTripSteps);
            }

            // Restaurer le nom et la description du trajet
            const savedTripName = await safeGetItem('tripName', { defaultValue: null });
            if (savedTripName) {
              setTripName(savedTripName);
            }

            const savedTripDescription = await safeGetItem('tripDescription', { defaultValue: null });
            if (savedTripDescription) {
              setTripDescription(savedTripDescription);
            }

            animateControlsIn();
          } else {
            await safeSetItem('isTracking', 'false', { silent: true });
          }
        } catch (error) {
          console.error('Error initializing tracking state:', error);
        }
      }, 'initTrackingState');
    };

    initTrackingState();
  }, [
    animateControlsIn,
    hydrateTimerState,
    restoreTrackingState,
    setAltitudeData,
    setIsPaused,
    setMaxSpeed,
    setStartTime,
    setTrackingStatus,
    setIsTracking,
  ]);

  // useLocationRecorder gère maintenant directement le polling de la queue
  // Plus besoin de setBackgroundLocationHandler ou de drainer manuellement

  const {
    startTracking,
    pauseTracking,
    stopTracking,
    resetTracking,
  } = useTrackingSession({
    isTracking,
    setIsTracking,
    isPaused,
    setIsPaused,
    isTrackingRef,
    pauseToggleInProgressRef,
    currentSegmentIndexRef,
    trackingPointsRef,
    lastBgSyncRef,
    locationPermission,
    requestLocationPermission,
    resetTrackingState,
    setStartTime,
    setMaxSpeed,
    maxSpeedRef,
    setTotalStops,
    setTotalStopTime,
    setLastStopTime,
    setIsStopped,
    setAltitudeData,
    setDrivingScore,
    resetInactivityTracking,
    setCurrentSpeed,
    setLastSampledPoint,
    setLastSampledTime,
    setLastSampledBearing,
    updateSegmentStarts,
    resetKalmanFilters,
    resetTripTimer,
    startTripTimer,
    pauseTripTimer,
    resumeTripTimer,
    stopTripTimer,
    animateStartButtonOut,
    animateControlsIn,
    animateControlsOut,
    animateStartButtonIn,
    startPulseAnimation,
    stopPulseAnimation,
    setSpeedHistory,
    setSmoothedSpeed,
    setTripName,
    setTripDescription,
    setShowTripSummary,
    setShowStepsEditor,
    setTripSteps,
    timerStorageKey: TIMER_STORAGE_KEY,
  });

  const pauseTrackingActionRef = useRef(null);
  const stopTrackingActionRef = useRef(null);

  useEffect(() => {
    pauseTrackingActionRef.current = pauseTracking;
    stopTrackingActionRef.current = stopTracking;
  }, [pauseTracking, stopTracking]);

  const { syncBackgroundLocations } = useTrackingPersistence({
    isPaused,
    setIsTracking,
    setIsPaused,
    isTrackingRef,
    setTrackingStatus,
    restoreTrackingState,
    trackingPointsRef,
    currentSegmentIndexRef,
    lastBgSyncRef,
    maxSpeedRef,
    setMaxSpeed,
    setAltitudeData,
    setStartTime,
    hydrateTimerState,
    animateControlsIn,
    setLastSampledPoint,
    setLastSampledTime,
    setLastSampledBearing,
    appendTrackingPoint,
    validateAndFilterPoint,
    recordRejectedPoint,
    formatDisplaySpeed,
    setCurrentSpeed,
    detectStop,
    lastSampledBearing,
    syncBackgroundLocationsRef,
    hasHydratedTrackingRef,
    setBackgroundStatus,
    setLastHeartbeat,
  });

  // Surveiller les changements d'état de l'app
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      // Si l'app revient au premier plan, réinitialiser l'alerte d'inactivité
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        if (showInactivityPrompt) {
          resetInactivityTracking();
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription?.remove();
    };
  }, [showInactivityPrompt, resetInactivityTracking]);

  useEffect(() => {
    if (!showInactivityPrompt || inactivityAlertShownRef.current) {
      return;
    }

    // Ne pas afficher l'alerte si l'app est en arrière-plan
    if (appStateRef.current !== 'active') {
      return;
    }

    inactivityAlertShownRef.current = true;
    const totalSeconds = Math.max(0, Math.floor(inactiveDurationMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    // Message plus court et simple
    let durationLabel = '';
    if (minutes > 0) {
      durationLabel = minutes === 1 ? '1 min' : `${minutes} min`;
    } else {
      durationLabel = `${Math.max(seconds, 5)}s`;
    }

    // Message simplifié pour éviter le troncage
    const message = `Vitesse < ${INACTIVITY_SPEED_THRESHOLD_KMH} km/h depuis ${durationLabel}. Que souhaitez-vous faire ?`;

    Alert.alert(
      'Trajet en pause ?',
      message,
      [
        {
          text: 'Ignorer',
          style: 'cancel',
          onPress: () => {
            resetInactivityTracking();
          },
        },
        {
          text: 'Pause',
          onPress: () => {
            pauseTrackingActionRef.current?.();
            resetInactivityTracking();
          },
        },
        {
          text: 'Terminer',
          style: 'destructive',
          onPress: () => {
            stopTrackingActionRef.current?.();
            resetInactivityTracking();
          },
        },
      ],
      { cancelable: true }
    );
  }, [
    INACTIVITY_SPEED_THRESHOLD_KMH,
    inactivityAlertShownRef,
    inactiveDurationMs,
    pauseTrackingActionRef,
    resetInactivityTracking,
    showInactivityPrompt,
    stopTrackingActionRef,
  ]);

  useEffect(() => {
    if (showInactivityPrompt) {
      return;
    }
    inactivityAlertShownRef.current = false;
  }, [showInactivityPrompt, inactivityAlertShownRef]);

  const value = useMemo(
    () => ({
      // Loading state
      isLoading: loadingState.isLoading,
      loadingOperations: loadingState.loadingOperations,
      isOperationLoading: loadingState.isOperationLoading,
      startLoading: loadingState.startLoading,
      stopLoading: loadingState.stopLoading,
      executeWithLoading: loadingState.executeWithLoading,
      resetLoading: loadingState.resetLoading,

      // Tracking state
      isTracking,
      isPaused,
      setIsPaused,
      isRequestingPermission,
      locationPermission,
      backgroundStatus,
      lastHeartbeat,
      startTracking,
      pauseTracking,
      stopTracking,
      resetTracking,
      requestLocationPermission,
      checkLocationPermission,
      syncBackgroundLocations,

      // Data + refs
      currentLocation,
      setCurrentLocation,
      trackingPoints,
      trackingPointsRef,
      trackingSegments,
      activeRouteSegments,
      simplifiedPoints,
      compressedPolyline,
      segmentStartIndices,
      segmentStartIndicesRef,
      currentSegmentIndexRef,
      getSegmentIndexForPosition,
      flattenSegments,
      compressPolyline,
      decompressPolyline,

      // Metrics
      startTime,
      setStartTime,
      maxSpeed,
      setMaxSpeed,
      totalStops,
      setTotalStops,
      totalStopTime,
      setTotalStopTime,
      lastStopTime,
      setLastStopTime,
      isStopped,
      setIsStopped,
      altitudeData,
      setAltitudeData,
      drivingScore,
      setDrivingScore,
      currentSpeed,
      smoothedSpeed,
      speedHistory,
      totalDistance,
      formatDisplaySpeed,
      detectStop,
      scheduleInactivityPrompt,
      resetInactivityTracking,
      showInactivityPrompt,
      setShowInactivityPrompt,
      inactiveDurationMs,
      INACTIVITY_SPEED_THRESHOLD_KMH,
      INACTIVITY_DURATION_MS,
      timeText,
      formatTripTime,
      calculateElevationGain,
      getCurrentTripTime,
      setCurrentSpeed,
      setSmoothedSpeed,
      setSpeedHistory,

      // Trip timer controls
      startTripTimer,
      pauseTripTimer,
      resumeTripTimer,
      stopTripTimer,
      resetTripTimer,

      // Kalman & smoothing
      applyKalmanFilter,
      smoothSpeed,
      resetKalmanFilters,

      // Trip info
      tripName,
      setTripName,
      tripDescription,
      setTripDescription,
      tripSteps,
      setTripSteps,
      showTripSummary,
      setShowTripSummary,
      showStepsEditor,
      setShowStepsEditor,

      // Handlers
      handleLocationUpdate,
      registerAnimationHandlers,
      flattenSegments,
      setIsTracking,
      isTrackingRef,

      // Internal references for advanced usage
      speedWatchRef,
      pauseToggleInProgressRef,
      lastBgSyncRef,
      syncBackgroundLocationsRef,
      hasHydratedTrackingRef,
    }),
    [
      INACTIVITY_DURATION_MS,
      INACTIVITY_SPEED_THRESHOLD_KMH,
      altitudeData,
      applyKalmanFilter,
      backgroundStatus,
      calculateElevationGain,
      checkLocationPermission,
      compressedPolyline,
      currentLocation,
      currentSpeed,
      drivingScore,
      flattenSegments,
      formatDisplaySpeed,
      formatTripTime,
      timeText,
      getCurrentTripTime,
      getSegmentIndexForPosition,
      handleLocationUpdate,
      inactiveDurationMs,
      isPaused,
      isRequestingPermission,
      isStopped,
      isTracking,
      lastHeartbeat,
      lastStopTime,
      locationPermission,
      loadingState,
      maxSpeed,
      requestLocationPermission,
      resetInactivityTracking,
      resetKalmanFilters,
      resetTracking,
      scheduleInactivityPrompt,
      setShowInactivityPrompt,
      showInactivityPrompt,
      showStepsEditor,
      showTripSummary,
      smoothedSpeed,
      speedHistory,
      smoothSpeed,
      startTime,
      startTracking,
      stopTracking,
      startTripTimer,
      pauseTripTimer,
      resumeTripTimer,
      stopTripTimer,
      resetTripTimer,
      syncBackgroundLocations,
      totalDistance,
      totalStopTime,
      totalStops,
      trackingPoints,
      trackingSegments,
      tripDescription,
      tripName,
      tripSteps,
      registerAnimationHandlers,
      setIsTracking,
      setAltitudeData,
      setDrivingScore,
      setIsStopped,
      setLastStopTime,
      setMaxSpeed,
      setTotalStopTime,
      setTotalStops,
    ],
  );

  return (
    <TrackingEngineContext.Provider value={value}>
      {children}
    </TrackingEngineContext.Provider>
  );
};

export const useTrackingEngine = () => {
  const context = useContext(TrackingEngineContext);
  if (!context) {
    throw new Error('useTrackingEngine must be used within a TrackingEngineProvider');
  }
  return context;
};
