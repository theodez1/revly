import React, { useState, useEffect, useRef, useMemo, useCallback, memo, forwardRef, useImperativeHandle } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, View, TouchableOpacity, Alert, StatusBar, ScrollView, Animated, Dimensions, TextInput, Image, ActivityIndicator, AppState, KeyboardAvoidingView, Platform } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import * as polyline from 'google-polyline';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { loadAndCacheProfilePhoto, getCachedProfilePhoto } from '../../services/ProfilePhoto';
import ViewShot from 'react-native-view-shot';
import ShareCard from '../../components/ShareCard';
import VehicleSelectorSheet from './MapScreenFull/components/VehicleSelectorSheet';
import SavedTripsModal from './MapScreenFull/components/SavedTripsModal';
import StepsEditorModal from './MapScreenFull/components/StepsEditorModal';
import TripSummaryModal from './MapScreenFull/components/TripSummaryModal';
import CameraModal from './MapScreenFull/components/CameraModal';
import StatsPanel from './MapScreenFull/components/StatsPanel';
import useVehicleSelection from './MapScreenFull/hooks/useVehicleSelection';
import {
  handleShareExport,
  saveTripWithStepsExport,
  loadTripsFromStorageExport,
  deleteTripFromStorageExport,
} from './MapScreenFull/utils/tripExport';
import useTrackingAnimations from './MapScreenFull/hooks/useTrackingAnimations';
import { useTrackingEngine } from '../../contexts/TrackingEngineContext';

// Composant isolé pour l'affichage du temps (évite les re-renders de la carte)
const TimeDisplay = memo(({ timeText }: { timeText: string }) => (
  <Text
    style={styles.statText}
    numberOfLines={1}
    adjustsFontSizeToFit
    minimumFontScale={0.85}
  >
    Temps: {timeText.replace(/\s+/g, '\u202F')}
  </Text>
));

const TIMER_STORAGE_KEY = '@tripTimerState_v2';

import { DEFAULT_MAP_STYLE } from '../../config/mapboxStyles';

// Composant isolé pour le tracé "vivant" - OPTIMISÉ TEMPS RÉEL
// Suit le GPS nativement (~10 Hz) sans animation supplémentaire
const LiveRoute = memo(forwardRef(({ isPaused }: { isPaused: boolean }, ref) => {
  const shapeSourceRef = useRef<any>(null);
  const lastRecordedRef = useRef<any>(null);
  const [hasData, setHasData] = useState(false);

  useImperativeHandle(ref, () => ({
    update: (currentLoc: any, lastRecordedPoint: any) => {
      if (!currentLoc || !lastRecordedPoint) {
        setHasData(false);
        return;
      }

      // ⚡ FIX: Prevent "Straight Line" artifact
      const getDist = (p1, p2) => {
        const R = 6371e3;
        const φ1 = p1.latitude * Math.PI / 180;
        const φ2 = p2.latitude * Math.PI / 180;
        const Δφ = (p2.latitude - p1.latitude) * Math.PI / 180;
        const Δλ = (p2.longitude - p1.longitude) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      const dist = getDist(currentLoc, lastRecordedPoint);

      // Vérifier aussi le gap de temps
      const timeDelta = (currentLoc.timestamp || Date.now()) - (lastRecordedPoint.timestamp || 0);
      const TIME_GAP_THRESHOLD = 30000; // 30 secondes
      const DISTANCE_GAP_THRESHOLD = 300; // 300 mètres

      // Si distance ou temps trop large, c'est un gap (background/retour) - ne pas relier
      if (dist > DISTANCE_GAP_THRESHOLD || timeDelta > TIME_GAP_THRESHOLD) {
        console.log('[LiveRoute] Gap détecté - ne pas relier les points:', {
          dist: dist.toFixed(1),
          timeDelta: (timeDelta / 1000).toFixed(1),
        });
        setHasData(false);
        return;
      }

      // Store last recorded point
      lastRecordedRef.current = lastRecordedPoint;

      // ⚡ UPDATE DIRECT via setNativeProps (temps réel GPS, pas d'animation supplémentaire)
      if (shapeSourceRef.current) {
        try {
          const newShape = {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [lastRecordedPoint.longitude, lastRecordedPoint.latitude],
                [currentLoc.longitude, currentLoc.latitude]
              ],
            },
            properties: {},
          };

          // Direct native update - suit le GPS sans boucle supplémentaire
          shapeSourceRef.current.setNativeProps?.({ shape: newShape });

          if (!hasData) setHasData(true);
        } catch (error) {
          console.log('[LiveRoute] Update error:', error);
        }
      }
    }
  }));

  if (!hasData) return null;

  return (
    <Mapbox.ShapeSource
      id="liveRouteSource"
      ref={shapeSourceRef}
      shape={{
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [[0, 0], [0, 0]],
        },
        properties: {},
      }}
    >
      <Mapbox.LineLayer
        id="liveRouteOutline"
        style={{
          lineColor: 'rgba(255, 255, 255, 0.8)',
          lineWidth: 7,
          lineCap: 'round',
          lineJoin: 'round',
          lineOpacity: 1,
        }}
        belowLayerID="mapbox-location-indicator-layer"
      />
      <Mapbox.LineLayer
        id="liveRouteLine"
        style={{
          lineColor: isPaused ? '#94A3B8' : '#3B82F6',
          lineWidth: 5,
          lineCap: 'round',
          lineJoin: 'round',
          lineOpacity: 1,
        }}
        belowLayerID="mapbox-location-indicator-layer"
      />
    </Mapbox.ShapeSource>
  );
}));

