import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Modal, Dimensions, Animated, TouchableWithoutFeedback, NativeScrollEvent, NativeSyntheticEvent, ActivityIndicator, Share, FlatList, Easing, Platform, ActionSheetIOS } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RideStorageService, SavedRide } from '../../services/RideStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import RideFilterSheet from '../../components/RideFilterSheet';
import MiniRoutePreview from '../../components/MiniRoutePreview';
import CommentsSheet from '../../components/CommentsSheet';
import { useAuth } from '../../contexts/AuthContext';
import ridesService from '../../services/supabase/ridesService';
import userRelationshipsService from '../../services/supabase/userRelationshipsService';
import FeedAlgorithmService from '../../services/FeedAlgorithmService';
import userProfileService from '../../services/supabase/userProfileService';
import rideLikesService from '../../services/supabase/rideLikesService';

import { FeedSkeleton } from '../../components/Skeletons';
import * as polyline from 'google-polyline';

// Composant Carousel pour une carte + photos
const RideCarousel = React.memo(({ ride, carouselIndex, onIndexChange, onCardPress }) => {
  const carouselData = useMemo(() => [
    { type: 'map', data: ride },
    ...(ride.photos && ride.photos.length > 0 ? ride.photos.map((photo, index) => ({ type: 'photo', data: photo, index })) : [])
  ], [ride]);

  const scrollViewRef = useRef(null);
  const scrollWidth = Dimensions.get('window').width - 48;
  const ITEM_WIDTH = scrollWidth;
  const PADDING = 8;
  const hasMultipleItems = carouselData.length > 1;

  const handleScroll = useCallback((event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / ITEM_WIDTH);
    onIndexChange(newIndex);
  }, [ITEM_WIDTH, onIndexChange]);

  return (
    <View style={styles.runCarouselContainer}>
      {hasMultipleItems ? (
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled={false}
          snapToInterval={ITEM_WIDTH}
          snapToAlignment="start"
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingRight: PADDING }}
        >
          {carouselData.map((item, index) => (
            <View
              key={index}
              style={[styles.runCarouselItemWrapper, {
                width: ITEM_WIDTH,
                marginRight: PADDING
              }]}
            >
              {item.type === 'map' ? (
                <TouchableOpacity
                  style={styles.runCarouselItemInner}
                  onPress={() => onCardPress && onCardPress()}
                  activeOpacity={1}
                >
                  <MiniRoutePreview
                    coordinates={ride.routeCoordinates}
                    style={styles.runMap}
                  />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.runCarouselItemInner}
                  onPress={() => onCardPress && onCardPress()}
                  activeOpacity={1}
                >
                  <Image source={{ uri: item.data.uri }} style={styles.runCarouselPhoto} resizeMode="cover" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      ) : (
        <TouchableOpacity
          style={styles.runCarouselItemInnerSingle}
          onPress={() => onCardPress && onCardPress()}
          activeOpacity={1}
        >
          <MiniRoutePreview
            coordinates={ride.routeCoordinates}
            style={styles.runMap}
          />
        </TouchableOpacity>
      )}
    </View>
  );
});

export default function RunsScreen() {
  const navigation = useNavigation();
  const [rides, setRides] = useState([]);
  const [feedMode, setFeedMode] = useState('foryou'); // 'foryou' | 'following'
  const [globalStats, setGlobalStats] = useState({
    totalRides: 0,
    totalDistance: 0,
    totalDuration: 0,
    averageSpeed: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isReloadingFromTab, setIsReloadingFromTab] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const PAGE_SIZE = 12;
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredRides, setFilteredRides] = useState([]);
  const [filterVehicle, setFilterVehicle] = useState('all');
  const [filterSortBy, setFilterSortBy] = useState('date');
  const [selectedRide, setSelectedRide] = useState(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  const [likedRides, setLikedRides] = useState({});
  const [showFeedMenu, setShowFeedMenu] = useState(false);
  const [likeAnimations, setLikeAnimations] = useState({});
  const [carouselIndices, setCarouselIndices] = useState({});
  const loadingRef = useRef(false);
  const flatListRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressAnimBottom = useRef(new Animated.Value(0)).current;
  const loadingStartTimeRef = useRef(null);

  // Utiliser l'ID utilisateur du contexte AuthContext
  const { user } = useAuth();
  const userId = user?.id;

  // BottomSheet pour les filtres
  const filterSheetRef = useRef(null);
  const filterSnapPoints = useMemo(() => ['50%'], []);

  // BottomSheet pour les options de carte
  const optionsSheetRef = useRef(null);
  const optionsSnapPoints = useMemo(() => ['25%'], []);

  // BottomSheet pour les commentaires
  const commentsSheetRef = useRef(null);

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} enableTouchThrough={false} />,
    []
  );

  // Initialiser les animations pour chaque ride
  useEffect(() => {
    const initialAnimations = {};
    filteredRides.forEach(ride => {
      initialAnimations[ride.id] = new Animated.Value(1);
    });
    setLikeAnimations(initialAnimations);
  }, [filteredRides]);

  const handleLike = useCallback(async (rideId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Optimistic update
    const isCurrentlyLiked = likedRides[rideId];
    setLikedRides(prev => ({ ...prev, [rideId]: !isCurrentlyLiked }));

    // Update local like count optimistically
    setRides(prevRides => prevRides.map(ride => {
      if (ride.id === rideId) {
        return {
          ...ride,
          likesCount: isCurrentlyLiked ? Math.max(0, (ride.likesCount || 0) - 1) : (ride.likesCount || 0) + 1
        };
      }
      return ride;
    }));

    const anim = likeAnimations[rideId];
    if (anim) {
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1.3,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }

    // Call backend
    if (user?.id) {
      const { error } = await rideLikesService.toggleLike(rideId, user.id);
      if (error) {
        console.error('Error toggling like:', error);
        // Revert on error
        setLikedRides(prev => ({ ...prev, [rideId]: isCurrentlyLiked }));
        setRides(prevRides => prevRides.map(ride => {
          if (ride.id === rideId) {
            return {
              ...ride,
              likesCount: isCurrentlyLiked ? (ride.likesCount || 0) + 1 : Math.max(0, (ride.likesCount || 0) - 1)
            };
          }
          return ride;
        }));
      }
    }
  }, [likeAnimations, likedRides, user?.id]);

  const handleComment = useCallback((ride) => {
    setSelectedRide(ride);
    commentsSheetRef.current?.present();
  }, []);

  // Fonction de partage simple
  const handleShare = useCallback(async (ride) => {
    try {
      const distance = ride.totalDistance ? `${(ride.totalDistance / 1000).toFixed(1)} km` : 'N/A';
      const duration = ride.totalDuration ? `${Math.floor(ride.totalDuration / 60)} min` : 'N/A';
      const message = `🚗 Trajet de ${distance} en ${duration}${ride.vehicle === 'car' ? ' en voiture' : ''}`;

      await Share.share({
        message: message,
        title: 'Partager mon trajet',
      });
    } catch (error) {
      console.error('Erreur partage:', error);
    }
  }, []);


  // Filtrer les trajets selon la recherche et les filtres
  useEffect(() => {
    // Fonction helper pour trier du plus récent au plus ancien
    const sortRidesByDate = (ridesList) => {
      return [...ridesList].sort((a, b) => {
        // Convertir en timestamp numérique si c'est une string ISO
        const getTimestamp = (date) => {
          if (!date) return 0;
          if (typeof date === 'string') {
            return new Date(date).getTime();
          }
          if (typeof date === 'number') {
            return date;
          }
          return 0;
        };

        const dateA = getTimestamp(a.endTime || a.startTime);
        const dateB = getTimestamp(b.endTime || b.startTime);
        return dateB - dateA; // Décroissant (plus récent d'abord)
      });
    };

    // Appliquer le filtre de recherche textuel
    let filtered = rides;
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = rides.filter(ride =>
        ride.name.toLowerCase().includes(query) ||
        (ride.description && ride.description.toLowerCase().includes(query)) ||
        (ride.startCity && ride.startCity.toLowerCase().includes(query)) ||
        (ride.endCity && ride.endCity.toLowerCase().includes(query)) ||
        (ride.userName && ride.userName.toLowerCase().includes(query)) ||
        (ride.user?.name && ride.user?.name.toLowerCase().includes(query)) ||
        (ride.vehicle && ride.vehicle.toLowerCase().includes(query))
      );
    }

    // Appliquer le filtre de véhicule
    if (filterVehicle !== 'all') {
      filtered = filtered.filter(ride => ride.vehicle === filterVehicle);
    }

    setFilteredRides(sortRidesByDate(filtered));
  }, [rides, searchQuery, filterVehicle, feedMode]);

  // Recharger les trajets quand le mode change
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    setHasLoadedOnce(false); // Reset pour le nouveau mode
    setIsLoading(true); // Réactiver le loading pour le nouveau mode
    // setRides([]); // Optionnel : vider pour montrer le chargement
    loadRides(0, true);
  }, [feedMode]);

  // Synchroniser hasLoadedOnce et isLoading avec l'état réel des trajets
  // Cela garantit que le skeleton reste affiché jusqu'à ce que les trajets soient réellement chargés
  useEffect(() => {
    // Si on charge et qu'on a des trajets, marquer comme chargé et désactiver le loading
    if (isLoading && rides.length > 0) {
      setHasLoadedOnce(true);
      setIsLoading(false);
      loadingStartTimeRef.current = null;
    }
    // Si on charge depuis plus de 1 seconde et qu'il n'y a pas de trajets,
    // c'est qu'il n'y a vraiment aucun trajet - afficher le message
    else if (isLoading && rides.length === 0 && loadingStartTimeRef.current) {
      const elapsed = Date.now() - loadingStartTimeRef.current;
      if (elapsed > 1000) {
        setHasLoadedOnce(true);
        setIsLoading(false);
        loadingStartTimeRef.current = null;
      }
    }
  }, [isLoading, rides.length]);

  // Charger les trajets (Feed - tous les utilisateurs)
  const loadRides = async (pageNumber = 0, shouldRefresh = false) => {
    // Protection contre les chargements multiples
    if (loadingRef.current && !shouldRefresh) {
      console.log('⚠️ Chargement déjà en cours, skip');
      return;
    }

    if (pageNumber > 0 && !hasMore) {
      console.log('⚠️ Plus de données à charger');
      return;
    }

    loadingRef.current = true;

    try {
      if (pageNumber === 0) {
        setIsLoading(true);
        loadingStartTimeRef.current = Date.now();
      } else {
        setIsLoadingMore(true);
      }

      console.log(`📥 LOADING FEED RIDES (${feedMode}, Page ${pageNumber})...`);

      let ridesData = [];
      let followingIds = [];

      // Récupérer les abonnements pour l'algo ou le filtre
      if (user?.id) {
        const { followingIds: ids } = await userRelationshipsService.getFollowingIds(user.id);
        followingIds = ids || [];
      }

      if (feedMode === 'following') {
        // Mode Abonnements : Filtrer par IDs suivis
        if (followingIds.length === 0) {
          // Si on ne suit personne, pas de résultats
          ridesData = [];
        } else {
          const { rides } = await ridesService.getAllRidesWithEngagement({
            limit: PAGE_SIZE,
            offset: pageNumber * PAGE_SIZE,
            userIds: followingIds,
            orderBy: 'created_at',
            order: 'desc',
            currentUserId: user?.id
          });
          ridesData = rides || [];
        }
      } else {
        // Mode Pour vous : TOUS les trajets (sauf les miens), triés par pertinence
        const { rides } = await ridesService.getAllRidesWithEngagement({
          limit: PAGE_SIZE * 3, // Charger plus pour avoir du choix après filtrage
          offset: pageNumber * PAGE_SIZE,
          orderBy: 'created_at',
          order: 'desc',
          currentUserId: user?.id
        });

        if (rides && rides.length > 0) {
          // 1. FILTRER mes propres trajets
          let filteredRides = rides;
          if (user?.id) {
            filteredRides = rides.filter(ride => ride.userId !== user.id);
            console.log(`🔥 Filtré ${rides.length - filteredRides.length} de mes trajets, reste ${filteredRides.length}`);
          }

          // 2. Récupérer contexte pour scoring
          let userGroups = [];
          if (user?.id) {
            const { groups } = await userProfileService.getUserGroups(user.id);
            userGroups = groups ? groups.map(g => g.id) : [];
          }

          // 3. Appliquer scoring SANS diversité stricte
          ridesData = FeedAlgorithmService.getPersonalizedFeed(
            filteredRides,
            user?.id,
            {
              userGroups,
              following: followingIds,
              userPreferences: { preferredVehicles: ['car'] }
            },
            {
              limit: PAGE_SIZE,
              applyDiversityRules: false  // ❌ Pas de diversité = tous les trajets affichés
            }
          );
        } else {
          ridesData = [];
        }
      }

      // Décoder les polylines en routeCoordinates pour chaque trajet
      const ridesWithCoordinates = ridesData.map(ride => {
        let routeCoordinates = [];
        if (ride.polyline && ride.polyline.length > 0) {
          try {
            const coords = polyline.decode(ride.polyline);
            routeCoordinates = coords.map(c => ({ latitude: c[0], longitude: c[1] }));
          } catch (error) {
            console.error('Erreur décompression polyline pour ride', ride.id, error);
          }
        }
        return {
          ...ride,
          routeCoordinates: routeCoordinates.length > 0 ? routeCoordinates : (ride.routeCoordinates || [])
        };
      });

      console.log(`✅ Chargé ${ridesWithCoordinates.length} trajets pour la page ${pageNumber}`);

      // Si moins de résultats que la page, on a atteint la fin
      if (ridesWithCoordinates.length < PAGE_SIZE) {
        setHasMore(false);
        console.log('🏁 Fin des données atteinte');
      } else {
        setHasMore(true);
      }

      // Convertir en format SavedRide pour compatibilité UI si nécessaire
      // Mais ridesService retourne déjà un format compatible grâce au mapping

      if (shouldRefresh || pageNumber === 0) {
        // Mettre à jour les trajets d'abord
        setRides(ridesWithCoordinates);
        // Initialize liked state
        const newLikedState = {};
        ridesWithCoordinates.forEach(r => {
          if (r.isLiked) newLikedState[r.id] = true;
        });
        setLikedRides(newLikedState);
        // Ne pas mettre hasLoadedOnce ici - utiliser un useEffect pour s'assurer que rides est mis à jour
      } else {
        // Ajouter les nouveaux trajets
        setRides(prev => {
          const existingIds = new Set(prev.map(r => r.id));
          const newRides = ridesWithCoordinates.filter(r => !existingIds.has(r.id));
          console.log(`➕ Ajout de ${newRides.length} nouveaux trajets`);

          // Update liked state for new rides
          setLikedRides(prevLikes => {
            const updatedLikes = { ...prevLikes };
            newRides.forEach(r => {
              if (r.isLiked) updatedLikes[r.id] = true;
            });
            return updatedLikes;
          });

          return [...prev, ...newRides];
        });
      }

      // Charger les stats globales pour le Feed (une seule fois au début)
      if (pageNumber === 0) {
        const stats = await RideStorageService.getGlobalStats();
        setGlobalStats(stats);
        // Ne pas mettre setIsLoading(false) ici - laisser le useEffect le gérer
      }
    } catch (error) {
      console.error('❌ Erreur chargement:', error);
      // En cas d'erreur, marquer comme chargé pour afficher le message d'erreur
      if (pageNumber === 0) {
        setHasLoadedOnce(true);
        setIsLoading(false);
      }
    } finally {
      setRefreshing(false);
      loadingRef.current = false;

      // Finir l'animation de la barre en bas si elle est active
      if (isLoadingMore) {
        await new Promise(resolve => {
          Animated.timing(progressAnimBottom, {
            toValue: 100,
            duration: 200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
          }).start(() => resolve());
        });
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      setIsLoadingMore(false); // Set to false after animation
    }
  };

  // Charger plus de trajets (infinite scroll)
  const loadMoreRides = useCallback(() => {
    if (isLoadingMore || !hasMore || isLoading) return;

    console.log('📜 Chargement de la page suivante...');

    // Animer la barre de progression en bas
    setIsLoadingMore(true);
    progressAnimBottom.setValue(0);

    // Animation smooth de 0 à 90%
    Animated.timing(progressAnimBottom, {
      toValue: 90,
      duration: 1500,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: false,
    }).start();

    const nextPage = page + 1;
    setPage(nextPage);
    loadRides(nextPage);
  }, [isLoadingMore, hasMore, isLoading, page, loadRides, progressAnimBottom]);

  // Rafraîchir les données
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(0);
    setHasMore(true);
    loadRides(0, true);
  }, []);

  // Scroll to top et refresh (quand on appuie sur le header ou tab bar)
  const scrollToTopAndRefresh = useCallback(async () => {
    // Protection contre les clics multiples
    if (isReloadingFromTab) {
      console.log('⚠️ Déjà en cours de rechargement, ignoré');
      return;
    }

    console.log('🔝 Scroll to top et refresh');

    // 1. Afficher l'indicateur et reset la barre à 0
    setIsPulling(false); // Reset pull state
    setIsReloadingFromTab(true);
    progressAnim.setValue(0);

    // 2. Animer la barre de 0 à 90% (smooth et lent)
    const animation = Animated.timing(progressAnim, {
      toValue: 90,
      duration: 2000, // 2 secondes pour être vraiment smooth
      easing: Easing.bezier(0.25, 0.1, 0.25, 1), // Courbe de Bézier pour smoothness
      useNativeDriver: false,
    });
    animation.start();

    // 3. Scroll instantané en haut
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });

    // 4. Reset et recharge
    setPage(0);
    setHasMore(true);

    // 5. Petit délai pour que le scroll soit visible
    await new Promise(resolve => setTimeout(resolve, 300));

    // 6. Recharge les données
    await loadRides(0, true);

    // 7. Finir l'animation à 100% (rapide)
    await new Promise(resolve => {
      Animated.timing(progressAnim, {
        toValue: 100,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start(() => resolve());
    });

    // 8. Petit délai pour voir la barre à 100%
    await new Promise(resolve => setTimeout(resolve, 150));

    // 9. Masquer l'indicateur
    setIsReloadingFromTab(false);

    console.log('✅ Refresh terminé');
  }, [loadRides, isReloadingFromTab, progressAnim]);

  // Charger les données au focus de l'écran
  useFocusEffect(
    useCallback(() => {
      // Charger les vraies données depuis Supabase
      if (rides.length === 0) {
        loadRides(0);
      }
    }, [])
  );

  // Écouter le tap sur l'icône Feed dans la tab bar (comme Instagram)
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', (e) => {
      // Si on est déjà sur cet écran, scroll to top + refresh
      if (navigation.isFocused()) {
        console.log('📱 Tab Feed cliqué - Scroll to top + refresh');
        e.preventDefault(); // Empêcher le comportement par défaut
        scrollToTopAndRefresh();
      }
    });

    return unsubscribe;
  }, [navigation, scrollToTopAndRefresh]);

  // Formater la durée
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Formater le temps (format complet)
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Formater la date en temps relatif
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Moins d'une heure
    if (diffMins < 60) {
      if (diffMins < 1) return "à l'instant";
      if (diffMins === 1) return "il y a 1 min";
      return `il y a ${diffMins} min`;
    }

    // Moins de 24 heures
    if (diffHours < 24) {
      if (diffHours === 1) return "il y a 1h";
      return `il y a ${diffHours}h`;
    }

    // Hier
    if (diffDays === 1) {
      return "hier";
    }

    // Il y a X jours (jusqu'à 7 jours)
    if (diffDays < 7) {
      return `il y a ${diffDays} jours`;
    }

    // Plus d'une semaine : afficher la date
    return `${date.getDate()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  };

  // Formater la distance
  const formatDistance = (meters) => {
    return `${((meters || 0) / 1000).toFixed(1)} km`;
  };

  // Obtenir l'icône Ionicons du véhicule
  const getVehicleIcon = (vehicle) => {
    switch (vehicle) {
      case 'car': return 'car-outline';
      case 'motorcycle': return 'bicycle-outline';
      case 'bicycle': return 'bicycle-outline';
      case 'scooter': return 'flash-outline';
      default: return 'car-outline';
    }
  };

  // Formater l'allure
  const formatPace = (distanceKm, durationSeconds) => {
    if (distanceKm === 0 || durationSeconds === 0) return '0:00 /km';

    const paceSecondsPerKm = durationSeconds / distanceKm;
    const paceMinutes = Math.floor(paceSecondsPerKm / 60);
    const paceSeconds = Math.floor(paceSecondsPerKm % 60);

    return `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')} /km`;
  };

  // Obtenir le type d'activité
  const getActivityType = (vehicle) => {
    switch (vehicle) {
      case 'bicycle':
        return 'Course à vélo';
      case 'car':
        return 'Course en voiture';
      case 'motorcycle':
        return 'Course en moto';
      case 'scooter':
        return 'Course en trottinette';
      default:
        return 'Course en extérieur';
    }
  };

  // Formater la date de manière plus jolie
  const formatPrettyDate = (timestamp) => {
    const date = new Date(timestamp);
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${dayName} ${day} ${month} • ${hours}:${minutes}`;
  };

  // Obtenir la liste des villes pour un trajet (uniquement départ et arrivée)
  const getCities = (ride) => {
    // Toujours afficher seulement départ et arrivée
    if (ride.startCity && ride.endCity) {
      return [ride.startCity, ride.endCity];
    }
    if (ride.startCity) {
      return [ride.startCity];
    }
    if (ride.endCity) {
      return [ride.endCity];
    }

    // Aucune ville trouvée
    return [];
  };

  // Afficher le BottomSheet d'options pour un trajet
  const openOptionsSheet = (ride) => {
    setSelectedRide(ride);
    optionsSheetRef.current?.present();
  };

  // Confirmer la suppression
  const confirmDeleteRide = async (ride) => {
    Alert.alert(
      'Supprimer le trajet',
      `Êtes-vous sûr de vouloir supprimer "${ride.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await RideStorageService.deleteRide(ride.id);
              await loadRides(); // Recharger la liste
            } catch (error) {
              console.error('Erreur lors de la suppression:', error);
              Alert.alert('Erreur', 'Impossible de supprimer le trajet');
            }
          },
        },
      ]
    );
  };

  // Navigation vers l'écran de détails
  const handleRunPress = (ride) => {
    navigation.navigate('RunDetail', { ride });
  };

  const renderRideItem = ({ item: ride, index }) => {
    const isCar = ride.vehicle === 'car';
    const citiesList = getCities(ride);
    const likeAnimation = likeAnimations[ride.id];
    const isLiked = likedRides[ride.id];

    return (
      <View style={[styles.runCard, index > 0 && styles.runCardMargin]}>
        {/* Bouton menu en haut à droite de la card */}
        <TouchableOpacity
          style={styles.runCardMenuButton}
          onPress={() => openOptionsSheet(ride)}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#666666" />
        </TouchableOpacity>

        {/* Header avec photo de profil et infos utilisateur */}
        <View style={styles.runHeader}>
          <TouchableOpacity
            style={styles.runProfileSection}
            onPress={() => {
              // Naviguer vers le profil utilisateur si userId existe et est différent de l'utilisateur actuel
              if (ride.userId && ride.userId !== userId && ride.userId !== 'default') {
                navigation.navigate('UserProfile', { userId: ride.userId });
              }
            }}
            activeOpacity={ride.userId && ride.userId !== userId && ride.userId !== 'default' ? 0.7 : 1}
            disabled={!ride.userId || ride.userId === userId || ride.userId === 'default'}
          >
            {ride.userAvatar ? (
              <Image source={{ uri: ride.userAvatar }} style={styles.runProfileImageAvatar} />
            ) : (
              <View style={styles.runProfileImage}>
                <Text style={styles.runProfileInitial}>
                  {(ride.userName || ride.user?.name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.runUserInfo}>
              <Text style={styles.runUserName}>{ride.userName || ride.user?.name || 'Utilisateur'}</Text>
              <Text style={styles.runActivityText}>{formatDate(ride.startTime)}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Titre du trajet */}
        <TouchableOpacity
          style={styles.runActivityTitleSection}
          onPress={() => handleRunPress(ride)}
          activeOpacity={0.7}
        >
          <Text style={styles.runActivityTitle}>{ride.name}</Text>
          <View style={styles.runMetaInfo}>
            {ride.vehicle && (
              <Text style={styles.vehicleText}>
                {ride.vehicle === 'car' ? 'Voiture' :
                  ride.vehicle === 'motorcycle' ? 'Moto' :
                    ride.vehicle === 'bicycle' ? 'Vélo' :
                      ride.vehicle === 'scooter' ? 'Trottinette' : ride.vehicle}
              </Text>
            )}
            {citiesList.length > 0 ? (
              <Text style={styles.runCitiesText}>{citiesList.join(' → ')}</Text>
            ) : (
              <Text style={styles.runCitiesText}>Ville inconnue</Text>
            )}
          </View>
          {ride.description && (() => {
            const fullDesc = ride.description;
            const maxLength = 100;
            const isExpanded = expandedDescriptions[ride.id];
            const isLong = fullDesc.length > maxLength;
            const displayDesc = isExpanded || !isLong ? fullDesc : fullDesc.substring(0, maxLength) + '...';

            return (
              <View>
                <Text style={styles.runDescription}>{displayDesc}</Text>
                {isLong && (
                  <TouchableOpacity
                    onPress={() => setExpandedDescriptions(prev => ({ ...prev, [ride.id]: !prev[ride.id] }))}
                    style={styles.showMoreButton}
                  >
                    <Text style={styles.showMoreText}>
                      {isExpanded ? 'moins' : 'plus'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}
        </TouchableOpacity>

        {/* Statistiques principales */}
        <TouchableOpacity
          style={styles.runStatsContainer}
          onPress={() => handleRunPress(ride)}
          activeOpacity={0.7}
        >
          <View style={styles.runStatItem}>
            <Text style={styles.runStatLabel}>Distance</Text>
            <Text style={styles.runStatValue}>{((ride.distance || 0) / 1000).toFixed(1).replace('.', ',')} km</Text>
          </View>
          <View style={styles.runStatSeparator} />
          <View style={styles.runStatItem}>
            <Text style={styles.runStatLabel}>Durée</Text>
            <Text style={styles.runStatValue}>{formatDuration(ride.duration || 0)}</Text>
          </View>
          <View style={styles.runStatSeparator} />
          <View style={styles.runStatItem}>
            <Text style={styles.runStatLabel}>Vitesse moy.</Text>
            <Text style={styles.runStatValue}>{(ride.averageSpeed || 0).toFixed(1)} km/h</Text>
          </View>
        </TouchableOpacity>

        {/* Carousel de carte et photos */}
        <RideCarousel
          ride={ride}
          carouselIndex={carouselIndices[ride.id] || 0}
          onIndexChange={(index) => setCarouselIndices(prev => ({ ...prev, [ride.id]: index }))}
          onCardPress={() => handleRunPress(ride)}
        />

        {/* Actions (Like, Comment, Share) */}
        <View style={styles.runInteractionSection}>
          <View style={styles.runInteractionLeft}>
            <TouchableOpacity
              style={styles.runInteractionItem}
              onPress={() => handleLike(ride.id)}
              activeOpacity={1}
            >
              <Animated.View style={{ transform: [{ scale: likeAnimation || 1 }] }}>
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={24}
                  color={isLiked ? "#EF4444" : "#1F2937"}
                />
              </Animated.View>
              {ride.likesCount > 0 && (
                <Text style={styles.interactionCount}>{ride.likesCount}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.runInteractionItem}
              onPress={() => handleComment(ride)}
              activeOpacity={1}
            >
              <Ionicons name="chatbubble-outline" size={24} color="#1F2937" />
              {ride.commentsCount > 0 && (
                <Text style={styles.interactionCount}>{ride.commentsCount}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.runInteractionItem}
              onPress={() => handleShare(ride)}
              activeOpacity={1}
            >
              <Ionicons name="paper-plane-outline" size={24} color="#1F2937" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.runInteractionItem} activeOpacity={0.5}>
            <Ionicons name="bookmark-outline" size={24} color="#1F2937" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderFooter = () => {
    if (!isLoadingMore) return <View style={{ height: 20 }} />;
    return (
      <View style={{ paddingVertical: 10 }}>
        <FeedSkeleton count={1} />
      </View>
    );
  };

  const renderEmpty = () => {
    // Toujours afficher le skeleton si on charge ou si on n'a pas encore chargé
    // Ne jamais afficher "aucun trajet" pendant le chargement initial
    if (isLoading || !hasLoadedOnce) {
      return <FeedSkeleton count={3} />;
    }

    // Seulement afficher "aucun trajet" si on a fini de charger ET qu'il n'y a vraiment aucun trajet
    if (filteredRides.length === 0 && hasLoadedOnce) {
      // Message différent selon le mode et la recherche
      let emptyTitle = 'Aucun trajet';
      let emptyText = '';
      let emptyIcon = '🗺️';

      if (searchQuery.length > 0) {
        emptyTitle = 'Aucun résultat trouvé';
        emptyText = `Aucun trajet ne correspond à "${searchQuery}"`;
        emptyIcon = '🔍';
      } else if (feedMode === 'following') {
        emptyTitle = 'Aucun abonnement';
        emptyText = 'Vous ne suivez personne pour le moment.\nDécouvrez de nouveaux utilisateurs dans "Pour vous" !';
        emptyIcon = '👥';
      } else {
        emptyTitle = 'Aucun trajet disponible';
        emptyText = 'Les trajets partagés par la communauté apparaîtront ici.\nLancez votre premier trajet pour commencer !';
        emptyIcon = '🗺️';
      }

      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>{emptyIcon}</Text>
          <Text style={styles.emptyStateTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyStateText}>{emptyText}</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons name="search-outline" size={64} color="#CBD5E1" />
        <Text style={styles.emptyStateTitle}>Aucun résultat</Text>
        <Text style={styles.emptyStateText}>
          {searchQuery.trim().length > 0
            ? `Aucun trajet ne correspond à "${searchQuery}"`
            : 'Aucun trajet ne correspond à vos filtres.'}
        </Text>
      </View>
    );
  };

  return (
    <>
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />

        {/* Header Feed */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            {/* Menu Feed Mode */}
            <View style={styles.feedMenuContainer}>
              <TouchableOpacity
                style={styles.feedMenuButton}
                onPress={() => setShowFeedMenu(!showFeedMenu)}
                activeOpacity={0.7}
              >
                <Text style={styles.feedMenuButtonText}>
                  {feedMode === 'foryou' ? 'Pour vous' : 'Abonnements'}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color="#1F2937"
                  style={{ marginLeft: 6 }}
                />
              </TouchableOpacity>

              {/* Menu déroulant */}
              {showFeedMenu && (
                <>
                  <TouchableWithoutFeedback onPress={() => setShowFeedMenu(false)}>
                    <View style={styles.feedMenuOverlay} />
                  </TouchableWithoutFeedback>
                  <View style={styles.feedMenuDropdown}>
                    <TouchableOpacity
                      style={styles.feedMenuItem}
                      onPress={() => {
                        if (feedMode !== 'foryou') {
                          setFeedMode('foryou');
                          setPage(0);
                          setRides([]);
                          setHasMore(true);
                          loadRides(0, true);
                        }
                        setShowFeedMenu(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="compass"
                        size={18}
                        color={feedMode === 'foryou' ? '#1E3A8A' : '#6B7280'}
                        style={{ marginRight: 10 }}
                      />
                      <Text style={[styles.feedMenuItemText, feedMode === 'foryou' && styles.feedMenuItemTextActive]}>
                        Pour vous
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.feedMenuItem}
                      onPress={() => {
                        if (feedMode !== 'following') {
                          setFeedMode('following');
                          setPage(0);
                          setRides([]);
                          setHasMore(true);
                          loadRides(0, true);
                        }
                        setShowFeedMenu(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="people"
                        size={18}
                        color={feedMode === 'following' ? '#1E3A8A' : '#6B7280'}
                        style={{ marginRight: 10 }}
                      />
                      <Text style={[styles.feedMenuItemText, feedMode === 'following' && styles.feedMenuItemTextActive]}>
                        Abonnements
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>

            <TouchableOpacity
              style={styles.headerAction}
              onPress={() => filterSheetRef.current?.present()}
            >
              <Ionicons name="filter" size={22} color="#1F2937" />
            </TouchableOpacity>
          </View>

          {/* Barre de progression fine (comme le separator) */}
          {(isReloadingFromTab || isPulling) && (
            <View style={styles.progressBarContainer}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
          )}
        </View>

        <FlatList
          ref={flatListRef}
          data={filteredRides}
          renderItem={renderRideItem}
          keyExtractor={(item) => item.id}
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 20 }}
          onScroll={(e) => {
            // Détection du pull-to-refresh custom
            const offset = e.nativeEvent.contentOffset.y;

            // Gestion de l'état isPulling et animation de la barre
            if (offset < 0 && !refreshing && !isLoading && !isReloadingFromTab) {
              if (!isPulling) setIsPulling(true);
              // Calculer la progression (0 à 100% sur 80px)
              const progress = Math.min(Math.abs(offset) / 80, 1) * 100;
              progressAnim.setValue(progress);
            } else if (offset >= 0 && isPulling) {
              setIsPulling(false);
              progressAnim.setValue(0);
            }

            // Déclenchement du refresh
            if (offset < -80 && !refreshing && !isLoading && !isReloadingFromTab) {
              console.log('🔄 Pull-to-refresh déclenché');
              scrollToTopAndRefresh();
            }
          }}
          scrollEventThrottle={16}
          onEndReached={loadMoreRides}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={50}
          initialNumToRender={6}
          windowSize={10}
        />

        {/* BottomSheet pour les options de carte */}
        <BottomSheetModal
          ref={optionsSheetRef}
          snapPoints={optionsSnapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderBackdrop}
          backgroundStyle={styles.bottomSheetBackground}
          handleIndicatorStyle={styles.bottomSheetHandle}
          enableDynamicSizing={false}
        >
          <BottomSheetView style={styles.optionsSheetContent}>
            <TouchableOpacity
              style={styles.optionsSheetItem}
              onPress={() => {
                optionsSheetRef.current?.dismiss();
                if (selectedRide) {
                  handleShare(selectedRide);
                }
              }}
            >
              <Ionicons name="paper-plane-outline" size={20} color="#1E3A8A" />
              <Text style={styles.optionsSheetItemText}>Partager</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.optionsSheetItem}
              onPress={() => {
                optionsSheetRef.current?.dismiss();
                if (selectedRide) {
                  confirmDeleteRide(selectedRide);
                }
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              <Text style={styles.optionsSheetItemTextDestructive}>Supprimer</Text>
            </TouchableOpacity>
          </BottomSheetView>
        </BottomSheetModal>

        {/* Modal pour afficher l'image agrandie */}
        <Modal
          visible={selectedPhoto !== null}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedPhoto(null)}
        >
          <TouchableOpacity
            style={styles.photoModalOverlay}
            activeOpacity={1}
            onPress={() => setSelectedPhoto(null)}
          >
            <View style={styles.photoModalContainer}>
              <TouchableOpacity
                style={styles.photoModalCloseButton}
                onPress={() => setSelectedPhoto(null)}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              {selectedPhoto && (
                <Image
                  source={{ uri: selectedPhoto }}
                  style={styles.photoModalImage}
                  resizeMode="contain"
                />
              )}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* BottomSheet pour les commentaires */}
        <CommentsSheet
          ref={commentsSheetRef}
          type="ride"
          entityId={selectedRide?.id}
          onCommentAdded={(newComment) => {
            console.log('✅ Commentaire ajouté:', newComment);
          }}
        />
      </SafeAreaView >

      <RideFilterSheet
        sheetRef={filterSheetRef}
        snapPoints={filterSnapPoints}
        renderBackdrop={renderBackdrop}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetHandle}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterVehicle={filterVehicle}
        onVehicleChange={setFilterVehicle}
        onReset={() => {
          setSearchQuery('');
          setFilterVehicle('all');
        }}
        defaultVehicleKey="all"
      />

    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerAction: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 22, color: '#1F2937',
    marginBottom: 24,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 16, fontWeight: '400',
    color: '#374151',
    marginBottom: 12,
  },
  searchBarFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInputFilter: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    marginLeft: 8,
    marginRight: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    minWidth: '47%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  filterOptionActive: {
    backgroundColor: '#1F2937',
    borderColor: '#1F2937',
  },
  filterOptionText: {
    fontSize: 16, fontWeight: '400',
    color: '#374151',
  },
  filterOptionTextActive: {
    color: '#FFFFFF',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: '#1F2937',
  },
  modalButtonText: {
    fontSize: 16, fontWeight: '400',
    color: '#FFFFFF',
  },
  bottomSheetBackground: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  bottomSheetHandle: {
    backgroundColor: '#9CA3AF',
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  bottomSheetFixedHeader: {
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  bottomSheetTitle: {
    fontSize: 22, color: '#1F2937',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  optionsSheetContent: {
    paddingTop: 12,
    paddingBottom: 40,
  },
  optionsSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  optionsSheetItemText: {
    fontSize: 17,
    color: '#1F2937',
  },
  optionsSheetItemTextDestructive: {
    fontSize: 17,
    color: '#FF3B30',
  },
  commentsSheetContent: {
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  commentsSheetTitle: {
    fontSize: 20, color: '#1F2937',
    marginBottom: 16,
  },
  commentsPlaceholder: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 24, fontWeight: '700',
    color: '#1F2937',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 18, fontWeight: '700',
    color: '#8B5CF6',
  },
  userAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  runProfileImageAvatar: {
    width: 35,
    height: 35,
    borderRadius: 18,
    marginRight: 10,
  },
  content: {
    flex: 1,
  },
  runCard: {
    backgroundColor: 'transparent',
    marginBottom: 0,
    position: 'relative',
  },
  runCardMargin: {
    marginTop: 8,
    borderTopWidth: 4,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
  },
  runCardMenuButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 10,
  },
  // Header du run
  runHeader: {
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 10,
  },
  runProfileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  runProfileImage: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  runProfileInitial: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  runUserInfo: {
    flex: 1,
  },
  runUserName: {
    fontSize: 16, fontWeight: '400',
    color: '#1F2937',
    marginBottom: 2,
  },
  runActivityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  runActivityIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  runActivityText: {
    color: '#666666',
    fontSize: 12,
  },
  runDescription: {
    color: '#1F2937',
    fontSize: 15, marginTop: 8,
    marginBottom: 2,
    lineHeight: 21,
  },
  showMoreButton: {
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  showMoreText: {
    fontSize: 16, fontWeight: '400',
    color: '#1F2937',
  },
  runCitiesText: {
    color: '#1F2937',
    fontSize: 13,
  },
  // Titre de l'activité
  runActivityTitleSection: {
    paddingHorizontal: 15,
    paddingBottom: 8,
  },
  runActivityTitle: {
    fontSize: 18, fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  runMetaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vehicleText: {
    fontSize: 16, fontWeight: '400',
    color: '#1F2937',
  },
  // Carte
  runMapContainer: {
    marginHorizontal: 15,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  runMap: {
    flex: 1,
  },
  runCarouselContainer: {
    marginHorizontal: 0,
    marginBottom: 8,
    marginTop: 4,
    paddingLeft: 16,
    height: 280,
    borderRadius: 0,
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  runPagerView: {
    height: 280,
  },
  runCarouselItemWrapper: {
    flex: 1,
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
  },
  runCarouselItemInner: {
    width: Dimensions.get('window').width - 48,
    height: 270,
    borderRadius: 12,
    overflow: 'hidden',
  },
  runCarouselItemInnerSingle: {
    width: Dimensions.get('window').width - 32,
    height: 270,
    borderRadius: 12,
    overflow: 'hidden',
  },
  runCarouselItem: {
    flex: 1,
    height: 240,
  },
  runCarouselPhoto: {
    width: '100%',
    height: '100%',
  },
  runPhotosSection: {
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  runPhotosScroll: {
    flexDirection: 'row',
  },
  runPhotosScrollContent: {
    paddingRight: 15,
  },
  runPhotoItem: {
    width: 90,
    height: 90,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: '#F0F0F0',
  },
  // Séparateurs
  runSeparator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 0,
    marginVertical: 20,
  },
  // Statistiques
  runStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 24,
  },
  runStatItem: {
    alignItems: 'flex-start',
  },
  runStatSeparator: {
    width: 1,
    height: 30,
    backgroundColor: '#E0E0E0',
  },
  runStatsSecondary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 0,
    paddingTop: 0,
    justifyContent: 'flex-end',
  },
  runStatSecondaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  runStatSecondaryText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  runStatValue: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  runStatLabel: {
    color: '#374151',
    fontSize: 11,
  },
  // Photos
  // Boutons d'interaction
  runInteractionSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 8,
  },
  runInteractionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  runInteractionItem: {
    padding: 4,
  },
  // Styles pour les éléments communs
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20, color: '#1F2937',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
  },
  mockButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  mockButtonText: {
    color: '#FFFFFF', marginLeft: 8,
  },
  // Modal photo agrandie
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalContainer: {
    width: Dimensions.get('window').width - 40,
    height: Dimensions.get('window').height - 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalCloseButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  photoModalImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  footerLoaderContainer: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarContainerBottom: {
    height: 1,
    width: '90%',
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    borderRadius: 1,
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  // Feed Menu - Design avec menu déroulant
  feedMenuContainer: {
    flex: 1,
    marginRight: 12,
    position: 'relative',
    zIndex: 10,
  },
  feedMenuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  feedMenuButtonText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  feedMenuOverlay: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
    backgroundColor: 'transparent',
  },
  feedMenuDropdown: {
    position: 'absolute',
    top: 40,
    left: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  feedMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'transparent',
  },
  feedMenuItemText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
  },
  feedMenuItemTextActive: {
    fontWeight: '500',
    color: '#1E3A8A',
  },
  interactionCount: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
  },
});
2