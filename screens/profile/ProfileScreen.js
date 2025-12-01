import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, TouchableWithoutFeedback, Keyboard, Platform, Image, Dimensions, Animated, ActivityIndicator, Easing } from 'react-native';
import PagerView from 'react-native-pager-view';
import MiniRoutePreview from '../../components/MiniRoutePreview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RideStorageService } from '../../services/RideStorage';

import { loadVehicles as loadVehiclesService, loadDefaultVehicleId, setDefaultVehicleId as setDefaultVehicleIdService, saveVehicle, deleteVehicle as deleteVehicleService, updateVehicle, getVehicleIconByType } from '../../services/Vehicles';
import vehiclesService from '../../services/supabase/vehiclesService';
import authService from '../../services/supabase/authService';
import userRelationshipsService from '../../services/supabase/userRelationshipsService';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { loadAndCacheProfilePhoto, cacheProfilePhoto, getCachedProfilePhoto } from '../../services/ProfilePhoto';
// using native Modal for a simple bottom sheet to avoid reanimated setup

const formatDistanceKm = (meters) => {
  if (!meters) return '0 km';
  const km = meters / 1000;
  if (km >= 100) {
    return `${Math.round(km).toLocaleString('fr-FR')} km`;
  }
  if (km >= 10) {
    return `${km.toFixed(1).replace('.', ',')} km`;
  }
  return `${km.toFixed(2).replace('.', ',')} km`;
};

const formatDurationLong = (seconds) => {
  if (!seconds) return '0 min';
  const totalMinutes = Math.round(seconds / 60);

  if (totalMinutes <= 0) {
    return '0 min';
  }

  const minutesPerDay = 60 * 24;
  const days = Math.floor(totalMinutes / minutesPerDay);
  const hours = Math.floor((totalMinutes % minutesPerDay) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    if (hours > 0) {
      return `${days} j ${hours} h`;
    }
    return `${days} j`;
  }

  if (hours > 0) {
    return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
  }

  return `${minutes} min`;
};

const formatAverageSpeed = (speed) => `${(speed || 0).toFixed(1).replace('.', ',')} km/h`;

const formatInteger = (value) => (value || 0).toLocaleString('fr-FR');

const formatKmValue = (meters) => {
  const km = (Number(meters) || 0) / 1000;
  if (km >= 100) {
    return Math.round(km).toLocaleString('fr-FR');
  }
  if (km >= 10) {
    return km.toFixed(1).replace('.', ',');
  }
  if (km >= 1) {
    return km.toFixed(2).replace('.', ',');
  }
  return km.toFixed(2).replace('.', ',');
};

const formatKmFromValue = (kilometers) => {
  const value = Number(kilometers) || 0;
  if (value >= 100) {
    return Math.round(value).toLocaleString('fr-FR');
  }
  if (value >= 10) {
    return value.toFixed(1).replace('.', ',');
  }
  if (value >= 1) {
    return value.toFixed(2).replace('.', ',');
  }
  return value.toFixed(2).replace('.', ',');
};

const achievementBadgeImages = {
  '10km': {
    image: require('../../assets/badges/10km.png'),
    label: '10 km',
  },
  '50km': {
    image: require('../../assets/badges/50km.png'),
    label: '50 km',
  },
  '100km': {
    image: require('../../assets/badges/100km.png'),
    label: '100 km',
  },
  '1000km': {
    image: require('../../assets/badges/1000km.png'),
    label: '1000 km',
  },
};

