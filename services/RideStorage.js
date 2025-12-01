import AsyncStorage from '@react-native-async-storage/async-storage';
import * as polyline from 'google-polyline';
import ridesService from './supabase/ridesService';
import offlineService from './offlineService';
import geocodingService from './geocodingService';
import ChallengesService from './ChallengesService';
import GroupsService from './GroupsService';

export class SavedRide {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.startTime = data.startTime;
    this.endTime = data.endTime;
    this.duration = data.duration;
    this.distance = data.distance;
    this.maxSpeed = data.maxSpeed;
    this.averageSpeed = data.averageSpeed;
    this.pace = data.pace || 0; // Allure en min/km
    const extraStats = data.extraStats || data.extra_stats || {};
    this.elevationGain = data.elevationGain !== undefined
      ? data.elevationGain
      : extraStats.elevationGain ?? extraStats.gain ?? 0; // Dénivelé positif (m)
    this.elevationLoss = data.elevationLoss !== undefined
      ? data.elevationLoss
      : extraStats.elevationLoss ?? extraStats.loss ?? 0; // Dénivelé négatif (m)
    this.totalStops = data.totalStops || 0; // Nombre d'arrêts
    this.totalStopTime = data.totalStopTime || 0; // Temps total d'arrêt (secondes)
    this.movingTime = data.movingTime || 0; // Temps en mouvement (sans arrêts, secondes)
    this.topSpeed = data.topSpeed || 0; // Vitesse de pointe sur 1km (km/h)
    this.avgMovingSpeed = data.avgMovingSpeed || 0; // Vitesse moyenne en mouvement (km/h)
    this.totalTurns = data.totalTurns || 0; // Nombre de virages détectés
    this.sharpTurns = data.sharpTurns || 0; // Nombre de virages serrés (>45°)
    this.smoothness = data.smoothness || 100; // Fluidité du trajet (0-100)
    this.drivingScore = data.drivingScore || 100; // Score de conduite
    this.polyline = data.polyline || ''; // Polyline compressé
    // Décompresser automatiquement le polyline si présent
    this.routeCoordinates = this._decompressRoute(data);
    this.photos = data.photos || [];
    this.vehicle = data.vehicle;
    this.startCity = data.startCity;
    this.endCity = data.endCity;
    this.cities = data.cities || [];
    this.steps = data.steps || [];
    this.userId = data.userId || 'default'; // ID de l'utilisateur propriétaire
    this.userName = data.userName || 'Utilisateur'; // Nom de l'utilisateur
    this.userAvatar = data.userAvatar || null; // Photo de profil de l'utilisateur
    this.pendingCityLookup = Boolean(data.pendingCityLookup);
    this.extraStats = extraStats && Object.keys(extraStats).length > 0 ? extraStats : null;
  }

  // Méthode privée pour décompresser le route
  _decompressRoute(data) {
    try {
      // Si polyline est fourni, le décompresser
      if (data.polyline) {
        const coords = polyline.decode(data.polyline);
        return coords.map(c => ({ latitude: c[0], longitude: c[1] }));
      }
      // Sinon, utiliser routeCoordinates si présent (legacy)
      return data.routeCoordinates || [];
    } catch (error) {
      console.error('Erreur décompression polyline:', error);
      return data.routeCoordinates || [];
    }
  }
}

class RideStorageService {
  static RIDES_KEY = '@rides';
  static STATS_KEY = '@global_stats';

