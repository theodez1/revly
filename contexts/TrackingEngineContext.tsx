import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as polyline from 'google-polyline';
import { DeviceEventEmitter, Alert, AppState } from 'react-native';
import { BackgroundLocationService } from '../services/BackgroundLocationService';

/**
 * TrackingEngineContext - GPS Tracking Engine
 * 
 * Système de tracking GPS en temps réel avec:
 * - Collecte haute fréquence de points GPS (adaptative)
 * - Gestion des segments (pause/reprise)
 * - Calcul de métriques en temps réel
 * - Filtrage intelligent des points aberrants
 */

interface GPSPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  speed?: number;
  altitude?: number;
  accuracy?: number;
  heading?: number;
}

interface TrackingState {
  isTracking: boolean;
  isPaused: boolean;
  currentLocation: GPSPoint | null;
  // VISUAL ONLY state (throttled)
  visualRoute: GPSPoint[];
  // RAW recording (full resolution) is internal in Refs, but we expose metrics
  currentSpeed: number;
  maxSpeed: number;
  totalDistance: number;
  elapsedTime: number;
  tripStartTime: number | null;
}

interface TrackingEngineContextValue extends TrackingState {
  activeRouteSegments: GPSPoint[][];
  trackingPoints: GPSPoint[];
  trackingSegments: GPSPoint[][];

  timeText: string;
  startTracking: () => Promise<void>;
  pauseTracking: () => void;
  resumeTracking: () => void;
  stopTracking: () => void;
  resetTracking: () => void;
  formatDisplaySpeed: (speedMs: number) => number;
  handleLocationUpdate: (point: GPSPoint) => void;
  setPaused: (paused: boolean) => void;
  setMaxSpeed: (speed: number) => void; // ⚡ NEW: Allow external max speed updates
  setCurrentSpeed: (speed: number) => void; // ⚡ NEW: Allow external speed updates
  executeWithLoading: (fn: () => Promise<void>, key?: string) => Promise<void>;
  isOperationLoading: (key?: string) => boolean;
  registerAnimationHandlers: (handlers: any) => void;
  setCurrentLocation: (location: any) => void;
  compressPolyline: (points: GPSPoint[]) => string; // ⚡ NEW: Polyline compression
  // Permissions
  locationPermission: string;
  isRequestingPermission: boolean;
  checkLocationPermission: () => Promise<any>;
  // Trip metadata
  tripName: string;
  setTripName: (name: string) => void;
  tripDescription: string;
  setTripDescription: (desc: string) => void;
  tripSteps: any[];
  setTripSteps: (steps: any[] | ((prev: any[]) => any[])) => void;
  showStepsEditor: boolean;
  setShowStepsEditor: (show: boolean) => void;
  showTripSummary: boolean;
  setShowTripSummary: (show: boolean) => void;
}

const TrackingEngineContext = createContext<TrackingEngineContextValue | null>(null);

interface TrackingEngineProviderProps {
  children: ReactNode;
}

// Constantes de configuration GPS - MAXIMALES pour rendu temps réel ultra-fluide
const GPS_CONFIG = {
  // Haute précision pour navigation
  accuracy: Location.Accuracy.BestForNavigation,
  // Fréquence RÉDUITE: 1Hz (1000ms) pour économiser batterie/CPU
  timeInterval: 1000,
  // Distance minimale: 5 mètres pour éviter le bruit
  distanceInterval: 5,
  // Précision GPS minimale acceptable: 50 mètres
  minAccuracy: 50,
  // Distance minimale pour filtrage: 5m
  minDistanceFilter: 5,
  // Vitesse minimale: 0
  minSpeedThreshold: 0,
};

