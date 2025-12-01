import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../utils/logger';

const LOCATION_TASK_NAME = 'stravacar-location-tracking';
const LOCATION_QUEUE_KEY = '@stravacar_location_queue';
const LAST_LOCATION_TIME_KEY = '@stravacar_last_location_time';
const BACKGROUND_QUEUE_KEY = '@stravacar_bg_location_queue'; // Ancien nom, gardé pour compatibilité
const MAX_PERSISTED_LOCATIONS = 2000;

let backgroundLocationHandler = null;
let lastErrorHandler = null;

// ⚡ NOUVEAU: Callback direct pour traitement immédiat
let locationCallback = null;

export const setLocationCallback = (callback) => {
  locationCallback = callback;
  logger.log(`Callback ${callback ? 'enregistré' : 'supprimé'}`, 'LocationService');
};

export const setBackgroundLocationHandler = (handler) => {
  backgroundLocationHandler = handler;
};

export const setBackgroundLocationErrorHandler = (handler) => {
  lastErrorHandler = handler;
};

const persistLocationsAsync = async (locations) => {
  if (!Array.isArray(locations) || locations.length === 0) {
    return;
  }

  try {
    const rawQueue = await AsyncStorage.getItem(BACKGROUND_QUEUE_KEY);
    const queue = rawQueue ? JSON.parse(rawQueue) : [];
    const merged = [...queue, ...locations]
      .slice(-MAX_PERSISTED_LOCATIONS);
    await AsyncStorage.setItem(BACKGROUND_QUEUE_KEY, JSON.stringify(merged));
  } catch (storageError) {
    logger.error('Persist queue error', storageError, 'LocationService');
  }
};

export const drainPersistedLocationsAsync = async () => {
  try {
    const rawQueue = await AsyncStorage.getItem(BACKGROUND_QUEUE_KEY);
    if (!rawQueue) {
      return [];
    }
    await AsyncStorage.removeItem(BACKGROUND_QUEUE_KEY);
    return JSON.parse(rawQueue) || [];
  } catch (error) {
    logger.error('Drain queue error', error, 'LocationService');
    return [];
  }
};

// TaskManager.defineTask sera redéfini plus bas avec la nouvelle logique

const androidForegroundService = {
  notificationTitle: 'Trajet en cours',
  notificationBody: 'Tracking actif en arrière-plan',
  notificationColor: '#1E3A8A',
};

const defaultStartOptions = {
  // Simple : 3 points par seconde (3 Hz)
  accuracy: Platform.OS === 'ios' ? Location.Accuracy.BestForNavigation : Location.Accuracy.High,
  timeInterval: 333, // 333ms = 3 Hz (3 points par seconde)
  distanceInterval: 0, // Pas de filtre de distance, on prend tous les points
  activityType: Location.ActivityType.AutomotiveNavigation,
  pausesUpdatesAutomatically: false, // CRITIQUE : Empêche iOS de couper le GPS à l'arrêt
  deferredUpdatesInterval: 0,
  deferredUpdatesDistance: 0,
  showsBackgroundLocationIndicator: true, // Requis pour le mode background "Always" sur iOS
  foregroundService: androidForegroundService,
};

// Les fonctions startBackgroundLocationUpdatesAsync, stopBackgroundLocationUpdatesAsync
// et hasStartedBackgroundLocationUpdatesAsync sont maintenant des alias définis à la fin du fichier

export const getBackgroundTaskName = () => LOCATION_TASK_NAME;

// ========== Nouvelles fonctions pour le système unifié ==========

/**
 * Persister une location dans la queue
 */
const persistLocation = async (location) => {
  // ⚡ NOUVEAU: Essayer callback direct d'abord
  if (locationCallback) {
    try {
      locationCallback(location);
      // Callback réussi = pas besoin de queue !
      // Mettre à jour seulement le timestamp
      const now = Date.now();
      await AsyncStorage.setItem(LAST_LOCATION_TIME_KEY, now.toString());
      return;
    } catch (callbackError) {
      logger.error('Erreur callback, fallback queue', callbackError, 'LocationService');
      // Continue vers queue si callback échoue
    }
  }

  // Fallback: Persister dans la queue (ancien système)
  try {
    const rawQueue = await AsyncStorage.getItem(LOCATION_QUEUE_KEY);
    const queue = rawQueue ? JSON.parse(rawQueue) : [];
    const locationWithTimestamp = {
      ...location,
      processedAt: Date.now(),
    };
    queue.push(locationWithTimestamp);
    // Garder seulement les 2000 dernières locations
    const trimmedQueue = queue.slice(-MAX_PERSISTED_LOCATIONS);
    await AsyncStorage.setItem(LOCATION_QUEUE_KEY, JSON.stringify(trimmedQueue));

    // Mettre à jour le timestamp de dernière location
    const now = Date.now();
    await AsyncStorage.setItem(LAST_LOCATION_TIME_KEY, now.toString());

    // Log détaillé pour diagnostic
    const coords = location.coords || location;
    logger.log(`📍 Point persisté: lat=${coords.latitude?.toFixed(6)}, lng=${coords.longitude?.toFixed(6)}, acc=${coords.accuracy?.toFixed(1)}m, speed=${coords.speed ? (coords.speed * 3.6).toFixed(1) : 'N/A'}km/h, queue=${trimmedQueue.length}`, 'LocationService');
  } catch (error) {
    logger.error('Erreur persistance location', error, 'LocationService');
  }
};

