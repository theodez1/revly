import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const INACTIVITY_SPEED_THRESHOLD_KMH = 5;
const INACTIVITY_DURATION_MS = 2 * 60 * 1000;

interface UseTripMetricsProps {
  trackingPoints: any[];
  timerSeconds: number;
  getElapsedSeconds: () => number;
  isPaused: boolean;
}

const useTripMetrics = ({
  trackingPoints,
  timerSeconds,
  getElapsedSeconds,
  isPaused,
}: UseTripMetricsProps) => {
  const [startTime, setStartTime] = useState<number | null>(null);
  const [maxSpeedState, setMaxSpeedState] = useState(0);
  const maxSpeedRef = useRef(0);
  const [totalStops, setTotalStops] = useState(0);
  const [totalStopTime, setTotalStopTime] = useState(0);
  const [lastStopTime, setLastStopTime] = useState<number | null>(null);
  const [isStopped, setIsStopped] = useState(false);
  const [altitudeData, setAltitudeData] = useState<number[]>([]);
  const [drivingScoreState, setDrivingScoreState] = useState(100);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [smoothedSpeed, setSmoothedSpeed] = useState(0);
  const [speedHistory, setSpeedHistoryState] = useState<number[]>([]);
  const [showInactivityPrompt, setShowInactivityPrompt] = useState(false);
  const [inactiveDurationMs, setInactiveDurationMs] = useState(0);

  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityStartRef = useRef<number | null>(null);
  const inactivityAlertShownRef = useRef(false);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }
  }, []);

  const resetInactivityTracking = useCallback(() => {
    clearInactivityTimer();
    inactivityStartRef.current = null;
    inactivityAlertShownRef.current = false;
    setShowInactivityPrompt(false);
    setInactiveDurationMs(0);
  }, [clearInactivityTimer]);

  const scheduleInactivityPrompt = useCallback(() => {
    if (inactivityTimeoutRef.current || isPaused) {
      return;
    }
    inactivityStartRef.current = Date.now();
    inactivityTimeoutRef.current = setTimeout(() => {
      inactivityTimeoutRef.current = null;
      const elapsed = Date.now() - (inactivityStartRef.current || Date.now());
      setInactiveDurationMs(elapsed);
      setShowInactivityPrompt(true);
    }, INACTIVITY_DURATION_MS);
  }, [isPaused]);

  useEffect(() => () => clearInactivityTimer(), [clearInactivityTimer]);

  const setMaxSpeed = useCallback((speed: number) => {
    setMaxSpeedState(speed);
    maxSpeedRef.current = speed;
  }, []);

  const setAltitudeDataSafe = useCallback((updater: any) => {
    setAltitudeData((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  const setDrivingScore = useCallback((score: number) => {
    setDrivingScoreState(score);
  }, []);

  const setSpeedHistory = useCallback((updater: any) => {
    setSpeedHistoryState((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  const formatDisplaySpeed = useCallback((speed: number) => {
    const nonNegativeSpeed = Math.max(0, speed);
    if (nonNegativeSpeed >= 0.6) {
      return Math.max(1, Math.round(nonNegativeSpeed));
    }
    return 0;
  }, []);

  const calculateTripTime = useCallback(() => {
    if (!startTime) return 0;
    return Math.floor((Date.now() - startTime) / 1000);
  }, [startTime]);

  const calculateDrivingScore = useCallback(() => {
    let score = 100;

    if (maxSpeedState > 130) {
      score -= Math.min(30, (maxSpeedState - 130) * 2);
    }

    if (totalStops > 10) {
      score -= Math.min(20, (totalStops - 10) * 2);
    }

    const tripTime = calculateTripTime();
    if (tripTime > 0) {
      const stopTimePercentage = (totalStopTime / tripTime) * 100;
      if (stopTimePercentage > 20) {
        score -= Math.min(25, (stopTimePercentage - 20) * 1.5);
      }
    }

    return Math.max(0, Math.round(score));
  }, [calculateTripTime, maxSpeedState, totalStopTime, totalStops]);

  useEffect(() => {
    setDrivingScoreState(calculateDrivingScore());
  }, [calculateDrivingScore]);

  const detectStop = useCallback(
    (speed: number) => {
      try {
        const speedKmh = speed * 3.6;

        if (speedKmh < INACTIVITY_SPEED_THRESHOLD_KMH && !isStopped) {
          setIsStopped(true);
          setLastStopTime(Date.now());
          setTotalStops((prev) => prev + 1);
        } else if (speedKmh >= INACTIVITY_SPEED_THRESHOLD_KMH && isStopped) {
          setIsStopped(false);
          if (lastStopTime) {
            const stopDuration = Date.now() - lastStopTime;
            setTotalStopTime((prev) => prev + stopDuration);
          }
        }

        if (speedKmh < INACTIVITY_SPEED_THRESHOLD_KMH && !isPaused) {
          scheduleInactivityPrompt();
        } else if (speedKmh >= INACTIVITY_SPEED_THRESHOLD_KMH) {
          resetInactivityTracking();
        }
      } catch (error) {
        console.error('Erreur détection arrêt:', error);
      }
    },
    [isPaused, isStopped, lastStopTime, resetInactivityTracking, scheduleInactivityPrompt],
  );

  const calculateDistanceBetweenPoints = useCallback((pointA: any, pointB: any) => {
    const lat1 = pointA.latitude * Math.PI / 180;
    const lat2 = pointB.latitude * Math.PI / 180;
    const deltaLat = (pointB.latitude - pointA.latitude) * Math.PI / 180;
    const deltaLng = (pointB.longitude - pointA.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const earthRadiusKm = 6371;
    return earthRadiusKm * c;
  }, []);

  const totalDistance = useMemo(() => {
    if (trackingPoints.length < 2) return 0;

    let distance = 0;
    for (let i = 1; i < trackingPoints.length; i += 1) {
      const current = trackingPoints[i];
      const previous = trackingPoints[i - 1];
      if (!current || !previous || (current.segmentIndex ?? 0) !== (previous.segmentIndex ?? 0)) {
        continue;
      }
      distance += calculateDistanceBetweenPoints(previous, current);
    }
    return distance;
  }, [calculateDistanceBetweenPoints, trackingPoints]);

  const formatTripTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }, []);

  const timeText = useMemo(() => formatTripTime(timerSeconds), [formatTripTime, timerSeconds]);

  const calculateElevationGain = useCallback(() => {
    if (altitudeData.length < 2) return 0;

    let totalGain = 0;
    for (let i = 1; i < altitudeData.length; i += 1) {
      const diff = altitudeData[i] - altitudeData[i - 1];
      if (diff > 0) {
        totalGain += diff;
      }
    }
    return Math.round(totalGain);
  }, [altitudeData]);

  const getCurrentTripTime = useCallback(() => getElapsedSeconds(), [getElapsedSeconds]);

  return {
    startTime,
    setStartTime,
    maxSpeed: maxSpeedState,
    setMaxSpeed,
    maxSpeedRef,
    totalStops,
    setTotalStops,
    totalStopTime,
    setTotalStopTime,
    lastStopTime,
    setLastStopTime,
    isStopped,
    setIsStopped,
    altitudeData,
    setAltitudeData: setAltitudeDataSafe,
    drivingScore: drivingScoreState,
    setDrivingScore,
    currentSpeed,
    setCurrentSpeed,
    smoothedSpeed,
    setSmoothedSpeed,
    speedHistory,
    setSpeedHistory,
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
  };
};

export default useTripMetrics;