export const TrackingEngineProvider: React.FC<TrackingEngineProviderProps> = ({ children }) => {
  // État du tracking
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<GPSPoint | null>(null);

  // RENDER STATE (Throttled for Performance)
  // Only contains points that need to be drawn on map
  const [visualRoute, setVisualRoute] = useState<GPSPoint[]>([]);

  // DATA REFS (High Frequency)
  // Holds ALL data without causing re-renders
  const allPointsRef = useRef<GPSPoint[]>([]);
  const allSegmentsRef = useRef<GPSPoint[][]>([[]]);
  const lastVisualUpdateRef = useRef<number>(0);

  // Métriques
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const maxSpeedRef = useRef(0); // ⚡ Ref to avoid closure issues
  const [totalDistance, setTotalDistance] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [tripStartTime, setTripStartTime] = useState<number | null>(null);

  // Trip metadata
  const [tripName, setTripName] = useState('');
  const [tripDescription, setTripDescription] = useState('');
  const [tripSteps, setTripSteps] = useState<any[]>([]);
  const [showStepsEditor, setShowStepsEditor] = useState(false);
  const [showTripSummary, setShowTripSummary] = useState(false);

  // Permissions
  const [locationPermission, setLocationPermission] = useState('undetermined');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  // Références pour éviter les stale closures
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastRecordedPoint = useRef<GPSPoint | null>(null);
  const currentSegmentIndex = useRef(0);
  const isTrackingRef = useRef(false);
  const isPausedRef = useRef(false);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);

  /**
   * Calcule la distance en mètres entre deux points GPS (formule Haversine)
   */
  const calculateDistance = useCallback((point1: GPSPoint, point2: GPSPoint): number => {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = (point1.latitude * Math.PI) / 180;
    const φ2 = (point2.latitude * Math.PI) / 180;
    const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }, []);

  /**
   * Vérifie si un point GPS doit être enregistré
   * STRATÉGIE MAXIMALE: Enregistrer presque tous les points pour rendu ultra-fluide
   */
  const shouldRecordPoint = useCallback((newPoint: GPSPoint): boolean => {
    // Toujours enregistrer le premier point
    if (!lastRecordedPoint.current) {
      return true;
    }

    const lastPoint = lastRecordedPoint.current;

    // SEUL FILTRE STRICT: Précision GPS
    // Rejeter uniquement les points avec très mauvaise précision
    if (newPoint.accuracy && newPoint.accuracy > GPS_CONFIG.minAccuracy) {
      console.log('[GPS] Point rejeté: précision insuffisante', newPoint.accuracy);
      return false;
    }

    // Calculer la distance depuis le dernier point
    const distance = calculateDistance(lastPoint, newPoint);

    // Calculer le temps écoulé
    const timeDelta = newPoint.timestamp - lastPoint.timestamp;
    const timeSeconds = timeDelta / 1000;

    // FILTRAGE ADAPTATIF
    // ⚡ REQUESTED: Retenir le MAX de points précis. On ignore la distance et le temps min.
    // On garde tout ce qui a une bonne précision.
    // ✅ ENREGISTRER
    return true;
  }, [calculateDistance, currentSpeed]);

  /**
   * Traite une nouvelle position GPS
   * Cette fonction est maintenant appelée depuis l'extérieur (via Mapbox.UserLocation.onUpdate)
   * pour garantir une synchronisation parfaite
   */
  const handleLocationUpdate = useCallback((newPoint: GPSPoint) => {
    if (!isTrackingRef.current || isPausedRef.current) {
      return;
    }

    // Mettre à jour la position actuelle (toujours, pour l'affichage)
    setCurrentLocation(newPoint);

    // Mettre à jour la vitesse actuelle
    const speedKmh = (newPoint.speed || 0) * 3.6;
    setCurrentSpeed(speedKmh);

    // Mettre à jour la vitesse max (using REF to avoid closure issues)
    if (speedKmh > maxSpeedRef.current) {
      console.log(`[GPS] 🚀 NEW MAX SPEED: ${speedKmh.toFixed(1)} km/h (previous: ${maxSpeedRef.current.toFixed(1)})`);
      maxSpeedRef.current = speedKmh; // Update ref immediately
      setMaxSpeed(speedKmh); // Update state for UI
    } else {
      console.log(`[GPS] Current: ${speedKmh.toFixed(1)} km/h | Max: ${maxSpeedRef.current.toFixed(1)} km/h`);
    }

    // ⚡ DÉTECTION DE GAP (Background/Retour)
    // Vérifier s'il y a un gap significatif qui indique un retour du background
    const shouldCreateNewSegment = (() => {
      if (!lastRecordedPoint.current) {
        return false; // Premier point, pas de gap
      }

      const lastPoint = lastRecordedPoint.current;
      const timeDelta = newPoint.timestamp - lastPoint.timestamp;
      const timeDeltaSeconds = timeDelta / 1000;
      const distance = calculateDistance(lastPoint, newPoint);

      // Gap de temps > 30 secondes OU distance > 500m = probable retour du background
      const TIME_GAP_THRESHOLD = 30000; // 30 secondes
      const DISTANCE_GAP_THRESHOLD = 500; // 500 mètres

      if (timeDelta > TIME_GAP_THRESHOLD || distance > DISTANCE_GAP_THRESHOLD) {
        console.log(`[GPS] ⚠️ Gap détecté: ${timeDeltaSeconds.toFixed(1)}s, ${distance.toFixed(1)}m - Création nouveau segment`);
        return true;
      }

      return false;
    })();

    // Créer un nouveau segment si gap détecté
    if (shouldCreateNewSegment) {
      currentSegmentIndex.current += 1;
      allSegmentsRef.current[currentSegmentIndex.current] = [];
      console.log(`[GPS] Nouveau segment créé (index: ${currentSegmentIndex.current})`);
    }

    // Vérifier si on doit enregistrer ce point
    if (!shouldRecordPoint(newPoint)) {
      return;
    }

    console.log('[GPS] Point enregistré:', {
      lat: newPoint.latitude.toFixed(6),
      lng: newPoint.longitude.toFixed(6),
      speed: speedKmh.toFixed(1),
      accuracy: newPoint.accuracy?.toFixed(1),
      segment: currentSegmentIndex.current,
    });

    // 1. RECORDING (Always)
    // Enregistrer le point dans les Refs (High Frequency Data)
    lastRecordedPoint.current = newPoint;
    allPointsRef.current.push(newPoint);

    // Add to current segment ref
    if (allSegmentsRef.current[currentSegmentIndex.current]) {
      allSegmentsRef.current[currentSegmentIndex.current].push(newPoint);
    } else {
      allSegmentsRef.current[currentSegmentIndex.current] = [newPoint];
    }

    setTotalDistance(prev => {
      // Calculate incremental distance just for metrics
      // Ne pas ajouter la distance si c'est un nouveau segment (gap)
      if (shouldCreateNewSegment) {
        return prev; // Ne pas compter la distance du gap
      }
      if (allPointsRef.current.length > 1) {
        const last = allPointsRef.current[allPointsRef.current.length - 2];
        return prev + calculateDistance(last, newPoint);
      }
      return prev;
    });

    // 2. RENDERING (Throttled)
    // Update visual state only if enough time passed (e.g., 1000ms) OR significant distance
    // This prevents React from re-rendering the MapView 3-10 times a second
    const now = Date.now();
    const timeSinceLastVisual = now - lastVisualUpdateRef.current;

    // Throttle to 1Hz (1000ms) for map updates
    if (timeSinceLastVisual > 1000) {
      lastVisualUpdateRef.current = now;

      // Sync Visual State with Refs
      // We clone the refs to trigger state update
      // We can flatten segments for easier rendering
      const flatRoute = allSegmentsRef.current.flat();
      setVisualRoute(flatRoute);
    }
  }, [calculateDistance, shouldRecordPoint, maxSpeed]);

  /**
   * Démarre le tracking GPS
   * Note: La collecte GPS est maintenant gérée par Mapbox.UserLocation.onUpdate
   */
  const startTracking = useCallback(async () => {
    try {
      console.log('[TrackingEngine] Démarrage du tracking GPS...');

      // Vérifier les permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Permission de localisation refusée');
      }

      // Réinitialiser l'état
      setIsTracking(true);
      setIsPaused(false);
      isTrackingRef.current = true;
      isPausedRef.current = false;

      setTripStartTime(Date.now());
      currentSegmentIndex.current = 0;

      // Reset Refs
      allPointsRef.current = [];
      allSegmentsRef.current = [[]];
      lastVisualUpdateRef.current = 0;
      setVisualRoute([]); // Clear map

      // Obtenir la position initiale
      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: GPS_CONFIG.accuracy,
      });

      const initialPoint: GPSPoint = {
        latitude: initialLocation.coords.latitude,
        longitude: initialLocation.coords.longitude,
        timestamp: initialLocation.timestamp,
        speed: initialLocation.coords.speed || undefined,
        altitude: initialLocation.coords.altitude || undefined,
        accuracy: initialLocation.coords.accuracy || undefined,
        heading: initialLocation.coords.heading || undefined,
      };

      setCurrentLocation(initialPoint);
      lastRecordedPoint.current = initialPoint;

      // Init start point
      allPointsRef.current = [initialPoint];
      allSegmentsRef.current = [[initialPoint]];
      setVisualRoute([initialPoint]);

      // Démarrer le timer
      timerInterval.current = setInterval(() => {
        if (isTrackingRef.current && !isPausedRef.current) {
          setElapsedTime(prev => prev + 1);
        }
      }, 1000);

      // Démarrer le service de background tracking (Task Manager)
      await BackgroundLocationService.startLocationTracking();

      // Écouter les mises à jour du background (si l'app est active mais en background)
      const subscription = DeviceEventEmitter.addListener('onLocationUpdate', (locations) => {
        if (locations && locations.length > 0) {
          locations.forEach((loc: any) => {
            const gpsPoint = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              timestamp: loc.timestamp || Date.now(),
              speed: loc.coords.speed,
              altitude: loc.coords.altitude,
              accuracy: loc.coords.accuracy,
              heading: loc.coords.heading,
            };
            handleLocationUpdate(gpsPoint);
          });
        }
      });

      // Stocker la souscription pour nettoyage
      (startTracking as any).subscription = subscription;

      console.log('[TrackingEngine] Tracking démarré - Background Service activé');
    } catch (error) {
      console.error('Erreur startTracking:', error);
      Alert.alert('Erreur', 'Impossible de démarrer le suivi GPS');
      setIsTracking(false);
    }
  }, [isTracking, isPaused, handleLocationUpdate]);

  /**
   * Met en pause le tracking
   */
  const pauseTracking = useCallback(() => {
    console.log('[TrackingEngine] Pause du tracking');
    setIsPaused(true);
    isPausedRef.current = true;

    // Créer un nouveau segment pour la reprise
    currentSegmentIndex.current += 1;
  }, []);

  /**
   * Reprend le tracking après une pause
   */
  const resumeTracking = useCallback(() => {
    console.log('[TrackingEngine] Reprise du tracking');
    setIsPaused(false);
    isPausedRef.current = false;

    // Créer un nouveau segment
    // Créer un nouveau segment
    // Update ref direct
    allSegmentsRef.current[currentSegmentIndex.current] = [];
    // Force visual update to show pause gap if needed
    setVisualRoute(allSegmentsRef.current.flat());
  }, []);

  /**
   * Arrête le tracking
   */
  const stopTracking = useCallback(() => {
    console.log('[TrackingEngine] Arrêt du tracking');

    // Arrêter l'abonnement GPS
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }

    // Arrêter le timer
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }

    setIsTracking(false);
    setIsPaused(false);
    isTrackingRef.current = false;
    isPausedRef.current = false;
  }, []);

  /**
   * Réinitialise tout le tracking
   */
  const resetTracking = useCallback(() => {
    console.log('[TrackingEngine] Réinitialisation du tracking');

    stopTracking();

    // Clear everything
    setVisualRoute([]);
    allPointsRef.current = [];
    allSegmentsRef.current = [[]];
    lastVisualUpdateRef.current = 0;
    setCurrentLocation(null);
    setCurrentSpeed(0);
    setMaxSpeed(0);
    maxSpeedRef.current = 0; // ⚡ Reset ref
    setTotalDistance(0);
    setElapsedTime(0);
    setTripStartTime(null);
    lastRecordedPoint.current = null;
    currentSegmentIndex.current = 0;
  }, [stopTracking]);

  // Nettoyer lors du démontage
  useEffect(() => {
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, []);



  // Fonction setPaused pour compatibilité
  const setPaused = useCallback((paused: boolean) => {
    if (paused) {
      pauseTracking();
    } else {
      resumeTracking();
    }
  }, []);

  // Fonctions de loading pour compatibilité
  const executeWithLoading = useCallback(async (fn: () => Promise<void>, key?: string) => {
    await fn();
  }, []);

  const isOperationLoading = useCallback((key?: string) => false, []);

  // Fonction pour enregistrer les handlers d'animation (pour compatibilité)
  const registerAnimationHandlers = useCallback((handlers: any) => {
    // Les animations sont gérées par useTrackingAnimations dans MapScreenFull
  }, []);

  // Fonction setCurrentLocation exposée (pour permettre la mise à jour manuelle)
  const setCurrentLocationExternal = useCallback((location: any) => {
    if (location?.latitude && location?.longitude) {
      setCurrentLocation(location);
    }
  }, []);

  // Vérifier et demander les permissions de localisation
  const checkLocationPermission = useCallback(async () => {
    try {
      setIsRequestingPermission(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status);
      setIsRequestingPermission(false);
      return { status };
    } catch (error) {
      console.error('[TrackingEngine] Erreur vérification permissions:', error);
      setIsRequestingPermission(false);
      return { status: 'denied' };
    }
  }, []);

  // Vérifier les permissions au montage
  useEffect(() => {
    const checkInitialPermission = async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationPermission(status);
    };
    checkInitialPermission();
  }, []);

  // Fonction pour formater le temps écoulé
  const formatElapsedTime = useCallback((seconds: number): string => {
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
  }, []);

  // Calculer le texte de temps pour l'affichage
  const timeText = useMemo(() => formatElapsedTime(elapsedTime), [elapsedTime, formatElapsedTime]);

  // Fonction pour formater la vitesse pour l'affichage
  const formatDisplaySpeed = useCallback((speedMs: number): number => {
    return Math.round(speedMs * 3.6 * 10) / 10;
  }, []);

  // ⚡ Compress GPS points to polyline string
  const compressPolyline = useCallback((points: GPSPoint[]): string => {
    try {
      if (!points || points.length < 2) {
        return '';
      }
      const coords = points.map(p => [p.latitude, p.longitude]);
      return polyline.encode(coords);
    } catch (error) {
      console.error('[TrackingEngine] Polyline compression error:', error);
      return '';
    }
  }, []);

  // ========================================
  // CONTEXT VALUE
  // ========================================
  const value: TrackingEngineContextValue = {
    // État
    isTracking,
    isPaused,
    currentLocation,

    // Expose throttled visual route for Map
    visualRoute,
    // Compatibility fields (mapped to visual or refs if needed)
    trackingPoints: allPointsRef.current, // ⚡ FIX: Use ALL points for saving, not throttled visualRoute

    activeRouteSegments: allSegmentsRef.current,
    trackingSegments: allSegmentsRef.current,
    currentSpeed,
    maxSpeed,
    totalDistance,
    elapsedTime,
    tripStartTime,
    timeText,

    // Actions
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    resetTracking,

    // Utilities
    formatDisplaySpeed,
    handleLocationUpdate,
    setPaused,
    setMaxSpeed, // ⚡ NEW: Expose max speed setter
    setCurrentSpeed, // ⚡ NEW: Expose current speed setter
    compressPolyline, // ⚡ NEW: Expose polyline compression
    executeWithLoading,
    isOperationLoading,
    registerAnimationHandlers,
    setCurrentLocation: setCurrentLocationExternal,
    // Permissions
    locationPermission,
    isRequestingPermission,
    checkLocationPermission,
    // Trip metadata
    tripName,
    setTripName,
    tripDescription,
    setTripDescription,
    tripSteps,
    setTripSteps,
    showStepsEditor,
    setShowStepsEditor,
    showTripSummary,
    setShowTripSummary,
  };

  return (
    <TrackingEngineContext.Provider value={value}>
      {children}
    </TrackingEngineContext.Provider>
  );
};

export const useTrackingEngine = () => {
  const context = useContext(TrackingEngineContext);
  if (!context) {
    throw new Error('useTrackingEngine must be used within TrackingEngineProvider');
  }
  return context;
};

export default TrackingEngineContext;
