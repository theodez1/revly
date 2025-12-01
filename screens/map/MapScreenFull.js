import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, View, TouchableOpacity, Alert, StatusBar, ScrollView, Animated, Dimensions, TextInput, Image, ActivityIndicator, AppState, KeyboardAvoidingView, Platform } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { getDistance } from 'geolib';
import * as polyline from 'google-polyline';
// ... other imports

// ...


import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
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
import {
  hasStartedBackgroundLocationUpdatesAsync,
  startBackgroundLocationUpdatesAsync,
} from '../../services/BackgroundLocationService';

// Composant isolé pour l'affichage du temps (évite les re-renders de la carte)
const TimeDisplay = memo(({ timeText }) => (
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
    setIsPaused,
    isRequestingPermission,
    locationPermission,
    backgroundStatus,
    lastHeartbeat,
    startTracking,
    pauseTracking,
    stopTracking,
    resetTracking,
    checkLocationPermission,
    syncBackgroundLocations,
    currentLocation,
    setCurrentLocation,
    trackingPoints,
    trackingPointsRef,
    trackingSegments,
    activeRouteSegments,
    simplifiedPoints,
    compressedPolyline,
    segmentStartIndices,
    segmentStartIndicesRef,
    currentSegmentIndexRef,
    setLastSampledPoint,
    setLastSampledTime,
    lastSampledBearing,
    setLastSampledBearing,
    appendTrackingPoint,
    incrementTotalPoints,
    recordRejectedPoint,
    shouldSamplePoint,
    validateAndFilterPoint,
    startTime,
    setStartTime,
    maxSpeed,
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
    setAltitudeData,
    drivingScore,
    setDrivingScore,
    currentSpeed,
    smoothedSpeed,
    speedHistory,
    totalDistance,
    formatDisplaySpeed,
    detectStop,
    scheduleInactivityPrompt,
    resetInactivityTracking,
    showInactivityPrompt,
    setShowInactivityPrompt,
    inactiveDurationMs,
    INACTIVITY_SPEED_THRESHOLD_KMH,
    INACTIVITY_DURATION_MS,
    timeText,
    formatTripTime,
    calculateElevationGain,
    getCurrentTripTime,
    startTripTimer,
    pauseTripTimer,
    resumeTripTimer,
    stopTripTimer,
    resetTripTimer,
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
    setIsTracking,
    isTrackingRef,
    flattenSegments: flattenSegmentsFromEngine,
    getSegmentIndexForPosition: getSegmentIndexForPositionFromEngine,
    compressPolyline: compressPolylineFromEngine,
    setCurrentSpeed: setCurrentSpeedFromEngine,
    speedWatchRef: speedWatchRefFromEngine,
    handleLocationUpdate: handleLocationUpdateFromEngine,
    executeWithLoading,
    isOperationLoading,
  } = useTrackingEngine();

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
    (...args) => {
      if (typeof handleLocationUpdateFromEngine === 'function') {
        return handleLocationUpdateFromEngine(...args);
      }
      return undefined;
    },
    [handleLocationUpdateFromEngine],
  );

  const [savedTrips, setSavedTrips] = useState([]);
  const [showTripsModal, setShowTripsModal] = useState(false);
  const [selectedTripForView, setSelectedTripForView] = useState(null);
  const [profilePhotoUri, setProfilePhotoUri] = useState(null);
  const lastLoadedAvatarRef = useRef(null); // Pour éviter les rechargements inutiles
  const mapType = 'standard';
  const initialRegion = useMemo(
    () => ({
      latitude: typeof currentLocation?.latitude === 'number' ? currentLocation.latitude : 48.8566,
      longitude: typeof currentLocation?.longitude === 'number' ? currentLocation.longitude : 2.3522,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }),
    [currentLocation?.latitude, currentLocation?.longitude]
  );
  const [extraStats, setExtraStats] = useState({});
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
      console.log('Ouverture de la caméra...');

      if (!cameraPermission) {
        console.log('Permissions caméra en cours de chargement...');
        return;
      }

      if (!cameraPermission.granted) {
        console.log('Demande de permission caméra...');
        const result = await requestCameraPermission();
        console.log('Résultat permission:', result);

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

      console.log('Permission accordée, ouverture de la caméra');
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

      console.log('Prise de photo en cours...');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      console.log('Photo prise:', photo.uri);

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
    getCurrentTripTime,
    totalDistance,
    maxSpeed,
    extraStats,
    tripName,
    tripDescription,
    startTime,
    segmentStartIndicesRef,
    navigation,
    selectedVehicleId,
    setIsGeneratingShare,
  }), [
    compressedPolyline,
    extraStats,
    flattenSegments,
    getCurrentTripTime,
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
        getCurrentTripTime,
        totalDistance,
        maxSpeed,
        totalStops,
        totalStopTime,
        tripSteps,
        altitudeData,
        extraStats,
        tripName,
        tripDescription,
        startTime,
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
      });
    }, 'saveTrip');
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
  // Fonction pour lisser les courbes avec interpolation Catmull-Rom
  const smoothTrack = useCallback((points) => {
    if (points.length < 4) return points;

    const smoothedPoints = [];
    const tension = 0.5; // Tension de la courbe (0.5 = bon équilibre)
    const numSegments = 3; // Nombre de points entre chaque point réel (réduit de 5 à 3 pour performance)

    // Ajouter le premier point
    smoothedPoints.push(points[0]);

    // Interpolation Catmull-Rom entre les points
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(i + 2, points.length - 1)];

      // Générer des points intermédiaires
      for (let t = 0; t < numSegments; t++) {
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
          timestamp: p1.timestamp,
          speed: p1.speed,
          altitude: p1.altitude
        });
      }
    }

    // Ajouter le dernier point
    smoothedPoints.push(points[points.length - 1]);

    return smoothedPoints;
  }, []);

  const centerMapOnLocation = useCallback((location, options = {}) => {
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

  // Suivi fluide de la caméra pendant le tracking avec interpolation progressive
  const lastCameraUpdateRef = useRef(null);
  const latestLocationRef = useRef(null);

  useEffect(() => {
    latestLocationRef.current = currentLocation;
  }, [currentLocation]);

  useEffect(() => {
    if (!isTracking || !currentLocation || !mapRef.current) {
      return;
    }

    const speedForCamera = Number.isFinite(smoothedSpeed) && smoothedSpeed > 0 ? smoothedSpeed : currentSpeed || 0;
    const now = Date.now();

    // Intervalle réduit pour des mises à jour plus fréquentes et fluides
    const minInterval =
      speedForCamera >= 100
        ? 80  // Réduit de 120 à 80ms pour plus de fluidité
        : speedForCamera >= 60
          ? 100 // Réduit de 160 à 100ms
          : 150; // Réduit de 240 à 150ms

    if (!lastCameraUpdateRef.current || now - lastCameraUpdateRef.current > minInterval) {
      lastCameraUpdateRef.current = now;

      const previousTarget = previousCameraTargetRef.current || currentLocation;
      const distanceMeters = Number.isFinite(previousTarget?.latitude) && Number.isFinite(previousTarget?.longitude)
        ? getDistance(
          { latitude: previousTarget.latitude, longitude: previousTarget.longitude },
          { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
        )
        : 0;

      // Durée d'animation plus longue pour plus de fluidité, avec interpolation basée sur la distance
      const baseDuration = speedForCamera >= 100 ? 600 : speedForCamera >= 60 ? 700 : 800;
      const distanceWeightedDuration = Math.min(1200, Math.max(baseDuration, distanceMeters * 60));
      const duration = speedForCamera > 0 ? distanceWeightedDuration : 500;

      // Utiliser directement animateCamera avec une durée plus longue pour plus de fluidité
      // L'interpolation est gérée par animateCamera lui-même, avec lissage du heading
      centerMapOnLocation(currentLocation, {
        duration,
      });
      previousCameraTargetRef.current = currentLocation;
    }
  }, [isTracking, currentLocation, centerMapOnLocation, smoothedSpeed, currentSpeed]);

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

      const currentLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setCurrentLocation(currentLocation);
      centerMapOnLocation(currentLocation, { duration: 600 });

    } catch (error) {
      console.error('Erreur obtention position:', error);
    }
  }, [centerMapOnLocation]);

  // Fonction pour calculer la vitesse moyenne (simplifiée)
  const calculateAverageSpeed = () => {
    try {
      if (trackingPoints.length < 2 || !startTime) return 0;

      const totalTime = (Date.now() - startTime) / 1000 / 3600; // en heures
      const totalDistanceKm = totalDistance;

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
      if (!isTrackingRef.current || isPaused) {
        return;
      }

      // Vérifier les permissions de localisation
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted' && isTrackingRef.current) {
          console.error('[Tracking] ❌ Permissions révoquées pendant le tracking');
          Alert.alert('Erreur', 'Les permissions de localisation ont été révoquées. Le tracking a été arrêté.');
          setIsTracking(false);
          isTrackingRef.current = false;
          return;
        }
      } catch (err) {
        console.error('[Tracking] ❌ Erreur vérification permissions:', err);
      }

      // Vérifier que TaskManager fonctionne toujours (foreground ET background)
      try {
        const isRunning = await hasStartedBackgroundLocationUpdatesAsync();
        if (!isRunning && isTrackingRef.current && !isPaused) {
          console.warn('[Tracking] ⚠️ TaskManager arrêté, redémarrage...');
          await startBackgroundLocationUpdatesAsync();
        }
      } catch (err) {
        console.error('[Tracking] ❌ Erreur vérification TaskManager:', err);
      }
    }, 30000); // Vérifier toutes les 30 secondes

    return () => {
      clearInterval(checkInterval);
    };
  }, [isTracking, isPaused, setIsTracking]);

  // Gestion AppState : TaskManager fonctionne automatiquement en foreground ET background
  // Plus besoin de gérer watchPositionAsync séparément
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      // TaskManager continue de fonctionner en background automatiquement
      // On synchronise juste les locations au retour au foreground
      if (nextAppState === 'active' && isTrackingRef.current && !isPaused) {
        syncBackgroundLocations();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [isPaused, syncBackgroundLocations, isTrackingRef]);

  const routeGeoJSON = useMemo(() => {
    if (!activeRouteSegments || activeRouteSegments.length === 0) return null;

    const coordinates = activeRouteSegments.map(segment => {
      let pointsToRender = segment;
      if (isTracking && segment.length > 200) {
        pointsToRender = segment.slice(-200);
      }
      return pointsToRender.map(p => [p.longitude, p.latitude]);
    });

    return {
      type: 'Feature',
      geometry: {
        type: 'MultiLineString',
        coordinates: coordinates,
      },
    };
  }, [activeRouteSegments, isTracking]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Carte */}
      {/* Carte Mapbox */}
      <Mapbox.MapView
        style={styles.map}
        styleURL={Mapbox.StyleURL.Street}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled={!isTracking}
        zoomEnabled={!isTracking}
      >
        <Mapbox.Camera
          ref={setCameraRef}
          defaultSettings={{
            centerCoordinate: [initialRegion.longitude, initialRegion.latitude],
            zoomLevel: 15,
          }}
          followUserLocation={false}
        />

        <Mapbox.UserLocation
          visible={true}
          showsUserHeadingIndicator={true}
          androidRenderMode="gps"
        />

        {routeGeoJSON && (
          <Mapbox.ShapeSource id="routeSource" shape={routeGeoJSON}>
            <Mapbox.LineLayer
              id="routeFill"
              style={{
                lineColor: '#2563EB',
                lineWidth: 6,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </Mapbox.ShapeSource>
        )}
      </Mapbox.MapView>



      {/* Bouton retour */}
      <TouchableOpacity
        style={[styles.historyButton, { top: topPosition }]}
        onPress={() => {
          // Fermer le modal si navigation existe
          if (typeof navigation !== 'undefined' && navigation) {
            navigation.goBack();
          }
        }}
      >
        <Ionicons name="chevron-down" size={18} color="#64748B" />
      </TouchableOpacity>




      {/* Sélecteur de véhicule ou vitesse selon l'état */}
      <View style={[styles.topIndicatorContainer, { top: topPosition }]}>
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
                <ActivityIndicator size="small" color="#F8FAFC" />
              ) : (
                <Ionicons name={getVehicleIcon(selectedVehicleId)} size={20} color="white" />
              )}
              <Text style={styles.vehicleDropdownText}>
                {isLoadingVehicles
                  ? 'Chargement...'
                  : vehicles.length === 0
                    ? 'Pas de véhicule'
                    : selectedVehicle}
              </Text>
              <Ionicons name="chevron-down" size={16} color="rgba(255, 255, 255, 0.7)" />
            </View>
          </TouchableOpacity>
        ) : (
          /* Indicateur de vitesse pendant le trajet */
          <View style={styles.speedIndicatorSimple}>
            <Text style={styles.speedValue}>{currentSpeed}</Text>
            <Text style={styles.speedUnit}>km/h</Text>
          </View>
        )}
      </View>

      {/* Bouton centrer GPS avec effet Liquid Glass */}
      <TouchableOpacity
        style={[styles.gpsButton, { bottom: sheetHeight + 5 + statsRectangleHeight + 10 }]}
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
            {/* Cercle extérieur */}
            <View style={styles.targetOuterCircle} />
            {/* Cercle intérieur */}
            <View style={styles.targetInnerCircle} />
            {/* Point central */}
            <View style={styles.targetCenter} />
            {/* Traits de cible - Nord */}
            <View style={styles.targetLineNorth} />
            {/* Traits de cible - Sud */}
            <View style={styles.targetLineSouth} />
            {/* Traits de cible - Est */}
            <View style={styles.targetLineEast} />
            {/* Traits de cible - Ouest */}
            <View style={styles.targetLineWest} />
          </View>
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
                style={[
                  styles.bigStartButton,
                  locationPermission !== 'granted' && styles.disabledButton
                ]}
                onPress={startTracking}
                disabled={locationPermission !== 'granted'}
              >
                <View style={styles.startButtonContent}>
                  <Text style={styles.bigStartButtonText}>
                    {locationPermission !== 'granted' ? 'Permissions requises' : 'Commencer'}
                  </Text>
                  <Text style={styles.startButtonSubtext}>
                    {locationPermission !== 'granted' ? 'Autorisez la localisation' : 'Démarrer le trajet'}
                  </Text>
                </View>
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
                onPress={pauseTracking}
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
                        { text: 'Ne pas enregistrer', style: 'destructive', onPress: () => stopTracking() },
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
              startTime: startTime || new Date().toISOString(),
              endTime: new Date().toISOString(),
              duration: getCurrentTripTime(),
              distance: Math.max(0, (totalDistance || 0) * 1000),
              maxSpeed: maxSpeed,
              averageSpeed: (totalDistance || 0) > 0 && getCurrentTripTime() > 0
                ? (totalDistance || 0) / (getCurrentTripTime() / 3600)
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
              extraStats: shareExtraStats,
              totalTurns: totalTurns,
            }} variant={shareVariant} />
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
        <StravaCarApp />
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
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  },
  statText: {
    fontSize: 14, color: '#666',
    textAlign: 'center',
  },
  mainMenu: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  menuHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  bigStartButton: {
    backgroundColor: '#1F2937',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
    marginVertical: 18,
    minWidth: 220,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  startButtonContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigStartButtonText: {
    fontSize: 18, fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: 0.5,
    marginBottom: 2,
    textAlign: 'center',
  },
  startButtonSubtext: {
    color: 'rgba(241, 245, 249, 0.7)',
    fontSize: 12, textAlign: 'center',
  },
  disabledButton: {
    backgroundColor: '#6c757d',
    borderColor: '#495057',
    shadowOpacity: 0.1,
    elevation: 2,
  },
  dynamicControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginTop: 16,
    height: 64,
    gap: 10,
  },
  dynamicControlButton: {
    flex: 1,
    height: 56,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.1)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  dynamicControlText: {
    fontSize: 16, fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  photoButton: {
    flex: 1,
    height: 56,
    borderRadius: 20,
    backgroundColor: '#BFDBFE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(30, 64, 175, 0.25)',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  photoButtonText: {
    fontSize: 16, fontWeight: '700',
    color: '#1F2937',
    letterSpacing: 0.3,
  },
  stepSheetContainer: {
    padding: 20,
    paddingBottom: 30,
    gap: 12,
  },
  stepSheetBackground: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  stepSheetHandle: {
    backgroundColor: '#CBD5E1',
  },
  stepSheetTitle: {
    fontSize: 18, fontWeight: '700',
    color: '#1F2937',
  },
  stepSheetInput: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.6)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
  },
  stepSheetTextArea: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1F2937',
    minHeight: 90,
    textAlignVertical: 'top',
  },
  stepSheetPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  stepSheetPhotoButtonText: {
    fontSize: 16, fontWeight: '400',
    color: '#2563EB',
  },
  stepSheetPhotoPreview: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    gap: 8,
  },
  stepSheetPhoto: {
    width: '100%',
    height: 140,
    borderRadius: 12,
  },
  stepSheetPhotoRemove: {
    color: '#DC2626',
  },
  stepSheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  stepSheetButton: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  stepSheetButtonDisabled: {
    backgroundColor: 'rgba(17, 24, 39, 0.4)',
  },
  stepSheetButtonText: {
    color: '#F8FAFC',
    fontSize: 15,
  },
  stepSheetButtonSecondary: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.6)',
  },
  stepSheetButtonSecondaryText: {
    color: '#1F2937',
    fontSize: 15,
  },
  finishControlButton: {
    backgroundColor: '#FDE68A',
    borderColor: 'rgba(217, 119, 6, 0.35)',
    shadowColor: '#D97706',
  },
  finishControlText: {
    color: '#92400E',
  },
  gpsButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
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
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
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
    borderRadius: 18,
    minWidth: 96,
    backgroundColor: 'rgba(30, 58, 138, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    backdropFilter: 'blur(10px)',
  },
  vehicleDropdown: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.45)',
    minWidth: 150,
  },
  vehicleDropdownLoading: {
    opacity: 0.8,
  },
  vehicleDropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  vehicleDropdownText: {
    fontSize: 16, fontWeight: '400',
    color: '#F8FAFC',
    letterSpacing: 0.3,
  },
  pauseIndicator: {
    position: 'absolute',
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  pauseIndicatorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  historyButton: {
    position: 'absolute',
    left: 20,
    width: 40,
    height: 40,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  shareCardContainer: {
    position: 'absolute',
    top: -100000,
    left: 0,
    width: 1080,
    height: 1920,
  },
  speedIndicatorSimple: {
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  speedValue: {
    color: '#FFFFFF',
    fontSize: 34, lineHeight: 38,
  },
  speedUnit: {
    fontSize: 12, fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 0.4,
    marginTop: -2,
  },
  targetVehicleIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  targetOuterCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#1E3A8A',
    position: 'absolute',
  },
  targetInnerCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E3A8A',
    position: 'absolute',
  },
  targetCenter: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1E3A8A',
    position: 'absolute',
  },
  targetLineNorth: {
    width: 1,
    height: 8,
    backgroundColor: '#1E3A8A',
    position: 'absolute',
    top: -4,
  },
  targetLineSouth: {
    width: 1,
    height: 8,
    backgroundColor: '#1E3A8A',
    position: 'absolute',
    bottom: -4,
  },
  targetLineEast: {
    width: 8,
    height: 1,
    backgroundColor: '#1E3A8A',
    position: 'absolute',
    right: -4,
  },
  targetLineWest: {
    width: 8,
    height: 1,
    backgroundColor: '#1E3A8A',
    position: 'absolute',
    left: -4,
  },
});