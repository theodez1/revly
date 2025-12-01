import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Animated, Easing } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RideStorageService } from '../../services/RideStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useAuth } from '../../contexts/AuthContext';
import { loadAndCacheProfilePhoto, getCachedProfilePhoto } from '../../services/ProfilePhoto';
import MiniRoutePreview from '../../components/MiniRoutePreview';
import RideFilterSheet from '../../components/RideFilterSheet';

import { HistorySkeleton } from '../../components/Skeletons';

export default function HistoryScreen() {
  const navigation = useNavigation();
  const { user, profile } = useAuth();
  const [rides, setRides] = useState([]);
  const [filteredRides, setFilteredRides] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [globalStats, setGlobalStats] = useState({
    totalRides: 0,
    totalDistance: 0,
    totalDuration: 0,
    averageSpeed: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profilePhotoUri, setProfilePhotoUri] = useState(null);
  const lastLoadedAvatarRef = useRef(null); // Pour éviter les rechargements inutiles
  const [filterVehicle, setFilterVehicle] = useState('all');
  const [selectedRide, setSelectedRide] = useState(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isReloadingFromTab, setIsReloadingFromTab] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const scrollViewRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // BottomSheet pour les filtres
  const filterSheetRef = useRef(null);
  const filterSnapPoints = useMemo(() => ['55%'], []);

  // BottomSheet pour les options de carte
  const optionsSheetRef = useRef(null);
  const optionsSnapPoints = useMemo(() => ['25%'], []);
  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} enableTouchThrough={false} />,
    []
  );

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
        (ride.vehicle && ride.vehicle.toLowerCase().includes(query))
      );
    }

    // Appliquer le filtre de véhicule
    if (filterVehicle !== 'all') {
      filtered = filtered.filter(ride => ride.vehicle === filterVehicle);
    }

    setFilteredRides(sortRidesByDate(filtered));
  }, [rides, searchQuery, filterVehicle]);

  // Charger les trajets de l'utilisateur uniquement
  const loadRides = async () => {
    try {
      // Utiliser le vrai UUID de l'utilisateur connecté
      if (!user?.id) {
        console.warn('Pas d\'utilisateur connecté');
        setRides([]);
        setGlobalStats({ totalRides: 0, totalDistance: 0, totalDuration: 0, averageSpeed: 0 });
        return;
      }

      // Charger directement depuis l'API

      const [ridesData, stats] = await Promise.all([
        RideStorageService.getUserRides(user.id),
        RideStorageService.getUserStats(user.id),
      ]);

      // Trier du plus récent au plus ancien
      const sortedRides = [...ridesData].sort((a, b) => {
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

      setRides(sortedRides);
      setGlobalStats(stats);
      // Marquer comme chargé seulement après avoir mis à jour les trajets
      // Utiliser setTimeout pour s'assurer que l'état est mis à jour après le render
      setTimeout(() => {
        setHasLoadedOnce(true);
      }, 100);
    } catch (error) {
      console.error('❌ Erreur lors du chargement des trajets:', error);
      setTimeout(() => {
        setHasLoadedOnce(true);
      }, 100);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

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
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });

    // 4. Petit délai pour que le scroll soit visible
    await new Promise(resolve => setTimeout(resolve, 300));

    // 5. Recharge les données
    await loadRides();

    // 6. Finir l'animation à 100% (rapide)
    await new Promise(resolve => {
      Animated.timing(progressAnim, {
        toValue: 100,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start(() => resolve());
    });

    // 7. Petit délai pour voir la barre à 100%
    await new Promise(resolve => setTimeout(resolve, 150));

    // 8. Masquer l'indicateur
    setIsReloadingFromTab(false);

    console.log('✅ Refresh terminé');
  }, [isReloadingFromTab, progressAnim]);

  // Rafraîchir les données
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRides();
  }, []);

  // Charger les données au focus de l'écran
  useFocusEffect(
    useCallback(() => {
      loadRides();
    }, [user])
  );

  // Écouter le tap sur l'icône History dans la tab bar (comme Instagram)
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', (e) => {
      // Si on est déjà sur cet écran, scroll to top + refresh
      if (navigation.isFocused()) {
        console.log('📱 Tab History cliqué - Scroll to top + refresh');
        e.preventDefault(); // Empêcher le comportement par défaut
        scrollToTopAndRefresh();
      }
    });

    return unsubscribe;
  }, [navigation, scrollToTopAndRefresh]);

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
    };
    loadProfilePhoto();
  }, [profile?.avatar_url, user?.id]); // Utiliser seulement les valeurs nécessaires dans les dépendances

  // Formater la durée
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Formater la date
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();

    // Comparer les dates (jour/mois/année) plutôt que les heures
    const dateDay = date.getDate();
    const dateMonth = date.getMonth();
    const dateYear = date.getFullYear();

    const nowDay = now.getDate();
    const nowMonth = now.getMonth();
    const nowYear = now.getFullYear();

    // Aujourd'hui : même jour, même mois, même année
    if (dateDay === nowDay && dateMonth === nowMonth && dateYear === nowYear) {
      return `Aujourd'hui, ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    // Hier : jour précédent (gérer le changement de mois/année)
    const yesterday = new Date(now);
    yesterday.setDate(nowDay - 1);

    if (dateDay === yesterday.getDate() &&
      dateMonth === yesterday.getMonth() &&
      dateYear === yesterday.getFullYear()) {
      return `Hier, ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    // Autres dates
    return `${date.getDate()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  };

  // Formater la distance
  const formatDistance = (meters) => {
    return `${((meters || 0) / 1000).toFixed(1)} km`;
  };

  // Calculer une région de carte optimisée pour zoom maximum avec rotation intelligente

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

  // Utiliser les villes sauvegardées
  const getStartEndCities = (ride) => {
    if (ride.startCity && ride.endCity) {
      return { start: ride.startCity, end: ride.endCity };
    }
    return { start: 'Ville inconnue', end: 'Ville inconnue' };
  };

  // Ouvrir le sheet d'options pour une carte
  const openOptionsSheet = (ride) => {
    setSelectedRide(ride);
    optionsSheetRef.current?.present();
  };

  // Supprimer le trajet
  const handleDeleteRide = async (rideToDelete) => {
    optionsSheetRef.current?.dismiss();

    try {
      if (!user?.id) {
        Alert.alert('Erreur', 'Vous devez être connecté pour supprimer un trajet');
        return;
      }

      const rideId = rideToDelete.id;

      // Supprimer de Supabase et du cache local (RideStorageService gère tout)
      try {
        await RideStorageService.deleteRide(rideId);
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        Alert.alert('Erreur', 'Impossible de supprimer le trajet');
        return;
      }

      // Recharger les trajets
      await loadRides();

      Alert.alert('Succès', 'Le trajet a été supprimé');
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      Alert.alert('Erreur', 'Impossible de supprimer le trajet');
    }
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
              await RideStorageService.deleteRide(ride.id);
              await loadRides();
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

  if (isLoading || !hasLoadedOnce) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Mes trajets</Text>
            </View>
          </View>
        </View>
        <HistorySkeleton />
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>
                Mes trajets
              </Text>
            </View>
            <TouchableOpacity
              style={styles.headerAction}
              onPress={() => filterSheetRef.current?.present()}
            >
              <Ionicons name="filter" size={22} color="#111827" />
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

        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
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
        >
          {filteredRides.length === 0 && rides.length > 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyStateTitle}>Aucun résultat</Text>
              <Text style={styles.emptyStateText}>
                {searchQuery.trim().length > 0
                  ? `Aucun trajet ne correspond à "${searchQuery}"`
                  : 'Aucun trajet ne correspond à vos filtres.'}
              </Text>
            </View>
          ) : filteredRides.length === 0 && hasLoadedOnce && !isLoading ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIcon}>
                <Ionicons name="time-outline" size={64} color="#CBD5E1" />
              </View>
              <Text style={styles.emptyStateTitle}>Aucun trajet enregistré</Text>
              <Text style={styles.emptyStateText}>
                Vos trajets sauvegardés apparaîtront ici.\nLancez votre premier trajet depuis l'écran principal !
              </Text>
              <TouchableOpacity
                style={styles.startButton}
                onPress={() => navigation.navigate('RecordTrip')}
              >
                <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                <Text style={styles.startButtonText}>Commencer un trajet</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredRides.map((ride, index) => {
              const cities = getStartEndCities(ride);
              const citiesList = [cities.start, cities.end].filter(Boolean);

              return (
                <View key={ride.id} style={[styles.runCard, index > 0 && styles.runCardMargin]}>
                  {/* Menu options */}
                  <TouchableOpacity
                    style={styles.runCardMenuButton}
                    onPress={() => openOptionsSheet(ride)}
                  >
                    <Ionicons name="ellipsis-horizontal" size={20} color="#666666" />
                  </TouchableOpacity>

                  {/* Date du trajet */}
                  <View style={styles.runHeader}>
                    <Ionicons name="time-outline" size={16} color="#64748B" />
                    <Text style={styles.runActivityText}>{formatDate(ride.startTime)}</Text>
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
                  </TouchableOpacity>

                  {/* Carte miniature */}
                  {ride.routeCoordinates && ride.routeCoordinates.length > 0 && (
                    <TouchableOpacity
                      style={styles.runMapSection}
                      onPress={() => handleRunPress(ride)}
                      activeOpacity={0.9}
                    >
                      <MiniRoutePreview
                        coordinates={ride.routeCoordinates}
                        style={styles.runMap}
                      />
                    </TouchableOpacity>
                  )}

                  {/* Stats */}
                  <View style={styles.runStatsSection}>
                    <View style={styles.runStatItemSimple}>
                      <Ionicons name="navigate" size={16} color="#64748B" />
                      <Text style={styles.runStatTextSimple}>{formatDistance(ride.distance)}</Text>
                    </View>
                    <View style={styles.runStatItemSimple}>
                      <Ionicons name="time" size={16} color="#64748B" />
                      <Text style={styles.runStatTextSimple}>{formatDuration(ride.duration)}</Text>
                    </View>
                    <View style={styles.runStatItemSimple}>
                      <Ionicons name="speedometer" size={16} color="#64748B" />
                      <Text style={styles.runStatTextSimple}>{(ride.averageSpeed || 0).toFixed(0)} km/h</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
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
      {/* BottomSheet d'options pour une carte */}
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
          <Text style={styles.optionsSheetTitle}>Options</Text>
          {selectedRide && (
            <TouchableOpacity
              style={styles.deleteOption}
              onPress={() => handleDeleteRide(selectedRide)}
            >
              <Ionicons name="trash-outline" size={24} color="#EF4444" />
              <Text style={styles.deleteOptionText}>Supprimer</Text>
            </TouchableOpacity>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
  },
  header: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
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
    fontSize: 22, color: '#111827',
    marginBottom: 24,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
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
    fontSize: 13,
    fontWeight: '600',
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
    backgroundColor: '#1E3A8A',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
    fontSize: 22, color: '#111827',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  optionsSheetContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 8,
  },
  optionsSheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  deleteOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    gap: 12,
  },
  deleteOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  headerAction: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 80,
  },
  emptyStateIcon: {
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 20, color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  startButtonText: {
    fontSize: 16, fontWeight: '400',
    color: '#FFFFFF',
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
  runHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 10,
  },
  runActivityText: {
    color: '#666666',
    fontSize: 12,
  },
  runActivityTitleSection: {
    paddingHorizontal: 15,
    paddingBottom: 8,
  },
  runActivityTitle: {
    fontSize: 18, fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  runMetaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vehicleText: {
    fontSize: 16, fontWeight: '400',
    color: '#111827',
  },
  runCitiesText: {
    color: '#111827',
    fontSize: 13,
  },
  runMapSection: {
    marginHorizontal: 15,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
    height: 200,
  },
  runMap: {
    flex: 1,
    borderRadius: 12,
  },
  runStatsSection: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 24,
  },
  runStatItemSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  runStatTextSimple: {
    fontSize: 16, fontWeight: '400',
    color: '#475569',
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
});