// Redéfinir la task pour utiliser la nouvelle queue
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  const timestamp = Date.now();

  // ✅ FIX #2: HEARTBEAT IMMÉDIAT (même en cas d'erreur)
  try {
    await AsyncStorage.setItem('tracking_heartbeat', timestamp.toString());
  } catch (hbError) {
    console.error('❌ Erreur enregistrement heartbeat:', hbError);
  }

  if (error) {
    logger.error(`Task error à ${new Date(timestamp).toLocaleTimeString()}`, error, 'LocationService');
    if (typeof lastErrorHandler === 'function') {
      lastErrorHandler(error);
    }
    return;
  }

  const { locations } = data || {};
  if (!locations || locations.length === 0) {
    logger.warn(`Task appelée mais aucune location reçue à ${new Date(timestamp).toLocaleTimeString()}`, 'LocationService');
    return;
  }

  logger.log(`✅ Task reçoit ${locations.length} location(s) à ${new Date(timestamp).toLocaleTimeString()}`, 'LocationService');

  // Persister chaque location dans la nouvelle queue
  for (const location of locations) {
    await persistLocation(location);
  }

  // Appeler aussi l'ancien handler si présent (pour compatibilité)
  if (typeof backgroundLocationHandler === 'function') {
    locations.forEach((location) => {
      try {
        backgroundLocationHandler(location);
      } catch (handlerError) {
        logger.error('Handler error', handlerError, 'LocationService');
      }
    });
  }
});

/**
 * Récupérer toutes les locations en attente dans la queue
 */
export const getQueuedLocations = async () => {
  try {
    const rawQueue = await AsyncStorage.getItem(LOCATION_QUEUE_KEY);
    if (!rawQueue) {
      return [];
    }
    const queue = JSON.parse(rawQueue);
    const locations = Array.isArray(queue) ? queue : [];
    if (locations.length > 0) {
      logger.log(`📦 Queue contient ${locations.length} location(s) en attente`, 'LocationService');
    }
    return locations;
  } catch (error) {
    logger.error('Erreur récupération queue', error, 'LocationService');
    return [];
  }
};

/**
 * Vider la queue de locations
 */
export const clearLocationQueue = async () => {
  try {
    await AsyncStorage.removeItem(LOCATION_QUEUE_KEY);
  } catch (error) {
    logger.error('Erreur vidage queue', error, 'LocationService');
  }
};

/**
 * Récupérer le timestamp de la dernière location
 */
export const getLastLocationTime = async () => {
  try {
    const timestamp = await AsyncStorage.getItem(LAST_LOCATION_TIME_KEY);
    return timestamp ? parseInt(timestamp, 10) : null;
  } catch (error) {
    logger.error('Erreur récupération dernière location', error, 'LocationService');
    return null;
  }
};

/**
 * Vérifier la santé du tracking (si des locations arrivent encore)
 */
export const checkTrackingHealth = async (maxSilenceMs = 60000) => {
  try {
    const lastTime = await getLastLocationTime();
    const now = Date.now();

    if (!lastTime) {
      logger.warn(`Health check: Aucune location enregistrée (lastTime: ${lastTime})`, 'LocationService');
      return false;
    }

    const timeSinceLastLocation = now - lastTime;
    const isHealthy = timeSinceLastLocation < maxSilenceMs;

    if (!isHealthy) {
      const secondsSinceLast = Math.floor(timeSinceLastLocation / 1000);
      logger.log(`❌ Health check FAILED: ${secondsSinceLast}s depuis dernière location (max: ${maxSilenceMs / 1000}s)`, 'LocationService');
      logger.log(`   Dernière location: ${new Date(lastTime).toLocaleTimeString()}, Maintenant: ${new Date(now).toLocaleTimeString()}`, 'LocationService');
    } else {
      const secondsSinceLast = Math.floor(timeSinceLastLocation / 1000);
      if (timeSinceLastLocation > 10000) { // Log seulement si > 10s pour éviter spam
        logger.log(`✅ Health check OK: ${secondsSinceLast}s depuis dernière location`, 'LocationService');
      }
    }

    return isHealthy;
  } catch (error) {
    logger.error('Erreur health check', error, 'LocationService');
    return false;
  }
};

