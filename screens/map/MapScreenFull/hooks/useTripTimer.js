import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TIMER_STORAGE_KEY = '@tripTimerState_v2';
const TIMER_ALLOWED_STATUSES = ['idle', 'running', 'paused'];
const TIMER_DEFAULT_STATE = Object.freeze({
  status: 'idle',
  startedAt: null,
  accumulatedMs: 0,
  pausedAt: null,
});

const sanitizeTimerState = (rawState) => {
  if (!rawState || typeof rawState !== 'object') {
    return { ...TIMER_DEFAULT_STATE };
  }

  const status = TIMER_ALLOWED_STATUSES.includes(rawState.status) ? rawState.status : 'idle';
  const startedAt = typeof rawState.startedAt === 'number' ? rawState.startedAt : null;
  const accumulatedMs = typeof rawState.accumulatedMs === 'number' && rawState.accumulatedMs >= 0
    ? rawState.accumulatedMs
    : 0;
  const pausedAt = typeof rawState.pausedAt === 'number' ? rawState.pausedAt : null;

  const sanitized = {
    status,
    startedAt: status === 'running' && startedAt ? startedAt : null,
    accumulatedMs,
    pausedAt: status === 'paused' ? (pausedAt || null) : null,
  };

  if (sanitized.status !== 'running') {
    sanitized.startedAt = null;
  }
  if (sanitized.status !== 'paused') {
    sanitized.pausedAt = null;
  }

  return sanitized;
};

const computeElapsedMs = (state) => {
  if (!state) return 0;
  const base = Math.max(0, state.accumulatedMs || 0);

  if (state.status === 'running' && state.startedAt) {
    return base + Math.max(0, Date.now() - state.startedAt);
  }

  return base;
};

const computeElapsedSeconds = (state) => {
  return Math.floor(computeElapsedMs(state) / 1000);
};

const useTripTimer = () => {
  const [state, setState] = useState({ ...TIMER_DEFAULT_STATE });
  const stateRef = useRef({ ...TIMER_DEFAULT_STATE });
  const intervalRef = useRef(null);
  const [seconds, setSeconds] = useState(0);

  const persistState = useCallback((nextState) => {
    AsyncStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(nextState)).catch(() => {});
  }, []);

  const syncInterval = useCallback((nextState) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (nextState.status === 'running' && nextState.startedAt) {
      intervalRef.current = setInterval(() => {
        setSeconds(computeElapsedSeconds(stateRef.current));
      }, 1000);
    }
  }, []);

  const commitState = useCallback((updater) => {
    setState((prevState) => {
      const base = sanitizeTimerState(prevState);
      const proposed = typeof updater === 'function' ? updater(base) : updater;
      const next = sanitizeTimerState(proposed);

      stateRef.current = next;
      setSeconds(computeElapsedSeconds(next));
      syncInterval(next);
      persistState(next);

      return next;
    });
  }, [persistState, syncInterval]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const hydrate = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(TIMER_STORAGE_KEY);

      if (stored) {
        const parsed = sanitizeTimerState(JSON.parse(stored));
        stateRef.current = parsed;
        setState(parsed);
        setSeconds(computeElapsedSeconds(parsed));
        syncInterval(parsed);
        return parsed;
      }
    } catch (error) {
      console.error('Timer hydrate error:', error);
    }

    stateRef.current = { ...TIMER_DEFAULT_STATE };
    setState({ ...TIMER_DEFAULT_STATE });
    setSeconds(0);
    syncInterval({ ...TIMER_DEFAULT_STATE });
    return { ...TIMER_DEFAULT_STATE };
  }, [syncInterval]);

  const start = useCallback(() => {
    commitState(() => ({
      status: 'running',
      startedAt: Date.now(),
      accumulatedMs: 0,
      pausedAt: null,
    }));
  }, [commitState]);

  const pause = useCallback(() => {
    commitState((prev) => ({
      status: 'paused',
      startedAt: null,
      accumulatedMs: computeElapsedMs(prev),
      pausedAt: Date.now(),
    }));
  }, [commitState]);

  const resume = useCallback(() => {
    commitState((prev) => ({
      status: 'running',
      startedAt: Date.now(),
      accumulatedMs: Math.max(0, prev.accumulatedMs || 0),
      pausedAt: null,
    }));
  }, [commitState]);

  const stop = useCallback(() => {
    commitState((prev) => ({
      status: 'idle',
      startedAt: null,
      accumulatedMs: computeElapsedMs(prev),
      pausedAt: null,
    }));
  }, [commitState]);

  const reset = useCallback(() => {
    commitState(() => ({ ...TIMER_DEFAULT_STATE }));
  }, [commitState]);

  const getElapsedSeconds = useCallback(() => {
    return computeElapsedSeconds(stateRef.current);
  }, []);

  return useMemo(() => ({
    state,
    status: state.status,
    seconds,
    isRunning: state.status === 'running',
    isPaused: state.status === 'paused',
    start,
    pause,
    resume,
    stop,
    reset,
    hydrate,
    getElapsedSeconds,
  }), [state, seconds, start, pause, resume, stop, reset, hydrate, getElapsedSeconds]);
};

export default useTripTimer;



