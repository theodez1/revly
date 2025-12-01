import { useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { SEGMENTS_STORAGE_KEY, BG_LAST_SYNC_KEY } from './useTrackingPoints';
import {
  startLocationTracking,
  stopLocationTracking,
  clearLocationQueue,
} from '../../../../services/BackgroundLocationService';
import trackingLogger from '../../../../utils/trackingLogger';

const useTrackingSession = ({
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
  animateStartButtonOut = () => { },
  animateControlsIn = () => { },
  animateControlsOut = () => { },
  animateStartButtonIn = () => { },
  startPulseAnimation = () => { },
  stopPulseAnimation = () => { },
  setSpeedHistory,
  setSmoothedSpeed,
  setTripName = () => { },
  setTripDescription = () => { },
  setShowTripSummary = () => { },
  setShowStepsEditor = () => { },
  setTripSteps = () => { },
  timerStorageKey,
}) => {
  const startTracking = useCallback(async () => {
    try {
      if (locationPermission !== 'granted') {
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
          return;
        }
      }

      // 📝 Démarrer le système de logs automatiques
      await trackingLogger.startSession({
        platform: Platform.OS,
        timestamp: Date.now(),
      }).catch(err => console.log('Erreur démarrage logs:', err));
      trackingLogger.logTrackingEvent('TRACKING_STARTED');

      try {
        await AsyncStorage.multiRemove([
          'trackingPoints',
          'trackingPoints_backup', // 🧹 CRITIQUE: Supprimer aussi le backup !
          'maxSpeed',
          'altitudeData',
          'tripStartTime',
          'pausedDuration',
          timerStorageKey,
          SEGMENTS_STORAGE_KEY,
          BG_LAST_SYNC_KEY,
          'sessionEndReason',
        ]);
      } catch (e) {
        console.log('⚠️ Erreur nettoyage AsyncStorage:', e);
        trackingLogger.logError(e, { context: 'cleanup_storage' });
      }

      const now = Date.now();
      setStartTime(now);
      maxSpeedRef.current = 0;
      setMaxSpeed(0);
      setTotalStops(0);
      setTotalStopTime(0);
      setLastStopTime(null);
      setIsStopped(false);
      setAltitudeData([]);
      setDrivingScore(100);
      resetInactivityTracking();

      resetTrackingState();
      setCurrentSpeed(0);
      setLastSampledPoint(null);
      setLastSampledTime(null);
      setLastSampledBearing(null);
      currentSegmentIndexRef.current = 0;
      lastBgSyncRef.current = 0;

      resetKalmanFilters({
        coordinateConfig: { R: 0.01, Q: 0.1 },
        speedConfig: { R: 0.5, Q: 0.1 },
      });

      resetTripTimer();
      startTripTimer();

      await AsyncStorage.setItem('tripStartTime', now.toString());
      await AsyncStorage.setItem('isTracking', 'true');
      await AsyncStorage.setItem('sessionEndReason', 'none'); // 'none' = session active, pas terminée

      setIsTracking(true);
      isTrackingRef.current = true;
      setIsPaused(false);

      animateStartButtonOut();
      setTimeout(() => animateControlsIn(), 150);
      startPulseAnimation();

      // Vider la queue de locations précédente pour éviter les "fantômes"
      try {
        await clearLocationQueue();
        console.log('🧹 Queue de locations vidée avant démarrage');
      } catch (e) {
        console.warn('Erreur vidage queue (start):', e);
      }

      // Démarrer le tracking avec TaskManager (fonctionne en foreground ET background)
      try {
        await startLocationTracking();
      } catch (error) {
        console.error('❌ Erreur démarrage tracking:', error);
        Alert.alert('Erreur', 'Impossible de démarrer le tracking GPS. Vérifiez les permissions de localisation.');
        setIsTracking(false);
        isTrackingRef.current = false;
        return;
      }
    } catch (error) {
      console.error('❌ ERREUR DÉMARRAGE:', error);
      Alert.alert('Erreur', 'Impossible de démarrer le tracking. Vérifiez les permissions de localisation.');
      setIsTracking(false);
      isTrackingRef.current = false;
    }
  }, [
    animateControlsIn,
    animateStartButtonOut,
    locationPermission,
    requestLocationPermission,
    resetInactivityTracking,
    resetTrackingState,
    resetKalmanFilters,
    resetTripTimer,
    setAltitudeData,
    setCurrentSpeed,
    setDrivingScore,
    setIsPaused,
    setIsStopped,
    setIsTracking,
    setLastSampledBearing,
    setLastSampledPoint,
    setLastSampledTime,
    setLastStopTime,
    setMaxSpeed,
    setStartTime,
    setTotalStopTime,
    setTotalStops,
    startPulseAnimation,
    startTripTimer,
    timerStorageKey,
  ]);

  const pauseTracking = useCallback(async () => {
    if (pauseToggleInProgressRef.current) {
      return;
    }
    pauseToggleInProgressRef.current = true;
    try {
      // Sauvegarder immédiatement lors de la pause (CRITIQUE - annule le debounce)
      if (trackingPointsRef.current.length > 0) {
        const pointsJson = JSON.stringify(trackingPointsRef.current);
        // Double sauvegarde avec retry pour garantir la persistance
        let saved = false;
        for (let retry = 0; retry < 3 && !saved; retry++) {
          try {
            await Promise.all([
              AsyncStorage.setItem('trackingPoints', pointsJson),
              AsyncStorage.setItem('trackingPoints_backup', pointsJson),
            ]);
            console.log(`[pauseTracking] ✅ Points sauvegardés (${trackingPointsRef.current.length} points)`);
            saved = true;
          } catch (err) {
            if (retry === 2) {
              console.error('❌ Erreur sauvegarde points après 3 tentatives:', err);
              // Dernière tentative : au moins le backup
              try {
                await AsyncStorage.setItem('trackingPoints_backup', pointsJson);
                console.log('[pauseTracking] 💾 Backup sauvegardé en dernier recours');
              } catch (backupErr) {
                console.error('❌ Erreur sauvegarde backup:', backupErr);
              }
            }
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }

      if (isPaused) {
        const nextSegmentIndex = (currentSegmentIndexRef.current || 0) + 1;
        currentSegmentIndexRef.current = nextSegmentIndex;
        const startIndex = trackingPointsRef.current.length;
        updateSegmentStarts((prevStarts) => {
          if (prevStarts[prevStarts.length - 1] === startIndex) {
            return prevStarts;
          }
          return [...prevStarts, startIndex];
        });
        setLastSampledPoint(null);
        setLastSampledTime(null);
        setLastSampledBearing(null);

        setIsPaused(false);
        isTrackingRef.current = true;
        resetInactivityTracking();

        await AsyncStorage.setItem('isPaused', 'false');

        // Redémarrer le tracking avec TaskManager
        try {
          await startLocationTracking();
        } catch (error) {
          console.error('Erreur redémarrage tracking:', error);
        }
        resumeTripTimer();
        trackingLogger.logTrackingEvent('TRACKING_RESUMED');
      } else {
        setIsPaused(true);
        isTrackingRef.current = false;
        resetInactivityTracking();

        await AsyncStorage.setItem('isPaused', 'true');

        if (maxSpeedRef.current > 0) {
          AsyncStorage.setItem('maxSpeed', maxSpeedRef.current.toString()).catch(() => { });
        }

        // Arrêter le tracking TaskManager
        try {
          await stopLocationTracking();
        } catch (error) {
          console.error('Erreur arrêt tracking:', error);
          trackingLogger.logError(error, { context: 'stop_location_tracking' });
        }
        pauseTripTimer();
        trackingLogger.logTrackingEvent('TRACKING_PAUSED');
      }
    } catch (error) {
      console.error('Erreur lors de la pause/reprise:', error);
      trackingLogger.logError(error, { context: 'pause_tracking' });
    } finally {
      pauseToggleInProgressRef.current = false;
    }
  }, [
    isPaused,
    isTracking,
    maxSpeedRef,
    pauseTripTimer,
    resetInactivityTracking,
    resumeTripTimer,
    setIsPaused,
    setLastSampledBearing,
    setLastSampledPoint,
    setLastSampledTime,
    trackingPointsRef,
    updateSegmentStarts,
  ]);

  const resetTracking = useCallback(async () => {
    console.log('🔄 Réinitialisation complète du tracking');

    setIsTracking(false);
    isTrackingRef.current = false;
    setIsPaused(false);
    resetInactivityTracking();

    resetTrackingState();
    currentSegmentIndexRef.current = 0;
    lastBgSyncRef.current = 0;

    setStartTime(null);
    maxSpeedRef.current = 0;
    setMaxSpeed(0);
    setTotalStops(0);
    setTotalStopTime(0);
    setLastStopTime(null);
    setIsStopped(false);
    setAltitudeData([]);
    setDrivingScore(100);

    resetTripTimer();

    AsyncStorage.multiRemove(['isPaused', 'pauseStartTime']).catch(() => { });

    setTripName('');
    setTripDescription('');
    setShowTripSummary(false);
    setShowStepsEditor(false);
    setTripSteps([]);

    stopPulseAnimation();

    resetKalmanFilters({
      coordinateConfig: { R: 0.01, Q: 0.1 },
      speedConfig: { R: 0.5, Q: 0.1 },
    });

    setSpeedHistory([]);
    setSmoothedSpeed(0);
    setCurrentSpeed(0);

    try {
      await stopLocationTracking();
    } catch (error) {
      console.warn('Erreur arrêt tracking lors du reset:', error);
    }

    try {
      AsyncStorage.multiRemove([
        'trackingPoints',
        'maxSpeed',
        'altitudeData',
        'tripStartTime',
        'pausedDuration',
        'isTracking',
        'tripSteps',
        'tripName',
        'tripDescription',
        timerStorageKey,
      ]).catch(() => { });

      // Supprimer toutes les photos du trajet
      const tripPhotosDir = `${FileSystem.documentDirectory}trip_photos/`;
      try {
        const dirInfo = await FileSystem.getInfoAsync(tripPhotosDir);
        if (dirInfo.exists) {
          await FileSystem.deleteAsync(tripPhotosDir, { idempotent: true });
          console.log('✅ Photos du trajet supprimées');
        }
      } catch (photoError) {
        console.warn('Erreur suppression photos trajet:', photoError);
      }
    } catch (e) {
      // ignore
    }

    // Plus besoin de speedWatchRef avec TaskManager

    console.log('✅ Réinitialisation complète terminée');
  }, [
    maxSpeedRef,
    resetInactivityTracking,
    resetKalmanFilters,
    resetTrackingState,
    resetTripTimer,
    setAltitudeData,
    setCurrentSpeed,
    setDrivingScore,
    setIsPaused,
    setIsStopped,
    setIsTracking,
    setLastStopTime,
    setMaxSpeed,
    setShowStepsEditor,
    setShowTripSummary,
    setSmoothedSpeed,
    setSpeedHistory,
    setStartTime,
    setTotalStopTime,
    setTotalStops,
    setTripDescription,
    setTripName,
    setTripSteps,
    stopPulseAnimation,
    timerStorageKey,
  ]);

  const stopTracking = useCallback(async (reason = 'user_discard') => {
    try {
      // CRITIQUE : Sauvegarder les points AVANT d'arrêter (dernière chance)
      if (trackingPointsRef.current.length > 0) {
        const pointsJson = JSON.stringify(trackingPointsRef.current);
        let saved = false;
        for (let retry = 0; retry < 3 && !saved; retry++) {
          try {
            await Promise.all([
              AsyncStorage.setItem('trackingPoints', pointsJson),
              AsyncStorage.setItem('trackingPoints_backup', pointsJson),
            ]);
            console.log(`[stopTracking] ✅ Points sauvegardés (${trackingPointsRef.current.length} points)`);
            saved = true;
          } catch (err) {
            if (retry === 2) {
              console.error('❌ Erreur sauvegarde points après 3 tentatives:', err);
              try {
                await AsyncStorage.setItem('trackingPoints_backup', pointsJson);
                console.log('[stopTracking] 💾 Backup sauvegardé en dernier recours');
              } catch (backupErr) {
                console.error('❌ Erreur sauvegarde backup:', backupErr);
              }
            }

            // 📝 Terminer la session de logs et exporter vers fichier
            trackingLogger.logTrackingEvent('TRACKING_STOPPED', {
              totalPoints: trackingPointsRef.current.length,
              reason
            });

            try {
              await trackingLogger.endSession({
                totalPoints: trackingPointsRef.current.length,
                reason,
              });

              // Exporter automatiquement vers fichier
              const sessions = await trackingLogger.getSessions();
              const sessionIds = Object.keys(sessions).sort((a, b) =>
                sessions[b].startTime - sessions[a].startTime
              );

              if (sessionIds.length > 0) {
                const lastSessionId = sessionIds[0];
                const filepath = await trackingLogger.exportSessionToFile(lastSessionId, 'txt');
                console.log('\n📝 LOGS EXPORTÉS VERS:', filepath);
                console.log('📂 Vous pouvez récupérer ce fichier sur votre Mac/PC\n');
              }
            } catch (logError) {
              console.log('Erreur export logs:', logError);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }

      setIsTracking(false);
      isTrackingRef.current = false;
      setIsPaused(false);
      resetInactivityTracking();

      stopPulseAnimation();

      // Arrêter le tracking TaskManager
      try {
        await stopLocationTracking();
      } catch (e) {
        console.error('Erreur arrêt tracking:', e);
      }

      stopTripTimer();

      // IMPORTANT : Marquer la session comme terminée AVANT de supprimer les données
      // pour éviter qu'elle soit restaurée accidentellement
      await AsyncStorage.setItem('sessionEndReason', reason);
      await AsyncStorage.setItem('isTracking', 'false');
      await AsyncStorage.setItem('isPaused', 'false');

      // Vider la queue de locations TaskManager pour éviter qu'elle soit traitée après arrêt
      try {
        await clearLocationQueue();
      } catch (e) {
        console.warn('Erreur vidage queue locations:', e);
      }

      // Supprimer toutes les données du trajet
      await AsyncStorage.multiRemove([
        'tripStartTime',
        'trackingPoints',
        'maxSpeed',
        'altitudeData',
        'pausedDuration',
        'pauseStartTime',
        'tripDuration',
        timerStorageKey,
        SEGMENTS_STORAGE_KEY,
        BG_LAST_SYNC_KEY,
      ]).catch(() => { });

      await resetTracking();

      animateControlsOut();
      setTimeout(() => {
        animateStartButtonIn();
      }, 150);
    } catch (error) {
      console.error('❌ ERREUR ARRÊT:', error);
      Alert.alert('Erreur', 'Impossible d\'arrêter le tracking');
      setIsTracking(false);
      isTrackingRef.current = false;
    }
  }, [
    animateControlsOut,
    animateStartButtonIn,
    resetInactivityTracking,
    resetTracking,
    setIsPaused,
    setIsTracking,
    stopPulseAnimation,
    stopTripTimer,
    timerStorageKey,
  ]);

  return {
    startTracking,
    pauseTracking,
    stopTracking,
    resetTracking,
  };
};

export default useTrackingSession;
