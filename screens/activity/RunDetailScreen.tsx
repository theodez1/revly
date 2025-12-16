import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Modal, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Mapbox from '@rnmapbox/maps';
import Svg, { Rect } from 'react-native-svg';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
// ... imports

// ...

import { Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import Carousel from 'react-native-reanimated-carousel';
import { GlassView } from 'expo-glass-effect';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import ViewShot from 'react-native-view-shot';
import ShareCard from '../../components/ShareCard';
import * as FileSystem from 'expo-file-system/legacy';
import { RideStorageService } from '../../services/RideStorage';
import RideAnalysisService from '../../services/RideAnalysisService';
import { useRidePlayback } from '../../hooks/useRidePlayback';
import PlaybackControls from '../../components/PlaybackControls';

import * as polyline from 'google-polyline';
import EditTripModal from './components/EditTripModal';
import { RouteOptimizationService, Coordinate } from '../../services/RouteOptimizationService';
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const SHARE_PREVIEW_WIDTH = Math.min(screenWidth - 64, 320);
const SHARE_PREVIEW_HEIGHT = Math.min(SHARE_PREVIEW_WIDTH * 1.78, screenHeight * 0.45);

const customMapStyle = [
  // Keep overall colors; only declutter non-essential icons and shields
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'all', stylers: [{ visibility: 'off' }] },
  // Hide highway/road shields (icons), keep road names (text) visible
  { featureType: 'road.highway', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.arterial', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.local', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];


export default function RunDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { ride: initialRide, rideId } = route.params || {};
  const [ride, setRide] = useState(initialRide || null);
  const [isLoading, setIsLoading] = useState(!initialRide && !!rideId);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [currentSheetIndex, setCurrentSheetIndex] = useState(1);
  const [mapType, setMapType] = useState('standard');
  const [sheetPosition, setSheetPosition] = useState(screenHeight * 0.5); // current sheet bottom position
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const copyAnim = useSharedValue(0);
  const saveAnim = useSharedValue(0);
  const copyIconStyle = useAnimatedStyle(() => ({ opacity: 1 - copyAnim.value }));
  const copyCheckStyle = useAnimatedStyle(() => ({ opacity: copyAnim.value }));
  const saveIconStyle = useAnimatedStyle(() => ({ opacity: 1 - saveAnim.value }));
  const saveCheckStyle = useAnimatedStyle(() => ({ opacity: saveAnim.value }));

  // Use shared value to track sheet position (initialized to middle position)
  const snapPercents = [0.15, 0.5, 1.0];
  const sheetPositionValue = useSharedValue(screenHeight * snapPercents[1]); // Start at middle (index 1)

  // Animated style for top buttons - fade out progressively from 88% to 100%
  const topButtonsStyle = useAnimatedStyle(() => {
    // When sheet is at 88%, it's at 12% from top of screen
    const highPosition = screenHeight * 0.12; // Sheet at 88% (12% from top)
    const fullPosition = 0; // Sheet at 100% (0% from top)

    // Fade out when sheet goes from 88% to 100%
    if (sheetPositionValue.value > highPosition) {
      // Sheet is between 15% and 88% -> fully visible
      return {
        opacity: 1,
        pointerEvents: 'auto',
      };
    } else {
      // Sheet is between 88% and 100% -> fade out
      const fadeRange = highPosition - fullPosition;
      const progress = (sheetPositionValue.value - fullPosition) / fadeRange;
      const opacity = Math.max(0, Math.min(1, progress));

      return {
        opacity,
        pointerEvents: opacity < 0.5 ? 'none' : 'auto',
      };
    }
  });
  const shareSheetRef = useRef(null);
  const shareCardRefTransparent = useRef(null);
  const bottomSheetRef = useRef<BottomSheet | null>(null);
  const mapRef = useRef<any>(null);
  const snapPoints = useMemo(() => ['15%', '50%', '88%', '100%'], []);
  const [isShareProcessing, setIsShareProcessing] = useState(false);
  const [isIntermediateCitiesExpanded, setIsIntermediateCitiesExpanded] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const sharePreviewWidth = SHARE_PREVIEW_WIDTH;
  const sharePreviewHeight = SHARE_PREVIEW_HEIGHT;
  // Playback Hook
  const routeCoords = useMemo(() => {
    return (ride?.routeCoordinates || []).filter(
      (p) => p && typeof p.latitude === 'number' && typeof p.longitude === 'number'
    );
  }, [ride]);

  const {
    isPlaying,
    progress,
    speedMultiplier,
    currentPosition,
    currentHeading,
    play,
    pause,
    seek,
    setSpeed
  } = useRidePlayback(routeCoords);

  // Auto-close bottom sheet when playing
  useEffect(() => {
    if (isPlaying) {
      bottomSheetRef.current?.snapToIndex(0); // Minimize
    }
  }, [isPlaying]);

  // Update camera when currentPosition changes (smooth follow)
  useEffect(() => {
    if (isPlaying && currentPosition && mapRef.current) {
      mapRef.current.setCamera({
        centerCoordinate: [currentPosition.longitude, currentPosition.latitude],
        heading: currentHeading,
        pitch: 65,
        zoomLevel: 19,
        animationDuration: 0,
      });
    }
  }, [isPlaying, currentPosition, currentHeading]);

  const routeSegments = useMemo(() => {
    if (!ride) return [];

    if (Array.isArray(ride.routeSegments) && ride.routeSegments.length > 0) {
      return ride.routeSegments
        .map((segment) =>
          (segment || []).filter(
            (point) => point && typeof point.latitude === 'number' && typeof point.longitude === 'number'
          )
        )
        .filter((segment) => segment.length > 0);
    }

    const coords = (ride.routeCoordinates || []).filter(
      (point) => point && typeof point.latitude === 'number' && typeof point.longitude === 'number'
    );
    if (coords.length === 0) {
      return [];
    }

    if (coords.some((point) => typeof point.segmentIndex === 'number')) {
      const segments = [];
      let currentSegmentIndex = typeof coords[0]?.segmentIndex === 'number' ? coords[0].segmentIndex : 0;
      let current = [];

      coords.forEach((point) => {
        const segIndex =
          typeof point.segmentIndex === 'number' ? point.segmentIndex : currentSegmentIndex;
        if (current.length === 0 || segIndex === currentSegmentIndex) {
          current.push(point);
          currentSegmentIndex = segIndex;
        } else {
          segments.push(current);
          current = [point];
          currentSegmentIndex = segIndex;
        }
      });
      if (current.length > 0) {
        segments.push(current);
      }
      return segments;
    }

    const starts = Array.isArray(ride.segmentStartIndices) ? ride.segmentStartIndices : null;
    if (starts && starts.length > 0) {
      const segments = [];
      for (let i = 0; i < starts.length; i += 1) {
        const start = starts[i];
        const end = i + 1 < starts.length ? starts[i + 1] : coords.length;
        const segment = coords.slice(start, end);
        if (segment.length > 0) {
          segments.push(segment);
        }
      }
      if (segments.length > 0) {
        return segments;
      }
    }

    return [coords];
  }, [ride]);

  const flattenedRoute = useMemo(
    () => routeSegments.reduce((acc, segment) => acc.concat(segment), []),
    [routeSegments]
  );



  // State for Map Matching
  const [matchedCoordinates, setMatchedCoordinates] = useState<any[] | null>(null);
  const [isMatching, setIsMatching] = useState(false);

  // Charger le ride depuis rideId si nécessaire
  useEffect(() => {
    const loadRide = async () => {
      if (!ride && rideId) {
        try {
          setIsLoading(true);
          const loadedRide = await RideStorageService.getRideById(rideId);
          if (loadedRide) {
            setRide(loadedRide);
          } else {
            Alert.alert('Erreur', 'Trajet introuvable');
            navigation.goBack();
          }
        } catch (error) {
          console.error('Erreur chargement trajet:', error);
          Alert.alert('Erreur', 'Impossible de charger le trajet');
          navigation.goBack();
        } finally {
          setIsLoading(false);
        }
      }
    };
    loadRide();
  }, [ride, rideId, navigation]);

  // Décoder le polyline en routeCoordinates si nécessaire
  useEffect(() => {
    if (ride && (!ride.routeCoordinates || ride.routeCoordinates.length === 0) && ride.polyline) {
      try {
        const coords = polyline.decode(ride.polyline);
        const routeCoordinates = coords.map(c => ({ latitude: c[0], longitude: c[1] }));
        setRide({
          ...ride,
          routeCoordinates: routeCoordinates
        });
      } catch (error) {
        console.error('Erreur décompression polyline dans RunDetailScreen:', error);
      }
    }
  }, [ride]);

  // ⚡ MAP MATCHING ON VIEW
  useEffect(() => {
    if (!ride || !ride.routeCoordinates || ride.routeCoordinates.length < 2) return;

    // Si on a déjà matché, on ne refait pas
    if (matchedCoordinates) return;

    const performMatching = async () => {
      setIsMatching(true);
      try {
        // Dynamic import to avoid cycles if any
        const { MapMatchingService } = require('../../services/MapMatchingService');
        console.log('[RunDetail] Requesting Map Matching...');

        const matched = await MapMatchingService.matchTrace(ride.routeCoordinates);
        if (matched && matched.length > 0) {
          console.log(`[RunDetail] Map Matching success! Got ${matched.length} points.`);
          setMatchedCoordinates(matched);
          // Optional: Haptic feedback to indicate "snap" happened
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          console.log('[RunDetail] Map Matching returned null.');
        }
      } catch (e) {
        console.warn('[RunDetail] Map Matching error:', e);
      } finally {
        setIsMatching(false);
      }
    };

    performMatching();
  }, [ride]);

  // ⚡ OPTIMISATION DU POLYLINE POUR AFFICHAGE (sans modifier la BDD)
  // Filtre intelligent pour conduite : supprime les outliers GPS (points trop éloignés, derrière, trop proches)
  const optimizedRouteSegments = useMemo(() => {
    if (!routeSegments || routeSegments.length === 0) return [];

    // Optimiser chaque segment individuellement
    return routeSegments.map((segment) => {
      if (segment.length < 2) return segment;
      
      const coords: Coordinate[] = segment.map(p => ({
        latitude: p.latitude,
        longitude: p.longitude,
      }));

      // Optimisation intelligente pour conduite : filtre les outliers GPS puis ajoute des courbes
      return RouteOptimizationService.optimizeForDriving(coords);
    });
  }, [routeSegments]);

  const optimizedMatchedCoordinates = useMemo(() => {
    if (!matchedCoordinates || matchedCoordinates.length < 2) return null;

    const coords: Coordinate[] = matchedCoordinates.map(p => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));

    // Optimisation intelligente pour conduite : filtre les outliers GPS puis ajoute des courbes
    return RouteOptimizationService.optimizeForDriving(coords);
  }, [matchedCoordinates]);

  const matchedRouteGeoJSON = useMemo(() => {
    // Utiliser la version optimisée si disponible, sinon le tracé brut
    const coordsToUse = optimizedMatchedCoordinates || matchedCoordinates;
    if (!coordsToUse || coordsToUse.length < 2) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: coordsToUse.map(p => [p.longitude, p.latitude]),
      },
    };
  }, [matchedCoordinates, optimizedMatchedCoordinates]);

  const routeGeoJSON = useMemo(() => {
    // 1. Priorité au tracé matché (Mapbox) - version optimisée
    if (optimizedMatchedCoordinates && optimizedMatchedCoordinates.length > 0) {
      return {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: optimizedMatchedCoordinates.map(p => [p.longitude, p.latitude]),
        },
      };
    }

    // 2. Fallback sur le tracé brut (segments) - version optimisée
    if (!optimizedRouteSegments || optimizedRouteSegments.length === 0) return null;

    // Create a MultiLineString from optimized segments
    const coordinates = optimizedRouteSegments.map(segment =>
      segment.map(p => [p.longitude, p.latitude])
    );

    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'MultiLineString' as const,
        coordinates: coordinates,
      },
    };
  }, [optimizedRouteSegments, optimizedMatchedCoordinates]);

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const handleSheetChanges = useCallback((index) => {
    setCurrentSheetIndex(index);
    // Don't set sheetPositionValue here - let animatedPosition handle it
    setTimeout(() => {
      fitMapToRoute(index);
    }, 80);
  }, []);


  const handleBack = () => navigation.goBack();

  const handleDeleteRide = () => {
    Alert.alert('Supprimer le trajet', 'Êtes-vous sûr de vouloir supprimer ce trajet ? Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  const handleMenu = () => {
    Alert.alert(
      'Options',
      undefined,
      [
        { text: 'Partager', onPress: () => handleShare() },
        { text: 'Modifier', onPress: () => setIsEditModalVisible(true) },
        { text: 'Supprimer', style: 'destructive', onPress: () => handleDeleteRide() },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const handleSaveEdit = async (updates) => {
    if (!ride) return;

    try {
      setIsSavingEdit(true);
      const success = await RideStorageService.updateRide(ride.id, updates);

      if (success) {
        setRide(prev => ({ ...prev, ...updates }));
        setIsEditModalVisible(false);
        Alert.alert('Succès', 'Trajet modifié avec succès');
      } else {
        Alert.alert('Erreur', 'Impossible de modifier le trajet');
      }
    } catch (error) {
      console.error('Erreur modification trajet:', error);
      Alert.alert('Erreur', 'Une erreur est survenue');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleShare = () => {
    shareSheetRef.current?.present();
  };

  const captureTransparentShareCard = useCallback(async ({ result = 'tmpfile' } = {}) => {
    const ref = shareCardRefTransparent.current;
    if (!ref?.capture) {
      throw new Error('capture_ref_missing');
    }

    // Attendre un délai pour s'assurer que le composant est rendu
    await new Promise(resolve => setTimeout(resolve, 300));

    // Vérifier à nouveau que le ref est toujours disponible
    if (!ref?.capture) {
      throw new Error('capture_ref_lost');
    }

    try {
      if (result === 'base64') {
        const captureResult = await ref.capture({ format: 'png', quality: 1, result: 'base64' });
        const looksLikePath = typeof captureResult === 'string' && (captureResult.startsWith('/') || captureResult.startsWith('file:'));
        if (looksLikePath) {
          const path = captureResult.startsWith('file:') ? captureResult.replace('file://', '') : captureResult;
          const base64 = await FileSystem.readAsStringAsync(path, { encoding: 'base64' });
          return base64;
        }
        // Nettoyer le base64 si nécessaire
        const cleaned = typeof captureResult === 'string'
          ? captureResult.replace(/^data:image\/[^;]+;base64,/, '').trim()
          : captureResult;
        return cleaned;
      }

      const captureResult = await ref.capture({ format: 'png', quality: 1, result });
      // S'assurer que le résultat est un URI valide
      if (typeof captureResult === 'string') {
        return captureResult.startsWith('file://') ? captureResult : `file://${captureResult}`;
      }
      return captureResult;
    } catch (captureError) {
      console.error('[SHARE][CAPTURE] Error:', captureError);
      throw new Error(`capture_failed: ${captureError.message}`);
    }
  }, []);

  const handleShareCopy = useCallback(async () => {
    try {
      if (isShareProcessing) return;
      setIsShareProcessing(true);
      console.log('[SHARE][COPY] start');

      // Vérifier que Clipboard est disponible
      if (!Clipboard.setImageAsync) {
        Alert.alert('Non disponible', "La copie d'image n'est pas disponible sur cet appareil.");
        return;
      }

      let copied = false;
      const maxRetries = 3;
      let lastError = null;

      // Essayer avec retry
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[SHARE][COPY] attempt ${attempt}/${maxRetries}`);

          // Essayer d'abord avec tmpfile
          try {
            const fileUriRaw = await captureTransparentShareCard({ result: 'tmpfile' });
            const fileUri = fileUriRaw?.startsWith('file://') ? fileUriRaw : `file://${fileUriRaw}`;
            console.log('[SHARE][COPY] tmpfile uri:', fileUri);

            // Vérifier que le fichier existe
            const fileInfo = await FileSystem.getInfoAsync(fileUri.replace('file://', ''));
            if (!fileInfo.exists) {
              throw new Error('File does not exist');
            }

            await Clipboard.setImageAsync(fileUri);
            console.log('[SHARE][COPY] success with tmpfile');
            copied = true;
            break;
          } catch (fileError) {
            console.warn(`[SHARE][COPY] tmpfile attempt ${attempt} failed:`, fileError);
            lastError = fileError;

            // Essayer avec base64
            try {
              const base64Png = await captureTransparentShareCard({ result: 'base64' });
              console.log('[SHARE][COPY] base64 png length:', base64Png?.length);

              if (!base64Png || base64Png.length < 100) {
                throw new Error('Invalid base64 data');
              }

              await Clipboard.setImageAsync(base64Png);
              console.log('[SHARE][COPY] success with base64');
              copied = true;
              break;
            } catch (base64Error) {
              console.warn(`[SHARE][COPY] base64 attempt ${attempt} failed:`, base64Error);
              lastError = base64Error;

              // Attendre avant le prochain essai
              if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 300 * attempt));
              }
            }
          }
        } catch (attemptError) {
          console.error(`[SHARE][COPY] attempt ${attempt} error:`, attemptError);
          lastError = attemptError;
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 300 * attempt));
          }
        }
      }

      if (copied) {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (hapticError) {
          console.warn('[SHARE][COPY] haptics error:', hapticError);
        }
        copyAnim.value = withTiming(1, { duration: 150 });
        setTimeout(() => {
          copyAnim.value = withTiming(0, { duration: 300 });
        }, 3000);
      } else {
        console.error('[SHARE][COPY] all attempts failed, last error:', lastError);
        Alert.alert('Erreur', "Impossible de copier l'image après plusieurs tentatives. Réessayez.");
      }
    } catch (error) {
      console.error('[SHARE][COPY] fatal error:', error);
      Alert.alert('Erreur', "Impossible de copier l'image. Réessayez.");
    } finally {
      setIsShareProcessing(false);
    }
  }, [captureTransparentShareCard, isShareProcessing, copyAnim]);

  const handleShareGeneric = useCallback(async () => {
    try {
      if (isShareProcessing) return;
      setIsShareProcessing(true);
      console.log('[SHARE][GENERIC] start');

      const uri = await captureTransparentShareCard();

      // Vérifier que le fichier existe
      const filePath = uri.replace('file://', '');
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        throw new Error('Captured file does not exist');
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
      } else {
        Alert.alert('Partage', "Le partage système n'est pas disponible sur cet appareil.");
      }
    } catch (error) {
      console.error('[SHARE][GENERIC] error:', error);
      Alert.alert('Erreur', 'Impossible de partager le visuel. Réessayez.');
    } finally {
      setIsShareProcessing(false);
    }
  }, [captureTransparentShareCard, isShareProcessing]);

  const ensureMediaPermission = useCallback(async () => {
    const current = await MediaLibrary.getPermissionsAsync();
    if (current.status === 'granted') return true;
    const request = await MediaLibrary.requestPermissionsAsync();
    if (request.status !== 'granted') {
      Alert.alert('Permission requise', "Autorisez l'accès à vos photos pour enregistrer le visuel.");
      return false;
    }
    return true;
  }, []);

  const handleShareSave = useCallback(async () => {
    try {
      if (isShareProcessing) return;
      setIsShareProcessing(true);
      console.log('[SHARE][SAVE] start');

      const hasPermission = await ensureMediaPermission();
      if (!hasPermission) {
        setIsShareProcessing(false);
        return;
      }

      const uri = await captureTransparentShareCard();

      // Vérifier que le fichier existe
      const filePath = uri.replace('file://', '');
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        throw new Error('Captured file does not exist');
      }

      await MediaLibrary.saveToLibraryAsync(uri);
      console.log('[SHARE][SAVE] success');

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (hapticError) {
        console.warn('[SHARE][SAVE] haptics error:', hapticError);
      }
      saveAnim.value = withTiming(1, { duration: 150 });
      setTimeout(() => {
        saveAnim.value = withTiming(0, { duration: 300 });
      }, 3000);
    } catch (error) {
      console.error('[SHARE][SAVE] error:', error);
      Alert.alert('Erreur', "Impossible d'enregistrer l'image. Réessayez.");
    } finally {
      setIsShareProcessing(false);
    }
  }, [captureTransparentShareCard, ensureMediaPermission, isShareProcessing, saveAnim]);

  const handleShareInstagram = useCallback(async () => {
    try {
      if (isShareProcessing) return;
      setIsShareProcessing(true);
      console.log('[SHARE][INSTAGRAM] start');

      const uri = await captureTransparentShareCard();

      // Vérifier que le fichier existe
      const filePath = uri.replace('file://', '');
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        throw new Error('Captured file does not exist');
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Partager sur Instagram Stories',
        });
      } else {
        Alert.alert('Partage', "Le partage n'est pas disponible sur cet appareil.");
      }
    } catch (error) {
      console.error('[SHARE][INSTAGRAM] error:', error);
      Alert.alert('Erreur', 'Impossible de partager sur Instagram Stories. Réessayez.');
    } finally {
      setIsShareProcessing(false);
    }
  }, [captureTransparentShareCard, isShareProcessing]);

  // Safe derived values
  const safeDistanceKm = ((ride?.distance || 0) / 1000);
  const safeDuration = ride?.duration || 0;
  const safeAvgSpeed = Number(ride?.averageSpeed || 0) || 0;
  const safeMaxSpeed = Number(ride?.maxSpeed || 0) || 0;
  const safeVehicle = ride?.vehicle || 'car';
  const safePauses = Array.isArray(ride?.pauses) ? ride.pauses : [];
  const safeTotalPauseMs = Number(ride?.totalPauseDuration || 0) || 0;
  const safeTotalStops = Number(ride?.totalStops || 0) || 0;
  const safeMovingTime = (() => {
    if (ride?.movingTime !== undefined && ride?.movingTime !== null) {
      const movingSeconds = Number(ride.movingTime);
      return Number.isFinite(movingSeconds) ? movingSeconds : 0;
    }
    const pauseSeconds = safeTotalPauseMs / 1000;
    return Math.max(0, safeDuration - pauseSeconds);
  })();

  const extraStatsRaw = ride?.extraStats || ride?.extra_stats || {};
  const parseNumber = useCallback((value) => {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }, []);

  const safeElevationGain = parseNumber(extraStatsRaw.elevationGain ?? extraStatsRaw.gain) ?? 0;
  const safeElevationLoss = parseNumber(extraStatsRaw.elevationLoss ?? extraStatsRaw.loss) ?? 0;
  const safeClimbRate = parseNumber(extraStatsRaw.climbRate) ?? (safeMovingTime > 0 ? safeElevationGain / (safeMovingTime / 3600) : 0);
  const safeAverageGrade = parseNumber(extraStatsRaw.averageGrade) ?? (safeDistanceKm > 0 ? (safeElevationGain / (safeDistanceKm * 1000)) * 100 : 0);
  const safeIdleRatio = parseNumber(extraStatsRaw.idleRatio) ?? (safeDuration > 0 ? ((safeTotalPauseMs / 1000) / safeDuration) * 100 : 0);
  const safeStopsPerKm = parseNumber(extraStatsRaw.stopsPerKm) ?? (safeDistanceKm > 0 ? safeTotalStops / safeDistanceKm : 0);
  const safeMovingRatio = parseNumber(extraStatsRaw.movingRatio) ?? (safeDuration > 0 ? (safeMovingTime / safeDuration) * 100 : 0);
  const safeMaxAltitude = parseNumber(extraStatsRaw.maxAltitude);
  const safeMinAltitude = parseNumber(extraStatsRaw.minAltitude);

  const formatMetric = useCallback((value, { decimals = 1, suffix = '', round = false } = {}) => {
    if (value === null || value === undefined) {
      return '—';
    }
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return '—';
    }
    const formatted = round ? Math.round(num).toString() : num.toFixed(decimals);
    return `${formatted}${suffix}`;
  }, []);

  const elevationGainDisplay = formatMetric(safeElevationGain, { round: true, suffix: ' m' });
  const elevationLossDisplay = formatMetric(safeElevationLoss, { round: true, suffix: ' m' });
  const climbRateDisplay = formatMetric(safeClimbRate, { round: true, suffix: ' m/h' });
  const averageGradeDisplay = formatMetric(safeAverageGrade, { decimals: 1, suffix: ' %' });
  const idleRatioDisplay = formatMetric(safeIdleRatio, { decimals: 1, suffix: ' %' });
  const movingRatioDisplay = formatMetric(safeMovingRatio, { decimals: 1, suffix: ' %' });
  const stopsPerKmDisplay = formatMetric(safeStopsPerKm, { decimals: 2, suffix: ' /km' });
  const movingTimeDisplay = formatDuration(Math.round(safeMovingTime || 0));
  const altitudeMinDisplay = formatMetric(safeMinAltitude, { round: true, suffix: ' m' });
  const altitudeMaxDisplay = formatMetric(safeMaxAltitude, { round: true, suffix: ' m' });

  // Obtenir toutes les villes
  const allCitiesList = (() => {
    if (ride?.cities && ride.cities.length > 0) {
      return ride.cities;
    }
    const cities = [];
    if (ride?.startCity) cities.push(ride.startCity);
    if (ride?.endCity && ride.endCity !== ride?.startCity) cities.push(ride.endCity);
    return cities;
  })();

  // Séparer les villes : début, intermédiaires, fin
  const startCity = allCitiesList.length > 0 ? allCitiesList[0] : null;
  const endCity = allCitiesList.length > 1 ? allCitiesList[allCitiesList.length - 1] : null;
  const intermediateCities = allCitiesList.length > 2
    ? allCitiesList.slice(1, -1)
    : [];

  // Liste des villes à afficher (début + point intermédiaire replié + fin)
  // Les villes intermédiaires dépliées sont affichées séparément dans le rendu
  const citiesList = (() => {
    const result = [];
    if (startCity) result.push({ city: startCity, type: 'start' });

    if (intermediateCities.length > 0) {
      // Toujours afficher un point intermédiaire replié (qui sera cliquable)
      const middleIndex = Math.floor(intermediateCities.length / 2);
      result.push({
        city: intermediateCities[middleIndex],
        type: 'intermediate',
        index: middleIndex,
        isCollapsed: true
      });
    }

    if (endCity && endCity !== startCity) {
      result.push({ city: endCity, type: 'end' });
    }

    return result;
  })();

  const getMapRegionForIndex = (sheetIndex) => {
    const coords = (ride?.routeCoordinates || []).filter(Boolean);
    if (coords.length === 0) {
      return { latitude: 48.8566, longitude: 2.3522, latitudeDelta: 0.03, longitudeDelta: 0.03 };
    }
    if (coords.length === 1) {
      return { latitude: coords[0].latitude, longitude: coords[0].longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    }
    let minLat = coords[0].latitude, maxLat = coords[0].latitude;
    let minLng = coords[0].longitude, maxLng = coords[0].longitude;
    for (let i = 1; i < coords.length; i++) {
      const c = coords[i];
      if (c.latitude < minLat) minLat = c.latitude;
      if (c.latitude > maxLat) maxLat = c.latitude;
      if (c.longitude < minLng) minLng = c.longitude;
      if (c.longitude > maxLng) maxLng = c.longitude;
    }
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const rawLatDelta = Math.max(0.001, maxLat - minLat);
    const rawLngDelta = Math.max(0.001, maxLng - minLng);
    const paddingFactor = sheetIndex === 0 ? 1.2 : sheetIndex === 1 ? 1.4 : 1.5;
    let latDelta = Math.max(0.005, rawLatDelta * paddingFactor);
    let lngDelta = Math.max(0.005, rawLngDelta * paddingFactor);
    let offsetLat = 0;
    if (sheetIndex === 1) offsetLat = -latDelta * 0.25;
    if (sheetIndex === 2) offsetLat = -latDelta * 0.35;
    latDelta = Math.max(0.01, latDelta);
    lngDelta = Math.max(0.01, lngDelta);
    return { latitude: centerLat + offsetLat, longitude: centerLng, latitudeDelta: latDelta, longitudeDelta: lngDelta };
  };

  const onMapReady = useCallback(() => {
    // Open sheet at middle by default and frame map accordingly
    bottomSheetRef.current?.snapToIndex?.(1);
    setTimeout(() => fitMapToRoute(1), 60);
  }, [currentSheetIndex]);


  // Animated style for buttons that follows sheet position
  const animatedButtonStyle = useAnimatedStyle(() => {
    // sheetPositionValue represents the distance from top, so we need to convert to bottom
    const sheetBottom = screenHeight - sheetPositionValue.value;
    const buttonBottom = sheetBottom + 12;

    // Calculate opacity - fade out when going from middle to high
    const middlePosition = screenHeight * snapPercents[1]; // 50%
    const highPosition = screenHeight * snapPercents[2]; // 88%
    let opacity = 1;

    // sheetPositionValue decreases as sheet goes up (from ~50% to ~88% from top)
    // So we need to fade when value decreases from middle to high
    if (sheetPositionValue.value < middlePosition) {
      // Fade out quickly from middle to high position - using only first 60% of the range
      const fadeRange = (middlePosition - highPosition) * 0.6; // Only use 60% of the range for faster fade
      const progress = (sheetPositionValue.value - middlePosition) / fadeRange;
      // Apply quadratic easing for faster disappearance
      const easedProgress = progress * progress;
      opacity = 1 - Math.min(1, Math.max(0, easedProgress));
    }

    return {
      bottom: buttonBottom,
      opacity: opacity,
    };
  });

  const toggleMapType = () => {
    // Cycle simplifié: Street -> Satellite -> Street
    const cycle = ['standard', 'satellite'];
    const idx = cycle.indexOf(mapType);
    const next = cycle[(idx + 1) % cycle.length] || cycle[0];
    setMapType(next);
  };

  // Get icon for current map type (Street / Satellite uniquement)
  const getMapTypeIcon = () => {
    switch (mapType) {
      case 'satellite':
        return 'globe-outline';
      case 'standard':
      default:
        return 'map-outline';
    }
  };

  const getEdgePaddingForIndex = (sheetIndex) => {
    // Increase top padding when sheet is higher so the route remains visible above
    const base = 24;
    if (sheetIndex === 0) {
      return { top: base, right: base, bottom: base + 110, left: base };
    }
    if (sheetIndex === 1) {
      // Keep route in upper 50% of screen, above the sheet
      // Sheet is at 50%, so we want route in 0-50% with padding
      return { top: base, right: base, bottom: Math.floor(screenHeight * 0.55), left: base };
    }
    // High sheet: substantial padding to keep the route clear
    return { top: Math.floor(screenHeight * 0.5), right: base + 12, bottom: 300, left: base + 12 };
  };

  const fitMapToRoute = (sheetIndex) => {
    // Don't move map when sheet is at highest position per UX request
    if (sheetIndex === 2) return;
    // Don't move map if playing
    if (isPlaying) return;
    const coords = (ride?.routeCoordinates || []).filter(Boolean);
    if (!mapRef.current || coords.length === 0) return;

    if (coords.length === 1) {
      mapRef.current.setCamera({
        centerCoordinate: [coords[0].longitude, coords[0].latitude],
        zoomLevel: 15,
        animationDuration: 250,
      });
      return;
    }

    let minLat = coords[0].latitude, maxLat = coords[0].latitude;
    let minLng = coords[0].longitude, maxLng = coords[0].longitude;
    for (let i = 1; i < coords.length; i++) {
      const c = coords[i];
      if (c.latitude < minLat) minLat = c.latitude;
      if (c.latitude > maxLat) maxLat = c.latitude;
      if (c.longitude < minLng) minLng = c.longitude;
      if (c.longitude > maxLng) maxLng = c.longitude;
    }

    const padding = getEdgePaddingForIndex(sheetIndex);

    mapRef.current.setCamera({
      bounds: {
        ne: [maxLng, maxLat],
        sw: [minLng, minLat],
        paddingTop: padding.top,
        paddingBottom: padding.bottom,
        paddingLeft: padding.left,
        paddingRight: padding.right,
      },
      animationDuration: 250,
    });
  };

  // Fonction pour calculer la distance entre deux points (en degrés)
  const getDistance = useCallback((p1, p2) => {
    const lat1 = p1.latitude * Math.PI / 180;
    const lat2 = p2.latitude * Math.PI / 180;
    const deltaLat = (p2.latitude - p1.latitude) * Math.PI / 180;
    const deltaLng = (p2.longitude - p1.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return c; // Distance en radians (approximation)
  }, []);

  // Fonction pour calculer l'angle entre trois points (en degrés)
  const calculateAngle = useCallback((p1, p2, p3) => {
    // Vecteur 1: de p1 à p2
    const v1Lat = p2.latitude - p1.latitude;
    const v1Lng = p2.longitude - p1.longitude;

    // Vecteur 2: de p2 à p3
    const v2Lat = p3.latitude - p2.latitude;
    const v2Lng = p3.longitude - p2.longitude;

    // Produit scalaire
    const dot = v1Lat * v2Lat + v1Lng * v2Lng;

    // Normes des vecteurs
    const norm1 = Math.sqrt(v1Lat * v1Lat + v1Lng * v1Lng);
    const norm2 = Math.sqrt(v2Lat * v2Lat + v2Lng * v2Lng);

    if (norm1 === 0 || norm2 === 0) return 180; // Points identiques

    // Angle en radians puis conversion en degrés
    const cosAngle = dot / (norm1 * norm2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180 / Math.PI;

    return angle;
  }, []);

  // Utiliser RideAnalysisService pour la détection des virages
  const { turnCount, turnPositions, nearTurnPositions } = useMemo(() => {
    if (!ride?.routeCoordinates) return { turnCount: 0, turnPositions: [], nearTurnPositions: [] };

    const coords = (ride.routeCoordinates || []).filter(
      (p) => p && typeof p.latitude === 'number' && typeof p.longitude === 'number'
    );

    if (coords.length < 3) return { turnCount: 0, turnPositions: [], nearTurnPositions: [] };

    // Utiliser le service unifié
    const analysis = RideAnalysisService.detectTurns(coords, {
      minTurnAngle: 25, // Seuil légèrement ajusté
      minDistanceBetweenTurns: 40,
      sampleDistance: 15,
    });

    const fullCoords = coords;

    const turns = analysis.turns.map(turn => {
      // Find the index of the turn coordinate in the full list
      // Since we resampled, we need to find the closest point
      // Optimization: search around the expected index if we had one, but we don't.
      // Simple search:
      let bestIdx = -1;
      let minD = Infinity;

      // Heuristic: the turn index in sampled array * sampleRate is approx index in full array
      // But sampleRate is variable in the service (distance based).
      // So we just search. To optimize, we could search only a subset if we knew where we were.
      // Given typical ride size (few thousand points), a linear search for each turn (few dozen) is fine.

      for (let i = 0; i < fullCoords.length; i++) {
        const d = Math.abs(fullCoords[i].latitude - turn.coord.latitude) + Math.abs(fullCoords[i].longitude - turn.coord.longitude);
        if (d < minD) {
          minD = d;
          bestIdx = i;
        }
      }

      // Create a segment of +/- 3 points around the turn center
      const startIdx = Math.max(0, bestIdx - 3);
      const endIdx = Math.min(fullCoords.length - 1, bestIdx + 3);
      const segmentCoords = fullCoords.slice(startIdx, endIdx + 1);

      return {
        latitude: turn.coord.latitude,
        longitude: turn.coord.longitude,
        angle: turn.angle.toFixed(1),
        direction: turn.direction,
        type: turn.type,
        segment: segmentCoords
      };
    });

    return {
      turnCount: analysis.totalTurns,
      turnPositions: turns,
      nearTurnPositions: [],
    };
  }, [ride]);


  if (isLoading || !ride) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' }}>
          <ActivityIndicator size="large" color="#1E3A8A" />
          <Text style={{ marginTop: 16, color: '#6B7280', fontSize: 16 }}>Chargement du trajet...</Text>
        </View>
      </View>
    );
  }

  // Helper function to get Mapbox style URL from mapType
  const getMapboxStyleURL = (type) => {
    switch (type) {
      case 'satellite':
        return Mapbox.StyleURL.Satellite;
      case 'standard':
      default:
        return Mapbox.StyleURL.Street;
    }
  };

  // ⚡ FIX Z-ORDER: Prepare markers to render LAST
  const markersToRender = (() => {
    if (isPlaying) return null; // Cacher les markers pendant l'animation
    if (currentSheetIndex === 2) return null; // hide markers when sheet is at highest position

    const steps = (ride?.steps || []);
    const photos = (ride?.photos || []);
    const coords = (ride?.routeCoordinates || []);

    // Récupérer les étapes avec coordonnées
    const stepsWithCoord = steps.filter((step) =>
      step?.location &&
      typeof step.location.latitude === 'number' &&
      typeof step.location.longitude === 'number'
    );

    // Récupérer les photos avec coordonnées
    const photosWithCoord = photos.filter((ph) =>
      typeof ph?.latitude === 'number' &&
      typeof ph?.longitude === 'number'
    );

    // Créer les markers pour les étapes
    let stepMarkers = stepsWithCoord.map((step, idx) => ({
      key: `step-${step.id || idx}`,
      lat: step.location.latitude,
      lng: step.location.longitude,
      type: 'step',
      title: step.title,
      description: step.description,
      photo: step.photo,
      timestamp: step.timestamp,
    }));

    // Créer les markers pour les photos (sans étape associée)
    let photoMarkers = photosWithCoord.map((ph, idx) => ({
      key: `photo-${idx}`,
      lat: ph.latitude,
      lng: ph.longitude,
      type: 'photo',
      uri: ph?.uri,
    }));

    // Fallback pour les photos sans coordonnées
    if (photoMarkers.length === 0 && photos.length > 0 && coords.length > 0) {
      const picks = [0.25, 0.5, 0.75];
      photoMarkers = picks
        .slice(0, Math.min(photos.length, 3))
        .map((p, i) => {
          const idx = Math.max(0, Math.min(coords.length - 1, Math.floor(coords.length * p)));
          const c = coords[idx];
          return { key: `photo-fb-${i}`, lat: c.latitude, lng: c.longitude, type: 'photo', uri: photos[i]?.uri };
        });
    }

    // Combiner tous les markers
    const allMarkers = [...stepMarkers, ...photoMarkers];

    // Filter out markers too close to each other (within 15 meters)
    const THRESHOLD_M = 15;
    const markersSpaced = [];
    for (const m of allMarkers) {
      let tooClose = false;
      for (const existing of markersSpaced) {
        const dx = (m.lat - existing.lat) * 111320;
        const dy = (m.lng - existing.lng) * 111320 * Math.cos(m.lat * Math.PI / 180);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < THRESHOLD_M) {
          // Si c'est une étape, elle a priorité sur une photo
          if (m.type === 'step' && existing.type === 'photo') {
            const idx = markersSpaced.indexOf(existing);
            markersSpaced[idx] = m;
            tooClose = true;
            break;
          } else {
            tooClose = true;
            break;
          }
        }
      }
      if (!tooClose) markersSpaced.push(m);
    }

    return markersSpaced.map((m) => {
      const isStep = m.type === 'step';
      const hasPhoto = isStep ? m.photo : m.uri;

      return (
        <Mapbox.PointAnnotation
          key={m.key}
          id={m.key}
          coordinate={[m.lng, m.lat]}
          anchor={{ x: 0.5, y: 1 }} // ⚡ ANCHOR BOTTOM CENTER (Pointe du bas)
          selected={true} // ⚡ FORCE RENDER ON TOP
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              if (hasPhoto) {
                setSelectedPhoto(isStep ? m.photo : m.uri);
              }
            }}
            style={styles.markerContainer} // ⚡ NOUVEAU CONTENEUR
          >
            {/* 3. La Bulle Photo (Au dessus) */}
            <View style={[
              styles.markerBubble,
              isStep ? styles.markerBubbleStep : styles.markerBubblePhoto
            ]}>
              {hasPhoto ? (
                <Image
                  source={{ uri: isStep ? m.photo : m.uri }}
                  style={styles.markerImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.markerIconContainer}>
                  <Ionicons
                    name={isStep ? "location" : "image"}
                    size={isStep ? 20 : 18}
                    color={isStep ? "#28A745" : "#64748B"}
                  />
                </View>
              )}

              {/* Badge (Si étape) */}
              {isStep && (
                <View style={styles.markerStepBadge}>
                  <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                </View>
              )}
            </View>

            {/* 2. La Pointe (Triangle) - Style "Map Pin" */}
            <View style={styles.markerArrow} />

          </TouchableOpacity>
        </Mapbox.PointAnnotation>
      );
    });
  })();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.mapContainer}>
        <Mapbox.MapView
          style={styles.map}
          styleURL={getMapboxStyleURL(mapType)}
          onDidFinishLoadingMap={onMapReady}
          logoEnabled={false}
          attributionEnabled={false}
          scaleBarEnabled={false}
          pitchEnabled={isPlaying} // Inclinaison possible uniquement pendant la lecture
          rotateEnabled={false}    // Pas de mode rotation/3D
          scrollEnabled={!isPlaying}
          zoomEnabled={!isPlaying}
        >
          <Mapbox.Camera
            ref={mapRef}
            defaultSettings={{
              centerCoordinate: [2.3522, 48.8566],
              zoomLevel: 10,
              pitch: 0, // Pas de 3D par défaut
            }}
          />

          {/* Full Route (Always visible, Blue) */}
          {routeGeoJSON && (
            <Mapbox.ShapeSource id="routeSource" shape={routeGeoJSON}>
              {/* Contour brillant */}
              <Mapbox.LineLayer
                id="routeOutline"
                style={{
                  lineColor: 'rgba(59, 130, 246, 0.5)',
                  lineWidth: 9,
                  lineCap: 'round',
                  lineJoin: 'round',
                  lineOpacity: 0.7,
                }}
              />
              {/* Ligne principale */}
              <Mapbox.LineLayer
                id="routeLine"
                style={{
                  lineColor: '#60A5FA',
                  lineWidth: 7,
                  lineCap: 'round',
                  lineJoin: 'round',
                  lineOpacity: 0.95,
                }}
              />
              {/* Ligne intérieure */}
              <Mapbox.LineLayer
                id="routeInner"
                style={{
                  lineColor: '#3B82F6',
                  lineWidth: 4,
                  lineCap: 'round',
                  lineJoin: 'round',
                  lineOpacity: 1,
                }}
              />
            </Mapbox.ShapeSource>
          )}

          {/* Matched Route Layer (if matchedCoordinates exists) */}
          {matchedRouteGeoJSON && (
            <Mapbox.ShapeSource id="matchedRouteSource" shape={matchedRouteGeoJSON}>
              <Mapbox.LineLayer
                id="matchedRouteFill"
                style={{
                  lineColor: '#7C3AED', // Purple for matched route
                  lineWidth: 6,
                  lineCap: 'round',
                  lineJoin: 'round',
                  lineOpacity: 1,
                }}
              />
            </Mapbox.ShapeSource>
          )}

          {/* Vehicle Marker - follows currentPosition from RAF loop */}
          {currentPosition && (isPlaying || progress > 0) && (
            <Mapbox.PointAnnotation
              id="vehicleMarker"
              coordinate={[currentPosition.longitude, currentPosition.latitude]}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.vehicleMarker, { transform: [{ rotate: `${currentHeading}deg` }] }]}>
                <Ionicons name="navigate" size={24} color="#60A5FA" />
              </View>
            </Mapbox.PointAnnotation>
          )}


          {/* Markers Rendered Last for Z-Order */}
          {markersToRender}

        </Mapbox.MapView>

        <Animated.View style={[topButtonsStyle, { position: 'absolute', top: 60, left: 20, zIndex: 10 }]}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={[topButtonsStyle, { position: 'absolute', top: 60, left: 70, zIndex: 10 }]}>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={20} color="#1a1a1a" />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={[topButtonsStyle, { position: 'absolute', top: 60, right: 20, zIndex: 10 }]}>
          <TouchableOpacity style={styles.menuButton} onPress={handleMenu}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#1a1a1a" />
          </TouchableOpacity>
        </Animated.View>
      </View>

      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        animatedPosition={sheetPositionValue}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
        enablePanDownToClose={false}
        enableOverDrag={false}
        enableHandlePanningGesture={!isPlaying}
        enableContentPanningGesture={!isPlaying}
        animationConfigs={{ duration: 300 }}
        maxDynamicContentSize={screenHeight * 0.75}
        enableDynamicSizing={false}
      >
        <BottomSheetScrollView
          style={styles.sheetContent}
          contentContainerStyle={currentSheetIndex === 3 ? { paddingTop: 30 } : undefined}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section: User & Date */}
          <View style={styles.headerSection}>
            <View style={styles.headerUserRow}>
              {ride?.userAvatar ? (
                <Image source={{ uri: ride.userAvatar }} style={styles.headerAvatar} />
              ) : (
                <View style={styles.headerAvatarPlaceholder}>
                  <Text style={styles.headerAvatarText}>
                    {(ride?.userName || ride?.user?.name || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.headerUserInfo}>
                <Text style={styles.headerUserName}>{ride?.userName || ride?.user?.name || 'Utilisateur'}</Text>
                {ride?.startTime && (
                  <Text style={styles.headerDate}>{formatDate(ride.startTime)}</Text>
                )}
              </View>
            </View>

            <Text style={styles.headerTitle}>{ride?.name || 'Trajet'}</Text>
            {ride.description && (
              <Text style={styles.headerDescription}>{ride.description}</Text>
            )}
          </View>

          {/* Route Timeline - Clean & Minimal */}
          <View style={styles.timelineContainer}>
            {citiesList.map((item, index) => {
              const isFirst = item.type === 'start';
              const isLast = item.type === 'end';
              const isIntermediate = item.type === 'intermediate';
              const isCollapsed = item.isCollapsed && intermediateCities.length > 0;

              return (
                <View key={`${item.type}-${item.index ?? index}`} style={styles.timelineItem}>
                  {/* Timeline Line & Dot */}
                  <View style={styles.timelineLeftCol}>
                    <View style={[
                      styles.timelineDot,
                      isFirst && styles.timelineDotStart,
                      isLast && styles.timelineDotEnd,
                      isIntermediate && styles.timelineDotIntermediate
                    ]}>
                      {isFirst && <View style={styles.timelineDotInnerStart} />}
                      {isLast && <View style={styles.timelineDotInnerEnd} />}
                    </View>
                    {!isLast && <View style={styles.timelineLine} />}
                  </View>

                  {/* Timeline Content */}
                  <View style={styles.timelineContent}>
                    {isIntermediate && isCollapsed ? (
                      <View>
                        {intermediateCities.length === 1 ? (
                          <View style={styles.timelinePoint}>
                            <Text style={styles.timelineCityName}>{intermediateCities[0]}</Text>
                            <Text style={styles.timelineLabel}>Passage</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setIsIntermediateCitiesExpanded(!isIntermediateCitiesExpanded)}
                            style={styles.timelineExpandable}
                          >
                            <View style={styles.timelineExpandHeader}>
                              <Text style={styles.timelineCityName}>{intermediateCities.length} villes traversées</Text>
                              <Ionicons
                                name={isIntermediateCitiesExpanded ? "chevron-up" : "chevron-down"}
                                size={16}
                                color="#64748B"
                              />
                            </View>

                            {isIntermediateCitiesExpanded && (
                              <View style={styles.timelineExpandedList}>
                                {intermediateCities.map((city, idx) => (
                                  <Text key={`city-${idx}`} style={styles.timelineSubCity}>
                                    <Text style={styles.timelineSubIndex}>{idx + 1}.</Text> {city}
                                  </Text>
                                ))}
                              </View>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <View style={styles.timelinePoint}>
                        <Text style={[
                          styles.timelineCityName,
                          (isFirst || isLast) && styles.timelineCityNameBold
                        ]}>{item.city}</Text>
                        <Text style={styles.timelineLabel}>
                          {isFirst ? 'Départ' : isLast ? 'Arrivée' : 'Passage'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.statsContainer}>
            {/* Hero Stat: Distance */}
            <View style={styles.heroStatContainer}>
              <Text style={styles.heroStatValue}>
                {safeDistanceKm.toFixed(2).replace('.', ',')}
                <Text style={styles.heroStatUnit}> km</Text>
              </Text>
              <Text style={styles.heroStatLabel}>Distance totale</Text>
            </View>

            {/* Key Metrics Grid - 2 Top, 1 Bottom */}
            <View style={styles.keyMetricsGrid}>
              {/* Top Row: Duration & Avg Speed */}
              <View style={styles.keyMetricsRowTop}>
                <View style={styles.keyMetricItem}>
                  <Text style={styles.keyMetricValue}>{formatDuration(safeDuration)}</Text>
                  <Text style={styles.keyMetricLabel}>Durée</Text>
                </View>
                <View style={styles.metricDividerVertical} />
                <View style={styles.keyMetricItem}>
                  <Text style={styles.keyMetricValue}>{safeAvgSpeed.toFixed(1)} <Text style={styles.keyMetricUnit}>km/h</Text></Text>
                  <Text style={styles.keyMetricLabel}>Moyenne</Text>
                </View>
              </View>

              {/* Horizontal Divider */}
              <View style={styles.metricDividerHorizontal} />

              {/* Bottom Row: Max Speed */}
              <View style={styles.keyMetricItemBottom}>
                <Text style={styles.keyMetricValue}>{safeMaxSpeed.toFixed(1)} <Text style={styles.keyMetricUnit}>km/h</Text></Text>
                <Text style={styles.keyMetricLabel}>Vitesse Max</Text>
              </View>
            </View>

            {/* Context Details - Subtle Strip */}
            <View style={styles.contextDetailsContainer}>
              <View style={styles.contextItem}>
                <Ionicons name="car-sport" size={16} color="#64748B" style={{ marginBottom: 4 }} />
                <Text style={styles.contextValue}>
                  {safeVehicle === 'car' ? 'Voiture' :
                    safeVehicle === 'motorcycle' ? 'Moto' :
                      safeVehicle === 'bicycle' ? 'Vélo' :
                        safeVehicle === 'scooter' ? 'Trott.' : safeVehicle}
                </Text>
              </View>

              <View style={styles.contextItem}>
                <Ionicons name="pause" size={16} color="#64748B" style={{ marginBottom: 4 }} />
                <Text style={styles.contextValue}>{safePauses.length} pause{safePauses.length > 1 ? 's' : ''}</Text>
              </View>

              <View style={styles.contextItem}>
                <Ionicons name="git-network" size={16} color="#64748B" style={{ marginBottom: 4 }} />
                <Text style={styles.contextValue}>{turnCount} virage{turnCount > 1 ? 's' : ''}</Text>
              </View>
            </View>
          </View>

          <View style={styles.additionalStatsContainer}>
            <View style={styles.secondaryStatItem}>
              <Text style={styles.secondaryStatLabel}>D+</Text>
              <Text style={styles.secondaryStatValue}>{elevationGainDisplay}</Text>
            </View>
            <View style={styles.secondaryStatItem}>
              <Text style={styles.secondaryStatLabel}>D-</Text>
              <Text style={styles.secondaryStatValue}>{elevationLossDisplay}</Text>
            </View>
            <View style={styles.secondaryStatItem}>
              <Text style={styles.secondaryStatLabel}>Pente moyenne</Text>
              <Text style={styles.secondaryStatValue}>{averageGradeDisplay}</Text>
            </View>
            <View style={styles.secondaryStatItem}>
              <Text style={styles.secondaryStatLabel}>Rythme de grimpe</Text>
              <Text style={styles.secondaryStatValue}>{climbRateDisplay}</Text>
            </View>
            <View style={styles.secondaryStatItem}>
              <Text style={styles.secondaryStatLabel}>Temps en mouvement</Text>
              <Text style={styles.secondaryStatValue}>{movingTimeDisplay}</Text>
            </View>
            <View style={styles.secondaryStatItem}>
              <Text style={styles.secondaryStatLabel}>Temps actif</Text>
              <Text style={styles.secondaryStatValue}>{movingRatioDisplay}</Text>
            </View>
            <View style={styles.secondaryStatItem}>
              <Text style={styles.secondaryStatLabel}>Temps à l'arrêt</Text>
              <Text style={styles.secondaryStatValue}>{idleRatioDisplay}</Text>
            </View>
            <View style={styles.secondaryStatItem}>
              <Text style={styles.secondaryStatLabel}>Arrêts / km</Text>
              <Text style={styles.secondaryStatValue}>{stopsPerKmDisplay}</Text>
            </View>
          </View>

          {(safeMaxAltitude !== null || safeMinAltitude !== null) && (
            <View style={styles.altitudeCard}>
              <Text style={styles.altitudeTitle}>Altitude</Text>
              <View style={styles.altitudeRow}>
                {safeMinAltitude !== null && (
                  <View style={styles.altitudeItem}>
                    <Text style={styles.altitudeLabel}>Min</Text>
                    <Text style={styles.altitudeValue}>{altitudeMinDisplay}</Text>
                  </View>
                )}
                {safeMaxAltitude !== null && (
                  <View style={styles.altitudeItem}>
                    <Text style={styles.altitudeLabel}>Max</Text>
                    <Text style={styles.altitudeValue}>{altitudeMaxDisplay}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={styles.achievementsSection}>
            <Text style={styles.sectionTitle}>Achievements du trajet</Text>
            {safeMaxSpeed > 120 && (
              <View style={styles.achievementCard}>
                <View style={styles.achievementIcon}><Ionicons name="speedometer" size={20} color="#64748B" /></View>
                <View style={styles.achievementContent}>
                  <Text style={styles.achievementTitle}>Vitesse élevée atteinte</Text>
                  <Text style={styles.achievementDescription}>Vous avez atteint {safeMaxSpeed.toFixed(0)} km/h ! Conduite sportive détectée.</Text>
                </View>
              </View>
            )}
            {(ride?.distance || 0) > 100000 && (
              <View style={styles.achievementCard}>
                <View style={styles.achievementIcon}><Ionicons name="car" size={20} color="#64748B" /></View>
                <View style={styles.achievementContent}>
                  <Text style={styles.achievementTitle}>Long trajet accompli</Text>
                  <Text style={styles.achievementDescription}>Plus de {safeDistanceKm.toFixed(0)} km parcourus ! Excellent pour un voyage.</Text>
                </View>
              </View>
            )}
            {safeAvgSpeed > 80 && safeAvgSpeed < 100 && (
              <View style={styles.achievementCard}>
                <View style={styles.achievementIcon}><Ionicons name="leaf" size={20} color="#64748B" /></View>
                <View style={styles.achievementContent}>
                  <Text style={styles.achievementTitle}>Conduite éco-responsable</Text>
                  <Text style={styles.achievementDescription}>Vitesse moyenne optimale de {safeAvgSpeed.toFixed(0)} km/h. Parfait pour l'environnement !</Text>
                </View>
              </View>
            )}
            {safePauses.length > 0 && (
              <View style={styles.achievementCard}>
                <View style={styles.achievementIcon}><Ionicons name="restaurant" size={20} color="#64748B" /></View>
                <View style={styles.achievementContent}>
                  <Text style={styles.achievementTitle}>Conduite sécurisée</Text>
                  <Text style={styles.achievementDescription}>{safePauses.length} pause{safePauses.length > 1 ? 's' : ''} effectuée{safePauses.length > 1 ? 's' : ''}. Excellente pratique pour la sécurité !</Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.graphsSection}>
            <Text style={styles.sectionTitle}>Analyse du trajet</Text>
            <View style={styles.graphCard}>
              <View style={styles.graphHeader}><Ionicons name="trending-up" size={16} color="#64748B" /><Text style={styles.graphTitle}>Profil de vitesse</Text></View>
              <View style={styles.speedBar}><View style={styles.speedBarFill} /></View>
              <View style={styles.speedStats}><Text style={styles.speedStat}>Min: 0 km/h</Text><Text style={styles.speedStat}>Max: {safeMaxSpeed.toFixed(0)} km/h</Text></View>
            </View>
            <View style={styles.graphCard}>
              <View style={styles.graphHeader}><Ionicons name="analytics" size={16} color="#64748B" /><Text style={styles.graphTitle}>Efficacité du trajet</Text></View>
              <View style={styles.efficiencyGrid}>
                <View style={styles.efficiencyItem}><Text style={styles.efficiencyLabel}>Temps de conduite</Text><Text style={styles.efficiencyValue}>{formatDuration(Math.max(0, safeDuration - (safeTotalPauseMs / 1000)))}</Text></View>
                <View style={styles.efficiencyItem}><Text style={styles.efficiencyLabel}>Temps de pause</Text><Text style={styles.efficiencyValue}>{formatDuration(safeTotalPauseMs / 1000)}</Text></View>
                <View style={styles.efficiencyItem}><Text style={styles.efficiencyLabel}>Efficacité</Text><Text style={styles.efficiencyValue}>{((safeDuration / (safeDuration + (safeTotalPauseMs / 1000))) * 100 || 0).toFixed(0)}%</Text></View>
              </View>
            </View>
          </View>

          {ride.photos && ride.photos.length > 0 && (
            <View style={styles.photosSection}>
              <Text style={styles.sectionTitle}>Photos du trajet</Text>
              <View style={styles.photosGrid}>
                {ride.photos.slice(0, 4).map((photo, index) => (
                  <TouchableOpacity key={index} style={styles.photoItem} onPress={() => setSelectedPhoto(photo.uri)}>
                    <Image source={{ uri: photo.uri }} style={styles.photoThumbnail} />
                  </TouchableOpacity>
                ))}
                {ride.photos.length > 4 && (
                  <TouchableOpacity style={styles.morePhotosButton}><Text style={styles.morePhotosText}>+{ride.photos.length - 4}</Text></TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {ride.steps && ride.steps.length > 0 && (
            <View style={styles.stepsSection}>
              <Text style={styles.sectionTitle}>Étapes du trajet</Text>
              {ride.steps.slice(0, 3).map((step, index) => (
                <View key={step.id || index} style={styles.stepItem}>
                  <View style={styles.stepIcon}><Ionicons name="location" size={16} color="#28A745" /></View>
                  <View style={styles.stepInfo}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    {step.description ? <Text style={styles.stepDescription}>{step.description}</Text> : null}
                    <Text style={styles.stepTime}>{formatTime(step.timestamp)}</Text>
                  </View>
                </View>
              ))}
              {ride.steps.length > 3 && (<Text style={styles.moreStepsText}>+{ride.steps.length - 3} autres étapes</Text>)}
            </View>
          )}

          {safePauses.length > 0 && (
            <View style={styles.pausesSection}>
              <Text style={styles.sectionTitle}>Pauses effectuées</Text>
              {safePauses.slice(0, 3).map((pause, index) => (
                <View key={index} style={styles.pauseItem}>
                  <View style={styles.pauseIcon}><Ionicons name="pause-circle" size={16} color="#28A745" /></View>
                  <View style={styles.pauseInfo}>
                    <Text style={styles.pauseTitle}>Pause {index + 1}</Text>
                    <Text style={styles.pauseDuration}>Durée: {formatDuration(pause.duration)}</Text>
                    <Text style={styles.pauseTime}>{formatTime(pause.startTime)} - {formatTime(pause.endTime)}</Text>
                  </View>
                </View>
              ))}
              {safePauses.length > 3 && (<Text style={styles.morePausesText}>+{safePauses.length - 3} autres pauses</Text>)}
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheet>

      {/* Floating action buttons above the sheet (right side) - After BottomSheet to render on top */}
      {!isPlaying && (
        <Animated.View style={[styles.fabColumn, animatedButtonStyle]} pointerEvents="box-none">
          <TouchableOpacity style={styles.fab} onPress={() => fitMapToRoute(currentSheetIndex)}>
            <GlassView
              style={styles.fabGlass}
              glassEffectStyle="regular"
              isInteractive={true}
              tintColor="rgba(255, 255, 255, 0.1)"
            >
              <Ionicons name="locate-outline" size={18} color="#1E3A8A" />
            </GlassView>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fab} onPress={toggleMapType}>
            <GlassView
              style={styles.fabGlass}
              glassEffectStyle="regular"
              isInteractive={true}
              tintColor="rgba(255, 255, 255, 0.1)"
            >
              <Ionicons name={getMapTypeIcon()} size={18} color="#1E3A8A" />
            </GlassView>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fab} onPress={play}>
            <GlassView
              style={styles.fabGlass}
              glassEffectStyle="regular"
              isInteractive={true}
              tintColor="rgba(255, 255, 255, 0.1)"
            >
              <Ionicons
                name="play"
                size={20}
                color="#1E3A8A"
              />
            </GlassView>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Playback Controls */}
      {isPlaying && (
        <PlaybackControls
          isPlaying={isPlaying}
          progress={progress}
          onPlayPause={isPlaying ? pause : play}
          onSeek={seek}
          speedMultiplier={speedMultiplier}
          onSpeedChange={setSpeed}
          onClose={pause}
          currentDistance={progress * safeDistanceKm}
          totalDistance={safeDistanceKm}
        />
      )}
      <Modal visible={selectedPhoto !== null} transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
        <View style={styles.photoModalOverlay}>
          <TouchableOpacity style={styles.photoModalCloseButton} onPress={() => setSelectedPhoto(null)}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {selectedPhoto && (<Image source={{ uri: selectedPhoto }} style={styles.photoModalImage} />)}
        </View>
      </Modal>

      {/* ShareCard component - rendered off-screen for capture (transparent pour Instagram) */}
      {ride && (
        <View style={{ position: 'absolute', top: -10000, left: 0, width: 1080, height: 1920 }}>
          <ViewShot
            ref={shareCardRefTransparent}
            // @ts-ignore - backgroundColor non typé dans CaptureOptions
            options={{
              format: 'png',
              quality: 1.0,
              result: 'tmpfile',
              backgroundColor: 'transparent',
            } as any}
            onLayout={() => {
              console.log('[SHARE] ShareCard mounted and ready');
            }}
          >
            <ShareCard ride={ride} />
          </ViewShot>
        </View>
      )}

      {/* BottomSheet de partage */}
      <BottomSheetModal
        ref={shareSheetRef}
        snapPoints={["85%"]}
        enablePanDownToClose={true}
        enableOverDrag={false}
        enableContentPanningGesture={false}
        enableHandlePanningGesture={false}
        backdropComponent={({ ...props }) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} enableTouchThrough={false} />}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={{ opacity: 0, height: 0 }}
        // @ts-ignore - prop non typée dans cette version de @gorhom/bottom-sheet
        initialSnapIndex={0 as any}
      >
        <BottomSheetView style={styles.shareSheetContent}>
          {/* Header avec bouton de fermeture */}
          <View style={styles.shareSheetHeader}>
            <TouchableOpacity
              style={styles.shareSheetCloseButton}
              onPress={() => shareSheetRef.current?.dismiss()}
              activeOpacity={0.7}
            >
              <Text style={styles.shareSheetCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>

          {/* Aperçu du sticker */}
          <View style={styles.sharePreviewWrapper}>
            <View
              style={[
                styles.sharePreviewFrame,
                {
                  width: sharePreviewWidth,
                  height: sharePreviewHeight,
                },
              ]}
            >
              {/* Fond damier pour visualiser la transparence */}
              <View style={styles.sharePreviewCardContainer}>
                <Svg
                  width={sharePreviewWidth}
                  height={sharePreviewHeight}
                  style={{ position: 'absolute', top: 0, left: 0 }}
                >
                  {(() => {
                    const size = 24; // Taille des carreaux
                    const cols = Math.ceil(sharePreviewWidth / size);
                    const rows = Math.ceil(sharePreviewHeight / size);
                    return Array.from({ length: rows }).map((_, r) =>
                      Array.from({ length: cols }).map((__, c) => (
                        <Rect
                          key={`${r}-${c}`}
                          x={c * size}
                          y={r * size}
                          width={size}
                          height={size}
                          fill={(r + c) % 2 === 0 ? '#2b2b2b' : '#1f1f1f'}
                        />
                      ))
                    );
                  })()}
                </Svg>
                <View style={{
                  transform: [{ scale: sharePreviewHeight / 1920 }],
                  width: 1080,
                  height: 1920,
                  position: 'absolute',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <ShareCard ride={ride} />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.shareActionRow}>
            <View style={styles.shareActionItem}>
              <TouchableOpacity
                style={styles.shareCircleBtn}
                onPress={handleShareCopy}
                disabled={isShareProcessing}
              >
                <Animated.View style={[StyleSheet.absoluteFillObject, styles.shareCircleContent, copyIconStyle]}>
                  <Ionicons name="copy-outline" size={22} color="#111827" />
                </Animated.View>
                <Animated.View style={[StyleSheet.absoluteFillObject, styles.shareCircleContent, copyCheckStyle]}>
                  <Ionicons name="checkmark" size={22} color="#0F172A" />
                </Animated.View>
              </TouchableOpacity>
              <Text style={styles.shareCircleLabel}>Copier</Text>
            </View>
            <View style={styles.shareActionItem}>
              <TouchableOpacity
                style={styles.shareCircleBtn}
                onPress={handleShareSave}
                disabled={isShareProcessing}
              >
                <Animated.View style={[StyleSheet.absoluteFillObject, styles.shareCircleContent, saveIconStyle]}>
                  <Ionicons name="download-outline" size={22} color="#111827" />
                </Animated.View>
                <Animated.View style={[StyleSheet.absoluteFillObject, styles.shareCircleContent, saveCheckStyle]}>
                  <Ionicons name="checkmark" size={22} color="#0F172A" />
                </Animated.View>
              </TouchableOpacity>
              <Text style={styles.shareCircleLabel}>Enregistrer</Text>
            </View>
            <View style={styles.shareActionItem}>
              <TouchableOpacity
                style={styles.shareCircleBtn}
                onPress={handleShareGeneric}
                disabled={isShareProcessing}
              >
                <Ionicons name="share-outline" size={22} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.shareCircleLabel}>Partager</Text>
            </View>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
      <EditTripModal
        visible={isEditModalVisible}
        onClose={() => setIsEditModalVisible(false)}
        ride={ride}
        onSave={handleSaveEdit}
        isSaving={isSavingEdit}
      />
    </View>
  );
}

const styles = StyleSheet.create<any>({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  mapContainer: { flex: 1 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  backButtonMinimal: { backgroundColor: 'rgba(255,255,255,0.7)', shadowOpacity: 0.05, elevation: 1 },
  shareButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  bookmarkButton: { position: 'absolute', top: 60, right: 80, width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, zIndex: 10 },
  menuButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  shareCardContainer: { position: 'absolute', top: -100000, left: 0 },
  map: { flex: 1 },
  fabColumn: { position: 'absolute', right: 16, gap: 10, flexDirection: 'column-reverse', zIndex: 999 },
  fab: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.25)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },
  fabGlass: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  bottomSheetBackground: { backgroundColor: '#FFFFFF', opacity: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8 },
  bottomSheetIndicator: { backgroundColor: '#E0E0E0', width: 40, height: 4 },
  hiddenButton: { opacity: 0, pointerEvents: 'none' },
  sheetContent: { flex: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },

  // Header Section
  headerSection: { marginBottom: 32 },
  headerUserRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  headerAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  headerAvatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  headerUserInfo: { justifyContent: 'center' },
  headerUserName: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  headerDate: { fontSize: 12, color: '#64748B' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#0F172A', marginBottom: 8, lineHeight: 34 },
  headerDescription: { fontSize: 15, color: '#475569', lineHeight: 22 },

  // Timeline Section
  timelineContainer: { marginBottom: 32, paddingLeft: 4 },
  timelineItem: { flexDirection: 'row', minHeight: 44 },
  timelineLeftCol: { width: 24, alignItems: 'center', marginRight: 12 },
  timelineDot: {
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 2, borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    zIndex: 2,
  },
  timelineDotStart: { borderColor: '#10B981', backgroundColor: '#10B981' }, // Green filled
  timelineDotEnd: { borderColor: '#EF4444', backgroundColor: '#EF4444' }, // Red filled
  timelineDotIntermediate: { borderColor: '#64748B', width: 8, height: 8, borderRadius: 4, marginLeft: 2, marginTop: 2 },

  timelineDotInnerStart: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF', alignSelf: 'center', marginTop: 2 },
  timelineDotInnerEnd: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF', alignSelf: 'center', marginTop: 2 },

  timelineLine: {
    width: 2, flex: 1, backgroundColor: '#E2E8F0',
    position: 'absolute', top: 12, bottom: -4, left: 11, // Centered on dot
  },
  timelineContent: { flex: 1, paddingBottom: 24 },
  timelinePoint: { justifyContent: 'center' },
  timelineCityName: { fontSize: 16, fontWeight: '500', color: '#1E293B', marginBottom: 2 },
  timelineCityNameBold: { fontWeight: '700', fontSize: 17, color: '#0F172A' },
  timelineLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },

  timelineExpandable: {},
  timelineExpandHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timelineExpandedList: { marginTop: 8, paddingLeft: 0, gap: 6 },
  timelineSubCity: { fontSize: 14, color: '#475569' },
  timelineSubIndex: { color: '#94A3B8', fontSize: 12, marginRight: 4 },

  statsContainer: { marginBottom: 32 },

  // Hero Stat
  heroStatContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heroStatValue: {
    fontSize: 56,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 64,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  heroStatUnit: {
    fontSize: 24,
    fontWeight: '600',
    color: '#94A3B8',
  },
  heroStatLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Key Metrics Row
  keyMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 16,
  },

  // Key Metrics Grid (2+1 layout)
  keyMetricsGrid: {
    marginBottom: 24,
  },
  keyMetricsRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  keyMetricItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  keyMetricItemBottom: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  keyMetricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
    fontVariant: ['tabular-nums'],
  },
  keyMetricUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  keyMetricLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E2E8F0',
  },
  metricDividerVertical: {
    width: 1,
    height: '100%',
    backgroundColor: '#E2E8F0',
  },
  metricDividerHorizontal: {
    height: 1,
    width: '100%',
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },

  // Context Details Strip
  contextDetailsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contextItem: {
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
  },
  contextValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },

  additionalStatsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 24,
  },
  statsColumn: { flex: 1 },
  statItem: { marginBottom: 15 },
  statSubtext: { fontSize: 11, color: '#64748B', marginTop: 2 },
  secondaryStatsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  secondaryStatItem: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  secondaryStatLabel: { fontSize: 11, color: '#64748B', marginBottom: 4, },
  altitudeCard: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  altitudeTitle: { fontSize: 13, color: '#475569', marginBottom: 10 },
  altitudeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  altitudeItem: { flex: 1 },
  interactionButtons: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  interactionButton: { marginHorizontal: 20 },
  photoModalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)', justifyContent: 'center', alignItems: 'center' },
  photoModalCloseButton: { position: 'absolute', top: 60, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  photoModalImage: { width: screenWidth * 0.9, height: screenHeight * 0.7, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  // Legacy styles removed
  photosSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, color: '#0F172A', marginBottom: 16 },
  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoItem: { width: '48%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden' },
  photoThumbnail: { width: '100%', height: '100%' },
  morePhotosButton: { width: '48%', aspectRatio: 1, backgroundColor: '#F0F0F0', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  stepsSection: { marginBottom: 20 },
  stepItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  stepIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(30,58,138,0.08)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  stepInfo: { flex: 1 },
  stepDescription: { fontSize: 14, color: '#64748B', marginBottom: 4 },
  stepTime: { fontSize: 12, color: '#64748B' },
  pausesSection: { marginBottom: 20 },
  pauseItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  pauseIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(30,58,138,0.08)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  pauseInfo: { flex: 1 },
  pauseDuration: { fontSize: 14, color: '#64748B', marginBottom: 2 },
  pauseTime: { fontSize: 12, color: '#64748B' },
  achievementsSection: { marginBottom: 20 },
  achievementCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 16, borderRadius: 12, marginBottom: 12 },
  achievementIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(30,58,138,0.08)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  achievementContent: { flex: 1 },
  achievementDescription: { fontSize: 14, color: '#64748B', lineHeight: 20 },
  graphsSection: { marginBottom: 20 },
  graphCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#F0F0F0' },
  graphHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  speedBar: { height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, marginBottom: 8, position: 'relative' },
  speedBarFill: { height: '100%', width: '60%', backgroundColor: '#1E3A8A', borderRadius: 4 },
  speedStats: { flexDirection: 'row', justifyContent: 'space-between' },
  efficiencyGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  efficiencyItem: { alignItems: 'center', flex: 1 },

  // Photo and step markers (improved design)
  // ⚡ NOUVEAUX STYLES MARKER (Map Pin Style - comme l'exemple)
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end', // ⚡ IMPORTANT: Aligner en bas pour que la pointe soit sur le point d'ancrage
    width: 60,
    height: 60, // 50 (bubble) + 10 (arrow) = 60px exactement
  },
  markerBubble: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#1E40AF', // ⚡ CHANGED: Dark Blue Border for contrast
    backgroundColor: '#F1F5F9', // Couleur de fond
    overflow: 'hidden',
    zIndex: 100, // Au dessus de la pointe
    // Ombre globale du "Pin"
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, // Stronger shadow
    shadowRadius: 5,
    elevation: 10,
  },
  markerArrow: {
    // Triangle CSS en React Native
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#1E40AF', // ⚡ CHANGED: Match border color (Dark Blue)
    marginTop: -1, // Chevauchement léger pour souder
    zIndex: 5, // En dessous du rond
    // Ombre pour la pointe (optionnel, souvent mieux sans pour l'effet uni)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  markerBubblePhoto: {
    borderColor: '#1E40AF', // Dark Blue
  },
  markerBubbleStep: {
    borderColor: '#16A34A', // Green for steps (distinctive)
  },
  // markerStem: REMOVED
  // markerAnchorDot: REMOVED
  // markerWrapper: REMOVED (Legacy)
  // markerHalo: REMOVED (Legacy)
  // markerCircle: REMOVED (Legacy)

  // Turn markers
  turnMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  turnMarkerNormal: {
    backgroundColor: '#F59E0B', // Amber/Orange
  },
  turnMarkerSharp: {
    backgroundColor: '#EF4444', // Red
  },
  turnMarkerUTurn: {
    backgroundColor: '#8B5CF6', // Purple
  },
  markerCirclePhoto: {
    backgroundColor: '#F8F9FA',
  },
  markerCircleStep: {
    backgroundColor: '#F0FDF4',
  },
  markerImage: {
    width: '100%',
    height: '100%',
  },
  markerIconContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerStepBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#16A34A', // Green
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 101,
  },
  animationMarker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animationMarkerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#1E3A8A',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  turnMarkerDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#DC2626', // Rouge
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  nearTurnMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(234, 179, 8, 0.2)', // Jaune transparent
    justifyContent: 'center',
    alignItems: 'center',
  },
  nearTurnMarkerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EAB308', // Jaune
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  shareSheetContent: { flex: 1, padding: 16, justifyContent: 'space-between', backgroundColor: '#FFFFFF' },
  shareSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingBottom: 16,
    paddingTop: 0,
    paddingHorizontal: 0,
    width: '100%',
  },
  shareSheetCloseButton: {
    paddingHorizontal: 0,
  },
  shareSheetCloseText: {
    fontSize: 16, fontWeight: '400',
    color: '#64748B',
  },
  shareVariantGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  shareVariantCard: {
    width: (screenWidth - 64) / 4 - 9,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  shareVariantCardActive: {
    borderColor: '#1E3A8A',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  shareVariantCardPreview: {
    width: '100%',
    height: (screenWidth - 64) / 4 - 9,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareVariantCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: '#F8FAFC',
  },
  shareVariantCardLabel: {
    fontSize: 11, color: '#64748B',
    flex: 1,
    textAlign: 'center',
  },
  shareVariantCardLabelActive: {
    color: '#1E3A8A',
  },
  sharePreviewWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  sharePreviewContainer: { alignItems: 'center', gap: 20, overflow: 'hidden' },
  sharePreviewFrame: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderWidth: 0,
    position: 'relative',
  },
  sharePreviewCardContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  shareCarousel: {
    overflow: 'visible',
  },
  shareSlideContainer: {
    width: SHARE_PREVIEW_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareVariantInfo: {
    alignItems: 'center',
    gap: 4,
  },
  shareVariantTitle: {
    fontSize: 16, fontWeight: '700',
    color: '#0F172A',
  },
  shareVariantSubtitle: {
    fontSize: 12, fontWeight: '400',
    color: '#64748B',
  },
  shareIndicatorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  shareIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(15,23,42,0.15)',
  },
  shareIndicatorDotActive: {
    backgroundColor: '#1E3A8A',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  shareActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    marginTop: 'auto',
  },
  shareActionItem: {
    alignItems: 'center',
    gap: 10,
    flex: 1,
    maxWidth: 100,
  },
  shareCircleBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  shareCircleContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});


