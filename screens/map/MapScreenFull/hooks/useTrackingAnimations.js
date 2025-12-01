import { useCallback, useMemo, useRef } from 'react';
import { Animated } from 'react-native';

const useTrackingAnimations = () => {
  const pulseAnimRef = useRef(new Animated.Value(1));
  const startButtonAnimRef = useRef(new Animated.Value(1));
  const controlsAnimRef = useRef(new Animated.Value(1));

  const startPulseAnimation = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimRef.current, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimRef.current, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const stopPulseAnimation = useCallback(() => {
    pulseAnimRef.current.stopAnimation();
    pulseAnimRef.current.setValue(1);
  }, []);

  const animateStartButtonOut = useCallback(() => {
    Animated.timing(startButtonAnimRef.current, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const animateStartButtonIn = useCallback(() => {
    Animated.timing(startButtonAnimRef.current, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const animateControlsIn = useCallback(() => {
    controlsAnimRef.current.setValue(1);
    Animated.timing(controlsAnimRef.current, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, []);

  const animateControlsOut = useCallback(() => {
    Animated.timing(controlsAnimRef.current, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  return {
    pulseAnim: useMemo(() => pulseAnimRef.current, []),
    startButtonAnim: useMemo(() => startButtonAnimRef.current, []),
    controlsAnim: useMemo(() => controlsAnimRef.current, []),
    startPulseAnimation,
    stopPulseAnimation,
    animateStartButtonOut,
    animateStartButtonIn,
    animateControlsIn,
    animateControlsOut,
  };
};

export default useTrackingAnimations;

