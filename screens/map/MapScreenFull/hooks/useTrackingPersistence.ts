import { useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SEGMENTS_STORAGE_KEY, BG_LAST_SYNC_KEY } from './useTrackingPoints';
import {
  hasStartedBackgroundLocationUpdatesAsync,
} from '../../../../services/BackgroundLocationService';

interface UseTrackingPersistenceProps {
  isPaused: boolean;
  setIsTracking: (val: boolean) => void;
  setIsPaused: (val: boolean) => void;
  isTrackingRef: React.MutableRefObject<boolean>;
  setTrackingStatus?: (val: boolean) => void;
  restoreTrackingState: (state: any) => void;
  trackingPointsRef: React.MutableRefObject<any[]>;
  currentSegmentIndexRef: React.MutableRefObject<number>;
  lastBgSyncRef: React.MutableRefObject<number>;
  maxSpeedRef: React.MutableRefObject<number>;
  setMaxSpeed: (val: number) => void;
  setAltitudeData: (data: any) => void;
  setStartTime: (val: number) => void;
  hydrateTimerState: () => Promise<any>;
  animateControlsIn: () => void;
  setLastSampledPoint: (point: any) => void;
  setLastSampledTime: (time: number) => void;
  setLastSampledBearing: (bearing: number) => void;
  lastSampledBearing?: number;
  syncBackgroundLocationsRef: React.MutableRefObject<any>;
  hasHydratedTrackingRef: React.MutableRefObject<boolean>;
  setBackgroundStatus?: (status: string) => void;
  setLastHeartbeat?: (timestamp: number) => void;
  appendTrackingPoint?: (point: any) => void;
  validateAndFilterPoint?: (point: any) => any;
  recordRejectedPoint?: () => void;
  formatDisplaySpeed?: (speed: number) => any;
  setCurrentSpeed?: (speed: number) => void;
  detectStop?: (speed: number) => void;
}