/**
 * Redémarrer le tracking
 */
export const restartLocationTracking = async () => {
  try {
    logger.log('🔄 Redémarrage du tracking...', 'LocationService');
    await stopLocationTracking();
    await new Promise(resolve => setTimeout(resolve, 500));
    const result = await startLocationTracking();
    if (result) {
      logger.log('✅ Tracking redémarré avec succès', 'LocationService');
    } else {
      logger.warn('❌ Échec redémarrage tracking', 'LocationService');
    }
    return result;
  } catch (error) {
    logger.error('Erreur redémarrage tracking', error, 'LocationService');
    return false;
  }
};

// Plus de logique de fréquence adaptative - on garde 3 Hz fixe

/**
 * Démarre le tracking de localisation (nouveau nom unifié)
 */
export const startLocationTracking = async (customOptions = {}) => {
  try {
    const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (isStarted) {
      logger.warn('Tracking déjà actif, vérification de l\'état...', 'LocationService');
      const lastTime = await getLastLocationTime();
      const now = Date.now();
      if (lastTime) {
        const timeSinceLast = now - lastTime;
        logger.log(`   Dernière location: ${timeSinceLast < 60000 ? `${Math.floor(timeSinceLast / 1000)}s` : `${Math.floor(timeSinceLast / 60000)}min`} ago`, 'LocationService');
      }
      return true;
    }

    logger.log('🚀 Démarrage du tracking (3 Hz fixe)...', 'LocationService');

    // Options simples : 3 Hz fixe
    const finalOptions = {
      ...defaultStartOptions,
      ...customOptions,
      // Forcer 3 Hz même si customOptions essaie de le changer
      timeInterval: 333,
      accuracy: customOptions.accuracy || (Platform.OS === 'ios'
        ? Location.Accuracy.BestForNavigation
        : Location.Accuracy.High),
      foregroundService: Platform.OS === 'android'
        ? {
          ...androidForegroundService,
          ...(customOptions.foregroundService || {}),
        }
        : undefined,
    };

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, finalOptions);

    // Initialiser le timestamp de dernière location
    const now = Date.now();
    await AsyncStorage.setItem(LAST_LOCATION_TIME_KEY, now.toString());

    logger.log(`✅ Tracking démarré avec succès à ${new Date(now).toLocaleTimeString()}`, 'LocationService');
    logger.log(`   Fréquence: 3 Hz (333ms)`, 'LocationService');
    logger.log(`   Accuracy: ${finalOptions.accuracy}`, 'LocationService');
    logger.log(`   Distance interval: ${finalOptions.distanceInterval}m`, 'LocationService');
    return true;
  } catch (error) {
    logger.error('Erreur démarrage tracking', error, 'LocationService');
    throw error;
  }
};

/**
 * Arrête le tracking de localisation (nouveau nom unifié)
 */
export const stopLocationTracking = async () => {
  try {
    const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (!isStarted) {
      logger.warn('Arrêt demandé mais tracking pas actif', 'LocationService');
      return false;
    }

    const lastTime = await getLastLocationTime();
    const now = Date.now();

    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    logger.log(`⏹️ Tracking arrêté à ${new Date(now).toLocaleTimeString()}`, 'LocationService');
    if (lastTime) {
      const timeSinceLast = now - lastTime;
      logger.log(`   Dernière location: ${timeSinceLast < 60000 ? `${Math.floor(timeSinceLast / 1000)}s` : `${Math.floor(timeSinceLast / 60000)}min`} ago`, 'LocationService');
    }
    return true;
  } catch (error) {
    logger.error('Erreur arrêt tracking', error, 'LocationService');
    throw error;
  }
};

/**
 * Vérifie si le tracking est actif
 */
export const isLocationTrackingActive = async () => {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch (error) {
    logger.error('Erreur vérification état', error, 'LocationService');
    return false;
  }
};

// Alias pour compatibilité avec l'ancien code
export const startBackgroundLocationUpdatesAsync = startLocationTracking;
export const stopBackgroundLocationUpdatesAsync = stopLocationTracking;
export const hasStartedBackgroundLocationUpdatesAsync = isLocationTrackingActive;

