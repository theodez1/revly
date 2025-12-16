import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as polyline from 'google-polyline';
import { getDistance } from 'geolib';

import { RideStorageService } from '../../../../services/RideStorage';
import RideAnalysisService from '../../../../services/RideAnalysisService';
import geocodingService from '../../../../services/geocodingService';
import offlineService from '../../../../services/offlineService';
import ridesService from '../../../../services/supabase/ridesService';
import { stopLocationTracking } from '../../../../services/BackgroundLocationService';

interface ShareExportParams {
  isTracking: boolean;
  trackingPoints: any[];
  flattenSegments: (segments: any[]) => any[];
  trackingSegments: any[][];
  compressedPolyline: string;
  getSegmentIndexForPosition: (index: number) => number;
  getCurrentTripTime: () => number;
  totalDistance: number;
  maxSpeed: number;
  extraStats: any;
  tripName: string;
  tripDescription: string;
  startTime: string | null;
  segmentStartIndicesRef: any;
  navigation: any;
  getVehicleName: (id: string) => string;
  selectedVehicleId: string;
  setIsGeneratingShare: (value: boolean) => void;
}

export async function handleShareExport(params: ShareExportParams) {
  const {
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
    getVehicleName,
    selectedVehicleId,
    setIsGeneratingShare,
  } = params;

  if (!isTracking || trackingPoints.length === 0) {
    Alert.alert('Erreur', 'Aucun trajet en cours à partager');
    return;
  }

  try {
    setIsGeneratingShare(true);

    const flattenedRoute = flattenSegments(trackingSegments);
    let routeCoordinates = flattenedRoute.length > 0 ? flattenedRoute : [];
    if (routeCoordinates.length === 0) {
      try {
        if (compressedPolyline) {
          const coords = polyline.decode(compressedPolyline);
          routeCoordinates = coords.map((c, index) => ({
            latitude: c[0],
            longitude: c[1],
            segmentIndex: getSegmentIndexForPosition(index),
          }));
        }
      } catch (_error) {
        routeCoordinates = [];
      }
    }
    if (routeCoordinates.length === 0) {
      routeCoordinates = trackingPoints;
    }

    const durationSeconds = getCurrentTripTime();
    const distanceMeters = Math.max(0, (totalDistance || 0) * 1000);

    let totalTurns = 0;
    let sharpTurns = 0;
    if (trackingPoints.length >= 5) {
      const speeds = trackingPoints.map((point) => (point?.speed ? point.speed * 3.6 : 0)).filter((speed) => speed > 0);
      const avgSpeed = speeds.length > 0
        ? speeds.reduce((a, b) => a + b, 0) / speeds.length
        : 50;

      const getThresholds = (speed: number) => {
        if (speed < 25) return { minTurnAngle: 20, minDistanceBetweenTurns: 20, sharpTurnThreshold: 50 };
        if (speed < 80) return { minTurnAngle: 25, minDistanceBetweenTurns: 30, sharpTurnThreshold: 60 };
        return { minTurnAngle: 30, minDistanceBetweenTurns: 50, sharpTurnThreshold: 70 };
      };

      const thresholds = getThresholds(avgSpeed);

      // Utiliser le service unifié
      // On doit applatir les segments pour l'analyse globale ou analyser par segment ?
      // Le service prend un tableau de coordonnées.
      // On va analyser le trajet complet (flattened) ou segment par segment.
      // Segment par segment est plus sûr pour éviter les sauts entre segments (pauses).

      trackingSegments.forEach(segment => {
        if (segment && segment.length > 2) {
          const { totalTurns: t, sharpTurns: s } = RideAnalysisService.detectTurns(segment, thresholds);
          totalTurns += t;
          sharpTurns += s;
        }
      });
    }

    const shareExtraStats = extraStats;

    const currentRide = {
      id: `trip_${Date.now()}`,
      name: tripName || `Trajet ${new Date().toLocaleDateString('fr-FR')}`,
      description: tripDescription,
      startTime: startTime || new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: durationSeconds,
      distance: distanceMeters,
      maxSpeed,
      averageSpeed: distanceMeters > 0 && durationSeconds > 0
        ? (distanceMeters / 1000) / (durationSeconds / 3600)
        : 0,
      routeCoordinates,
      vehicle: getVehicleName(selectedVehicleId),
      startCity: null,
      endCity: null,
      extraStats: shareExtraStats,
      totalTurns,
      segmentStartIndices: [...segmentStartIndicesRef.current],
      routeSegments: trackingSegments.map((segment) => segment.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
        timestamp: point.timestamp,
        speed: point.speed,
        altitude: point.altitude,
        segmentIndex: point.segmentIndex,
      }))),
    };

    navigation.navigate('ShareActivity', { ride: currentRide });
  } catch (error) {
    console.error('Erreur lors de la génération du partage:', error);
    Alert.alert('Erreur', 'Impossible de générer l\'image de partage');
  }
}

