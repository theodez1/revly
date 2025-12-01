import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import ridesService from './supabase/ridesService';
import vehiclesService from './supabase/vehiclesService';
import groupsService from './supabase/groupsService';
import challengesService from './supabase/challengesService';
import postsService from './supabase/postsService';
import geocodingService from './geocodingService';

/**
 * Service de synchronisation offline
 * Gère une queue d'actions en attente et les synchronise quand la connexion revient
 */
class OfflineService {
  constructor() {
    this.QUEUE_KEY = '@offline_queue';
    this.IS_SYNCING_KEY = '@is_syncing';
    this.RIDES_KEY = '@rides';
    this.isOnline = true;
    this.isSyncing = false;
    this.listeners = [];

    // Écouter les changements de connexion
    this.setupNetworkListener();
  }

  /**
   * Configurer l'écouteur réseau
   */
  setupNetworkListener() {
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected && state.isInternetReachable;

      console.log('📡 État connexion:', this.isOnline ? 'Online' : 'Offline');

      // Si on vient de revenir online, lancer la sync
      if (wasOffline && this.isOnline) {
        console.log('🔄 Connexion rétablie, démarrage sync...');
        this.syncQueue();
      }

      // Notifier les listeners
      this.notifyListeners({
        isOnline: this.isOnline,
        isSyncing: this.isSyncing,
      });
    });
  }

  /**
   * Vérifier l'état de la connexion
   */
  async checkConnection() {
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected && state.isInternetReachable;
    return this.isOnline;
  }

  /**
   * Ajouter une action à la queue
   * @param {string} type - 'CREATE_RIDE' | 'UPDATE_RIDE' | 'DELETE_RIDE' | 'UPLOAD_PHOTO' | 'CREATE_GROUP' | 'UPDATE_GROUP' | 'JOIN_GROUP' | 'LEAVE_GROUP' | 'CREATE_CHALLENGE' | 'UPDATE_CHALLENGE_PROGRESS' | 'CREATE_POST' | 'TOGGLE_POST_LIKE' | 'CREATE_COMMENT'
   * @param {Object} data - Données de l'action
   */
  async enqueue(type, data) {
    try {
      const queue = await this.getQueue();

      const action = {
        id: Date.now().toString(),
        type,
        data,
        timestamp: new Date().toISOString(),
        retries: 0,
      };

      queue.push(action);
      await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));

      console.log(`📥 Action ajoutée à la queue: ${type}`, action.id);

      // Notifier les listeners
      this.notifyListeners({
        isOnline: this.isOnline,
        isSyncing: this.isSyncing,
        queueSize: queue.length,
      });

      return action.id;
    } catch (error) {
      console.error('Erreur enqueue:', error);
      throw error;
    }
  }

  /**
   * Récupérer la queue
   */
  async getQueue() {
    try {
      const queueJson = await AsyncStorage.getItem(this.QUEUE_KEY);
      return queueJson ? JSON.parse(queueJson) : [];
    } catch (error) {
      console.error('Erreur getQueue:', error);
      return [];
    }
  }

  /**
   * Obtenir la taille de la queue
   */
  async getQueueSize() {
    const queue = await this.getQueue();
    return queue.length;
  }

  /**
   * Synchroniser la queue
   */
  async syncQueue() {
    // Si déjà en cours de sync ou offline, ne rien faire
    if (this.isSyncing || !this.isOnline) {
      return;
    }

    try {
      this.isSyncing = true;
      await AsyncStorage.setItem(this.IS_SYNCING_KEY, 'true');

      const queue = await this.getQueue();

      if (queue.length === 0) {
        console.log('✅ Queue vide, rien à synchroniser');
        this.isSyncing = false;
        await AsyncStorage.setItem(this.IS_SYNCING_KEY, 'false');
        return;
      }

      console.log(`🔄 Synchronisation de ${queue.length} action(s)...`);

      const remaining = [];

      for (const action of queue) {
        try {
          await this.processAction(action);
          console.log(`✅ Action ${action.id} synchronisée`);
        } catch (error) {
          console.error(`❌ Erreur sync action ${action.id}:`, error);

          // Incrémenter le compteur de tentatives
          action.retries = (action.retries || 0) + 1;

          // Abandonner après 3 tentatives
          if (action.retries < 3) {
            remaining.push(action);
          } else {
            console.error(`❌ Action ${action.id} abandonnée après 3 tentatives`);
          }
        }
      }

      // Mettre à jour la queue avec les actions restantes
      await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(remaining));

      console.log(`✅ Synchronisation terminée. ${remaining.length} action(s) en attente`);

      // Notifier les listeners
      this.notifyListeners({
        isOnline: this.isOnline,
        isSyncing: false,
        queueSize: remaining.length,
      });

    } catch (error) {
      console.error('Erreur syncQueue:', error);
    } finally {
      this.isSyncing = false;
      await AsyncStorage.setItem(this.IS_SYNCING_KEY, 'false');
    }
  }

  /**
   * Traiter une action
   */
  async processAction(action) {
    switch (action.type) {
      case 'CREATE_RIDE': {
        await geocodingService.populateRideCities(action.data, { isOnline: true });
        const { ride, error } = await ridesService.createRide(action.data);
        if (error) {
          throw error;
        }

        await this.updateLocalRideCache(action.data.id, {
          startCity: action.data.startCity || null,
          endCity: action.data.endCity || null,
          cities: Array.isArray(action.data.cities) ? action.data.cities : [],
          pendingCityLookup: false,
          extraStats: action.data.extraStats || null,
        });

        return { ride, error: null };
      }

      case 'UPDATE_RIDE':
        return await ridesService.updateRide(action.data.rideId, action.data.updates);

      case 'DELETE_RIDE':
        return await ridesService.deleteRide(action.data.rideId);

      case 'UPLOAD_RIDE_PHOTO':
        return await ridesService.uploadRidePhoto(
          action.data.userId,
          action.data.rideId,
          action.data.photoUri,
          action.data.location
        );

      case 'CREATE_VEHICLE':
        return await vehiclesService.createVehicle(action.data);

      case 'UPDATE_VEHICLE':
        return await vehiclesService.updateVehicle(action.data.vehicleId, action.data.updates);

      case 'DELETE_VEHICLE':
        return await vehiclesService.deleteVehicle(action.data.vehicleId);

      case 'CREATE_GROUP':
        return await groupsService.createGroup(action.data);

      case 'UPDATE_GROUP':
        return await groupsService.updateGroup(action.data.id, action.data.updates);

      case 'JOIN_GROUP':
        return await groupsService.joinGroup(action.data.groupId, action.data.userId);

      case 'LEAVE_GROUP':
        return await groupsService.leaveGroup(action.data.groupId, action.data.userId);

      case 'CREATE_CHALLENGE':
        return await challengesService.createChallenge(action.data);

      case 'UPDATE_CHALLENGE_PROGRESS': {
        const { userId } = action.data;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

        if (!userId || userId === 'default' || !isUuid) {
          console.log('⚠️ Action offline ignorée (userId invalide):', action.type, userId);
          return { participant: null, error: null }; // On retourne succès pour dépiler l'action
        }

        return await challengesService.updateParticipantProgress(
          action.data.challengeId,
          action.data.userId,
          action.data.progressData
        );
      }

      case 'CREATE_POST':
        return await postsService.createPost(action.data);

      case 'TOGGLE_POST_LIKE':
        return await postsService.toggleLike(action.data.postId, action.data.userId);

      case 'CREATE_COMMENT':
        return await postsService.createComment(action.data);

      default:
        throw new Error(`Type d'action inconnu: ${action.type}`);
    }
  }

  /**
   * Vider la queue (utiliser avec précaution)
   */
  async clearQueue() {
    await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify([]));
    console.log('🗑️ Queue vidée');

    this.notifyListeners({
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      queueSize: 0,
    });
  }

  /**
   * Ajouter un listener pour les changements d'état
   */
  addListener(callback) {
    this.listeners.push(callback);

    // Retourner une fonction pour retirer le listener
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Notifier tous les listeners
   */
  notifyListeners(state) {
    this.listeners.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error('Erreur listener offline:', error);
      }
    });
  }

  /**
   * Obtenir l'état actuel
   */
  async getState() {
    const queueSize = await this.getQueueSize();
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      queueSize,
    };
  }

  async updateLocalRideCache(rideId, updates) {
    if (!rideId || !updates) {
      return;
    }

    try {
      const ridesJson = await AsyncStorage.getItem(this.RIDES_KEY);
      if (!ridesJson) {
        return;
      }

      const rides = JSON.parse(ridesJson);
      const index = rides.findIndex((ride) => String(ride.id) === String(rideId));
      if (index === -1) {
        return;
      }

      const newCities = Array.isArray(updates.cities) ? updates.cities.filter(Boolean) : undefined;

      rides[index] = {
        ...rides[index],
        ...updates,
        ...(newCities !== undefined ? { cities: newCities } : {}),
      };

      await AsyncStorage.setItem(this.RIDES_KEY, JSON.stringify(rides));
    } catch (error) {
      console.error('offlineService.updateLocalRideCache error:', error);
    }
  }
}

export default new OfflineService();
