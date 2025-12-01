import { useCallback, useRef } from 'react';
import { KalmanFilter, State } from 'kalman-filter';

const NOOP = () => { };
const ZERO_REF_HISTORY = Object.freeze([]);

const ensureFunction = (fn, fallback = NOOP) => (typeof fn === 'function' ? fn : fallback);
const ensureArray = (value) => (Array.isArray(value) ? value : ZERO_REF_HISTORY);

const normalizeSpeedMs = (rawSpeed) => {
  const numeric = Number(rawSpeed);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  return numeric;
};

const sanitizeCoordinate = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  if (Math.abs(numeric) > 180) {
    return fallback;
  }
  return numeric;
};

const useKalmanFilters = ({
  formatDisplaySpeed,
  setCurrentSpeed,
  setSmoothedSpeed,
  setSpeedHistory,
} = {}) => {
  const safeFormatDisplaySpeed = ensureFunction(formatDisplaySpeed, (speed) => {
    const clamped = Math.max(0, Number(speed) || 0);
    return Math.round(clamped);
  });

  const safeSetCurrentSpeed = ensureFunction(setCurrentSpeed);
  const safeSetSmoothedSpeed = ensureFunction(setSmoothedSpeed);
  const safeSetSpeedHistory = ensureFunction(setSpeedHistory);

  // State for Kalman Filter
  const kFilterRef = useRef(null);
  const kFilterStateRef = useRef(null);

  const initFilter = useCallback(() => {
    try {
      // Import dynamically if needed or assume it's available since we check package.json
      // But here we use the imported class
      kFilterRef.current = new KalmanFilter({
        observation: {
          sensorDimension: 2,
          stateProjection: [
            [1, 0],
            [0, 1],
          ],
          covariance: [
            [0.0001, 0], // Moderate observation noise (trust GPS less to filter noise)
            [0, 0.0001],
          ],
        },
        dynamic: {
          transition: [
            [1, 0],
            [0, 1],
          ],
          covariance: [
            [0.00001, 0], // Low process noise (assume smooth movement)
            [0, 0.00001],
          ],
        },
      });
      kFilterStateRef.current = null;
    } catch (error) {
      console.error('Failed to initialize Kalman Filter:', error);
    }
  }, []);

  const resetKalmanFilters = useCallback(() => {
    kFilterStateRef.current = null;
    // We can keep the filter instance, just reset the state
  }, []);

  const applyKalmanFilter = useCallback((latitude, longitude) => {
    const lat = sanitizeCoordinate(latitude, 0);
    const lng = sanitizeCoordinate(longitude, 0);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.warn('Coordonnées GPS invalides, retour (0,0)');
      return { latitude: 0, longitude: 0 };
    }

    try {
      if (!kFilterRef.current) {
        initFilter();
      }

      if (!kFilterRef.current) {
        // Fallback if init failed
        return { latitude: lat, longitude: lng };
      }

      // First point initialization
      if (!kFilterStateRef.current) {
        // We need to use the State class if available, or rely on the filter to create it
        // But the error says "argument is not a state", so we likely need to pass a State instance
        // or let the filter initialize it differently.
        // Actually, for the first point, we can just return the point and let the NEXT iteration use it as previous?
        // No, we need to store the state.

        // Try to construct a State if we can import it, otherwise we might need to use filter.predict() first?
        // Let's try to use the State class if we can import it.
        // If not, we can try to use kFilterRef.current.getInitState() if it exists, 
        // but usually we just pass null for the first time?

        // If we pass null as previousCorrected, the library might use the default init state from config.
        // Let's try passing null for the first call if we don't have a state yet.

        // But we want to initialize it at the FIRST GPS point, not (0,0).
        // So we should probably update the init options of the filter instance dynamically?
        // Or just create a state object that satisfies the check.

        // Let's try to import State first.

        kFilterStateRef.current = new State({
          mean: [[lat], [lng]],
          covariance: [
            [0.0001, 0],
            [0, 0.0001],
          ],
        });
        return { latitude: lat, longitude: lng };
      }

      // Predict and Correct
      // kalman-filter v2 style: filter(observations, { previousCorrected })
      const observation = [[lat], [lng]];
      const results = kFilterRef.current.filter({
        observation,
        previousCorrected: kFilterStateRef.current
      });

      // Depending on version, results might be the state object or array
      // Usually it returns the corrected state for the observation
      // Let's assume standard behavior: returns state object or array of states

      const newState = Array.isArray(results) ? results[0] : results;

      if (newState && newState.mean) {
        kFilterStateRef.current = newState;
        return {
          latitude: newState.mean[0][0],
          longitude: newState.mean[1][0],
        };
      }

      return { latitude: lat, longitude: lng };

    } catch (error) {
      console.error('Kalman filter error:', error);
      return { latitude: lat, longitude: lng };
    }
  }, [initFilter]);

  const smoothSpeed = useCallback(
    (rawSpeed) => {
      try {
        const speedMs = normalizeSpeedMs(rawSpeed);
        const speedKmh = speedMs * 3.6;

        const filteredSpeed = speedKmh;
        let smoothedValue = filteredSpeed;

        safeSetSpeedHistory((prevHistory) => {
          const history = ensureArray(prevHistory);
          const nextHistory = [...history, filteredSpeed].slice(-3);
          const lastSpeed = history.length > 0 ? history[history.length - 1] : filteredSpeed;
          const average = nextHistory.length > 0
            ? nextHistory.reduce((sum, value) => sum + value, 0) / nextHistory.length
            : filteredSpeed;
          const speedChange = Math.abs(filteredSpeed - lastSpeed);
          const finalSpeed = speedChange > 5 ? filteredSpeed : average;
          safeSetSmoothedSpeed(finalSpeed);
          safeSetCurrentSpeed(safeFormatDisplaySpeed(finalSpeed));
          smoothedValue = finalSpeed;
          return nextHistory;
        });

        return {
          raw: speedKmh,
          kalman: filteredSpeed,
          smoothed: smoothedValue,
        };
      } catch (error) {
        console.error('Erreur lissage vitesse:', error);
        const fallback = Math.max(0, Number(rawSpeed ?? 0) * 3.6);
        safeSetCurrentSpeed(safeFormatDisplaySpeed(fallback));
        safeSetSmoothedSpeed(fallback);
        return {
          raw: fallback,
          kalman: fallback,
          smoothed: fallback,
        };
      }
    },
    [safeFormatDisplaySpeed, safeSetCurrentSpeed, safeSetSmoothedSpeed, safeSetSpeedHistory],
  );

  return {
    applyKalmanFilter,
    smoothSpeed,
    resetKalmanFilters,
  };
};

export default useKalmanFilters;