interface SaveTripParams {
  compressedPolyline: string;
  simplifiedPoints: any[];
  trackingPoints: any[];
  compressPolyline: (points: any[]) => string;
  flattenSegments: (segments: any[]) => any[];
  trackingSegments: any[][];
  getSegmentIndexForPosition: (index: number) => number;
  currentLocation: any;
  getCurrentTripTime: () => number;
  totalDistance: number;
  maxSpeed: number;
  totalStops: number;
  totalStopTime: number;
  tripSteps: any[];
  altitudeData: number[];
  extraStats: any;
  tripName: string;
  tripDescription: string;
  startTime: string | null;
  segmentStartIndicesRef: any;
  user: any;
  profile: any;
  setIsTracking: (val: boolean) => void;
  isTrackingRef: any;
  setIsPaused: (val: boolean) => void;
  stopTripTimer: () => void;
  animateControlsOut: () => void;
  animateStartButtonIn: () => void;
  resetTracking: () => Promise<void>;
  checkLocationPermission: () => Promise<void>;
  speedWatchRef: any;
  setCurrentSpeed: (speed: number) => void;
  formatDisplaySpeed: (speed: number) => string;
  maxSpeedRef: any;
  setMaxSpeed: (speed: number) => void;
  detectStop: (speed: number) => void;
  setAltitudeData: (data: number[]) => void;
  selectedVehicle: string;
  drivingScore: number;
  loadTripsFromStorage?: () => Promise<void>;
  deleteTripFromStorage?: (id: string) => Promise<void>;
}