// Composant principal de l'app
function StravaCarApp({ navigation }) {
  // Composant Backdrop pour le BottomSheet véhicule
  const renderBackdrop = useCallback((props) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} enableTouchThrough={false} />
  ), []);
  // Vérifier si Liquid Glass est disponible
  const isLiquidGlassSupported = isLiquidGlassAvailable();

  // Obtenir les safe area insets
  const insets = useSafeAreaInsets();

  // Mémoriser la position top initiale pour éviter les rebonds
  const [topPosition] = useState(() => {
    // Fixer une valeur suffisante pour éviter les problèmes de safe area
    return 60; // Position fixe en pixels
  });


  const { user, profile } = useAuth();

  // Gestion véhicules depuis le stockage (géré via useVehicleSelection)
  const {
    vehicles,
    selectedVehicleId,
    selectedVehicle,
    getVehicleIcon,
    getVehicleName,
    vehicleTypeToIcon,
    handleVehicleSelect,
    refreshVehicles,
    isLoadingVehicles,
  } = useVehicleSelection(user?.id);

  const {
    isTracking,
    isPaused,
    setPaused: setIsPaused,
    isRequestingPermission,
    locationPermission,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    resetTracking,
    checkLocationPermission,
    currentLocation,
    setCurrentLocation,
    trackingPoints,
    trackingSegments,
    activeRouteSegments,
    visualRoute, // ⚡ NEW: Need this for re-renders (1Hz heartbeat)
    currentSpeed,
    maxSpeed,
    totalDistance,
    formatDisplaySpeed,
    compressPolyline: compressPolylineFromContext, // ⚡ Real polyline compression
    setMaxSpeed: setMaxSpeedFromContext, // ⚡ Real max speed setter
    setCurrentSpeed: setCurrentSpeedFromContext, // ⚡ Real current speed setter
    timeText,
    tripName,
    setTripName,
    tripDescription,
    setTripDescription,
    tripSteps,
    setTripSteps,
    showTripSummary,
    setShowTripSummary,
    showStepsEditor,
    setShowStepsEditor,
    registerAnimationHandlers,
    handleLocationUpdate: contextHandleLocationUpdate,
    executeWithLoading,
    isOperationLoading,
    tripStartTime: startTime,
    elapsedTime,
  } = useTrackingEngine();

  // Mocks/Defaults for missing context values
  const setIsTracking = (val) => { }; // Mock
  const backgroundStatus = 'granted';
  const lastHeartbeat = Date.now();
  const trackingPointsRef = useRef(trackingPoints);
  const simplifiedPoints = useMemo(() => trackingPoints, [trackingPoints]);
  const compressedPolyline = '';
  const segmentStartIndices = [];
  const segmentStartIndicesRef = useRef([]);
  const currentSegmentIndexRef = useRef(0);
  const setLastSampledPoint = () => { };
  const setLastSampledTime = () => { };
  const lastSampledBearing = 0;
  const setLastSampledBearing = () => { };
  const appendTrackingPoint = () => { };
  const incrementTotalPoints = () => { };
  const recordRejectedPoint = () => { };
  const shouldSamplePoint = () => true;
  const validateAndFilterPoint = () => true;
  const setStartTime = () => { };
  const maxSpeedRef = useRef(maxSpeed);
  const totalStops = 0;
  const setTotalStops = () => { };
  const totalStopTime = 0;
  const setTotalStopTime = () => { };
  const lastStopTime = 0;
  const setLastStopTime = () => { };
  const isStopped = false;
  const setIsStopped = () => { };
  const altitudeData = [];
  const setAltitudeData = () => { };
  const drivingScore = 100;
  const setDrivingScore = () => { };
  const smoothedSpeed = currentSpeed;
  const speedHistory = [];
  const detectStop = () => { };
  const scheduleInactivityPrompt = () => { };
  const resetInactivityTracking = () => { };
  const showInactivityPrompt = false;
  const setShowInactivityPrompt = () => { };
  const inactiveDurationMs = 0;
  const INACTIVITY_SPEED_THRESHOLD_KMH = 3;
  const INACTIVITY_DURATION_MS = 60000;
  const formatTripTime = (s) => timeText; // Mock
  const calculateElevationGain = () => 0;
  const getCurrentTripTime = () => elapsedTime;
  const startTripTimer = () => { };
  const pauseTripTimer = () => { };
  const resumeTripTimer = () => { };
  const stopTripTimer: () => Promise<void> = async () => { };
  const resetTripTimer = () => { };
  const isTrackingRef = useRef(isTracking);
  const flattenSegmentsFromEngine = (segments) => segments?.flat() || [];
  const getSegmentIndexForPositionFromEngine = () => 0;
  const compressPolylineFromEngine = compressPolylineFromContext || (() => ''); // Use real function from context
  const setCurrentSpeedFromEngine = setCurrentSpeedFromContext || (() => { }); // Use real function from context
  const setMaxSpeedFromEngine = setMaxSpeedFromContext || (() => { }); // Use real function from context
  const speedWatchRefFromEngine = useRef(null);
  const handleLocationUpdateFromEngine = contextHandleLocationUpdate;
  const syncBackgroundLocations = () => { };

  const flattenSegments = useMemo(() => {
    if (typeof flattenSegmentsFromEngine === 'function') {
      return flattenSegmentsFromEngine;
    }
    return (segments) => {
      if (!Array.isArray(segments)) {
        return [];
      }
      return segments.reduce((acc, segment) => {
        if (segment && segment.length) {
          acc.push(...segment);
        }
        return acc;
      }, []);
    };
  }, [flattenSegmentsFromEngine]);

  const getSegmentIndexForPosition = useMemo(() => {
    if (typeof getSegmentIndexForPositionFromEngine === 'function') {
      return getSegmentIndexForPositionFromEngine;
    }
    return (index) => {
      if (!Number.isFinite(index) || index < 0) {
        return 0;
      }
      return 0;
    };
  }, [getSegmentIndexForPositionFromEngine]);

  const compressPolyline = useMemo(() => {
    if (typeof compressPolylineFromEngine === 'function') {
      return compressPolylineFromEngine;
    }
    return () => '';
  }, [compressPolylineFromEngine]);

  const setCurrentSpeed = useMemo(() => {
    if (typeof setCurrentSpeedFromEngine === 'function') {
      return setCurrentSpeedFromEngine;
    }
    return () => { };
  }, [setCurrentSpeedFromEngine]);

  const setMaxSpeed = useMemo(() => {
    if (typeof setMaxSpeedFromEngine === 'function') {
      return setMaxSpeedFromEngine;
    }
    return () => { };
  }, [setMaxSpeedFromEngine]);

  const localSpeedWatchRef = useRef(null);

  const speedWatchRef = useMemo(() => {
    if (
      speedWatchRefFromEngine
      && typeof speedWatchRefFromEngine === 'object'
      && 'current' in speedWatchRefFromEngine
    ) {
      return speedWatchRefFromEngine;
    }
    return localSpeedWatchRef;
  }, [speedWatchRefFromEngine, localSpeedWatchRef]);

  const handleLocationUpdate = useCallback(
    (point: any) => {
      if (typeof contextHandleLocationUpdate === 'function') {
        return contextHandleLocationUpdate(point);
      }
      return undefined;
    },
    [contextHandleLocationUpdate],
  );

  const [savedTrips, setSavedTrips] = useState([]);
  const [showTripsModal, setShowTripsModal] = useState(false);
  const [selectedTripForView, setSelectedTripForView] = useState(null);
  const [profilePhotoUri, setProfilePhotoUri] = useState(null);
  const lastLoadedAvatarRef = useRef(null); // Pour éviter les rechargements inutiles
  const [mapType, setMapType] = useState('standard');
  const initialRegion = useMemo(
    () => ({
      latitude: typeof currentLocation?.latitude === 'number' ? currentLocation.latitude : 48.8566,
      longitude: typeof currentLocation?.longitude === 'number' ? currentLocation.longitude : 2.3522,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }),
    [currentLocation?.latitude, currentLocation?.longitude]
  );
  const [extraStats, setExtraStats] = useState<any>({});
  const [sheetHeight, setSheetHeight] = useState(0);
  const [statsRectangleHeight, setStatsRectangleHeight] = useState(0);
  const vehicleSnapPoints = useMemo(() => ['40%', '70%'], []);
  const stepSheetRef = useRef(null);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [shareVariant, setShareVariant] = useState('stats-only');
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [stepTitleInput, setStepTitleInput] = useState('');
  const [stepDescriptionInput, setStepDescriptionInput] = useState('');
  const [stepDraftLocation, setStepDraftLocation] = useState(null);
  const [stepPhotoUri, setStepPhotoUri] = useState(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState('back');
  const [flashMode, setFlashMode] = useState('off');
  const totalTurns = useMemo(
    () => (typeof extraStats?.totalTurns === 'number' ? extraStats.totalTurns : 0),
    [extraStats],
  );

  const vehicleBottomSheetRef = useRef(null);
  const cameraRef = useRef(null);
  const shareCardRef = useRef(null);

  const stepTitleInputRef = useRef(null);

  const {
    pulseAnim,
    startButtonAnim,
    controlsAnim,
    startPulseAnimation,
    stopPulseAnimation,
    animateStartButtonOut,
    animateStartButtonIn,
    animateControlsIn,
    animateControlsOut,
  } = useTrackingAnimations();

  useEffect(() => {
    registerAnimationHandlers({
      animateStartButtonOut,
      animateControlsIn,
      animateControlsOut,
      animateStartButtonIn,
      startPulseAnimation,
      stopPulseAnimation,
    });
    return () => {
      registerAnimationHandlers({});
    };
  }, [
    animateControlsIn,
    animateControlsOut,
    animateStartButtonIn,
    animateStartButtonOut,
    registerAnimationHandlers,
    startPulseAnimation,
    stopPulseAnimation,
  ]);

  const setCameraRef = useCallback((ref) => {
    cameraRef.current = ref;
  }, []);

  // Recharger la photo de profil quand on revient sur l'écran avec cache local
  useFocusEffect(
    useCallback(() => {
      const loadProfilePhoto = async () => {
        try {
          const avatarUrl = profile?.avatar_url;
          const userId = user?.id;

          // Ne pas recharger si on a déjà chargé cette URL
          if (lastLoadedAvatarRef.current === avatarUrl && profilePhotoUri) {
            return;
          }

          if (avatarUrl && userId) {
            // Charger depuis le cache ou télécharger et mettre en cache
            const cachedUri = await loadAndCacheProfilePhoto(avatarUrl, userId);
            // Si le cache retourne null (échec téléchargement), utiliser l'URL Supabase directement
            const finalUri = cachedUri || avatarUrl;
            if (finalUri !== profilePhotoUri) {
              setProfilePhotoUri(finalUri);
              lastLoadedAvatarRef.current = avatarUrl;
            }
          } else if (userId) {
            // Essayer de charger depuis le cache même si pas d'URL Supabase
            const cachedUri = await getCachedProfilePhoto(userId);
            const finalUri = cachedUri || null;
            if (finalUri !== profilePhotoUri) {
              setProfilePhotoUri(finalUri);
              lastLoadedAvatarRef.current = null;
            }
          } else if (profilePhotoUri !== null) {
            setProfilePhotoUri(null);
            lastLoadedAvatarRef.current = null;
          }
        } catch (e) {
          console.error('Erreur chargement photo profil:', e);
          // En cas d'erreur, utiliser l'URL Supabase directement
          const fallbackUri = profile?.avatar_url || null;
          if (fallbackUri !== profilePhotoUri) {
            setProfilePhotoUri(fallbackUri);
          }
        }
      };
      loadProfilePhoto();
    }, [profile?.avatar_url, user?.id])
  );

  // Ouvrir le sélecteur de véhicule sans recharger (les véhicules sont déjà chargés)
  const handlePresentModalPress = useCallback(() => {
    vehicleBottomSheetRef.current?.snapToIndex(0);
    // Ne pas appeler refreshVehicles() pour éviter les chargements inutiles
    // Les véhicules sont déjà chargés au montage du composant
  }, []);

  // Gérer la sélection d'un véhicule
  const handleVehicleSelectWithClose = useCallback((vehicleId) => {
    handleVehicleSelect(vehicleId);
    vehicleBottomSheetRef.current?.close();
  }, [handleVehicleSelect]);

  const openCamera = async () => {
    try {


      if (!cameraPermission) {

        return;
      }

      if (!cameraPermission.granted) {

        const result = await requestCameraPermission();


        if (!result.granted) {
          Alert.alert(
            'Permission requise',
            'L\'accès à la caméra est nécessaire pour prendre des photos. Veuillez autoriser l\'accès dans les paramètres.',
            [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Réessayer', onPress: () => openCamera() }
            ]
          );
          return;
        }
      }


      setShowCamera(true);
    } catch (error) {
      console.error('Erreur ouverture caméra:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir la caméra: ' + error.message);
    }
  };

  const takePicture = async () => {
    try {
      if (!cameraRef.current) {
        Alert.alert('Erreur', 'Référence caméra non disponible');
        return;
      }


      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });



      // Stocker la photo temporairement pour prévisualisation
      setCapturedPhoto(photo);
    } catch (error) {
      console.error('Erreur prise de photo:', error);
      Alert.alert('Erreur', 'Impossible de prendre la photo: ' + error.message);
    }
  };

  // Sauvegarder une photo dans un répertoire permanent
  const savePhotoPermanently = async (photoUri) => {
    try {
      if (!photoUri || !photoUri.startsWith('file://')) {
        return photoUri; // Si ce n'est pas un fichier local, retourner tel quel
      }

      // Vérifier si le fichier existe déjà dans le répertoire permanent
      const photoId = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const permanentDir = `${FileSystem.documentDirectory}trip_photos/`;
      await FileSystem.makeDirectoryAsync(permanentDir, { intermediates: true }).catch(() => { });

      const permanentPath = `${permanentDir}${photoId}.jpg`;

      // Copier la photo vers le répertoire permanent
      await FileSystem.copyAsync({
        from: photoUri,
        to: permanentPath,
      });

      return permanentPath;
    } catch (error) {
      console.error('Erreur sauvegarde photo permanente:', error);
      return photoUri; // En cas d'erreur, retourner l'URI originale
    }
  };

  // Confirmer la photo
  const confirmPhoto = async () => {
    if (capturedPhoto) {
      // Sauvegarder la photo de manière permanente
      const permanentPhotoUri = await savePhotoPermanently(capturedPhoto.uri);

      const newStep = {
        id: Date.now(),
        type: 'photo',
        timestamp: Date.now(),
        location: currentLocation,
        photo: permanentPhotoUri,
        title: 'Photo du trajet',
        description: `Photo prise à ${new Date().toLocaleTimeString('fr-FR')}`,
      };

      setTripSteps(prev => [...prev, newStep]);
      setCapturedPhoto(null);
      setShowCamera(false);
    }
  };

  // Retirer la photo et reprendre
  const retakePhoto = () => {
    setCapturedPhoto(null);
  };

  const loadTripsFromStorage = useCallback(
    () => loadTripsFromStorageExport({ setSavedTrips }),
    [setSavedTrips],
  );

  const deleteTripFromStorage = useCallback(
    (tripId) => deleteTripFromStorageExport({ tripId, setSavedTrips }),
    [setSavedTrips],
  );

  const handleShare = useCallback(() => handleShareExport({
    isTracking,
    trackingPoints,
    flattenSegments,
    trackingSegments,
    compressedPolyline,
    getSegmentIndexForPosition,
    getCurrentTripTime: () => elapsedTime,
    totalDistance,
    maxSpeed,
    extraStats,
    tripName,
    tripDescription,
    startTime: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
    segmentStartIndicesRef,
    navigation,
    getVehicleName,
    selectedVehicleId,
    setIsGeneratingShare,
  }), [
    compressedPolyline,
    extraStats,
    flattenSegments,
    timeText,
    getSegmentIndexForPosition,
    isTracking,
    maxSpeed,
    navigation,
    selectedVehicleId,
    setIsGeneratingShare,
    startTime,
    totalDistance,
    trackingPoints,
    trackingSegments,
    tripDescription,
    tripName,
  ]);

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    Alert.alert('Succès', isBookmarked ? 'Marque-page retiré' : 'Trajet ajouté aux favoris');
  };

  const handleMenu = () => {
    Alert.alert(
      'Options',
      'Que souhaitez-vous faire ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Terminer le trajet',
          style: 'default',
          onPress: () => setShowTripSummary(true)
        },
      ],
    );
  };

  const openStepSheet = useCallback(() => {
    setStepTitleInput('');
    setStepDescriptionInput('');
    setStepPhotoUri(null);
    setStepDraftLocation(currentLocation ? { ...currentLocation } : null);
    stepSheetRef.current?.present();
    requestAnimationFrame(() => {
      stepSheetRef.current?.snapToIndex?.(0);
      stepTitleInputRef.current?.focus();
    });
  }, []);

  const closeStepSheet = useCallback(() => {
    stepSheetRef.current?.dismiss();
  }, []);

  const handleStepPhotoPick = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission requise',
          'Autorisez l’accès à vos photos pour ajouter une image à l’étape.',
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length) {
        setStepPhotoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erreur sélection photo étape:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner la photo.');
    }
  }, []);

  const handleStepPhotoClear = useCallback(() => {
    setStepPhotoUri(null);
  }, []);

  const handleAddStepSubmit = useCallback(async () => {
    const title = stepTitleInput.trim();
    const description = stepDescriptionInput.trim();

    if (!title) {
      Alert.alert('Titre requis', 'Donnez un nom à votre étape.');
      return;
    }

    // Sauvegarder la photo de manière permanente si elle existe
    let permanentPhotoUri = stepPhotoUri;
    if (stepPhotoUri) {
      permanentPhotoUri = await savePhotoPermanently(stepPhotoUri);
    }

    const newStep = {
      id: Date.now(),
      type: stepPhotoUri ? 'photo' : 'step',
      timestamp: Date.now(),
      location: stepDraftLocation || currentLocation,
      title,
      description,
      photo: permanentPhotoUri || undefined,
    };

    setTripSteps((prev) => [...prev, newStep]);
    closeStepSheet();
  }, [closeStepSheet, currentLocation, setTripSteps, stepDescriptionInput, stepPhotoUri, stepTitleInput, savePhotoPermanently]);

  const saveTripWithSteps = useCallback(async (overrides = {}) => {
    console.log('🚀 [SAVE] Starting saveTripWithSteps...');
    console.log('🚀 [SAVE] trackingPoints:', trackingPoints?.length || 0);
    console.log('🚀 [SAVE] elapsedTime:', elapsedTime, 'seconds');
    console.log('🚀 [SAVE] totalDistance:', totalDistance, 'km');
    console.log('🚀 [SAVE] startTime:', startTime, typeof startTime);
    console.log('🚀 [SAVE] startTime ISO:', startTime ? new Date(startTime).toISOString() : 'null');

    await executeWithLoading(async () => {
      await saveTripWithStepsExport({
        compressedPolyline,
        simplifiedPoints,
        trackingPoints,
        compressPolyline,
        flattenSegments,
        trackingSegments,
        getSegmentIndexForPosition,
        currentLocation,
        getCurrentTripTime: () => {
          const time = elapsedTime;
          console.log('⏱️ [SAVE] getCurrentTripTime appelé, retourne:', time);
          return time;
        }, // ⚡ FIX: Return seconds (number), not timeText (string)
        totalDistance,
        maxSpeed,
        totalStops,
        totalStopTime,
        tripSteps,
        altitudeData,
        extraStats,
        tripName,
        tripDescription,
        startTime: startTime ? (typeof startTime === 'number' ? startTime : new Date(startTime).getTime()) : null,
        segmentStartIndicesRef,
        user,
        profile,
        setIsTracking,
        isTrackingRef,
        setIsPaused,
        stopTripTimer,
        animateControlsOut,
        animateStartButtonIn,
        resetTracking,
        checkLocationPermission,
        speedWatchRef,
        setCurrentSpeed,
        formatDisplaySpeed,
        maxSpeedRef,
        setMaxSpeed,
        detectStop,
        setAltitudeData,
        selectedVehicle,
        drivingScore,
        loadTripsFromStorage,
        deleteTripFromStorage,
        ...overrides, // Allow overriding any of the above
      } as any);
      console.log('✅ [SAVE] saveTripWithStepsExport completed successfully');
    }, 'save');
  }, [
    animateControlsOut,
    animateStartButtonIn,
    checkLocationPermission,
    compressedPolyline,
    compressPolyline,
    currentLocation,
    detectStop,
    drivingScore,
    extraStats,
    flattenSegments,
    formatDisplaySpeed,
    getCurrentTripTime,
    getSegmentIndexForPosition,
    isTrackingRef,
    loadTripsFromStorage,
    maxSpeed,
    maxSpeedRef,
    profile,
    resetTracking,
    selectedVehicle,
    setAltitudeData,
    setCurrentSpeed,
    setIsPaused,
    setIsTracking,
    setMaxSpeed,
    simplifiedPoints,
    speedWatchRef,
    startTime,
    totalDistance,
    totalStops,
    totalStopTime,
    trackingPoints,
    trackingSegments,
    tripDescription,
    tripName,
    tripSteps,
    altitudeData,
    user,
    deleteTripFromStorage,
    executeWithLoading,
  ]);

  // Référence pour la carte
  const mapRef = useRef(null);
  const previousCameraTargetRef = useRef(null);

  // Fonction pour calculer le bearing (angle entre deux points)
  const getBearing = useCallback((point1, point2) => {
    const lat1 = point1.latitude * Math.PI / 180;
    const lat2 = point2.latitude * Math.PI / 180;
    const deltaLng = (point2.longitude - point1.longitude) * Math.PI / 180;

    const y = Math.sin(deltaLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360; // Normaliser entre 0 et 360
  }, []);

  // Fonctions de sauvegarde locale

  // Fonction pour compresser les points avec Google Polyline Algorithm

  // Fonction Douglas-Peucker pour simplifier le tracé
  // Ref pour le composant LiveRoute isolé
  const liveRouteRef = useRef<any>(null);
  const lastRecordedPointRef = useRef<any>(null);

  // Buffer haute fréquence pour suivre le GPS en temps réel
  const recentGPSPointsRef = useRef<any[]>([]);
  const MAX_RECENT_POINTS = 20; // Garder les 20 derniers points GPS

  // Mettre à jour la référence du dernier point enregistré quand activeRouteSegments change
  useEffect(() => {
    if (activeRouteSegments && activeRouteSegments.length > 0) {
      const lastSegment = activeRouteSegments[activeRouteSegments.length - 1];
      if (lastSegment && lastSegment.length > 0) {
        lastRecordedPointRef.current = lastSegment[lastSegment.length - 1];
        console.log('[MapScreenFull] lastRecordedPointRef updated:', lastSegment.length, 'points in segment');
      }
    }
  }, [activeRouteSegments, visualRoute]); // ⚡ FIX: Add visualRoute to trigger updates

  // Fonction pour lisser les courbes avec interpolation Catmull-Rom
  const smoothTrack = useCallback((points) => {
    if (points.length < 4) return points;

    const smoothedPoints = [];
    const tension = 0.5; // Tension de la courbe (0.5 = bon équilibre)
    const numSegments = 3; // Nombre de points entre chaque point réel

    // Ajouter le premier point
    smoothedPoints.push(points[0]);

    // Interpolation Catmull-Rom entre les points
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(i + 2, points.length - 1)];

      // Générer des points intermédiaires
      for (let t = 1; t <= numSegments; t++) {
        const fraction = t / numSegments;
        const t2 = fraction * fraction;
        const t3 = t2 * fraction;

        // Formule Catmull-Rom pour latitude
        const lat = 0.5 * (
          (2 * p1.latitude) +
          (-p0.latitude + p2.latitude) * fraction +
          (2 * p0.latitude - 5 * p1.latitude + 4 * p2.latitude - p3.latitude) * t2 +
          (-p0.latitude + 3 * p1.latitude - 3 * p2.latitude + p3.latitude) * t3
        );

        // Formule Catmull-Rom pour longitude
        const lng = 0.5 * (
          (2 * p1.longitude) +
          (-p0.longitude + p2.longitude) * fraction +
          (2 * p0.longitude - 5 * p1.longitude + 4 * p2.longitude - p3.longitude) * t2 +
          (-p0.longitude + 3 * p1.longitude - 3 * p2.longitude + p3.longitude) * t3
        );

        smoothedPoints.push({
          latitude: lat,
          longitude: lng,
          timestamp: p1.timestamp + (p2.timestamp - p1.timestamp) * fraction,
          speed: p1.speed,
          altitude: p1.altitude
        });
      }
    }

    return smoothedPoints;
  }, []);

  // Fonction pour animer la caméra vers une position
  const animateCameraTo = useCallback((location, options: any = {}) => {
    if (!cameraRef.current) return;

    cameraRef.current.setCamera({
      centerCoordinate: [location.longitude, location.latitude],
      animationDuration: options.duration || 1000,
      zoomLevel: options.zoom || 16,
      pitch: options.pitch || 45,
      heading: options.heading || 0,
    });
  }, []);

  const centerMapOnLocation = useCallback((location: any, options: { duration?: number; zoomLevel?: number; pitch?: number; heading?: number } = {}) => {
    if (!cameraRef.current || !location) {
      return;
    }

    const {
      duration = 650,
      zoomLevel = 16,
      pitch = 0,
      heading = 0,
    } = options || {};

    cameraRef.current.setCamera({
      centerCoordinate: [location.longitude, location.latitude],
      zoomLevel: zoomLevel,
      animationDuration: duration,
      pitch: pitch,
      heading: heading,
    });

    previousCameraTargetRef.current = { latitude: location.latitude, longitude: location.longitude };
  }, []);

  // Suivi fluide de la caméra pendant le tracking (Géré nativement par Mapbox.Camera maintenant)
  useEffect(() => {
    // Si on n'est pas en tracking, on peut toujours mettre à jour manuellement si besoin
    if (!isTracking && currentLocation && mapRef.current) {
      // Logic for non-tracking updates if necessary
    }
  }, [isTracking, currentLocation]);

  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

  // Sync maxSpeedRef with maxSpeed from context
  useEffect(() => {
    maxSpeedRef.current = maxSpeed;
  }, [maxSpeed]);

  useEffect(() => {
    if (!isTracking) {
      previousCameraTargetRef.current = null;
    }
  }, [isTracking]);

  // Fonction pour obtenir la position actuelle et centrer la carte
  const getCurrentLocationAndCenter = useCallback(async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const loc = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setCurrentLocation(loc);

      // Utiliser setCamera directement pour le centrage manuel
      if (cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: [loc.longitude, loc.latitude],
          zoomLevel: 15,
          animationDuration: 600,
          pitch: 0,
        });
      }

    } catch (error) {
      console.error('Erreur obtention position:', error);
    }
  }, []);

  // Fonction pour calculer la vitesse moyenne (simplifiée)
  const calculateAverageSpeed = () => {
    try {
      if (trackingPoints.length < 2 || !startTime) return 0;

      const totalTime = (Date.now() - startTime) / 1000 / 3600; // en heures
      const totalDistanceKm = (totalDistance || 0) / 1000;

      return totalTime > 0 ? totalDistanceKm / totalTime : 0;
    } catch (error) {
      console.error('Erreur calcul vitesse moyenne:', error);
      return 0;
    }
  };

  // Fonction pour calculer le temps de trajet (simplifiée)
  const calculateTripTime = () => {
    try {
      if (!startTime) return 0;
      return Math.floor((Date.now() - startTime) / 1000); // en secondes
    } catch (error) {
      console.error('Erreur calcul temps trajet:', error);
      return 0;
    }
  };

  // Fonction pour formater le temps
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Fonction pour calculer le score de conduite (simplifiée)
  const calculateDrivingScore = () => {
    try {
      let score = 100;

      // Pénalité pour vitesse excessive (> 130 km/h)
      if (maxSpeed > 130) {
        score -= Math.min(30, (maxSpeed - 130) * 2);
      }

      // Pénalité pour trop d'arrêts
      if (totalStops > 10) {
        score -= Math.min(20, (totalStops - 10) * 2);
      }

      // Pénalité pour temps d'arrêt excessif
      const tripTime = calculateTripTime();
      if (tripTime > 0) {
        const stopTimePercentage = totalStopTime / tripTime * 100;
        if (stopTimePercentage > 20) {
          score -= Math.min(25, (stopTimePercentage - 20) * 1.5);
        }
      }

      return Math.max(0, Math.round(score));
    } catch (error) {
      console.error('Erreur calcul score conduite:', error);
      return 100;
    }
  };

  // Fonction pour demander les permissions de localisation
  // Vérifier les permissions au démarrage
  // Charger les trajets sauvegardés au démarrage
  useEffect(() => {
    loadTripsFromStorage();
  }, [loadTripsFromStorage]);

  // Centrer la carte sur la position actuelle au démarrage
  useEffect(() => {
    if (locationPermission === 'granted') {
      getCurrentLocationAndCenter();
    }
  }, [locationPermission, getCurrentLocationAndCenter]);

  const showSavedTrips = () => {
    setShowTripsModal(true);
  };

  const deleteAllTrips = async () => {
    Alert.alert(
      'Confirmer suppression',
      'Êtes-vous sûr de vouloir supprimer tous les trajets sauvegardés ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('savedTrips');
              setSavedTrips([]);
              Alert.alert('Succès', 'Tous les trajets ont été supprimés');
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer les trajets');
            }
          }
        }
      ]
    );
  };

  const deleteTrip = async (tripId) => {
    Alert.alert(
      'Supprimer le trajet',
      'Êtes-vous sûr de vouloir supprimer ce trajet ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTripFromStorage(tripId);
              Alert.alert('Succès', 'Trajet supprimé');
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer le trajet');
            }
          }
        }
      ]
    );
  };

  const onSheetLayout = (event) => {
    const { height } = event.nativeEvent.layout;
    setSheetHeight(height);
  };

  const onStatsRectangleLayout = (event) => {
    const { height } = event.nativeEvent.layout;
    setStatsRectangleHeight(height);
  };

  // Vérification périodique que le tracking TaskManager fonctionne toujours
  // Plus besoin de watchPositionAsync : TaskManager fonctionne en foreground ET background
  useEffect(() => {
    if (!isTracking || isPaused) {
      return;
    }

    const checkInterval = setInterval(async () => {
      // Mock check
    }, 30000); // Vérifier toutes les 30 secondes

    return () => {
      clearInterval(checkInterval);
    };
  }, [isTracking, isPaused, setIsTracking]);

  // Gestion AppState : TaskManager fonctionne automatiquement en foreground ET background
  // Plus besoin de gérer watchPositionAsync séparément
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;

      // Détecter le retour du background vers le foreground
      if (previousState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[MapScreenFull] ⚡ Retour au foreground détecté');

        if (isTrackingRef.current && !isPaused) {
          // Synchroniser les locations du background
          syncBackgroundLocations();

          // ⚡ IMPORTANT: Réinitialiser lastRecordedPointRef pour éviter de relier les points
          // Le TrackingEngineContext créera automatiquement un nouveau segment si gap détecté
          // On force la mise à jour du dernier point enregistré pour éviter les lignes droites
          if (activeRouteSegments && activeRouteSegments.length > 0) {
            const lastSegment = activeRouteSegments[activeRouteSegments.length - 1];
            if (lastSegment && lastSegment.length > 0) {
              lastRecordedPointRef.current = lastSegment[lastSegment.length - 1];
              console.log('[MapScreenFull] lastRecordedPointRef mis à jour après retour du background');
            }
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [isPaused, syncBackgroundLocations, isTrackingRef, activeRouteSegments]);

  // SIMPLIFIED 2-LAYER RENDERING FOR SMOOTH TRACKING

  // LAYER 1: Throttled Route (Updates 1Hz)
  const routeGeoJSON = useMemo(() => {
    // visualRoute comes from Context and is already throttled
    // We can render it directly.

    // We can use trackingPoints from context which is aliased to visualRoute
    if (!trackingPoints || trackingPoints.length < 2) return null;

    return {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: trackingPoints.map(p => [p.longitude, p.latitude]),
      },
      properties: {},
    };
  }, [trackingPoints]);



  const displaySpeed = useMemo(() => {
    const safeSpeed = Math.max(0, Number.isFinite(currentSpeed) ? currentSpeed : 0);
    return safeSpeed >= 100 ? Math.round(safeSpeed).toString() : safeSpeed.toFixed(1);
  }, [currentSpeed]);


  // ⚡ UNIFIED TRACKING: Drive visual updates from Context Location (Single Source of Truth)
  // This ensures that what we see is exactly what the Background Task is recording.
  useEffect(() => {
    if (isTracking && !isPaused && currentLocation) {
      const gpsPoint = currentLocation;

      // ⚡ BUFFER HAUTE FRÉQUENCE: Ajouter le point GPS au buffer local
      // Note: currentLocation is updated at ~1Hz by standard GPS config, which is fine for "Real" tracking
      recentGPSPointsRef.current.push(gpsPoint);
      // Garder seulement les N derniers points
      if (recentGPSPointsRef.current.length > MAX_RECENT_POINTS) {
        recentGPSPointsRef.current.shift();
      }

      // ⚡ MISE À JOUR DU LIVE ROUTE
      if (liveRouteRef.current) {
        // Utiliser le point enregistré comme début, ou le premier du buffer
        const startPoint = lastRecordedPointRef.current || recentGPSPointsRef.current[0];
        if (startPoint) {
          // Check for valid coordinates to avoid crashes
          if (typeof startPoint.latitude === 'number' && typeof gpsPoint.latitude === 'number') {
            liveRouteRef.current.update(gpsPoint, startPoint);
          }
        }
      }
    }
  }, [currentLocation, isTracking, isPaused]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Carte Mapbox */}
      <Mapbox.MapView
        style={styles.map}
        styleURL={mapType === 'satellite' ? Mapbox.StyleURL.Satellite : DEFAULT_MAP_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        pitchEnabled={!isTracking}  // ⚡ BLOQUÉ pendant tracking
        rotateEnabled={false}
        scrollEnabled={!isTracking} // ⚡ BLOQUÉ pendant tracking
        zoomEnabled={!isTracking}   // ⚡ BLOQUÉ pendant tracking
        onMapLoadingError={() => {
          console.log('[Mapbox] Loading Error (ignored)');
        }}
      >
        <Mapbox.Camera
          ref={setCameraRef}
          defaultSettings={{
            centerCoordinate: [initialRegion.longitude, initialRegion.latitude],
            zoomLevel: 15,
            pitch: 0,  // Début à plat
            heading: 0,
          }}
          followUserLocation={isTracking}
          followUserMode={isTracking ? ('course' as any) : ('normal' as any)}
          followZoomLevel={isTracking ? 16 : undefined}
          followPitch={isTracking ? 0 : 0}  // ⚡ 0° fixe pendant tracking pour éviter l'effet 3D
          minZoomLevel={isTracking ? 14 : 0} // Lock zoom range slightly
          maxZoomLevel={isTracking ? 17 : 20}
          animationDuration={500}
        />
        {/* Route lines are hidden during tracking - only show after trip is saved */}
        {!isTracking && routeGeoJSON && (
          <Mapbox.ShapeSource id="routeSource" shape={routeGeoJSON}>
            {/* Outline for depth and visibility */}
            <Mapbox.LineLayer
              id="routeOutline"
              style={{
                lineColor: 'rgba(255, 255, 255, 0.8)',
                lineWidth: 7,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 1,
              }}
            />
            {/* Main route line */}
            <Mapbox.LineLayer
              id="routeLine"
              style={{
                lineColor: isPaused ? '#94A3B8' : '#3B82F6',
                lineWidth: 5,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 1,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Live preview line - hidden during tracking */}
        {!isTracking && <LiveRoute ref={liveRouteRef} isPaused={isPaused} />}

        {/* UserLocation marker - ALWAYS LAST to be ON TOP */}
        <Mapbox.UserLocation
          visible={true}
          showsUserHeadingIndicator={true}
          androidRenderMode={'gps'}
        // ⚡ Logic removed from here. Handled by Context + useEffect above.
        />
      </Mapbox.MapView>



      {/* Bouton retour */}
      {/* Bouton retour avec effet Liquid Glass */}
      <TouchableOpacity
        style={[styles.historyButton, { top: topPosition, backgroundColor: 'transparent', borderWidth: 0 }]}
        onPress={() => {
          // Fermer le modal si navigation existe
          if (typeof navigation !== 'undefined' && navigation) {
            navigation.goBack();
          }
        }}
      >
        <GlassView
          style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
          glassEffectStyle="regular"
          tintColor="rgba(255, 255, 255, 0.4)"
        />
        <Ionicons name="chevron-down" size={20} color="#0F172A" />
      </TouchableOpacity>




      {/* Sélecteur de véhicule ou vitesse selon l'état - Avec effet Liquid Glass */}
      <View style={[styles.topIndicatorContainer, { top: topPosition, backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0.05 }]}>
        <GlassView
          style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
          glassEffectStyle="regular"
          tintColor="rgba(255, 255, 255, 0.4)"
        />
        {!isTracking ? (
          /* Dropdown de sélection de véhicule */
          <TouchableOpacity
            style={[
              styles.vehicleDropdown,
              isLoadingVehicles && styles.vehicleDropdownLoading,
            ]}
            onPress={handlePresentModalPress}
            activeOpacity={0.7}
            disabled={isLoadingVehicles && vehicles.length === 0}
          >
            <View style={styles.vehicleDropdownContent}>
              {isLoadingVehicles ? (
                <ActivityIndicator size="small" color="#0F172A" />
              ) : (
                <Ionicons name={getVehicleIcon(selectedVehicleId)} size={20} color="#0F172A" />
              )}
              <Text style={styles.vehicleDropdownText}>
                {isLoadingVehicles
                  ? 'Chargement...'
                  : vehicles.length === 0
                    ? 'Pas de véhicule'
                    : selectedVehicle}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#64748B" />
            </View>
          </TouchableOpacity>
        ) : (
          /* Indicateur de vitesse pendant le trajet */
          <View style={styles.speedIndicatorSimple}>
            <Text style={styles.speedValue}>{displaySpeed}</Text>
            <Text style={styles.speedUnit}>km/h</Text>
          </View>
        )}
      </View>

      {/* Bouton centrer GPS avec effet Liquid Glass */}
      <TouchableOpacity
        style={[
          styles.gpsButton,
          { bottom: sheetHeight + 5 + statsRectangleHeight + 10 },
          mapType === 'satellite' && { backgroundColor: '#FFFFFF' }
        ]}
        onPress={() => {
          if (currentLocation) {
            console.log('📍 Recentrage sur position actuelle:', currentLocation);
            centerMapOnLocation(currentLocation);
          } else {
            console.log('📍 Pas de position actuelle, obtention position...');
            getCurrentLocationAndCenter();
          }
        }}
      >
        <GlassView
          style={styles.gpsGlass}
          glassEffectStyle="regular"
          isInteractive={true}
          tintColor="rgba(255, 255, 255, 0.1)"
        >
          <View style={styles.targetVehicleIcon}>
            <View style={styles.targetOuterCircle} />
            <View style={styles.targetInnerCircle} />
            <View style={styles.targetCenter} />
            <View style={styles.targetLineNorth} />
            <View style={styles.targetLineSouth} />
            <View style={styles.targetLineEast} />
            <View style={styles.targetLineWest} />
          </View>
        </GlassView>
      </TouchableOpacity>

      {/* Bouton satellite avec effet Liquid Glass */}
      <TouchableOpacity
        style={[
          styles.satelliteButton,
          { bottom: sheetHeight + 5 + statsRectangleHeight + 10 + 40 + 12 },
          mapType === 'satellite' && { backgroundColor: '#FFFFFF' }
        ]}
        onPress={() => setMapType(prev => prev === 'standard' ? 'satellite' : 'standard')}
      >
        <GlassView
          style={styles.satelliteGlass}
          glassEffectStyle="regular"
          isInteractive={true}
          tintColor="rgba(255, 255, 255, 0.1)"
        >
          <Ionicons
            name={mapType === 'standard' ? 'map-outline' : 'earth-outline'}
            size={24}
            color="#2563EB"
          />
        </GlassView>
      </TouchableOpacity>

      <SavedTripsModal
        visible={showTripsModal}
        onClose={() => setShowTripsModal(false)}
        savedTrips={savedTrips}
        deleteTrip={deleteTrip}
        deleteAllTrips={deleteAllTrips}
        formatTripTime={formatTripTime}
      />

      <StatsPanel
        bottomOffset={sheetHeight + 5}
        onLayout={onStatsRectangleLayout}
        vehicleName={selectedVehicle}
        timeText={timeText}
        elapsedTime={elapsedTime}
        totalDistance={totalDistance}
        maxSpeed={maxSpeed}
      />

      <StepsEditorModal
        visible={showStepsEditor}
        onClose={() => setShowStepsEditor(false)}
        tripSteps={tripSteps}
      />

      <TripSummaryModal
        visible={showTripSummary}
        onClose={() => setShowTripSummary(false)}
        totalDistance={totalDistance}
        maxSpeed={maxSpeed}
        tripSteps={tripSteps}
        trackingPoints={trackingPoints} // Pass tracking points for trimming
        tripName={tripName}
        setTripName={setTripName}
        tripDescription={tripDescription}
        setTripDescription={setTripDescription}
        saveTripWithSteps={saveTripWithSteps}
        isSaving={isOperationLoading('saveTrip')}
        formatTripTime={formatTripTime}
        getCurrentTripTime={getCurrentTripTime}
        selectedVehicleId={selectedVehicleId}
        getVehicleIcon={getVehicleIcon}
        getVehicleName={getVehicleName}
      />

      {/* Menu principal du MapScreen */}
      <View style={styles.mainMenu} onLayout={onSheetLayout}>
        {/* Handle minimaliste */}
        <View style={styles.menuHandle} />

        {/* Permissions UI removed to keep start button as single control */}

        {/* Avant de commencer un trajet */}
        {!isTracking && (
          <>
            {/* Bouton Commencer avec design moderne */}
            <Animated.View style={{
              transform: [{ scale: pulseAnim }],
              opacity: startButtonAnim
            }}>
              <TouchableOpacity
                onPress={startTracking}
                disabled={locationPermission !== 'granted'}
                activeOpacity={0.9}
                style={[
                  styles.startButtonContainer,
                  locationPermission !== 'granted' && styles.disabledButtonContainer
                ]}
              >
                <LinearGradient
                  colors={locationPermission !== 'granted' ? ['#94A3B8', '#64748B'] : ['#2563EB', '#1D4ED8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.startButtonGradient}
                >
                  <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                    {locationPermission === 'granted' && (
                      <Text style={styles.startButtonSubtext}>
                        Vous pouvez sélectionner un véhicule
                      </Text>
                    )}
                    <Text style={styles.bigStartButtonText}>
                      {locationPermission !== 'granted' ? 'PERMISSIONS REQUISES' : 'COMMENCER'}
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

          </>
        )}

        {/* Pendant le trajet */}
        {isTracking && (
          <>
            {/* Contrôles du trajet - Interface dynamique */}
            <Animated.View style={[
              styles.dynamicControls,
              {
                opacity: controlsAnim,
                transform: [{ scale: controlsAnim }]
              }
            ]}>
              {/* Bouton Pause/Reprendre */}
              <TouchableOpacity
                style={styles.dynamicControlButton}
                onPress={isPaused ? resumeTracking : pauseTracking}
              >
                <Text style={styles.dynamicControlText}>
                  {isPaused ? 'Reprendre' : 'Pause'}
                </Text>
              </TouchableOpacity>

              {/* Bouton Photo au centre */}
              <TouchableOpacity
                style={styles.photoButton}
                onPress={openCamera}
              >
                <Ionicons name="camera" size={22} color="#1F2937" />
                <Text style={styles.photoButtonText}>Photo</Text>
              </TouchableOpacity>

              {/* Bouton Étapes/Terminer */}
              <TouchableOpacity
                style={[
                  styles.dynamicControlButton,
                  isPaused && styles.finishControlButton
                ]}
                onPress={() => {
                  if (isPaused) {
                    Alert.alert(
                      'Terminer le trajet',
                      'Voulez-vous enregistrer ce trajet ?',
                      [
                        { text: 'Annuler', style: 'cancel' },
                        { text: 'Ne pas enregistrer', style: 'destructive', onPress: () => resetTracking() },
                        { text: 'Enregistrer', onPress: () => setShowTripSummary(true) },
                      ],
                    );
                  } else {
                    openStepSheet();
                  }
                }}
              >
                <Text style={[styles.dynamicControlText, isPaused && styles.finishControlText]}>
                  {isPaused ? 'Terminer' : 'Étapes'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </>
        )}
      </View>

      <VehicleSelectorSheet
        ref={vehicleBottomSheetRef}
        snapPoints={vehicleSnapPoints}
        backdropComponent={renderBackdrop}
        vehicles={vehicles}
        selectedVehicleId={selectedVehicleId}
        onSelectVehicle={handleVehicleSelectWithClose}
        vehicleTypeToIcon={vehicleTypeToIcon}
        isLoading={isLoadingVehicles}
      />

      {/* Message flottant si aucun véhicule sélectionné - REMPLACÉ PAR L'INSCRIPTION DANS LE BOUTON */}
      {/* {!isTracking && !selectedVehicleId && vehicles.length > 0 && !isLoadingVehicles && (
        <Animated.View style={{ 
          position: 'absolute', 
          top: topPosition + 60, 
          right: 20, 
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
          maxWidth: 200,
        }}>
          <Text style={{ fontSize: 13, color: '#2563EB', fontWeight: '600', textAlign: 'center' }}>
            👆 Sélectionnez votre véhicule
          </Text>
          <View style={{
            position: 'absolute',
            top: -6,
            right: 20,
            width: 12,
            height: 12,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            transform: [{ rotate: '45deg' }],
          }} />
        </Animated.View>
      )} */}

      <BottomSheetModal
        ref={stepSheetRef}
        snapPoints={['80%']}
        index={0}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        enableDynamicSizing={false}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        backgroundStyle={styles.stepSheetBackground}
        handleIndicatorStyle={styles.stepSheetHandle}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <BottomSheetScrollView
            contentContainerStyle={styles.stepSheetContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.stepSheetTitle}>Nouvelle étape</Text>
            <TextInput
              ref={stepTitleInputRef}
              value={stepTitleInput}
              onChangeText={setStepTitleInput}
              placeholder="Nom de l'étape"
              placeholderTextColor="#94A3B8"
              style={styles.stepSheetInput}
            />
            <TextInput
              value={stepDescriptionInput}
              onChangeText={setStepDescriptionInput}
              placeholder="Description ou contexte (optionnel)"
              placeholderTextColor="#94A3B8"
              style={styles.stepSheetTextArea}
              multiline
            />
            {stepPhotoUri ? (
              <View style={styles.stepSheetPhotoPreview}>
                <Image source={{ uri: stepPhotoUri }} style={styles.stepSheetPhoto} />
                <TouchableOpacity onPress={handleStepPhotoClear}>
                  <Text style={styles.stepSheetPhotoRemove}>Retirer la photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.stepSheetPhotoButton} onPress={handleStepPhotoPick}>
                <Ionicons name="image-outline" size={20} color="#2563EB" />
                <Text style={styles.stepSheetPhotoButtonText}>Ajouter une photo</Text>
              </TouchableOpacity>
            )}
            <View style={styles.stepSheetActions}>
              <TouchableOpacity style={styles.stepSheetButtonSecondary} onPress={closeStepSheet}>
                <Text style={styles.stepSheetButtonSecondaryText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.stepSheetButton,
                  stepTitleInput.trim() === '' && styles.stepSheetButtonDisabled,
                ]}
                onPress={handleAddStepSubmit}
                disabled={stepTitleInput.trim() === ''}
              >
                <Text style={styles.stepSheetButtonText}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </BottomSheetScrollView>
        </KeyboardAvoidingView>
      </BottomSheetModal>

      <CameraModal
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        cameraPermission={cameraPermission}
        capturedPhoto={capturedPhoto}
        retakePhoto={retakePhoto}
        confirmPhoto={confirmPhoto}
        cameraType={cameraType}
        setCameraType={setCameraType}
        flashMode={flashMode}
        setFlashMode={setFlashMode}
        takePicture={takePicture}
        setCameraRef={setCameraRef}
      />

      {/* ShareCard component - rendered off-screen for capture */}
      {isGeneratingShare && (
        <View style={styles.shareCardContainer}>
          <View style={{ position: 'absolute', top: 20, left: 20, right: 20, zIndex: 2, flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
            {['stats-only', 'route-stats', 'mini-route'].map(v => (
              <TouchableOpacity key={v} onPress={() => setShareVariant(v)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: shareVariant === v ? '#2563EB' : '#1F2937' }}>
                <Text style={{ color: '#fff', }}>{v.replace('-', ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <ViewShot ref={shareCardRef} options={{ format: 'png', quality: 1.0, result: 'tmpfile' }}>
            <ShareCard ride={{
              name: tripName || `Trajet ${new Date().toLocaleDateString('fr-FR')}`,
              description: tripDescription,
              startTime: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
              endTime: new Date().toISOString(),
              duration: elapsedTime,
              distance: Math.max(0, totalDistance || 0),
              maxSpeed: maxSpeed,
              averageSpeed: (totalDistance || 0) > 0 && getCurrentTripTime() > 0
                ? ((totalDistance || 0) / 1000) / (getCurrentTripTime() / 3600)
                : 0,
              routeCoordinates: compressedPolyline ? (() => {
                try {
                  const coords = polyline.decode(compressedPolyline);
                  return coords.map(c => ({ latitude: c[0], longitude: c[1] }));
                } catch (e) {
                  return trackingPoints;
                }
              })() : trackingPoints,
              vehicle: selectedVehicle,
              startCity: null,
              endCity: null,
              extraStats: extraStats,
              totalTurns: totalTurns,
            }} />
          </ViewShot>
        </View>
      )}

    </View>
  );
}

// Composant App par défaut qui enveloppe avec SafeAreaProvider
function AppWrapper() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StravaCarApp navigation={undefined} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Wrapper pour accepter navigation depuis React Navigation
export default function FullMapScreen({ navigation }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StravaCarApp navigation={navigation} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Export aussi le wrapper sans navigation pour compatibilité
AppWrapper.StravaCarApp = StravaCarApp;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  map: {
    flex: 1,
  },
  statText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
  },
  mainMenu: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    // Removed background color and borders to remove "sheet" look
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 40,
    // Removed shadows
  },
  menuHandle: {
    // Hidden handle since no sheet
    width: 0,
    height: 0,
    opacity: 0,
  },
  startButtonContainer: {
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
    alignSelf: 'center',
    borderRadius: 36,
    marginVertical: 12,
    width: '100%', // Full width
  },
  disabledButtonContainer: {
    shadowColor: '#94A3B8',
    shadowOpacity: 0.1,
  },
  startButtonGradient: {
    paddingVertical: 24, // Increased height
    paddingHorizontal: 24,
    borderRadius: 36,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%', // Full width
  },
  bigStartButtonText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: 4, // Spacing from subtext
  },
  startButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  disabledButton: {
    backgroundColor: '#94A3B8',
    borderColor: '#CBD5E1',
    shadowOpacity: 0.1,
    elevation: 2,
  },
  dynamicControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 0,
    marginTop: 8,
    height: 72,
    gap: 16,
  },
  dynamicControlButton: {
    flex: 1,
    height: 64,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dynamicControlText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  photoButton: {
    flex: 1.2,
    height: 64,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  photoButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  stepSheetContainer: {
    padding: 24,
    paddingBottom: 40,
    gap: 16,
    backgroundColor: '#FFFFFF',
  },
  stepSheetBackground: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  stepSheetHandle: {
    backgroundColor: '#CBD5E1',
    width: 48,
    height: 5,
    marginTop: 12,
  },
  stepSheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  stepSheetInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '500',
  },
  stepSheetTextArea: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#0F172A',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  stepSheetPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  stepSheetPhotoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
  },
  stepSheetPhotoPreview: {
    borderWidth: 0,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    gap: 12,
  },
  stepSheetPhoto: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
  stepSheetPhotoRemove: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 14,
  },
  stepSheetActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  stepSheetButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  stepSheetButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
  },
  stepSheetButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  stepSheetButtonSecondary: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  stepSheetButtonSecondaryText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
  },
  finishControlButton: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  finishControlText: {
    color: '#B45309',
  },
  gpsButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden', // Important for GlassView to respect rounded corners
  },
  gpsGlass: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  satelliteButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent', // Transparent pour laisser passer l'effet glass
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden', // Important pour GlassView
  },
  satelliteGlass: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topIndicatorContainer: {
    position: 'absolute',
    right: 20,
    borderRadius: 24,
    minWidth: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  vehicleDropdown: {
    backgroundColor: 'transparent',
    borderRadius: 24,
    borderWidth: 0,
    minWidth: 160,
  },
  vehicleDropdownLoading: {
    opacity: 0.7,
  },
  vehicleDropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  vehicleDropdownText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    letterSpacing: 0.5,
  },
  pauseIndicator: {
    position: 'absolute',
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 1000,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  pauseIndicatorText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  historyButton: {
    position: 'absolute',
    left: 20,
    width: 48,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  shareCardContainer: {
    position: 'absolute',
    top: -100000,
    left: 0,
    width: 1080,
    height: 1920,
  },
  speedIndicatorSimple: {
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  speedValue: {
    color: '#0F172A',
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 44,
    fontVariant: ['tabular-nums'],
  },
  speedUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 1,
    marginTop: 0,
    textTransform: 'uppercase',
  },
  targetVehicleIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  targetOuterCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#2563EB',
    position: 'absolute',
  },
  targetInnerCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2563EB',
    position: 'absolute',
  },
  targetCenter: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2563EB',
    position: 'absolute',
  },
  targetLineNorth: {
    width: 1.5,
    height: 6,
    backgroundColor: '#2563EB',
    position: 'absolute',
    top: -5,
  },
  targetLineSouth: {
    width: 1.5,
    height: 6,
    backgroundColor: '#2563EB',
    position: 'absolute',
    bottom: -5,
  },
  targetLineEast: {
    width: 6,
    height: 1.5,
    backgroundColor: '#2563EB',
    position: 'absolute',
    right: -5,
  },
  targetLineWest: {
    width: 6,
    height: 1.5,
    backgroundColor: '#2563EB',
    position: 'absolute',
    left: -5,
  },
});