export default function SettingsScreen({ navigation }) {
  const { user, profile, signOut, refreshProfile, isPremium } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [newVehicleName, setNewVehicleName] = useState('');
  const [newVehicleType, setNewVehicleType] = useState('car');
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [setAsDefaultOnSave, setSetAsDefaultOnSave] = useState(false);
  const [defaultVehicleId, setDefaultVehicleId] = useState(null);
  const [globalStats, setGlobalStats] = useState({ totalRides: 0, totalDistance: 0, totalDuration: 0, averageSpeed: 0 });
  const vehiclesKey = '@vehicles';
  const defaultKey = '@defaultVehicleId';
  const profilePhotoKey = '@profilePhotoUri';
  const profileDataKey = '@profileData';

  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ['60%'], []);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  // removed action sheet states
  const nameInputRef = useRef(null);
  const [focusNameOnOpen, setFocusNameOnOpen] = useState(false);
  const [profilePhotoUri, setProfilePhotoUri] = useState(null);
  const lastLoadedAvatarRef = useRef(null); // Pour éviter les rechargements inutiles
  const [newVehicleDescription, setNewVehicleDescription] = useState('');
  const [newVehiclePhotoUri, setNewVehiclePhotoUri] = useState(null);
  const [recentDistances, setRecentDistances] = useState([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState({});
  const [trophies, setTrophies] = useState([]);
  const [weekStreak, setWeekStreak] = useState(0);
  const [weekActivity, setWeekActivity] = useState({}); // { 0: true, 1: false, ... } pour chaque jour de la semaine
  const [activeTab, setActiveTab] = useState('posts');
  const [userRides, setUserRides] = useState([]);
  const [totalLikes, setTotalLikes] = useState(0);
  const [bookmarkedRides, setBookmarkedRides] = useState([]);
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);
  const [followStats, setFollowStats] = useState({ followersCount: 0, followingCount: 0 });
  const screenWidth = Dimensions.get('window').width;
  const pagerRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(0);
  const indicatorAnim = useRef(new Animated.Value(0)).current;

  // Calcul de la position de l'indicateur
  const indicatorTranslateX = indicatorAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [
      screenWidth / 8 - 20,
      screenWidth * 3 / 8 - 20,
      screenWidth * 5 / 8 - 20,
      screenWidth * 7 / 8 - 20,
    ],
  });

  // Handler simplifié pour changement de page
  const onPageSelected = useCallback((e) => {
    const page = e.nativeEvent.position;
    setCurrentPage(page);

    Animated.spring(indicatorAnim, {
      toValue: page,
      useNativeDriver: true,
      damping: 20,
      stiffness: 300,
    }).start();
  }, []);

  // Naviguer vers une page
  const goToPage = useCallback((page) => {
    pagerRef.current?.setPage(page);
  }, []);

  const statsSummary = useMemo(() => {
    const totalDistance = globalStats?.totalDistance || 0;
    const totalDuration = globalStats?.totalDuration || 0;
    const totalRides = globalStats?.totalRides || 0;
    const averageSpeed = globalStats?.averageSpeed || 0;

    const hasStats = totalRides > 0 || totalDistance > 0 || totalDuration > 0;

    return {
      hasStats,
      totalDistanceLabel: formatDistanceKm(totalDistance),
      totalDurationLabel: formatDurationLong(totalDuration),
      averageSpeedLabel: formatAverageSpeed(averageSpeed),
      totalRidesLabel: formatInteger(totalRides),
      rawTotalRides: totalRides,
    };
  }, [globalStats]);

  const statsSummaryItems = useMemo(() => (
    [
      {
        key: 'distance',
        value: formatKmValue(globalStats?.totalDistance || 0),
        label: 'Distance totale (km)',
      },
      {
        key: 'duration',
        value: statsSummary.totalDurationLabel,
        label: 'Temps total',
      },
      {
        key: 'speed',
        value: (globalStats?.averageSpeed || 0).toFixed(1).replace('.', ','),
        label: 'Vitesse moyenne (km/h)',
      },
      {
        key: 'rides',
        value: statsSummary.totalRidesLabel,
        label: statsSummary.rawTotalRides === 1 ? 'Trajet' : 'Trajets',
      },
    ]
  ), [statsSummary.totalDistanceLabel, statsSummary.totalDurationLabel, statsSummary.averageSpeedLabel, statsSummary.totalRidesLabel, statsSummary.rawTotalRides]);

  // Charger les stats de followers / suivis
  useEffect(() => {
    const loadFollowStats = async () => {
      try {
        if (!user?.id) return;
        const { stats, error } = await userRelationshipsService.getFollowStats(user.id);
        if (!error && stats) {
          setFollowStats(stats);
        }
      } catch (error) {
        console.error('Erreur chargement followStats:', error);
      }
    };

    loadFollowStats();
  }, [user?.id]);

  const recentDistanceStats = useMemo(() => {
    const values = Array.isArray(recentDistances)
      ? recentDistances.map((d) => {
        const numeric = Number(d);
        return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
      })
      : [];

    if (!values.length) {
      return { totalKm: 0, avgKm: 0, activeDays: 0, maxKm: 0, values };
    }

    const totalKm = values.reduce((sum, value) => sum + value, 0);
    const activeDays = values.filter((value) => value > 0).length;
    const avgKm = totalKm / values.length;
    const maxKm = Math.max(...values, 0);

    return { totalKm, avgKm, activeDays, maxKm, values };
  }, [recentDistances]);

  // Profile data
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    bio: '',
  });

  // Profile edit sheet
  const [isProfileSheetVisible, setIsProfileSheetVisible] = useState(false);
  const profileSheetAnim = useRef(new Animated.Value(0)).current;
  const [editedProfile, setEditedProfile] = useState({
    firstName: '',
    lastName: '',
    username: '',
    bio: '',
  });

  // Fonction pour copier l'image de manière permanente
  const copyImageToPermanentStorage = async (sourceUri) => {
    try {
      const filename = sourceUri.split('/').pop();
      const fileExtension = filename.split('.').pop();
      const newFilename = `${Date.now()}.${fileExtension}`;
      const destinationUri = `${FileSystem.documentDirectory}${newFilename}`;

      await FileSystem.copyAsync({
        from: sourceUri,
        to: destinationUri,
      });

      return destinationUri;
    } catch (error) {
      console.error('Erreur copie image:', error);
      return sourceUri; // Fallback sur l'URI source si échec
    }
  };

  const handlePresentModalPress = useCallback(() => {
    setIsSheetVisible(true);
    bottomSheetRef.current?.present?.();
  }, []);

  const handleDismissModalPress = useCallback(() => {
    bottomSheetRef.current?.dismiss?.();
    setIsSheetVisible(false);
  }, []);

  const loadVehicles = async () => {
    try {
      if (!user?.id) {
        console.warn('Pas d\'utilisateur connecté pour charger les véhicules');
        return;
      }

      // Charger les véhicules depuis Supabase
      const list = await loadVehiclesService(user.id);
      setVehicles(list);

      // Charger le véhicule par défaut
      const defId = await loadDefaultVehicleId(user.id);
      if (defId) setDefaultVehicleId(defId);
    } catch (e) {
      console.error('Erreur chargement véhicules', e);
    }
  };

  // Calculer l'activité de la semaine courante (jours avec trajets)
  const calculateWeekActivity = useCallback((rides) => {
    const activity = { 0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false }; // Dimanche = 0, Lundi = 1, etc.

    if (!rides || rides.length === 0) return activity;

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Dimanche
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    rides.forEach(ride => {
      const rideDate = new Date(ride.endTime || ride.startTime);
      if (rideDate >= startOfWeek && rideDate < endOfWeek) {
        const dayOfWeek = rideDate.getDay(); // 0 = Dimanche, 1 = Lundi, etc.
        activity[dayOfWeek] = true;
      }
    });

    return activity;
  }, []);

  const computeLast7DaysDistances = useCallback((rides) => {
    const result = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getTimestamp = (date) => {
      if (!date) return null;
      if (typeof date === 'number') return date;
      if (typeof date === 'string') {
        const parsed = Date.parse(date);
        return Number.isNaN(parsed) ? null : parsed;
      }
      if (date instanceof Date) return date.getTime();
      return null;
    };

    for (let offset = 6; offset >= 0; offset -= 1) {
      const dayStart = new Date(today);
      dayStart.setDate(today.getDate() - offset);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);

      const startMs = dayStart.getTime();
      const endMs = dayEnd.getTime();

      const totalMeters = (rides || []).reduce((sum, ride) => {
        const rideDateMs = getTimestamp(ride?.endTime || ride?.startTime);
        if (rideDateMs === null) return sum;
        if (rideDateMs >= startMs && rideDateMs < endMs) {
          return sum + Math.max(0, ride?.distance || 0);
        }
        return sum;
      }, 0);

      result.push(totalMeters > 0 ? totalMeters / 1000 : 0);
    }

    return result;
  }, []);

  // Calculer la série de semaines consécutives
  const calculateWeekStreak = useCallback((rides) => {
    if (!rides || rides.length === 0) return 0;

    // Grouper les rides par semaine (année + numéro de semaine)
    const getWeekKey = (date) => {
      const d = new Date(date);
      const year = d.getFullYear();
      const start = new Date(year, 0, 1);
      const days = Math.floor((d - start) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.ceil((days + start.getDay() + 1) / 7);
      return `${year}-${weekNumber}`;
    };

    const weeks = rides.map(r => getWeekKey(r.startTime));
    const uniqueWeeks = [...new Set(weeks)].sort();

    if (uniqueWeeks.length === 0) return 0;

    // Vérifier si la semaine dernière a un trajet
    const now = new Date();
    const lastWeekKey = getWeekKey(now);
    const weekIndex = uniqueWeeks.indexOf(lastWeekKey);

    if (weekIndex === -1) return 0; // Pas de trajet cette semaine

    // Compter les semaines consécutives depuis la dernière
    let streak = 0;
    let currentWeek = now;

    for (let i = 0; i < uniqueWeeks.length; i++) {
      const key = getWeekKey(currentWeek);
      if (!uniqueWeeks.includes(key)) break;
      streak++;

      // Passer à la semaine précédente
      currentWeek = new Date(currentWeek);
      currentWeek.setDate(currentWeek.getDate() - 7);
    }

    return streak;
  }, []);

  // Calculer les trophées à partir des rides
  const calculateTrophies = useCallback((rides) => {
    const trophiesList = [];

    if (!rides || rides.length === 0) return trophiesList;

    // Calculer les métriques
    const totalDistance = rides.reduce((sum, r) => sum + (r.distance || 0), 0) / 1000; // km
    const totalDuration = rides.reduce((sum, r) => sum + (r.duration || 0), 0); // secondes
    const totalRides = rides.length;
    const totalHours = totalDuration / 3600;

    // Trophées de distance (couleur bleue - design principal)
    if (totalDistance >= 10) trophiesList.push({ id: '10km', name: '10 km', icon: 'location', color: '#1E3A8A', category: 'distance' });
    if (totalDistance >= 50) trophiesList.push({ id: '50km', name: '50 km', icon: 'location', color: '#1E3A8A', category: 'distance' });
    if (totalDistance >= 100) trophiesList.push({ id: '100km', name: '100 km', icon: 'navigate', color: '#2563EB', category: 'distance' });
    if (totalDistance >= 250) trophiesList.push({ id: '250km', name: '250 km', icon: 'map', color: '#2563EB', category: 'distance' });
    if (totalDistance >= 500) trophiesList.push({ id: '500km', name: '500 km', icon: 'map', color: '#3B82F6', category: 'distance' });
    if (totalDistance >= 1000) trophiesList.push({ id: '1000km', name: '1000 km', icon: 'earth', color: '#3B82F6', category: 'distance' });
    if (totalDistance >= 2500) trophiesList.push({ id: '2500km', name: '2500 km', icon: 'earth', color: '#60A5FA', category: 'distance' });
    if (totalDistance >= 5000) trophiesList.push({ id: '5000km', name: '5000 km', icon: 'globe', color: '#60A5FA', category: 'distance' });

    // Trophées de nombre de trajets (couleur verte)
    if (totalRides >= 1) trophiesList.push({ id: 'first', name: 'Premier trajet', icon: 'star', color: '#10B981', category: 'rides' });
    if (totalRides >= 5) trophiesList.push({ id: '5rides', name: '5 trajets', icon: 'star', color: '#10B981', category: 'rides' });
    if (totalRides >= 10) trophiesList.push({ id: '10rides', name: '10 trajets', icon: 'star', color: '#059669', category: 'rides' });
    if (totalRides >= 25) trophiesList.push({ id: '25rides', name: '25 trajets', icon: 'medal', color: '#047857', category: 'rides' });
    if (totalRides >= 50) trophiesList.push({ id: '50rides', name: '50 trajets', icon: 'medal', color: '#047857', category: 'rides' });
    if (totalRides >= 100) trophiesList.push({ id: '100rides', name: '100 trajets', icon: 'trophy', color: '#065F46', category: 'rides' });
    if (totalRides >= 250) trophiesList.push({ id: '250rides', name: '250 trajets', icon: 'trophy', color: '#065F46', category: 'rides' });

    // Trophées de temps (couleur orange/jaune)
    if (totalHours >= 1) trophiesList.push({ id: '1h', name: '1h conduite', icon: 'time', color: '#F97316', category: 'time' });
    if (totalHours >= 5) trophiesList.push({ id: '5h', name: '5h conduite', icon: 'time', color: '#F97316', category: 'time' });
    if (totalHours >= 10) trophiesList.push({ id: '10h', name: '10h conduite', icon: 'hourglass', color: '#EA580C', category: 'time' });
    if (totalHours >= 24) trophiesList.push({ id: '24h', name: '24h conduite', icon: 'hourglass', color: '#EA580C', category: 'time' });
    if (totalHours >= 50) trophiesList.push({ id: '50h', name: '50h conduite', icon: 'hourglass-outline', color: '#DC2626', category: 'time' });
    if (totalHours >= 100) trophiesList.push({ id: '100h', name: '100h conduite', icon: 'hourglass-outline', color: '#DC2626', category: 'time' });

    // Trophées de série de jours (couleur rouge/flamme)
    const sortedRides = rides.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    let maxStreak = 0;
    let currentStreak = 1;
    for (let i = 1; i < sortedRides.length; i++) {
      const prevDate = new Date(sortedRides[i - 1].startTime);
      const currDate = new Date(sortedRides[i].startTime);
      const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentStreak++;
      } else {
        maxStreak = Math.max(maxStreak, currentStreak);
        currentStreak = 1;
      }
    }
    maxStreak = Math.max(maxStreak, currentStreak);

    if (maxStreak >= 3) trophiesList.push({ id: 'streak3', name: '3 jours d\'affilée', icon: 'flame', color: '#F97316', category: 'streak' });
    if (maxStreak >= 7) trophiesList.push({ id: 'streak7', name: '1 semaine', icon: 'flame', color: '#F97316', category: 'streak' });
    if (maxStreak >= 14) trophiesList.push({ id: 'streak14', name: '2 semaines', icon: 'flame', color: '#EA580C', category: 'streak' });
    if (maxStreak >= 30) trophiesList.push({ id: 'streak30', name: '1 mois', icon: 'flash', color: '#DC2626', category: 'streak' });
    if (maxStreak >= 60) trophiesList.push({ id: 'streak60', name: '2 mois', icon: 'flash', color: '#DC2626', category: 'streak' });

    // Trier les trophées par catégorie puis par valeur
    trophiesList.sort((a, b) => {
      const categoryOrder = { 'streak': 0, 'rides': 1, 'distance': 2, 'time': 3 };
      const catA = categoryOrder[a.category] || 99;
      const catB = categoryOrder[b.category] || 99;
      if (catA !== catB) return catA - catB;
      return a.id.localeCompare(b.id);
    });

    return trophiesList;
  }, []);

  // Charger les stats de l'utilisateur et les posts
  const loadUserStatsAndRides = useCallback(async () => {
    try {
      if (!user?.id) {
        console.warn('Pas d\'utilisateur connecté');
        return;
      }

      const stats = await RideStorageService.getUserStats(user.id);
      setGlobalStats(stats);

      // Charger les rides directement depuis l'API
      const rides = await RideStorageService.getUserRides(user.id);

      // Trier du plus récent au plus ancien
      const sortedRides = [...rides].sort((a, b) => {
        const getTimestamp = (date) => {
          if (!date) return 0;
          if (typeof date === 'string') return new Date(date).getTime();
          if (typeof date === 'number') return date;
          return 0;
        };
        const dateA = getTimestamp(a.endTime || a.startTime);
        const dateB = getTimestamp(b.endTime || b.startTime);
        return dateB - dateA;
      });
      setUserRides(sortedRides);

      // Charger les posts bookmarkés/aimés
      const allRides = await RideStorageService.getAllRides();
      const bookmarked = allRides.filter(ride =>
        (ride.likes && ride.likes > 0) ||
        (ride.isBookmarked === true) ||
        (ride.bookmarked === true)
      ).sort((a, b) => {
        const getTimestamp = (date) => {
          if (!date) return 0;
          if (typeof date === 'string') return new Date(date).getTime();
          if (typeof date === 'number') return date;
          return 0;
        };
        const dateA = getTimestamp(a.endTime || a.startTime);
        const dateB = getTimestamp(b.endTime || b.startTime);
        return dateB - dateA;
      });
      setBookmarkedRides(bookmarked);
      const distances = computeLast7DaysDistances(rides);
      setRecentDistances(distances);

      // Calculer les trophées
      const calculatedTrophies = calculateTrophies(rides);
      setTrophies(calculatedTrophies);

      // Calculer la série de semaines
      const streak = calculateWeekStreak(rides);
      setWeekStreak(streak);

      // Calculer l'activité de la semaine courante (jours avec trajets)
      const weekDays = calculateWeekActivity(rides);
      setWeekActivity(weekDays);

      // Calculer le total des likes (pour l'instant, on utilise un nombre fictif basé sur les trajets)
      // TODO: Implémenter le système de likes réel quand il sera disponible
      const likesCount = rides.length > 0 ? Math.floor(rides.length * 2.5) : 0;
      setTotalLikes(likesCount);
    } catch (e) {
      console.error('Erreur chargement stats:', e);
    }
  }, [user, calculateWeekStreak, calculateTrophies, calculateWeekActivity, computeLast7DaysDistances]);

  useEffect(() => {
    loadVehicles();
    loadUserStatsAndRides();
  }, [user, loadUserStatsAndRides]);

  // Charger les données de profil depuis AsyncStorage
  useEffect(() => {
    const loadProfileData = async () => {
      try {
        const stored = await AsyncStorage.getItem(profileDataKey);
        if (stored) {
          setProfileData(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Erreur chargement profil:', e);
      }
    };
    loadProfileData();
  }, []);

  // Mettre à jour la photo de profil depuis le contexte auth avec cache local
  useEffect(() => {
    const loadProfilePhoto = async () => {
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
      } else {
        // Essayer de charger depuis le cache même si pas d'URL Supabase
        if (userId) {
          const cachedUri = await getCachedProfilePhoto(userId);
          if (cachedUri && cachedUri !== profilePhotoUri) {
            setProfilePhotoUri(cachedUri);
            lastLoadedAvatarRef.current = null; // Pas d'URL Supabase
          } else if (!cachedUri && profilePhotoUri !== null) {
            setProfilePhotoUri(null);
            lastLoadedAvatarRef.current = null;
          }
        } else if (profilePhotoUri !== null) {
          setProfilePhotoUri(null);
          lastLoadedAvatarRef.current = null;
        }
      }
    };
    loadProfilePhoto();
  }, [profile?.avatar_url, user?.id]); // Utiliser seulement les valeurs nécessaires dans les dépendances

  // Recharger les véhicules et le profil quand on revient sur l'écran
  useFocusEffect(
    useCallback(() => {
      loadVehicles();
      loadUserStatsAndRides();
      // Recharger le profil depuis Supabase
      if (user?.id) {
        refreshProfile();
      }
      // Recharger profileData depuis AsyncStorage
      const loadProfileData = async () => {
        try {
          const stored = await AsyncStorage.getItem(profileDataKey);
          if (stored) {
            setProfileData(JSON.parse(stored));
          }
        } catch (e) {
          console.error('Erreur chargement profil:', e);
        }
      };
      loadProfileData();
    }, [user, refreshProfile, loadUserStatsAndRides])
  );

  // Ajuste le contenu quand le clavier apparaît, sans changer la structure du sheet
  useEffect(() => {
    const onShow = (e) => {
      const height = e?.endCoordinates?.height || 0;
      setKeyboardOffset(height);
    };
    const onHide = () => setKeyboardOffset(0);

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    return () => {
      subShow?.remove?.();
      subHide?.remove?.();
    };
  }, []);

  // Focus automatique sur le champ nom quand on ouvre en renommage
  useEffect(() => {
    if (isSheetVisible && focusNameOnOpen) {
      const t = setTimeout(() => {
        if (nameInputRef.current && nameInputRef.current.focus) {
          nameInputRef.current.focus();
        }
        setFocusNameOnOpen(false);
      }, 150);
      return () => clearTimeout(t);
    }
  }, [isSheetVisible, focusNameOnOpen]);

  // Cette fonction n'est plus nécessaire car on utilise Supabase directement

  const beginAddVehicle = () => {
    if (!isPremium && vehicles.length >= 1) {
      navigation?.navigate('Paywall');
      return;
    }
    setEditingVehicle(null);
    setNewVehicleName('');
    setNewVehicleType('car');
    setSetAsDefaultOnSave(false);
    setNewVehicleDescription('');
    setNewVehiclePhotoUri(null);
    handlePresentModalPress();
  };

  const beginEditVehicle = (vehicle) => {
    setEditingVehicle(vehicle);
    setNewVehicleName(vehicle.name);
    setNewVehicleType(vehicle.type || 'car');
    setSetAsDefaultOnSave(String(defaultVehicleId) === String(vehicle.id));
    setNewVehicleDescription(vehicle.description || '');
    setNewVehiclePhotoUri(vehicle.photoUri || vehicle.photos?.[0] || null);
    handlePresentModalPress();
  };

  const beginRenameVehicle = (vehicle) => {
    setFocusNameOnOpen(true);
    beginEditVehicle(vehicle);
  };

  const beginRetypeVehicle = (vehicle) => {
    setFocusNameOnOpen(false);
    beginEditVehicle(vehicle);
  };

  // removed openVehicleActions / closeVehicleActions helpers

  const handleSaveVehicle = async () => {
    if (isSavingVehicle) return;
    const name = (newVehicleName || '').trim();
    if (!name) {
      Alert.alert('Erreur', 'Donnez un nom au véhicule');
      return;
    }

    if (!user?.id) {
      Alert.alert('Erreur', 'Vous devez être connecté');
      return;
    }

    // éviter les doublons de noms (tolérer si on édite et garde le même id)
    const duplicate = vehicles.find(v => v.name.toLowerCase() === name.toLowerCase() && (!editingVehicle || v.id !== editingVehicle.id));
    if (duplicate) {
      Alert.alert('Doublon', 'Un véhicule avec ce nom existe déjà');
      return;
    }

    try {
      setIsSavingVehicle(true);
      let photoUrl = newVehiclePhotoUri;

      if (editingVehicle) {
        // Modifier un véhicule existant

        // Si une nouvelle photo a été sélectionnée et qu'elle est locale, l'uploader
        if (newVehiclePhotoUri && !newVehiclePhotoUri.startsWith('http')) {
          console.log('📤 Upload photo véhicule vers Supabase...');
          const { url, error } = await vehiclesService.uploadVehiclePhoto(
            user.id,
            editingVehicle.id,
            newVehiclePhotoUri
          );

          if (error) {
            console.error('Erreur upload photo:', error);
            Alert.alert('Erreur', 'Impossible d\'uploader la photo');
            return;
          }

          photoUrl = url;
          console.log('✅ Photo uploadée:', url);
        }

        const updatePayload = {
          name,
          type: newVehicleType,
          description: newVehicleDescription,
          photoUrl,
        };
        if (newVehiclePhotoUri) {
          updatePayload.photoUri = newVehiclePhotoUri;
        }
        await updateVehicle(editingVehicle.id, updatePayload, user.id);

        if (setAsDefaultOnSave) {
          await setDefaultVehicleIdService(editingVehicle.id, user.id);
          setDefaultVehicleId(String(editingVehicle.id));
        }
      } else {
        // Créer un nouveau véhicule
        const newVehicle = await saveVehicle({
          name,
          type: newVehicleType,
          description: newVehicleDescription,
          photoUrl: null, // On met null temporairement
          isDefault: setAsDefaultOnSave || vehicles.length === 0,
          photoUri: newVehiclePhotoUri || null,
        }, user.id);

        // Upload de la photo si présente
        if (newVehiclePhotoUri) {
          console.log('📤 Upload photo véhicule vers Supabase...');
          const { url, error } = await vehiclesService.uploadVehiclePhoto(
            user.id,
            newVehicle.id,
            newVehiclePhotoUri
          );

          if (error) {
            console.warn('Erreur upload photo (véhicule créé sans photo):', error);
          } else {
            photoUrl = url;
            console.log('✅ Photo uploadée:', url);

            // Mettre à jour le véhicule avec l'URL de la photo
            await updateVehicle(newVehicle.id, { photoUrl: url, photoUri: newVehiclePhotoUri }, user.id);
          }
        }

        if (setAsDefaultOnSave || vehicles.length === 0) {
          setDefaultVehicleId(String(newVehicle.id));
        }
      }

      // Recharger la liste
      await loadVehicles();

      // Fermer le modal
      setEditingVehicle(null);
      setNewVehicleName('');
      setNewVehicleType('car');
      setSetAsDefaultOnSave(false);
      setNewVehicleDescription('');
      setNewVehiclePhotoUri(null);
      handleDismissModalPress();
    } catch (error) {
      console.error('Erreur sauvegarde véhicule:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder le véhicule');
    } finally {
      setIsSavingVehicle(false);
    }
  };

  const removeVehicle = async (id) => {
    if (!user?.id) {
      Alert.alert('Erreur', 'Vous devez être connecté');
      return;
    }

    try {
      await deleteVehicleService(id, user.id);

      if (String(defaultVehicleId) === String(id)) {
        setDefaultVehicleId(null);
      }

      // Recharger la liste
      await loadVehicles();
      // Fermer le sheet après suppression
      handleDismissModalPress();
    } catch (error) {
      console.error('Erreur suppression véhicule:', error);
      Alert.alert('Erreur', 'Impossible de supprimer le véhicule');
    }
  };

  const setAsDefault = async (id) => {
    if (!user?.id) {
      Alert.alert('Erreur', 'Vous devez être connecté');
      return;
    }

    try {
      await setDefaultVehicleIdService(id, user.id);
      setDefaultVehicleId(String(id));
      Alert.alert('Défini', 'Véhicule défini par défaut');
    } catch (e) {
      console.error('Erreur définir véhicule par défaut:', e);
      Alert.alert('Erreur', 'Impossible de définir le véhicule par défaut');
    }
  };

  const confirmRemoveVehicle = (id) => {
    const vehicle = vehicles.find(v => String(v.id) === String(id));
    Alert.alert(
      'Supprimer ce véhicule ?',
      vehicle ? `"${vehicle.name}" sera supprimé définitivement.` : 'Ce véhicule sera supprimé définitivement.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => removeVehicle(id) },
      ]
    );
  };

  const pickProfilePhoto = async () => {
    try {
      if (!user?.id) {
        Alert.alert('Erreur', 'Vous devez être connecté');
        return;
      }

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Autorisez l\'accès aux photos pour définir votre avatar.');
        return;
      }

      // Sélectionner une photo avec editing pour recadrer
      const mediaTypes = (ImagePicker.MediaType && ImagePicker.MediaType.Images)
        ? [ImagePicker.MediaType.Images]
        : ImagePicker.MediaTypeOptions?.Images || 'images';

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes,
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1], // Format carré pour l'avatar
        presentationStyle: 'pageSheet'
      });

      const canceled = (result && (result.canceled ?? result.cancelled)) || false;
      const asset = (result && result.assets && result.assets[0]) || result;

      if (!canceled && asset?.uri) {
        const uri = asset.uri;

        // Afficher un indicateur de chargement
        Alert.alert('Upload en cours', 'Veuillez patienter...');

        console.log('📤 Upload avatar vers Supabase...');

        // Upload vers Supabase Storage
        const { url, error } = await authService.uploadAvatar(user.id, uri);

        if (error) {
          console.error('Erreur upload avatar:', error);
          Alert.alert('Erreur', 'Impossible d\'uploader la photo');
          return;
        }

        console.log('✅ Avatar uploadé:', url);

        // Mettre en cache localement
        if (user?.id) {
          const cachedUri = await cacheProfilePhoto(url, user.id);
          setProfilePhotoUri(cachedUri || url);
        } else {
          setProfilePhotoUri(url);
        }

        // Recharger le profil pour avoir la nouvelle URL
        await refreshProfile();

        Alert.alert('Succès', 'Photo de profil mise à jour !');
      }
    } catch (e) {
      console.error('Erreur sélection photo profil:', e);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la sélection de la photo');
    }
  };

  const pickVehiclePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Autorisez l\'accès aux photos.');
        return;
      }
      // Utiliser un ratio carré pour que le cadre de selection corresponde exactement aux cartes
      // Les cartes font 180px × 140px, mais on veut une forme carrée pour le cadrage
      const aspectRatio = [1, 1];

      // Use MediaType if available, otherwise fall back to MediaTypeOptions (deprecated but still works)
      const mediaTypes = (ImagePicker.MediaType && ImagePicker.MediaType.Images)
        ? [ImagePicker.MediaType.Images]
        : ImagePicker.MediaTypeOptions?.Images || 'images';
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes,
        quality: 0.9,
        allowsEditing: true,
        aspect: aspectRatio,
        presentationStyle: 'pageSheet'
      });
      const canceled = (result && (result.canceled ?? result.cancelled)) || false;
      const asset = (result && result.assets && result.assets[0]) || result;
      if (!canceled) {
        const uri = asset?.uri;
        if (uri) {
          // Copier l'image de manière permanente
          const permanentUri = await copyImageToPermanentStorage(uri);
          setNewVehiclePhotoUri(permanentUri);
        }
      }
    } catch (e) {
      console.error('Erreur sélection photo véhicule:', e);
    }
  };

  const openEditProfile = () => {
    setEditedProfile({
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      username: profileData.username,
      bio: profileData.bio,
    });
    setIsProfileSheetVisible(true);
    Animated.timing(profileSheetAnim, { toValue: 1, duration: 250, useNativeDriver: Platform.OS !== 'web' }).start();
  };

  const closeEditProfile = () => {
    Animated.timing(profileSheetAnim, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start(() => {
      setIsProfileSheetVisible(false);
    });
  };

  const saveProfile = async () => {
    try {
      const updatedProfile = {
        firstName: editedProfile.firstName.trim(),
        lastName: editedProfile.lastName.trim(),
        username: editedProfile.username.trim(),
        bio: editedProfile.bio.trim(),
      };

      await AsyncStorage.setItem(profileDataKey, JSON.stringify(updatedProfile));
      setProfileData(updatedProfile);
      closeEditProfile();
      Alert.alert('Succès', 'Profil mis à jour !');
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de sauvegarder le profil');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header fixe */}
      <View style={styles.fixedHeader}>
        {/* Avatar avec badge + et nom/username */}
        <View style={styles.profileHeaderSection}>
          {/* Contenu centré : Avatar + Nom + Username */}
          <View style={styles.profileCenterContent}>
            {/* Avatar avec badge + */}
            <TouchableOpacity onPress={pickProfilePhoto} activeOpacity={0.8}>
              <View style={styles.avatarContainer}>
                <View style={styles.avatarCircle}>
                  {profilePhotoUri ? (
                    <Image source={{ uri: profilePhotoUri }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarInitialContainer}>
                      <Text style={styles.avatarInitial}>R</Text>
                    </View>
                  )}
                </View>
                <View style={styles.avatarPlusBadge}>
                  <Ionicons name="add" size={14} color="#FFFFFF" />
                </View>
              </View>
            </TouchableOpacity>

            {/* Nom et username */}
            <View style={styles.profileNameSection}>
              <Text style={styles.profileName}>
                {profile?.first_name || profile?.last_name
                  ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
                  : 'Revly'}
              </Text>
              <Text style={styles.profileUsername}>
                @{profile?.username || 'revly_drive'}
              </Text>
            </View>
          </View>

          {/* Boutons à droite : Edition + Réglages */}
          <View style={styles.headerButtonsRight}>
            <TouchableOpacity
              style={styles.editHeaderButtonRight}
              onPress={() => navigation?.navigate('EditProfile')}
            >
              <View style={styles.editHeaderButtonOval}>
                <Ionicons name="pencil" size={16} color="#111827" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsButtonInline}
              onPress={() => navigation?.navigate('Settings')}
            >
              <View style={styles.settingsButtonOval}>
                <Ionicons name="settings-outline" size={16} color="#111827" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Statistiques principales */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{globalStats.totalRides || 0}</Text>
            <Text style={styles.statLabel}>Trajets</Text>
          </View>
          <View style={styles.statSeparator} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{followStats.followersCount}</Text>
            <Text style={styles.statLabel}>Abonnés</Text>
          </View>
          <View style={styles.statSeparator} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{followStats.followingCount}</Text>
            <Text style={styles.statLabel}>Suivis</Text>
          </View>
        </View>

        {/* Bio */}
        <View style={styles.profileBioContainer}>
          {(profile?.bio && profile.bio.trim() !== '') || (profileData?.bio && profileData.bio.trim() !== '') ? (
            <Text style={styles.profileBio}>{profile?.bio || profileData?.bio || ''}</Text>
          ) : (
            <Text style={styles.profileBioPlaceholder}>Bio...</Text>
          )}
        </View>
      </View>

      {/* Onglets de navigation Instagram-style */}
      <View style={styles.tabsRow}>
        <TouchableOpacity style={styles.tabItem} onPress={() => goToPage(0)}>
          <Ionicons
            name={currentPage === 0 ? 'grid' : 'grid-outline'}
            size={24}
            color={currentPage === 0 ? '#1F2937' : '#9CA3AF'}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => goToPage(1)}>
          <Ionicons
            name={currentPage === 1 ? 'car' : 'car-outline'}
            size={24}
            color={currentPage === 1 ? '#1F2937' : '#9CA3AF'}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => goToPage(2)}>
          <Ionicons
            name={currentPage === 2 ? 'stats-chart' : 'stats-chart-outline'}
            size={24}
            color={currentPage === 2 ? '#1F2937' : '#9CA3AF'}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => goToPage(3)}>
          <Ionicons
            name={currentPage === 3 ? 'bookmark' : 'bookmark-outline'}
            size={24}
            color={currentPage === 3 ? '#1F2937' : '#9CA3AF'}
          />
        </TouchableOpacity>
        <Animated.View
          style={[
            styles.tabIndicator,
            {
              transform: [{ translateX: indicatorTranslateX }],
            },
          ]}
        />
      </View>

      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={0}
        onPageSelected={onPageSelected}
      >
        {/* Page 1: Posts */}
        <ScrollView key="0" showsVerticalScrollIndicator={false} style={styles.contentScroll}>
          <View style={styles.postsContent}>
            {userRides && userRides.length > 0 ? (
              <View style={styles.postsGrid}>
                {userRides.map((ride) => (
                  <TouchableOpacity
                    key={ride.id}
                    style={styles.postCard}
                    onPress={() => navigation?.navigate('RunDetail', { ride })}
                    activeOpacity={0.85}
                  >
                    <View style={styles.postCardImageContainer}>
                      {ride.photos && ride.photos.length > 0 ? (
                        <Image
                          source={{ uri: typeof ride.photos[0] === 'string' ? ride.photos[0] : (ride.photos[0]?.uri || ride.photos[0]) }}
                          style={styles.postCardImage}
                        />
                      ) : ride.routeCoordinates && ride.routeCoordinates.length > 0 ? (
                        <MiniRoutePreview
                          coordinates={ride.routeCoordinates}
                          style={styles.postCardMap}
                        />
                      ) : (
                        <View style={styles.postCardPlaceholder}>
                          <Ionicons name="image-outline" size={24} color="#9CA3AF" />
                        </View>
                      )}
                      {/* Overlay avec infos */}
                      {(ride.distance || ride.duration) && (
                        <View style={styles.postCardInfoOverlay}>
                          <View style={styles.postCardInfoItem}>
                            {ride.distance && (
                              <>
                                <Ionicons name="location" size={10} color="#FFFFFF" />
                                <Text style={styles.postCardInfoText}>
                                  {formatDistanceKm(ride.distance)}
                                </Text>
                              </>
                            )}
                            {ride.duration && (
                              <>
                                <Ionicons name="time-outline" size={10} color="#FFFFFF" />
                                <Text style={styles.postCardInfoText}>
                                  {formatDurationLong(ride.duration)}
                                </Text>
                              </>
                            )}
                          </View>
                        </View>
                      )}
                      {ride.likes && ride.likes > 0 && (
                        <View style={styles.postCardLikeBadge}>
                          <Ionicons name="heart" size={12} color="#FFFFFF" />
                          <Text style={styles.postCardLikeCount}>{ride.likes}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyPostsContent}>
                <Text style={styles.emptyStateText}>Aucun post</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Page 2: Véhicules */}
        <ScrollView key="1" showsVerticalScrollIndicator={false} style={styles.contentScroll}>
          <View style={styles.vehiclesGrid}>
            {vehicles.map(v => (
              <TouchableOpacity key={v.id} style={styles.vehicleCard} onPress={() => beginEditVehicle(v)} activeOpacity={0.85}>
                <View style={styles.vehicleCardImageContainer}>
                  {v.photoUri || v.photos?.[0] ? (
                    <Image source={{ uri: v.photoUri || v.photos[0] }} style={styles.vehicleCardImage} />
                  ) : (
                    <View style={styles.vehicleCardIconContainer}>
                      <Ionicons
                        name={v.type === 'car' ? 'car' : v.type === 'bike' ? 'bicycle' : v.type === 'scooter' ? 'flash' : 'speedometer'}
                        size={32}
                        color="#6B7280"
                      />
                    </View>
                  )}
                  {String(defaultVehicleId) === String(v.id) && (
                    <View style={styles.vehicleCardBadge}>
                      <Ionicons name="star" size={12} color="#F59E0B" />
                    </View>
                  )}
                </View>
                <View style={styles.vehicleCardNameContainer}>
                  <Text style={styles.vehicleCardName}>{v.name}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.addVehicleCard} onPress={beginAddVehicle} activeOpacity={0.85}>
              <View style={styles.addVehicleCardContent}>
                <View style={styles.addVehicleIconCircle}>
                  <Ionicons name="add" size={28} color="#1F2937" />
                </View>
                <Text style={styles.addVehicleCardTitle}>Ajouter un véhicule</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Page 3: Stats */}
        <ScrollView key="2" showsVerticalScrollIndicator={false} style={styles.contentScroll}>
          <View style={styles.statsTabContent}>
            {/* Section Flammes - Activité de la semaine */}
            <View style={styles.streakSection}>
              <View style={styles.streakHeader}>
                <View style={styles.streakHeaderContent}>
                  <View style={styles.streakIconWrapper}>
                    <Ionicons name="flame" size={28} color="#F97316" />
                  </View>
                  <View style={styles.streakHeaderText}>
                    <Text style={styles.streakTitle}>Flammes de la semaine</Text>
                    <Text style={styles.streakSubtitle}>{weekStreak} semaines consécutives</Text>
                  </View>
                </View>
                {weekStreak > 0 && (
                  <View style={styles.streakBadge}>
                    <Ionicons name="flame" size={14} color="#FFFFFF" />
                    <Text style={styles.streakBadgeText}>{weekStreak}</Text>
                  </View>
                )}
              </View>

              <View style={styles.weekDaysContainer}>
                {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((dayLabel, index) => {
                  const dayOfWeek = index === 0 ? 0 : index; // D=0, L=1, M=2, M=3, J=4, V=5, S=6
                  const hasActivity = weekActivity[dayOfWeek] || false;
                  const activeDaysCount = Object.values(weekActivity).filter(v => v).length;

                  return (
                    <View key={index} style={styles.weekDayItem}>
                      <View style={styles.weekDayBoxWrapper}>
                        <View
                          style={[
                            styles.weekDayBox,
                            hasActivity && styles.weekDayBoxActive,
                            !hasActivity && styles.weekDayBoxInactive
                          ]}
                        >
                          {hasActivity ? (
                            <View style={styles.weekDayFlameContainer}>
                              <Ionicons name="flame" size={18} color="#FFFFFF" />
                            </View>
                          ) : (
                            <View style={styles.weekDayEmptyContainer}>
                              <View style={styles.weekDayEmptyDot} />
                            </View>
                          )}
                        </View>
                        {hasActivity && (
                          <View style={styles.weekDayGlow} />
                        )}
                      </View>
                      <Text style={[
                        styles.weekDayLabel,
                        hasActivity && styles.weekDayLabelActive
                      ]}>
                        {dayLabel}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.weekStats}>
                <View style={styles.weekStatItem}>
                  <Text style={styles.weekStatValue}>
                    {Object.values(weekActivity).filter(v => v).length}
                  </Text>
                  <Text style={styles.weekStatLabel}>jours actifs</Text>
                </View>
                <View style={styles.weekStatDivider} />
                <View style={styles.weekStatItem}>
                  <Text style={styles.weekStatValue}>
                    {7 - Object.values(weekActivity).filter(v => v).length}
                  </Text>
                  <Text style={styles.weekStatLabel}>jours restants</Text>
                </View>
              </View>
            </View>

            <View style={styles.statsSummarySection}>
              <Text style={styles.statsSummaryTitle}>Statistiques</Text>
              {statsSummary.hasStats ? (
                <>
                  <View style={styles.statsSummaryPairs}>
                    {[0, 1].map((rowIndex) => {
                      const leftItem = statsSummaryItems[rowIndex * 2];
                      const rightItem = statsSummaryItems[rowIndex * 2 + 1];

                      return (
                        <View key={rowIndex} style={styles.statsSummaryRow}>
                          <View style={styles.statsSummaryCell}>
                            <Text style={styles.statsSummaryValue}>{leftItem.value}</Text>
                            <Text style={styles.statsSummaryLabel}>{leftItem.label}</Text>
                          </View>
                          <View style={styles.statsSummarySeparator} />
                          <View style={styles.statsSummaryCell}>
                            <Text style={styles.statsSummaryValue}>{rightItem.value}</Text>
                            <Text style={styles.statsSummaryLabel}>{rightItem.label}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                  <View style={styles.statsSummaryFootnoteContainer}>
                    <Text style={styles.statsSummaryFootnote}>Distances en km · vitesse en km/h</Text>
                    <Text style={styles.statsSummaryFootnote}>
                      {statsSummary.rawTotalRides === 1
                        ? 'Basé sur 1 trajet enregistré'
                        : `Basé sur ${statsSummary.totalRidesLabel} trajets enregistrés`}
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.statsSummaryEmpty}>
                  <Text style={styles.statsSummaryEmptyText}>
                    Enregistre ton premier trajet pour voir tes stats.
                  </Text>
                </View>
              )}
            </View>

            {/* Graphique d'activité */}
            {recentDistanceStats.values.length > 0 && (
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <View>
                    <Text style={styles.chartTitle}>Activité des 7 derniers jours (km)</Text>
                    <Text style={styles.chartSubtitle}>
                      {formatKmFromValue(recentDistanceStats.totalKm)} kilomètres parcourus
                    </Text>
                  </View>
                </View>

                <View style={styles.barChartContainer}>
                  {(() => {
                    const values = recentDistanceStats.values;
                    const max = Math.max(recentDistanceStats.maxKm, 1);
                    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
                    const today = new Date();

                    return values.map((distanceKm, i) => {
                      const daysAgo = values.length - 1 - i;
                      const date = new Date(today);
                      date.setDate(today.getDate() - daysAgo);
                      const dayName = dayNames[date.getDay()];
                      const isToday = daysAgo === 0;
                      const barHeight = Math.max(16, (distanceKm / max) * 140);

                      return (
                        <View key={i} style={styles.barWrapper}>
                          <View
                            style={[
                              styles.barChartBar,
                              isToday && styles.barChartBarToday,
                              { height: barHeight },
                              distanceKm === 0 && styles.barChartBarEmpty
                            ]}
                          >
                            {distanceKm > 0 && (
                              <View style={[styles.barChartBarFill, { height: '100%' }]} />
                            )}
                          </View>
                          <Text style={[styles.barChartLabel, isToday && styles.barChartLabelToday]}>
                            {dayName}
                          </Text>
                          {distanceKm > 0 && (
                            <Text style={[styles.barValueText, isToday && styles.barValueTextToday]}>
                              {formatKmFromValue(distanceKm)}
                            </Text>
                          )}
                          {distanceKm === 0 && (
                            <Text style={styles.barValueEmpty}>—</Text>
                          )}
                        </View>
                      );
                    });
                  })()}
                </View>

                <Text style={styles.chartLegend}>Distances exprimées en kilomètres</Text>
              </View>
            )}

            <View style={styles.trophiesSection}>
              <View style={styles.trophiesHeader}>
                <Text style={styles.trophiesSectionTitle}>Badges</Text>
              </View>
              <View style={[styles.trophiesGrid, styles.badgesGridFourColumn]}>
                {Object.entries(achievementBadgeImages).map(([id, data]) => (
                  <View key={id} style={styles.badgeSlot}>
                    <Image source={data.image} style={styles.trophyBadgeImage} resizeMode="contain" />
                    {data.label ? (
                      <Text style={styles.badgeLabel} numberOfLines={1}>
                        {data.label}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Page 4: Bookmarks (Posts aimés/markés) */}
        <ScrollView key="3" showsVerticalScrollIndicator={false} style={styles.contentScroll}>
          <View style={styles.postsContent}>
            {bookmarkedRides && bookmarkedRides.length > 0 ? (
              <View style={styles.postsGrid}>
                {bookmarkedRides.map((ride) => (
                  <TouchableOpacity
                    key={ride.id}
                    style={styles.postCard}
                    onPress={() => navigation?.navigate('RunDetail', { ride })}
                    activeOpacity={0.85}
                  >
                    <View style={styles.postCardImageContainer}>
                      {ride.photos && ride.photos.length > 0 ? (
                        <Image
                          source={{ uri: typeof ride.photos[0] === 'string' ? ride.photos[0] : (ride.photos[0]?.uri || ride.photos[0]) }}
                          style={styles.postCardImage}
                        />
                      ) : ride.routeCoordinates && ride.routeCoordinates.length > 0 ? (
                        <MiniRoutePreview
                          coordinates={ride.routeCoordinates}
                          style={styles.postCardMap}
                        />
                      ) : (
                        <View style={styles.postCardPlaceholder}>
                          <Ionicons name="image-outline" size={24} color="#9CA3AF" />
                        </View>
                      )}
                      {/* Overlay avec infos */}
                      {(ride.distance || ride.duration) && (
                        <View style={styles.postCardInfoOverlay}>
                          <View style={styles.postCardInfoItem}>
                            {ride.distance && (
                              <>
                                <Ionicons name="location" size={10} color="#FFFFFF" />
                                <Text style={styles.postCardInfoText}>
                                  {formatDistanceKm(ride.distance)}
                                </Text>
                              </>
                            )}
                            {ride.distance && ride.duration && (
                              <Text style={styles.postCardInfoSeparator}>•</Text>
                            )}
                            {ride.duration && (
                              <>
                                <Ionicons name="time-outline" size={10} color="#FFFFFF" />
                                <Text style={styles.postCardInfoText}>
                                  {formatDurationLong(ride.duration)}
                                </Text>
                              </>
                            )}
                          </View>
                        </View>
                      )}
                      {ride.likes && ride.likes > 0 && (
                        <View style={styles.postCardLikeBadge}>
                          <Ionicons name="heart" size={12} color="#FFFFFF" />
                          <Text style={styles.postCardLikeCount}>{ride.likes}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyPostsContent}>
                <Text style={styles.emptyStateText}>Aucun post aimé</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </PagerView>

      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        enableOverDrag={false}
        enableDynamicSizing={false}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
        )}
        onDismiss={() => setIsSheetVisible(false)}
      >
        <View style={styles.sheetHeader}>
          <Text style={styles.addModalTitle}>{editingVehicle ? 'Modifier le véhicule' : 'Ajouter un véhicule'}</Text>
          <TouchableOpacity onPress={handleDismissModalPress} style={styles.closeButtonIcon}>
            <Ionicons name="close" size={24} color="#1F2937" />
          </TouchableOpacity>
        </View>
        <BottomSheetScrollView
          style={styles.modalScrollContent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 + keyboardOffset }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.addModalCard}>
            <TouchableOpacity onPress={pickVehiclePhoto} style={styles.photoPlaceholderSheet} activeOpacity={0.8}>
              {newVehiclePhotoUri ? (
                <>
                  <Image source={{ uri: newVehiclePhotoUri }} style={styles.vehiclePreviewSheet} />
                  <View style={styles.photoOverlay}>
                    <View style={styles.photoOverlayIconCircle}>
                      <Ionicons name="camera" size={20} color="#FFFFFF" />
                    </View>
                    <Text style={styles.photoOverlayText}>Modifier la photo</Text>
                  </View>
                </>
              ) : (
                <View style={styles.photoPlaceholderInner}>
                  <View style={styles.photoPlaceholderIconCircle}>
                    <Ionicons name="camera" size={32} color="#1F2937" />
                  </View>
                  <Text style={styles.photoButtonText}>Ajouter une photo</Text>
                  <Text style={styles.photoButtonSubtext}>Appuyez pour choisir une image</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nom du véhicule</Text>
              <TextInput
                style={styles.addModalInput}
                placeholder="Ex: Ma BMW Série 3"
                placeholderTextColor="#9CA3AF"
                value={newVehicleName}
                onChangeText={setNewVehicleName}
                ref={nameInputRef}
                autoCapitalize="words"
                autoCorrect
                returnKeyType="next"
                blurOnSubmit={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description (optionnel)</Text>
              <TextInput
                style={[styles.addModalInput, styles.textAreaInput]}
                placeholder="Décrivez votre véhicule..."
                placeholderTextColor="#9CA3AF"
                value={newVehicleDescription}
                onChangeText={setNewVehicleDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                returnKeyType="done"
                blurOnSubmit
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Type de véhicule</Text>
              <View style={styles.addModalTypeRow}>
                <TouchableOpacity
                  onPress={() => setNewVehicleType('car')}
                  style={[styles.typeOptionCard, newVehicleType === 'car' && styles.typeOptionCardActive]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="car-outline" size={20} color="#1F2937" />
                  <Text style={styles.typeOptionText}>Voiture</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setNewVehicleType('bike')}
                  style={[styles.typeOptionCard, newVehicleType === 'bike' && styles.typeOptionCardActive]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="bicycle-outline" size={20} color="#1F2937" />
                  <Text style={styles.typeOptionText}>Vélo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setNewVehicleType('scooter')}
                  style={[styles.typeOptionCard, newVehicleType === 'scooter' && styles.typeOptionCardActive]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="flash-outline" size={20} color="#1F2937" />
                  <Text style={styles.typeOptionText}>Scooter</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setNewVehicleType('motorcycle')}
                  style={[styles.typeOptionCard, newVehicleType === 'motorcycle' && styles.typeOptionCardActive]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="speedometer-outline" size={20} color="#1F2937" />
                  <Text style={styles.typeOptionText}>Moto</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setSetAsDefaultOnSave(prev => !prev)}
              style={styles.defaultOptionCard}
            >
              <View style={styles.defaultOptionCheckbox}>
                <Ionicons
                  name={setAsDefaultOnSave ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={setAsDefaultOnSave ? '#16A34A' : '#9CA3AF'}
                />
              </View>
              <View style={styles.defaultOptionTextContainer}>
                <Text style={styles.defaultRowText}>Définir comme véhicule par défaut</Text>
                <Text style={styles.defaultRowSubtext}>Utilisé automatiquement pour les nouveaux trajets</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.addModalActions}>
              {editingVehicle && (
                <TouchableOpacity
                  onPress={() => confirmRemoveVehicle(editingVehicle.id)}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.deleteButtonText}>Supprimer</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleSaveVehicle}
                style={[styles.saveButton, (!newVehicleName.trim() || isSavingVehicle) && styles.saveButtonDisabled]}
                disabled={!newVehicleName.trim() || isSavingVehicle}
                activeOpacity={0.8}
              >
                {isSavingVehicle ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>Enregistrement...</Text>
                  </View>
                ) : (
                  <Text style={styles.saveButtonText}>{editingVehicle ? 'Enregistrer' : 'Ajouter le véhicule'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  fixedHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerButtonsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editHeaderButtonRight: {
    justifyContent: 'center',
  },
  settingsButtonInline: {
    justifyContent: 'center',
  },
  settingsButtonOval: {
    width: 64,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editHeaderButtonOval: {
    width: 64,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileHeaderSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  profileCenterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
  },
  pagerView: {
    flex: 1,
  },
  contentScroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  profileHeader: {
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(31,41,55,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarInitialContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 36, color: '#111827',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18, fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  profileUsername: {
    fontSize: 14,
    color: '#6B7280',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarPlusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#60A5FA',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileNameSection: {
    marginLeft: 12,
    alignItems: 'flex-start',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statSeparator: {
    width: 1,
    height: 20,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  statNumber: {
    fontSize: 18, fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  profileBioContainer: {
    marginTop: 8,
  },
  profileBio: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  profileBioPlaceholder: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  editProfileButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  editProfileButtonText: {
    fontSize: 16, fontWeight: '400',
    color: '#111827',
  },
  settingsList: {
    gap: 12,
    marginBottom: 24,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30, 58, 138, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16, fontWeight: '400',
    color: '#2c3e50',
    flex: 1,
  },
  versionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  versionText: {
    fontSize: 14,
    color: '#888',
    marginLeft: 8,
  },
  // Onglets Instagram
  tabsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabItemActive: {
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 40,
    height: 1.5,
    backgroundColor: '#1F2937',
    borderRadius: 0.75,
  },
  // Grille de trajets
  ridesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  rideThumbnail: {
    width: '33.33%',
    aspectRatio: 1,
    borderWidth: 0.5,
    borderColor: '#FFFFFF',
  },
  rideThumbnailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  rideThumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsTabContent: {
    padding: 16,
    gap: 16,
  },
  statsOverviewGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  statOverviewCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statOverviewNumber: {
    fontSize: 24, fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statOverviewLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  streakSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  streakHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  streakHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  streakIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakHeaderText: {
    flex: 1,
  },
  streakTitle: {
    fontSize: 18, fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  streakSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F97316',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  streakBadgeText: {
    fontSize: 16, fontWeight: '700',
    color: '#FFFFFF',
  },
  weekDaysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 0,
  },
  weekDayItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  weekDayBoxWrapper: {
    position: 'relative',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekDayBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'relative',
    overflow: 'hidden',
  },
  weekDayBoxActive: {
    backgroundColor: '#F97316',
    borderColor: '#EA580C',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  weekDayBoxInactive: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  weekDayFlameContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  weekDayEmptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  weekDayEmptyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  weekDayGlow: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    top: -4,
    left: -4,
    zIndex: -1,
  },
  weekDayLabel: {
    fontSize: 12, fontWeight: '400',
    color: '#6B7280',
  },
  weekDayLabelActive: {
    color: '#F97316',
  },
  weekStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  weekStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  weekStatDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  weekStatValue: {
    fontSize: 20, color: '#111827',
  },
  weekStatLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  postsContent: {
    flex: 1,
    padding: 0,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 0,
  },
  postCard: {
    width: '33.33%',
    aspectRatio: 1,
    padding: 0,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  postCardImageContainer: {
    flex: 1,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  postCardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  postCardMap: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  postCardPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  postCardLikeBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  postCardLikeCount: {
    fontSize: 12, fontWeight: '400',
    color: '#FFFFFF',
  },
  postCardInfoOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
  },
  postCardInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
  },
  postCardInfoText: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  postCardInfoSeparator: {
    color: '#FFFFFF',
    fontSize: 10,
    opacity: 0.5,
    marginHorizontal: 2,
  },
  emptyPostsContent: {
    padding: 32,
    alignItems: 'center',
  },
  bookmarksContent: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  vehiclesSection: {
    marginBottom: 24,
  },
  vehiclesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  vehiclesTitle: {
    fontSize: 18, fontWeight: '700',
    color: '#111827',
  },
  addVehicleButton: {
    backgroundColor: '#1F2937',
    padding: 8,
    borderRadius: 8,
  },
  emptyVehicles: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6E9EE',
  },
  emptyVehiclesText: {
    fontSize: 16, fontWeight: '400',
    color: '#6B7280',
  },
  emptyVehiclesSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
  },
  vehicleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E6E9EE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  vehicleMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  vehicleThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  iconCircleSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30,58,138,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vehicleName: {
    fontSize: 16, fontWeight: '400',
    flex: 1,
    color: '#0F172A',
  },
  vehicleSubtitle: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
    marginLeft: 8,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  defaultBadgeText: {
    fontSize: 12, fontWeight: '400',
    marginLeft: 4,
    color: '#92400E',
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginLeft: 8,
  },
  vehiclesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 16,
  },
  vehicleCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
    transform: [{ scale: 1 }],
  },
  vehicleCardImageContainer: {
    width: '100%',
    aspectRatio: 1.35,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
  },
  vehicleCardScrollView: {
    width: '100%',
    height: 140,
  },
  vehicleCardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    backgroundColor: '#000',
  },
  vehicleCardGradientOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  vehicleCardShine: {
    position: 'absolute',
    top: 0,
    left: '-100%',
    width: '300%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    transform: [{ skewX: '-15deg' }],
    opacity: 0.4,
  },
  vehicleCardIconContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(31,41,55,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleCardNameContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  vehicleCardName: {
    fontSize: 15, color: '#111827',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  vehicleCardBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F9FAFB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  addVehicleCard: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    minHeight: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addVehicleCardContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  addVehicleIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  addVehicleCardTitle: {
    fontSize: 15, color: '#111827',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyVehiclesInGrid: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 32,
  },
  bottomSheetBackground: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  bottomSheetIndicator: {
    backgroundColor: '#DEE2E7',
    width: 40,
  },
  modalScrollContent: {
    flex: 1,
  },
  addModalCard: {
    padding: 20,
    paddingBottom: 40,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  addModalTitle: {
    fontSize: 20, color: '#111827',
  },
  closeButtonIcon: {
    padding: 4,
  },
  addModalInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  textAreaInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  addModalTypeRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  typeOptionCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  typeOptionCardActive: {
    borderColor: '#1F2937',
    backgroundColor: '#F9FAFB',
  },
  typeOptionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeOptionIconActive: {
    backgroundColor: '#1F2937',
  },
  typeOptionText: {
    fontSize: 16, fontWeight: '400',
    color: '#374151',
  },
  typeOptionTextActive: {
    color: '#111827',
  },
  addModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#D1D5DB',
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16, fontWeight: '700',
    color: '#FFFFFF',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 16, fontWeight: '400',
    color: '#FFFFFF',
  },
  defaultOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  defaultOptionCheckbox: {
    marginRight: 12,
  },
  defaultOptionTextContainer: {
    flex: 1,
  },
  defaultRowText: {
    fontSize: 15, color: '#111827',
    marginBottom: 2,
  },
  defaultRowSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  bottomSheetIndicator: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  // removed actionSheetContainer, actionsList, actionRow, actionText styles
  statsSection: {
    marginBottom: 24,
  },
  statsSectionTitle: {
    fontSize: 24, color: '#111827',
    marginBottom: 20,
  },
  statsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  streakNumber: {
    fontSize: 16, fontWeight: '700',
    color: '#FFFFFF',
  },
  statsMainCardLarge: {
    backgroundColor: '#10B981',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  statsMainNumberHuge: {
    fontSize: 56, color: '#FFFFFF',
    marginBottom: 4,
  },
  statsMainLabelLarge: {
    fontSize: 16, fontWeight: '400',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  statsMainGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statMetricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statMetricNumber: {
    fontSize: 28, fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  statMetricUnit: {
    fontSize: 16, fontWeight: '400',
    color: '#6B7280',
    marginBottom: 8,
  },
  statMainLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  statMetricLabel: {
    fontSize: 13,
    color: '#6B7280', textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  statCardHalf: {
    width: '48%',
  },
  statCardFull: {
    width: '100%',
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statCardContent: {
    flex: 1,
  },
  statCardContentCenter: {
    alignItems: 'center',
  },
  statNumberHuge: {
    fontSize: 36, color: '#111827',
    marginBottom: 4,
  },
  statLabelBig: {
    fontSize: 16, fontWeight: '400',
    color: '#6B7280',
  },
  statIconCircleBig: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(31, 41, 55, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statCardEmph: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E6E9EE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  statIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(30,58,138,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIconCircleBlue: {
    backgroundColor: 'rgba(30, 58, 138, 0.08)',
  },
  statIconCircleGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  statIconCirclePurple: {
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  statIconCircleOrange: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  statNumberBig: {
    fontSize: 20, color: '#0F172A',
    marginBottom: 4,
  },
  statLabelStrong: {
    fontSize: 12,
    color: '#64748B', textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  chartIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(30, 58, 138, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 18, fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  chartSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  barChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 180,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  barChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 90,
    paddingHorizontal: 6,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
    marginHorizontal: 2,
  },
  barValueText: {
    fontSize: 11, color: '#111827',
    marginTop: 6,
  },
  barValueTextToday: {
    color: '#1E3A8A',
    fontSize: 12,
  },
  barValueEmpty: {
    fontSize: 12, fontWeight: '400',
    marginTop: 6,
    color: '#CBD5F5',
  },
  barChartBar: {
    width: 32,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
    position: 'relative',
    minHeight: 16,
  },
  barChartBarToday: {
    borderWidth: 2,
    borderColor: '#1E3A8A',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  barChartBarEmpty: {
    backgroundColor: '#F9FAFB',
  },
  barChartBarFill: {
    backgroundColor: '#1E3A8A',
    borderRadius: 14,
    width: '100%',
    position: 'absolute',
    bottom: 0,
  },
  barChartLabel: {
    fontSize: 11, color: '#6B7280',
    marginTop: 4,
  },
  barChartLabelToday: {
    color: '#1E3A8A',
  },
  chartLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  chartLegendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  chartLegendText: {
    fontSize: 11,
    color: '#6B7280',
  },
  chartStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 16,
  },
  chartStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  chartStatValue: {
    fontSize: 20, color: '#111827',
  },
  chartStatLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  bar: {
    width: 14,
    backgroundColor: '#1F2937',
    borderRadius: 6,
  },
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  chartFootText: {
    fontSize: 11,
    color: '#64748B',
  },
  // Section profil
  profileEditSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18, fontWeight: '700',
    color: '#0F172A',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(30,58,138,0.08)',
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 16, fontWeight: '400',
    color: '#1F2937',
  },
  profileInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6E9EE',
    padding: 16,
    gap: 16,
  },
  profileInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  profileInfoContent: {
    flex: 1,
  },
  profileInfoLabel: {
    fontSize: 12, fontWeight: '400',
    color: '#64748B',
    marginBottom: 4,
  },
  profileInfoValue: {
    fontSize: 15,
    color: '#0F172A',
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 10,
  },
  photoButtonText: {
    color: '#1F2937', marginLeft: 6,
  },
  photoPlaceholder: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(30,58,138,0.06)',
  },
  photoPlaceholderDashed: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(30,58,138,0.3)',
  },
  photoPlaceholderInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  photoPlaceholderIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoButtonSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  photoOverlayIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  vehiclePreviewLarge: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholderSheet: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  vehiclePreviewSheet: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoOverlayText: {
    fontSize: 16, fontWeight: '400',
    color: '#FFFFFF',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16, fontWeight: '400',
    color: '#111827',
    marginBottom: 8,
  },
  photosScrollContainer: {
    marginBottom: 16,
  },
  photosScrollContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
  photoItemContainer: {
    position: 'relative',
    width: 180,
    height: 140,
    marginRight: 12,
  },
  photoItem: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    resizeMode: 'cover',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  photoIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    gap: 6,
  },
  photoIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  photoIndicatorDotActive: {
    backgroundColor: '#FFFFFF',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Section Trophées
  trophiesSection: {
    marginBottom: 24,
  },
  trophiesHeader: {
    marginBottom: 16,
  },
  trophiesSectionTitle: {
    fontSize: 20, color: '#0F172A',
  },
  trophiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
    columnGap: 16,
  },
  badgesGridFourColumn: {
    gap: 0,
  },
  badgeSlot: {
    width: '23%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  trophyBadgeImage: {
    width: '100%',
    height: '100%',
  },
  trophyIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trophyTextBlock: {
    flex: 1,
  },
  trophyTitle: {
    fontSize: 13, color: '#1E3A8A',
  },
  trophyCategory: {
    marginTop: 2,
    fontSize: 11, color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  trophyIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  trophyIconCircleBlue: {
    backgroundColor: 'rgba(30, 58, 138, 0.08)',
  },
  trophyIconCircleGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  trophyIconCirclePurple: {
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  trophyIconCircleOrange: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  trophyNumber: {
    fontSize: 20, color: '#0F172A',
    marginBottom: 4,
  },
  trophyNumberText: {
    fontSize: 12, fontWeight: '400',
    color: '#6B7280',
  },
  statsSummarySection: {
    marginTop: 28,
    marginBottom: 28,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statsSummaryTitle: {
    fontSize: 17, color: '#0F172A',
  },
  statsSummaryPairs: {
    marginTop: 16,
    gap: 10,
  },
  statsSummaryRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  statsSummaryCell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsSummarySeparator: {
    alignSelf: 'stretch',
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#CBD5E1',
    marginVertical: 4,
  },
  statsSummaryValue: {
    fontSize: 19, color: '#0F172A',
  },
  statsSummaryLabel: {
    marginTop: 8,
    fontSize: 12, color: '#6B7280',
  },
  statsSummaryFootnoteContainer: {
    marginTop: 12,
    gap: 2,
  },
  statsSummaryFootnote: {
    fontSize: 11,
    color: '#94A3B8',
  },
  statsSummaryEmpty: {
    marginTop: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statsSummaryEmptyText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#64748B',
  },
  chartStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  chartLegend: {
    marginTop: 12,
    fontSize: 11,
    color: '#94A3B8',
  },
  badgeLabel: {
    fontSize: 12, fontWeight: '400',
    color: '#475569',
  },
});