  // Migrate legacy savedTrips (if any) into the new @rides key/format
  static async migrateLegacySavedTrips() {
    try {
      const legacyJson = await AsyncStorage.getItem('savedTrips');
      if (!legacyJson) return 0;

      const parsed = JSON.parse(legacyJson);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        await AsyncStorage.removeItem('savedTrips');
        return 0;
      }

      // Load existing rides to avoid duplicates
      const existing = await this.getAllRides();
      const existingIds = new Set(existing.map(r => String(r.id)));

      let migrated = 0;
      for (const item of parsed) {
        const itemId = item.id ? String(item.id) : null;
        if (itemId && existingIds.has(itemId)) {
          continue; // skip duplicate
        }

        // decode polyline if present
        let routeCoordinates = [];
        try {
          if (item.polyline) {
            const coords = polyline.decode(item.polyline);
            routeCoordinates = coords.map(c => ({ latitude: c[0], longitude: c[1] }));
          } else if (item.routeCoordinates) {
            routeCoordinates = item.routeCoordinates;
          }
        } catch (e) {
          routeCoordinates = item.routeCoordinates || [];
        }

        const rideData = {
          id: itemId || `legacy_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          name: item.name || item.title || 'Trajet',
          description: item.description || '',
          startTime: item.startTime || item.savedAt ? new Date(item.startTime || item.savedAt).toISOString() : new Date().toISOString(),
          endTime: item.endTime || item.savedAt ? new Date(item.endTime || item.savedAt).toISOString() : new Date().toISOString(),
          duration: item.duration || item.time || 0,
          distance: item.distance || 0,
          maxSpeed: item.maxSpeed || 0,
          averageSpeed: item.averageSpeed || 0,
          routeCoordinates,
          photos: item.photos || item.tripPhotos || [],
          vehicle: item.vehicle || 'car',
          startCity: item.startCity,
          endCity: item.endCity,
          steps: item.steps || [],
        };

        await this.saveRide(rideData);
        migrated++;
      }

      // Remove legacy key after migration
      await AsyncStorage.removeItem('savedTrips');
      return migrated;
    } catch (error) {
      console.error('Erreur migration savedTrips -> @rides:', error);
      return 0;
    }
  }

  // Get all rides (all users - for Feed)
  static async getAllRides(options = {}) {
    try {
      // Vérifier si connecté à internet
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        // Mode online: récupérer depuis Supabase
        const { rides, error } = await ridesService.getAllRides(options);
        if (error) {
          console.error('Erreur getAllRides Supabase:', error);
          // Fallback sur cache local (avec pagination)
          return await this._getLocalRides(options);
        }

        // Cacher en local pour mode offline (seulement la première page pour éviter d'écraser tout le cache avec partiel)
        if (!options.offset || options.offset === 0) {
          await this._cacheRides(rides);
        }

        return rides.map(data => new SavedRide(data));
      } else {
        // Mode offline: utiliser le cache local (avec pagination)
        return await this._getLocalRides(options);
      }
    } catch (error) {
      console.error('Error loading rides:', error);
      return await this._getLocalRides();
    }
  }

  // Récupérer les rides du cache local
  static async _getLocalRides(options = {}) {
    try {
      const ridesJson = await AsyncStorage.getItem(this.RIDES_KEY);
      if (!ridesJson) return [];

      const ridesData = JSON.parse(ridesJson);
      let rides = ridesData.map(data => new SavedRide(data));

      // Appliquer la pagination si des options sont fournies
      if (options.limit !== undefined && options.offset !== undefined) {
        const start = options.offset;
        const end = start + options.limit;
        rides = rides.slice(start, end);
        console.log(`📦 Cache local: retour de ${rides.length} trajets (offset: ${options.offset}, limit: ${options.limit})`);
      }

      return rides;
    } catch (error) {
      console.error('Error loading local rides:', error);
      return [];
    }
  }

  // Cacher les rides en local
  static async _cacheRides(rides) {
    try {
      await AsyncStorage.setItem(this.RIDES_KEY, JSON.stringify(rides));
    } catch (error) {
      console.error('Error caching rides:', error);
    }
  }

  // Get rides for a specific user (for History)
  static async getUserRides(userId) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        // Mode online: récupérer depuis Supabase
        const { rides, error } = await ridesService.getUserRides(userId);
        if (error) {
          console.error('Erreur getUserRides Supabase:', error);
          // Fallback sur cache local
          const allRides = await this._getLocalRides();
          return allRides.filter(ride => ride.userId === userId);
        }

        return rides.map(data => new SavedRide(data));
      } else {
        // Mode offline: filtrer le cache local
        const allRides = await this._getLocalRides();
        return allRides.filter(ride => ride.userId === userId);
      }
    } catch (error) {
      console.error('Error loading user rides:', error);
      return [];
    }
  }

  // Get a single ride by ID
  static async getRideById(id) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        const { ride, error } = await ridesService.getRideById(id);
        if (error) {
          console.error('Erreur getRideById Supabase:', error);
          // Fallback sur cache local
          const rides = await this._getLocalRides();
          return rides.find(r => r.id === id);
        }
        return ride ? new SavedRide(ride) : null;
      } else {
        const rides = await this._getLocalRides();
        return rides.find(r => r.id === id);
      }
    } catch (error) {
      console.error('Error getting ride by ID:', error);
      return null;
    }
  }

  // Save a new ride
  static async saveRide(rideData) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (rideData && Array.isArray(rideData.routeCoordinates) && rideData.routeCoordinates.length > 0) {
        try {
          await geocodingService.populateRideCities(rideData, { isOnline });
        } catch (geoError) {
          console.warn('RideStorageService.saveRide: geocoding failed', geoError);
          if (!isOnline) {
            rideData.pendingCityLookup = true;
          }
        }
      } else if (!isOnline) {
        rideData.pendingCityLookup = true;
      }

      if (isOnline) {
        // Mode online: sauvegarder directement dans Supabase
        const { ride, error } = await ridesService.createRide(rideData);
        if (error) {
          console.error('Erreur saveRide Supabase:', error);
          // Ajouter à la queue offline
          await offlineService.enqueue('CREATE_RIDE', rideData);
          // Sauvegarder localement en attendant
          return await this._saveLocalRide(rideData);
        }

        // Mettre à jour le cache local
        const newRide = new SavedRide({
          ...ride,
          extraStats: rideData.extraStats || null,
          pendingCityLookup: rideData.pendingCityLookup,
        });
        await this._addToLocalCache(newRide);
        await this._addToLocalCache(newRide);

        // Mettre à jour les défis en arrière-plan
        this._updateChallengeProgress(newRide).catch(err => console.warn('Erreur update challenges:', err));

        return newRide;
      } else {
        // Mode offline: sauvegarder localement et ajouter à la queue
        await offlineService.enqueue('CREATE_RIDE', rideData);
        const savedRide = await this._saveLocalRide(rideData);

        // Tenter de mettre à jour les défis même en offline (si données en cache)
        this._updateChallengeProgress(savedRide).catch(err => console.warn('Erreur update challenges offline:', err));

        return savedRide;
      }
    } catch (error) {
      console.error('Error saving ride:', error);
      throw error;
    }
  }

  // Update an existing ride
  static async updateRide(rideId, updates) {
    try {
      const isOnline = await offlineService.checkConnection();

      // Update local cache first for immediate UI feedback
      const localRides = await this._getLocalRides();
      const rideIndex = localRides.findIndex(r => r.id === rideId);

      if (rideIndex >= 0) {
        const updatedRide = { ...localRides[rideIndex], ...updates };
        localRides[rideIndex] = updatedRide;
        await AsyncStorage.setItem(this.RIDES_KEY, JSON.stringify(localRides));
      }

      if (isOnline) {
        const { error } = await ridesService.updateRide(rideId, updates);
        if (error) {
          console.error('Erreur updateRide Supabase:', error);
          await offlineService.enqueue('UPDATE_RIDE', { id: rideId, ...updates });
        }
      } else {
        await offlineService.enqueue('UPDATE_RIDE', { id: rideId, ...updates });
      }

      return true;
    } catch (error) {
      console.error('Error updating ride:', error);
      return false;
    }
  }

  // Mettre à jour la progression des défis
  static async _updateChallengeProgress(ride) {
    try {
      // Vérifier si userId est valide (pas 'default' et format UUID)
      if (!ride || !ride.userId || ride.userId === 'default') {
        console.log('⚠️ [RideStorage] Pas de mise à jour défi: userId invalide ou default', ride?.userId);
        return;
      }

      // Validation UUID simple
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ride.userId);
      if (!isUuid) {
        console.log('⚠️ [RideStorage] Pas de mise à jour défi: userId non-UUID', ride.userId);
        return;
      }

      console.log('🏆 [RideStorage] Checking challenges for ride:', ride.id);

      // 1. Récupérer les groupes de l'utilisateur
      const userGroups = await GroupsService.getUserGroups(ride.userId);
      if (!userGroups || userGroups.length === 0) return;

      // 2. Pour chaque groupe, vérifier les défis actifs
      for (const group of userGroups) {
        const activeChallenges = await ChallengesService.getActiveChallenges(group.id);
        if (!activeChallenges || activeChallenges.length === 0) continue;

        for (const challenge of activeChallenges) {
          // Vérifier si le défi est en cours (dates)
          const now = new Date();
          const startDate = new Date(challenge.start_date);
          const endDate = new Date(challenge.end_date);

          if (now < startDate || now > endDate) continue;

          // Vérifier si le trajet est dans la période du défi
          const rideDate = new Date(ride.startTime);
          if (rideDate < startDate || rideDate > endDate) continue;

          // Calculer la contribution
          let progress = 0;
          let bestSpeed = 0;

          if (challenge.type === 'distance') {
            // Distance en mètres
            progress = ride.distance || 0;
          } else if (challenge.type === 'speed') {
            // Vitesse max en km/h
            bestSpeed = ride.maxSpeed || 0;
            // Pour un défi vitesse, on ne cumule pas le progrès, on garde le meilleur
            // Mais l'API attend un delta ou une valeur absolue ? 
            // Supposons que l'API gère le "meilleur des deux"
          } else if (challenge.type === 'count') {
            // Nombre de trajets
            progress = 1;
          }

          if (progress > 0 || bestSpeed > 0) {
            console.log(`🏆 [RideStorage] Updating challenge ${challenge.title} (${challenge.id}) for group ${group.name}`);
            await ChallengesService.updateChallengeProgress(challenge.id, ride.userId, {
              progress,
              best_speed: bestSpeed
            });
          }
        }
      }
    } catch (error) {
      console.error('❌ [RideStorage] Error updating challenges:', error);
    }
  }

  // Sauvegarder localement
  static async _saveLocalRide(rideData) {
    const ridesJson = await AsyncStorage.getItem(this.RIDES_KEY);
    const rides = ridesJson ? JSON.parse(ridesJson) : [];
    const newRidePayload = {
      id: rideData.id || Date.now().toString(),
      ...rideData,
    };

    // Garantir que les villes sont des tableaux simples
    if (Array.isArray(newRidePayload.cities)) {
      newRidePayload.cities = newRidePayload.cities.filter(Boolean);
    }

    rides.push(newRidePayload);
    await AsyncStorage.setItem(this.RIDES_KEY, JSON.stringify(rides));

    return new SavedRide(newRidePayload);
  }

  // Ajouter au cache local
  static async _addToLocalCache(ride) {
    try {
      const ridesJson = await AsyncStorage.getItem(this.RIDES_KEY);
      const rides = ridesJson ? JSON.parse(ridesJson) : [];
      const plainRide = {
        ...ride,
      };

      if (Array.isArray(plainRide.cities)) {
        plainRide.cities = plainRide.cities.filter(Boolean);
      }

      const existingIndex = rides.findIndex((item) => String(item.id) === String(plainRide.id));
      if (existingIndex >= 0) {
        rides[existingIndex] = { ...rides[existingIndex], ...plainRide };
      } else {
        rides.push(plainRide);
      }

      await AsyncStorage.setItem(this.RIDES_KEY, JSON.stringify(rides));
    } catch (error) {
      console.error('Error adding to cache:', error);
    }
  }

  // Delete a ride
  static async deleteRide(id) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        // Mode online: supprimer de Supabase
        const { error } = await ridesService.deleteRide(id);
        if (error) {
          console.error('Erreur deleteRide Supabase:', error);
          // Ajouter à la queue offline
          await offlineService.enqueue('DELETE_RIDE', { rideId: id });
        }
      } else {
        // Mode offline: ajouter à la queue
        await offlineService.enqueue('DELETE_RIDE', { rideId: id });
      }

      // Supprimer du cache local dans tous les cas
      const rides = await this._getLocalRides();
      const filteredRides = rides.filter(ride => ride.id !== id);
      await AsyncStorage.setItem(this.RIDES_KEY, JSON.stringify(filteredRides));
    } catch (error) {
      console.error('Error deleting ride:', error);
      throw error;
    }
  }

  // Get global statistics (all users - for Feed)
  static async getGlobalStats() {
    try {
      const rides = await this.getAllRides();

      if (rides.length === 0) {
        return {
          totalRides: 0,
          totalDistance: 0,
          totalDuration: 0,
          averageSpeed: 0,
        };
      }

      const totalRides = rides.length;
      const totalDistance = rides.reduce((sum, ride) => sum + (ride.distance || 0), 0);
      const totalDuration = rides.reduce((sum, ride) => sum + (ride.duration || 0), 0);
      const averageSpeed = totalDistance > 0
        ? (totalDistance / 1000) / (totalDuration / 3600)
        : 0;

      return {
        totalRides,
        totalDistance,
        totalDuration,
        averageSpeed,
      };
    } catch (error) {
      console.error('Error getting global stats:', error);
      return {
        totalRides: 0,
        totalDistance: 0,
        totalDuration: 0,
        averageSpeed: 0,
      };
    }
  }

  // Get global statistics for a specific user
  static async getUserStats(userId) {
    try {
      const userRides = await this.getUserRides(userId);

      if (userRides.length === 0) {
        return {
          totalRides: 0,
          totalDistance: 0,
          totalDuration: 0,
          averageSpeed: 0,
        };
      }

      const totalRides = userRides.length;
      const totalDistance = userRides.reduce((sum, ride) => sum + (ride.distance || 0), 0);
      const totalDuration = userRides.reduce((sum, ride) => sum + (ride.duration || 0), 0);
      const averageSpeed = totalDistance > 0
        ? (totalDistance / 1000) / (totalDuration / 3600)
        : 0;

      return {
        totalRides,
        totalDistance,
        totalDuration,
        averageSpeed,
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return {
        totalRides: 0,
        totalDistance: 0,
        totalDuration: 0,
        averageSpeed: 0,
      };
    }
  }

  // Clear all rides
  static async clearAllRides() {
    try {
      await AsyncStorage.removeItem(this.RIDES_KEY);
    } catch (error) {
      console.error('Error clearing rides:', error);
      throw error;
    }
  }
}

export { RideStorageService };



