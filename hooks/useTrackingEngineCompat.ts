import React from 'react';
import { useTrackingEngine } from '../contexts/TrackingEngineContext';

/**
 * Wrapper pour assurer la compatibilité avec l'ancien système de tracking
 * Ce hook fournit des valeurs par défaut pour toutes les propriétés attendues par MapScreenFull
 */
export const useTrackingEngineCompat = () => {
    const engine = useTrackingEngine();

    return {
        // Valeurs du nouveau TrackingEngine
        ...engine,

        // Valeurs par défaut pour les propriétés non implémentées
        setIsPaused: (value: boolean) => {
            if (value) {
                engine.pauseTracking();
            } else {
                engine.resumeTracking();
            }
        },
        isRequestingPermission: false,
        locationPermission: 'granted' as const,
        backgroundStatus: 'active' as const,
        lastHeartbeat: Date.now(),
        checkLocationPermission: async () => ({ status: 'granted' }),
        syncBackgroundLocations: async () => { },
        setCurrentLocation: () => { },
        trackingPointsRef: { current: engine.trackingPoints },
        simplifiedPoints: [],
        compressedPolyline: '',
        segmentStartIndices: [],
        segmentStartIndicesRef: { current: [] },
        currentSegmentIndexRef: { current: 0 },
        setLastSampledPoint: () => { },
        setLastSampledTime: () => { },
        lastSampledBearing: 0,
        setLastSampledBearing: () => { },
        appendTrackingPoint: () => { },
        incrementTotalPoints: () => { },
        recordRejectedPoint: () => { },
        shouldSamplePoint: () => true,
        validateAndFilterPoint: () => true,
        startTime: engine.tripStartTime || Date.now(),
        setStartTime: () => { },
        setMaxSpeed: () => { },
        maxSpeedRef: { current: engine.maxSpeed },
        totalStops: 0,
        setTotalStops: () => { },
        totalStopTime: 0,
        setTotalStopTime: () => { },
        lastStopTime: null,
        setLastStopTime: () => { },
        isStopped: false,
        setIsStopped: () => { },
        altitudeData: [],
        setAltitudeData: () => { },
        drivingScore: 100,
        setDrivingScore: () => { },
        smoothedSpeed: engine.currentSpeed,
        speedHistory: [engine.currentSpeed],
        detectStop: () => { },
        scheduleInactivityPrompt: () => { },
        resetInactivityTracking: () => { },
        showInactivityPrompt: false,
        setShowInactivityPrompt: () => { },
        inactiveDurationMs: 0,
        INACTIVITY_SPEED_THRESHOLD_KMH: 5,
        INACTIVITY_DURATION_MS: 300000,
        timeText: formatElapsedTime(engine.elapsedTime),
        formatTripTime: (seconds: number) => formatElapsedTime(seconds),
        calculateElevationGain: () => 0,
        getCurrentTripTime: () => engine.elapsedTime,
        startTripTimer: () => { },
        pauseTripTimer: () => { },
        resumeTripTimer: () => { },
        stopTripTimer: () => { },
        resetTripTimer: () => { },
        tripName: '',
        setTripName: () => { },
        tripDescription: '',
        setTripDescription: () => { },
        tripSteps: [],
        setTripSteps: () => { },
        showTripSummary: false,
        setShowTripSummary: () => { },
        showStepsEditor: false,
        setShowStepsEditor: () => { },
        registerAnimationHandlers: () => { },
        setIsTracking: () => { },
        isTrackingRef: { current: engine.isTracking },
        flattenSegments: (segments: any[][]) => segments.flat(),
        getSegmentIndexForPosition: () => 0,
        compressPolyline: () => '',
        setCurrentSpeed: () => { },
        speedWatchRef: { current: null },
        handleLocationUpdate: () => { },
        executeWithLoading: async (fn: () => Promise<void>) => await fn(),
        isOperationLoading: () => false,
    };
};

function formatElapsedTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}h ${String(minutes).padStart(2, '0')}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${String(secs).padStart(2, '0')}s`;
    } else {
        return `${secs}s`;
    }
}
