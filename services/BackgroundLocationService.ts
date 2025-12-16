import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_TASK_NAME = 'LOCATION_TRACKING';

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[BackgroundLocation] Task Error:', error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    // Emit event for the UI/Context to pick up if alive
    DeviceEventEmitter.emit('onLocationUpdate', locations);

    // Optional: Persist to storage for redundancy (simplified for now)
    // await storeLocations(locations);
    console.log('[BackgroundLocation] Received', locations.length, 'points');
  }
});

export const startLocationTracking = async () => {
  try {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[BackgroundLocation] Permission denied');
      return;
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000, // Relaxed to 1000ms for stability
      distanceInterval: 0,
      activityType: Location.ActivityType.AutomotiveNavigation,
      foregroundService: {
        notificationTitle: "StravaCar Tracking",
        notificationBody: "Enregistrement de votre trajet en cours...",
        notificationColor: "#3B82F6",
      },
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
    });
    console.log('[BackgroundLocation] Started');
  } catch (e) {
    console.error('[BackgroundLocation] Start Error:', e);
  }
};

export const stopLocationTracking = async () => {
  console.log('[BackgroundLocation] Stopping tracking forcefully...');

  // 1. Stop updates specifically
  try {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    console.log('[BackgroundLocation] Location updates stopped');
  } catch (e) {
    // Ignore error if not running
    console.log('[BackgroundLocation] Warning stopping updates:', e.message);
  }

  // 2. Unregister task specifically
  try {
    await TaskManager.unregisterTaskAsync(LOCATION_TASK_NAME);
    console.log('[BackgroundLocation] Task unregistered');
  } catch (e) {
    // Ignore error if not registered
    console.log('[BackgroundLocation] Warning unregistering task:', e.message);
  }

  // 3. Final Verification
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (isRegistered) {
      console.warn('[BackgroundLocation] CRITICAL: Task still registered after stop attempt');
    } else {
      console.log('[BackgroundLocation] Stop sequence complete. Clean.');
    }
  } catch (e) {
    // ignore
  }
};

export const hasStartedBackgroundLocationUpdatesAsync = async () => {
  return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
};

export const BackgroundLocationService = {
  startLocationTracking,
  stopLocationTracking,
  hasStartedBackgroundLocationUpdatesAsync,
};