const useTrackingPersistence = ({
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
  lastSampledBearing,
  syncBackgroundLocationsRef,
  hasHydratedTrackingRef,
  setBackgroundStatus,
  setLastHeartbeat,
}: UseTrackingPersistenceProps) => {
  // syncBackgroundLocations n'est plus nécessaire car useLocationRecorder
  // gère maintenant directement le polling de la queue
  const syncBackgroundLocations = useCallback(async () => {
    // Fonction vide pour compatibilité, le polling est géré par useLocationRecorder
    console.log('[Persistence] syncBackgroundLocations appelé (géré par useLocationRecorder)');
  }, []);

  useEffect(() => {
    if (syncBackgroundLocationsRef) {
      syncBackgroundLocationsRef.current = syncBackgroundLocations;
    }
  }, [syncBackgroundLocations, syncBackgroundLocationsRef]);

  useEffect(() => {
    const initTrackingState = async () => {
      try {
        // Vérifier d'abord si la session a été explicitement terminée
        const sessionEndReason = await AsyncStorage.getItem('sessionEndReason');
        if (sessionEndReason && sessionEndReason !== 'none') {
          // Session terminée par l'utilisateur, ne pas restaurer
          console.log(`[Persistence] Session terminée (${sessionEndReason}), ne pas restaurer`);
          await AsyncStorage.setItem('isTracking', 'false');
          return;
        }

        const hasBgUpdates = await hasStartedBackgroundLocationUpdatesAsync();
        const savedState = await AsyncStorage.getItem('isTracking');

        if (hasBgUpdates || savedState === 'true') {
          setIsTracking(true);
          isTrackingRef.current = true;
          setIsPaused(false);
          if (setTrackingStatus) {
            setTrackingStatus(true);
          }

          const [savedPointsRaw, savedPointsBackupRaw, savedSegmentsRaw, savedBgSyncRaw] = await Promise.all([
            AsyncStorage.getItem('trackingPoints'),
            AsyncStorage.getItem('trackingPoints_backup'), // Backup pour récupération
            AsyncStorage.getItem(SEGMENTS_STORAGE_KEY),
            AsyncStorage.getItem(BG_LAST_SYNC_KEY),
          ]);

          // Utiliser le backup si le principal est corrompu ou vide
          const pointsRaw = savedPointsRaw || savedPointsBackupRaw;

          let restoredSegmentStarts = [0];
          if (savedSegmentsRaw) {
            try {
              const parsedStarts = JSON.parse(savedSegmentsRaw);
              if (Array.isArray(parsedStarts) && parsedStarts.length > 0) {
                restoredSegmentStarts = parsedStarts;
              }
            } catch (segmentError) {
              console.warn('Error parsing stored segment starts:', segmentError);
            }
          }

          if (savedBgSyncRaw) {
            const parsedBgTs = parseInt(savedBgSyncRaw, 10);
            if (!Number.isNaN(parsedBgTs)) {
              lastBgSyncRef.current = parsedBgTs;
            }
          }

          let restoredPoints: any[] = [];
          if (pointsRaw) {
            try {
              const computeSegmentForIndex = (idx: number) => {
                for (let seg = restoredSegmentStarts.length - 1; seg >= 0; seg -= 1) {
                  if (idx >= restoredSegmentStarts[seg]) {
                    return seg;
                  }
                }
                return 0;
              };

              const parsedPoints = JSON.parse(pointsRaw);
              if (Array.isArray(parsedPoints) && parsedPoints.length > 0) {
                restoredPoints = parsedPoints.map((point, index) => ({
                  ...point,
                  segmentIndex:
                    typeof point?.segmentIndex === 'number'
                      ? point.segmentIndex
                      : computeSegmentForIndex(index),
                }));
                console.log(`[Persistence] ✅ ${restoredPoints.length} points restaurés${savedPointsBackupRaw && !savedPointsRaw ? ' (depuis backup)' : ''}`);
              }
            } catch (parseError) {
              console.error('[Persistence] ❌ Erreur parsing points, tentative backup:', parseError);
              // Si le principal est corrompu, essayer le backup
              if (savedPointsBackupRaw && savedPointsRaw) {
                try {
                  const backupPoints = JSON.parse(savedPointsBackupRaw);
                  if (Array.isArray(backupPoints) && backupPoints.length > 0) {
                    const computeSegmentForIndex = (idx: number) => {
                      for (let seg = restoredSegmentStarts.length - 1; seg >= 0; seg -= 1) {
                        if (idx >= restoredSegmentStarts[seg]) {
                          return seg;
                        }
                      }
                      return 0;
                    };
                    restoredPoints = backupPoints.map((point, index) => ({
                      ...point,
                      segmentIndex:
                        typeof point?.segmentIndex === 'number'
                          ? point.segmentIndex
                          : computeSegmentForIndex(index),
                    }));
                    console.log(`[Persistence] ✅ ${restoredPoints.length} points restaurés depuis backup`);
                  }
                } catch (backupError) {
                  console.error('[Persistence] ❌ Erreur parsing backup aussi:', backupError);
                }
              }
            }
          }

          restoreTrackingState({
            points: restoredPoints,
            segmentStarts: restoredSegmentStarts,
            lastBgTimestamp: lastBgSyncRef.current,
          });

          const savedMaxSpeed = await AsyncStorage.getItem('maxSpeed');
          if (savedMaxSpeed) {
            const speed = parseFloat(savedMaxSpeed);
            setMaxSpeed(speed);
            maxSpeedRef.current = speed;
          }

          const savedAltitudeData = await AsyncStorage.getItem('altitudeData');
          if (savedAltitudeData) {
            setAltitudeData(JSON.parse(savedAltitudeData));
          }

          const [savedTripStartTime, savedIsPaused] = await Promise.all([
            AsyncStorage.getItem('tripStartTime'),
            AsyncStorage.getItem('isPaused'),
          ]);

          if (savedTripStartTime) {
            const startTimestamp = parseInt(savedTripStartTime, 10);
            if (!Number.isNaN(startTimestamp)) {
              setStartTime(startTimestamp);
            }
          }

          const timerSnapshot = await hydrateTimerState();
          const wasPaused = savedIsPaused === 'true' || timerSnapshot.status === 'paused';
          setIsPaused(wasPaused);

          animateControlsIn();
        } else {
          await AsyncStorage.setItem('isTracking', 'false');
        }
      } catch (error) {
        console.error('Error initializing tracking state:', error);
      }
    };

    initTrackingState();
  }, [
    animateControlsIn,
    hydrateTimerState,
    isTrackingRef,
    setAltitudeData,
    setIsPaused,
    setIsTracking,
    setMaxSpeed,
    setStartTime,
    setTrackingStatus,
  ]);

  useFocusEffect(
    useCallback(() => {
      hasHydratedTrackingRef.current = false;
      let isActive = true;

      const restoreTrackingPoints = async () => {
        try {
          // Vérifier d'abord si la session a été explicitement terminée
          const sessionEndReason = await AsyncStorage.getItem('sessionEndReason');
          if (sessionEndReason && sessionEndReason !== 'none') {
            // Session terminée par l'utilisateur, ne pas restaurer
            console.log(`[Persistence] Session terminée (${sessionEndReason}), ne pas restaurer`);
            return;
          }

          const savedState = await AsyncStorage.getItem('isTracking');
          const savedTripStartTime = await AsyncStorage.getItem('tripStartTime');
          const savedIsPaused = await AsyncStorage.getItem('isPaused');

          // Ne restaurer QUE si isTracking est explicitement 'true' ET TaskManager est actif
          // Ne PAS restaurer juste sur tripStartTime (peut être un reste)
          const hasBgUpdates = await hasStartedBackgroundLocationUpdatesAsync();

          // 🛡️ PROTECTION RACE CONDITION:
          // Si une session vient de démarrer (< 2s), ne PAS tenter de restaurer
          // car cela pourrait réinjecter des données que startTracking vient de supprimer
          const now = Date.now();
          if (savedTripStartTime && (now - parseInt(savedTripStartTime, 10) < 2000)) {
            console.log('[useFocusEffect] 🛡️ Session trop récente, skip restauration pour éviter race condition');
            return;
          }

          if ((savedState === 'true' || savedTripStartTime) && hasBgUpdates) {
            const [savedPointsRaw, savedPointsBackupRaw, savedSegmentsRaw, savedBgSyncRaw] = await Promise.all([
              AsyncStorage.getItem('trackingPoints'),
              AsyncStorage.getItem('trackingPoints_backup'), // Backup pour récupération
              AsyncStorage.getItem(SEGMENTS_STORAGE_KEY),
              AsyncStorage.getItem(BG_LAST_SYNC_KEY),
            ]);

            // Utiliser le backup si le principal est corrompu ou vide
            const pointsRaw = savedPointsRaw || savedPointsBackupRaw;

            if (!isActive) {
              return;
            }

            let restoredSegmentStarts = [0];
            if (savedSegmentsRaw) {
              try {
                const parsedStarts = JSON.parse(savedSegmentsRaw);
                if (Array.isArray(parsedStarts) && parsedStarts.length > 0) {
                  restoredSegmentStarts = parsedStarts;
                }
              } catch (segmentError) {
                console.warn('[useFocusEffect] Error parsing stored segment starts:', segmentError);
              }
            }

            if (savedBgSyncRaw) {
              const parsedBgTs = parseInt(savedBgSyncRaw, 10);
              if (!Number.isNaN(parsedBgTs)) {
                lastBgSyncRef.current = parsedBgTs;
              }
            }

            let restoredPoints: any[] = [];
            if (pointsRaw) {
              try {
                const computeSegmentForIndex = (idx: number) => {
                  for (let seg = restoredSegmentStarts.length - 1; seg >= 0; seg -= 1) {
                    if (idx >= restoredSegmentStarts[seg]) {
                      return seg;
                    }
                  }
                  return 0;
                };

                const parsedPoints = JSON.parse(pointsRaw);
                if (Array.isArray(parsedPoints) && parsedPoints.length > 0) {
                  restoredPoints = parsedPoints.map((point, index) => ({
                    ...point,
                    segmentIndex:
                      typeof point?.segmentIndex === 'number'
                        ? point.segmentIndex
                        : computeSegmentForIndex(index),
                  }));
                  console.log(`[useFocusEffect] ✅ ${restoredPoints.length} points restaurés${savedPointsBackupRaw && !savedPointsRaw ? ' (depuis backup)' : ''}`);
                }
              } catch (parseError) {
                console.error('[useFocusEffect] ❌ Erreur parsing points, tentative backup:', parseError);
                // Si le principal est corrompu, essayer le backup
                if (savedPointsBackupRaw && savedPointsRaw) {
                  try {
                    const backupPoints = JSON.parse(savedPointsBackupRaw);
                    if (Array.isArray(backupPoints) && backupPoints.length > 0) {
                      const computeSegmentForIndex = (idx: number) => {
                        for (let seg = restoredSegmentStarts.length - 1; seg >= 0; seg -= 1) {
                          if (idx >= restoredSegmentStarts[seg]) {
                            return seg;
                          }
                        }
                        return 0;
                      };
                      restoredPoints = backupPoints.map((point, index) => ({
                        ...point,
                        segmentIndex:
                          typeof point?.segmentIndex === 'number'
                            ? point.segmentIndex
                            : computeSegmentForIndex(index),
                      }));
                      console.log(`[useFocusEffect] ✅ ${restoredPoints.length} points restaurés depuis backup`);
                    }
                  } catch (backupError) {
                    console.error('[useFocusEffect] ❌ Erreur parsing backup aussi:', backupError);
                  }
                }
              }
            }

            restoreTrackingState({
              points: restoredPoints,
              segmentStarts: restoredSegmentStarts,
              lastBgTimestamp: lastBgSyncRef.current,
            });

            const savedMaxSpeed = await AsyncStorage.getItem('maxSpeed');
            if (savedMaxSpeed) {
              const speed = parseFloat(savedMaxSpeed);
              setMaxSpeed(speed);
              maxSpeedRef.current = speed;
            }

            const savedAltitudeData = await AsyncStorage.getItem('altitudeData');
            if (savedAltitudeData) {
              setAltitudeData(JSON.parse(savedAltitudeData));
            }

            if (savedTripStartTime) {
              const startTimestamp = parseInt(savedTripStartTime, 10);
              if (!Number.isNaN(startTimestamp)) {
                setStartTime(startTimestamp);
              }
            }

            const timerSnapshot = await hydrateTimerState();
            const wasPaused = savedIsPaused === 'true' || timerSnapshot.status === 'paused';
            if (!hasHydratedTrackingRef.current) {
              setIsPaused(wasPaused);
            }

            setIsTracking(true);
            isTrackingRef.current = true;
            if (setTrackingStatus) {
              setTrackingStatus(true);
            }
            animateControlsIn();
            hasHydratedTrackingRef.current = true;
            // Plus besoin d'appeler syncBackgroundLocations : useLocationRecorder gère le polling
          }
        } catch (error) {
          console.error('Erreur restauration points de tracking:', error);
        }
      };

      restoreTrackingPoints();

      return () => {
        isActive = false;
        hasHydratedTrackingRef.current = false;
      };
    }, [
      animateControlsIn,
      hasHydratedTrackingRef,
      hydrateTimerState,
      isTrackingRef,
      lastBgSyncRef,
      setAltitudeData,
      setIsPaused,
      setIsTracking,
      setMaxSpeed,
      setStartTime,
      setTrackingStatus,
      restoreTrackingState,
    ]),
  );

  // Le polling des locations est maintenant géré directement par useLocationRecorder


  return { syncBackgroundLocations };
};

export default useTrackingPersistence;