export async function saveTripWithStepsExport(params: SaveTripParams) {
  const {
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
  } = params;

  try {
    let polylineData = compressedPolyline || '';

    console.log('🗺️ État initial polyline:', {
      compressedPolyline: compressedPolyline ? `${compressedPolyline.substring(0, 50)}...` : 'vide',
      simplifiedPoints: simplifiedPoints.length,
      trackingPoints: trackingPoints.length,
    });

    if (!polylineData && simplifiedPoints.length > 1) {
      polylineData = compressPolyline(simplifiedPoints);
      console.log('✅ Polyline créé depuis simplifiedPoints:', polylineData ? `${polylineData.substring(0, 50)}...` : 'vide');
    } else if (!polylineData && trackingPoints.length > 1) {
      polylineData = compressPolyline(trackingPoints);
      console.log('✅ Polyline créé depuis trackingPoints:', polylineData ? `${polylineData.substring(0, 50)}...` : 'vide');
    }

    console.log('🗺️ Polyline final:', polylineData ? `${polylineData.substring(0, 50)}... (${polylineData.length} chars)` : 'VIDE');

    const flattenedRoute = flattenSegments(trackingSegments);
    let routeCoordinates = flattenedRoute.length > 0 ? flattenedRoute : [];
    if (routeCoordinates.length === 0) {
      if (simplifiedPoints.length > 0) {
        routeCoordinates = simplifiedPoints;
      } else if (trackingPoints.length > 0) {
        routeCoordinates = trackingPoints;
      }
    }
    if (routeCoordinates.length === 0 && polylineData) {
      try {
        const coords = polyline.decode(polylineData);
        routeCoordinates = coords.map((c, index) => ({
          latitude: c[0],
          longitude: c[1],
          segmentIndex: getSegmentIndexForPosition(index),
        }));
      } catch (_error) {
        console.log('Polyline decoding failed, using tracking points');
        routeCoordinates = trackingPoints;
      }
    }

    if (routeCoordinates.length === 0 && currentLocation) {
      console.log('⚠️ Aucun point collecté, utilisation de currentLocation pour géocodage');
      routeCoordinates = [currentLocation];
    }

    console.log('📍 routeCoordinates pour géocodage:', routeCoordinates.length, 'points');

    // ⚡ RECALCUL ROBUSTE : Ne pas se fier uniquement aux props passées qui peuvent être stale
    // Recalculer la distance totale à partir des points bruts pour être sûr
    let calculatedDistanceMeters = 0;
    try {
      if (trackingPoints && Array.isArray(trackingPoints) && trackingPoints.length > 1) {
        for (let i = 1; i < trackingPoints.length; i++) {
          const p1 = trackingPoints[i - 1];
          const p2 = trackingPoints[i];

          // Vérification stricte des points
          if (p1 && p2 &&
            typeof p1.latitude === 'number' && typeof p1.longitude === 'number' &&
            typeof p2.latitude === 'number' && typeof p2.longitude === 'number' &&
            (p1.segmentIndex ?? 0) === (p2.segmentIndex ?? 0)) {

            const dist = getDistance(
              { latitude: p1.latitude, longitude: p1.longitude },
              { latitude: p2.latitude, longitude: p2.longitude }
            );
            calculatedDistanceMeters += dist;
          }
        }
      }
    } catch (calcError) {
      console.error('Erreur lors du recalcul de la distance:', calcError);
      // On continue avec la valeur par défaut
    }

    // Utiliser la distance recalculée si elle est cohérente, sinon fallback sur totalDistance
    const distanceMeters = calculatedDistanceMeters > 0 ? calculatedDistanceMeters : Math.max(0, (totalDistance || 0) * 1000);

    // Recalculer la durée si nécessaire
    let durationSeconds = 0;
    try {
      // 1. Essayer d'obtenir le temps depuis getCurrentTripTime
      if (typeof getCurrentTripTime === 'function') {
        durationSeconds = getCurrentTripTime();
        console.log('⏱️ [SAVE] getCurrentTripTime() retourné:', durationSeconds, 'secondes');
      }

      // 2. Si le temps est 0 ou invalide, calculer depuis startTime
      if ((!durationSeconds || durationSeconds === 0) && startTime) {
        try {
          const startTimeMs = typeof startTime === 'string' 
            ? new Date(startTime).getTime() 
            : startTime;
          
          if (startTimeMs && !isNaN(startTimeMs)) {
            const calculatedDuration = Math.floor((Date.now() - startTimeMs) / 1000);
            if (calculatedDuration > 0) {
              durationSeconds = calculatedDuration;
              console.log('⏱️ [SAVE] Durée calculée depuis startTime:', durationSeconds, 'secondes');
            }
          }
        } catch (startTimeError) {
          console.error('Erreur calcul durée depuis startTime:', startTimeError);
        }
      }

      // 3. Si toujours 0, essayer de calculer depuis les timestamps des points GPS
      if ((!durationSeconds || durationSeconds === 0) && trackingPoints && trackingPoints.length > 1) {
        try {
          const firstPoint = trackingPoints[0];
          const lastPoint = trackingPoints[trackingPoints.length - 1];
          
          if (firstPoint?.timestamp && lastPoint?.timestamp) {
            const pointDuration = Math.floor((lastPoint.timestamp - firstPoint.timestamp) / 1000);
            if (pointDuration > 0) {
              durationSeconds = pointDuration;
              console.log('⏱️ [SAVE] Durée calculée depuis timestamps GPS:', durationSeconds, 'secondes');
            }
          }
        } catch (timestampError) {
          console.error('Erreur calcul durée depuis timestamps:', timestampError);
        }
      }

      // 4. Log final pour debug
      if (durationSeconds === 0) {
        console.warn('⚠️ [SAVE] ATTENTION: Durée = 0 secondes !', {
          getCurrentTripTime: typeof getCurrentTripTime === 'function' ? getCurrentTripTime() : 'N/A',
          startTime,
          trackingPointsLength: trackingPoints?.length || 0,
        });
      } else {
        console.log('✅ [SAVE] Durée finale sauvegardée:', durationSeconds, 'secondes');
      }
    } catch (timeError) {
      console.error('❌ Erreur calcul durée:', timeError);
      durationSeconds = 0;
    }

    const distanceKm = distanceMeters / 1000;
    const avgKmH = distanceMeters > 0 && durationSeconds > 0
      ? distanceKm / (durationSeconds / 3600)
      : 0;

    const paceMinPerKm = avgKmH > 0 ? 60 / avgKmH : 0;

    let elevationGain = 0;
    let elevationLoss = 0;
    let maxAltitude: number | null = altitudeData.length > 0 ? altitudeData[0] : null;
    let minAltitude: number | null = altitudeData.length > 0 ? altitudeData[0] : null;
    if (altitudeData.length > 1) {
      for (let i = 1; i < altitudeData.length; i += 1) {
        const currentAlt = altitudeData[i];
        const prevAlt = altitudeData[i - 1];

        if (Number.isFinite(currentAlt)) {
          if (maxAltitude === null || currentAlt > maxAltitude) maxAltitude = currentAlt;
          if (minAltitude === null || currentAlt < minAltitude) minAltitude = currentAlt;
        }

        if (!Number.isFinite(currentAlt) || !Number.isFinite(prevAlt)) {
          continue;
        }

        const diff = currentAlt - prevAlt;
        if (diff > 0) {
          elevationGain += diff;
        } else if (diff < 0) {
          elevationLoss += Math.abs(diff);
        }
      }
    }

    const roundedGain = Math.round(elevationGain);
    const roundedLoss = Math.round(elevationLoss);
    const maxAltitudeRounded = maxAltitude !== null ? Math.round(maxAltitude) : null;
    const minAltitudeRounded = minAltitude !== null ? Math.round(minAltitude) : null;

    const totalStopTimeSeconds = Math.floor(totalStopTime / 1000);
    const movingTime = Math.max(0, durationSeconds - totalStopTimeSeconds);

    const avgMovingSpeed = movingTime > 0 && distanceKm > 0
      ? distanceKm / (movingTime / 3600)
      : avgKmH;

    const climbRate = movingTime > 0 ? roundedGain / (movingTime / 3600) : 0;
    const avgGrade = distanceMeters > 0 ? (roundedGain / distanceMeters) * 100 : 0;
    const idleRatio = durationSeconds > 0 ? (totalStopTimeSeconds / durationSeconds) * 100 : 0;
    const stopsPerKm = distanceKm > 0 ? totalStops / distanceKm : 0;
    const movingRatio = durationSeconds > 0 ? (movingTime / durationSeconds) * 100 : 0;

    let topSpeed = maxSpeed;
    if (trackingPoints.length > 10) {
      const speeds = trackingPoints
        .map((point) => point.speed * 3.6)
        .filter((speed) => speed > 0)
        .sort((a, b) => b - a);
      const top10Percent = speeds.slice(0, Math.max(1, Math.floor(speeds.length * 0.1)));
      topSpeed = top10Percent.reduce((a, b) => a + b, 0) / top10Percent.length;
    }

    let totalTurns = 0;
    let sharpTurns = 0;
    if (trackingPoints.length >= 5) {
      const speeds = trackingPoints.map((point) => (point?.speed ? point.speed * 3.6 : 0)).filter((speed) => speed > 0);
      const avgSpeed = speeds.length > 0
        ? speeds.reduce((a, b) => a + b, 0) / speeds.length
        : 50;

      const getThresholds = (speed: number) => {
        if (speed < 25) return { minTurnAngle: 20, minDistanceBetweenTurns: 20, sharpTurnThreshold: 50 };
        if (speed < 80) return { minTurnAngle: 25, minDistanceBetweenTurns: 30, sharpTurnThreshold: 60 };
        return { minTurnAngle: 30, minDistanceBetweenTurns: 50, sharpTurnThreshold: 70 };
      };

      const thresholds = getThresholds(avgSpeed);

      trackingSegments.forEach(segment => {
        if (segment && segment.length > 2) {
          const { totalTurns: t, sharpTurns: s } = RideAnalysisService.detectTurns(segment, thresholds);
          totalTurns += t;
          sharpTurns += s;
        }
      });
    }

    let smoothness = 100;
    if (trackingPoints.length > 2) {
      const speeds = trackingPoints.map((point) => point.speed * 3.6).filter((speed) => speed > 0);
      if (speeds.length > 2) {
        const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
        const variance = speeds.reduce((sum, speed) => sum + (speed - avgSpeed) ** 2, 0) / speeds.length;
        const stdDev = Math.sqrt(variance);
        smoothness = Math.max(0, Math.min(100, 100 - (stdDev * 2)));
      }
    }

    let startCity: string | null = null;
    let endCity: string | null = null;
    let cities: string[] = [];
    let pendingCityLookup = false;

    console.log('🌍 Début géocodage - routeCoordinates.length:', routeCoordinates.length);

    try {
      const geoPayload: any = {
        routeCoordinates,
        startCity: null,
        endCity: null,
        cities: [],
      };

      const isOnlineForGeocoding = await offlineService.checkConnection();
      await geocodingService.populateRideCities(geoPayload, { isOnline: isOnlineForGeocoding });

      startCity = geoPayload.startCity || null;
      endCity = geoPayload.endCity || null;
      cities = Array.isArray(geoPayload.cities) ? geoPayload.cities : [];
      pendingCityLookup = Boolean(geoPayload.pendingCityLookup);

      console.log('📍 Villes finales:', { startCity, endCity, cities, pendingCityLookup });
    } catch (error) {
      pendingCityLookup = true;
      console.error('❌ Erreur lors du géocodage des villes:', error);
    }

    const photosFromSteps = tripSteps
      .filter((step) => step.type === 'photo' && step.photo)
      .map((step) => ({
        uri: step.photo,
        timestamp: step.timestamp,
        location: step.location,
        title: step.title,
        description: step.description,
      }));

    let userId = user?.id || 'default';
    let userName = profile?.username || profile?.first_name || 'Utilisateur';
    let userAvatar = profile?.avatar_url || null;

    // Utiliser le cache local pour la photo de profil
    if (user?.id && profile?.avatar_url) {
      try {
        const { getCachedProfilePhoto } = require('../../../services/ProfilePhoto');
        const cachedPhoto = await getCachedProfilePhoto(user.id);
        if (cachedPhoto) {
          userAvatar = cachedPhoto;
        }
      } catch (error) {
        console.warn('Erreur récupération cache photo profil:', error);
      }
    }

    if (!user?.id) {
      try {
        const profileRaw = await AsyncStorage.getItem('@profileData');
        const profilePhoto = await AsyncStorage.getItem('@profilePhotoUri');

        if (profileRaw) {
          const legacyProfile = JSON.parse(profileRaw);
          userName = legacyProfile.firstName || legacyProfile.lastName
            ? `${legacyProfile.firstName || ''} ${legacyProfile.lastName || ''}`.trim()
            : legacyProfile.username
              ? `@${legacyProfile.username}`
              : 'Utilisateur';
        }

        if (profilePhoto) {
          userAvatar = profilePhoto;
        }
      } catch (error) {
        console.error('Erreur chargement profil legacy:', error);
      }
    }

    const extendedExtraStats = {
      elevationGain: roundedGain,
      elevationLoss: roundedLoss,
      climbRate: Math.round(climbRate),
      averageGrade: Math.round(avgGrade * 10) / 10,
      idleRatio: Math.round(idleRatio * 10) / 10,
      stopsPerKm: Math.round(stopsPerKm * 100) / 100,
      movingRatio: Math.round(movingRatio * 10) / 10,
      maxAltitude: maxAltitudeRounded,
      minAltitude: minAltitudeRounded,
      ...extraStats,
    };

    // Formater startTime correctement (peut être number ou string)
    let formattedStartTime: string;
    if (startTime) {
      try {
        const startTimeMs = typeof startTime === 'number' ? startTime : new Date(startTime).getTime();
        if (!isNaN(startTimeMs)) {
          formattedStartTime = new Date(startTimeMs).toISOString();
        } else {
          formattedStartTime = new Date().toISOString();
        }
      } catch (e) {
        console.error('Erreur formatage startTime:', e);
        formattedStartTime = new Date().toISOString();
      }
    } else {
      formattedStartTime = new Date().toISOString();
    }

    console.log('📅 [SAVE] startTime formaté:', formattedStartTime);
    console.log('⏱️ [SAVE] durationSeconds final:', durationSeconds);

    const tripData = {
      id: `trip_${Date.now()}`,
      name: tripName || `Trajet ${new Date().toLocaleDateString('fr-FR')}`,
      description: tripDescription,
      startTime: formattedStartTime,
      endTime: new Date().toISOString(),
      duration: durationSeconds,
      distance: distanceMeters,
      maxSpeed,
      averageSpeed: avgKmH,
      pace: paceMinPerKm,
      totalStops,
      totalStopTime: Math.floor(totalStopTime / 1000),
      movingTime,
      topSpeed: Math.round(topSpeed * 10) / 10,
      avgMovingSpeed: Math.round(avgMovingSpeed * 10) / 10,
      totalTurns,
      sharpTurns,
      smoothness: Math.round(smoothness),
      drivingScore,
      polyline: polylineData || '',
      routeCoordinates: routeCoordinates.length > 0 ? routeCoordinates : [],
      routeSegments: trackingSegments.map((segment) =>
        segment.map((point) => ({
          latitude: point.latitude,
          longitude: point.longitude,
          timestamp: point.timestamp,
          speed: point.speed,
          altitude: point.altitude,
          segmentIndex: point.segmentIndex,
        })),
      ),
      segmentStartIndices: [...segmentStartIndicesRef.current],
      photos: photosFromSteps,
      vehicle: selectedVehicle || 'car',
      startCity,
      endCity,
      cities,
      pendingCityLookup,
      extraStats: extendedExtraStats,
      steps: tripSteps,
      userId,
      userName,
      userAvatar,
    };

    console.log('📊 TripData avant sauvegarde:', {
      userId: tripData.userId,
      name: tripData.name,
      distance: tripData.distance,
      duration: tripData.duration,
      trackingPoints: trackingPoints.length,
      simplifiedPoints: simplifiedPoints.length,
      routeCoordinates: routeCoordinates.length,
      polyline: tripData.polyline ? `${tripData.polyline.substring(0, 50)}...` : 'vide',
      startCity: tripData.startCity,
      endCity: tripData.endCity,
      cities: tripData.cities,
      extraStats: tripData.extraStats,
    });

    const savedRide = await RideStorageService.saveRide(tripData);
    console.log('✅ TRIP SAVED:', savedRide?.id || 'ERREUR - pas d\'ID retourné');

    const isOnline = await offlineService.checkConnection();
    if (isOnline && photosFromSteps.length > 0 && savedRide?.id) {
      console.log('📷 Uploading photos for ride:', savedRide.id);
      const uploadPromises = photosFromSteps.map(async (photo, index) => {
        try {
          const { url, error } = await ridesService.uploadRidePhoto(
            userId,
            savedRide.id,
            photo.uri,
            photo.location,
          );
          if (error) {
            console.error(`❌ Error uploading photo ${index}:`, error);
          } else {
            console.log(`✅ Photo ${index + 1}/${photosFromSteps.length} uploaded:`, url);
          }
        } catch (err) {
          console.error(`❌ Exception uploading photo ${index}:`, err);
        }
      });

      await Promise.all(uploadPromises);
      console.log('📷 All photos processed');
    }

    const allRides = await RideStorageService.getAllRides();
    console.log('📋 TOTAL RIDES IN STORAGE:', allRides.length);

    if (speedWatchRef.current) {
      try {
        speedWatchRef.current.remove();
        speedWatchRef.current = null;
        console.log('[SPEED] ⏹️ Watch vitesse arrêté');
      } catch (error) {
        console.error('Erreur arrêt watch vitesse:', error);
      }
    }

    try {
      await stopLocationTracking();
      console.log('[BG] ⏹️ Background updates arrêtés');
    } catch (error) {
      console.error('Erreur arrêt background updates:', error);
    }

    setIsTracking(false);
    isTrackingRef.current = false;
    setIsPaused(false);
    stopTripTimer();
    await AsyncStorage.setItem('isTracking', 'false');
    await AsyncStorage.setItem('isPaused', 'false');

    animateControlsOut();

    setTimeout(async () => {
      await resetTracking();
      animateStartButtonIn();
      await checkLocationPermission();
      console.log('✅ Bouton réinitialisé, permissions vérifiées');
    }, 300);

    Alert.alert('Succès', `Trajet "${tripData.name}" sauvegardé avec ${tripSteps.length} étapes !`);

    if (typeof loadTripsFromStorage === 'function') {
      await loadTripsFromStorage();
    }
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    Alert.alert('Erreur', 'Impossible de sauvegarder le trajet');
  }
}

export async function saveTripToStorageExport({ tripData, setSavedTrips }: { tripData: any; setSavedTrips?: (trips: any[]) => void }) {
  try {
    const tripId = `trip_${Date.now()}`;
    const tripToSave = {
      id: tripId,
      ...tripData,
      savedAt: new Date().toISOString(),
    };

    const existingTrips = await AsyncStorage.getItem('savedTrips');
    const trips = existingTrips ? JSON.parse(existingTrips) : [];

    trips.push(tripToSave);

    await AsyncStorage.setItem('savedTrips', JSON.stringify(trips));
    setSavedTrips?.(trips);

    return tripId;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    throw error;
  }
}

export async function loadTripsFromStorageExport({ setSavedTrips }: { setSavedTrips?: (trips: any[]) => void }) {
  try {
    const trips = await AsyncStorage.getItem('savedTrips');
    const parsedTrips = trips ? JSON.parse(trips) : [];
    setSavedTrips?.(parsedTrips);
    return parsedTrips;
  } catch (error) {
    console.error('Erreur lors du chargement des trajets:', error);
    setSavedTrips?.([]);
    return [];
  }
}

export async function deleteTripFromStorageExport({ tripId, setSavedTrips }: { tripId: string; setSavedTrips?: (trips: any[]) => void }) {
  try {
    const trips = await AsyncStorage.getItem('savedTrips');
    if (trips) {
      const parsedTrips = JSON.parse(trips);
      const filteredTrips = parsedTrips.filter((trip: any) => trip.id !== tripId);

      await AsyncStorage.setItem('savedTrips', JSON.stringify(filteredTrips));
      setSavedTrips?.(filteredTrips);
      console.log('Trajet supprimé:', tripId);
    }
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    throw error;
  }
}

