import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import vehiclesService from './supabase/vehiclesService';
import offlineService from './offlineService';

const VEHICLES_BASE_KEY = '@vehicles';
const DEFAULT_VEHICLE_ID_BASE_KEY = '@defaultVehicleId';
const LEGACY_VEHICLES_KEY = VEHICLES_BASE_KEY;
const LEGACY_DEFAULT_VEHICLE_KEY = DEFAULT_VEHICLE_ID_BASE_KEY;

const getVehiclesStorageKey = (userId: string | null) => `${VEHICLES_BASE_KEY}:${userId || 'guest'}`;
const getDefaultVehicleStorageKey = (userId: string | null) => `${DEFAULT_VEHICLE_ID_BASE_KEY}:${userId || 'guest'}`;
const getVehiclePhotoKey = (vehicleId: string, userId: string) => `@vehiclePhoto:${userId || 'guest'}:${vehicleId}`;
const getVehiclePhotoPath = (vehicleId: string, userId: string) => `${FileSystem.documentDirectory}vehicles/${userId || 'guest'}/${vehicleId}.jpg`;

export async function cacheVehiclePhoto(remoteUri: string, vehicleId: string, userId: string): Promise<string | null> {
  try {
    if (!remoteUri || !vehicleId) {
      return null;
    }

    // Vérifier si l'image est déjà en cache et existe
    const existingCache = await getCachedVehiclePhoto(vehicleId, userId);
    if (existingCache) {
      const fileInfo = await FileSystem.getInfoAsync(existingCache);
      if (fileInfo.exists) {
        // Photo déjà en cache, pas besoin de re-télécharger
        return existingCache;
      }
    }

    // Télécharger depuis Supabase uniquement si pas déjà en cache
    const directory = `${FileSystem.documentDirectory}vehicles/${userId || 'guest'}`;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(() => {});
    const destination = getVehiclePhotoPath(vehicleId, userId);

    if (remoteUri.startsWith('file://')) {
      // Copier depuis un fichier local
      if (remoteUri !== destination) {
        await FileSystem.copyAsync({ from: remoteUri, to: destination });
      }
    } else {
      // Télécharger depuis une URL (Supabase)
      try {
        const result = await FileSystem.downloadAsync(remoteUri, destination);
        
        // Vérifier que result existe
        if (!result) {
          // Pas de log si result est undefined (erreur réseau silencieuse)
          return remoteUri; // Retourner l'URL Supabase en fallback
        }
        
        // Vérifier le statusCode - si undefined/null, considérer comme erreur
        const statusCode = result.status;
        if (statusCode === undefined || statusCode === null) {
          // Erreur réseau ou réponse invalide - pas de log pour éviter le spam
          // Supprimer le fichier partiel s'il existe
          try {
            const fileInfo = await FileSystem.getInfoAsync(destination);
            if (fileInfo.exists) {
              await FileSystem.deleteAsync(destination, { idempotent: true });
            }
          } catch (deleteError) {
            // Ignorer les erreurs de suppression
          }
          return remoteUri; // Retourner l'URL Supabase en fallback
        }
        
        // Vérifier si le statusCode est différent de 200
        if (statusCode !== 200) {
          console.warn('[CACHE] Erreur téléchargement photo, status:', statusCode);
          // Supprimer le fichier partiel s'il existe
          try {
            const fileInfo = await FileSystem.getInfoAsync(destination);
            if (fileInfo.exists) {
              await FileSystem.deleteAsync(destination, { idempotent: true });
            }
          } catch (deleteError) {
            // Ignorer les erreurs de suppression
          }
          return remoteUri; // Retourner l'URL Supabase en fallback
        }
      } catch (downloadError) {
        // Erreur réseau ou autre - pas de log pour éviter le spam
        // Supprimer le fichier partiel s'il existe
        try {
          const fileInfo = await FileSystem.getInfoAsync(destination);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(destination, { idempotent: true });
          }
        } catch (deleteError) {
          // Ignorer les erreurs de suppression
        }
        return remoteUri; // Retourner l'URL Supabase en fallback
      }
    }

    await AsyncStorage.setItem(getVehiclePhotoKey(vehicleId, userId), destination);
    return destination;
  } catch (error) {
    console.warn('[CACHE] Erreur cache vehicle photo:', error);
    // En cas d'erreur, retourner l'URL Supabase pour affichage direct
    return remoteUri;
  }
}

export async function getCachedVehiclePhoto(vehicleId: string, userId: string): Promise<string | null> {
  try {
    const localUri = await AsyncStorage.getItem(getVehiclePhotoKey(vehicleId, userId));
    if (!localUri) {
      return null;
    }
    const info = await FileSystem.getInfoAsync(localUri);
    if (!info.exists) {
      await AsyncStorage.removeItem(getVehiclePhotoKey(vehicleId, userId));
      return null;
    }
    return localUri;
  } catch (error) {
    console.warn('Erreur récupération photo vehicle:', error);
    return null;
  }
}

export async function loadVehicles(userId: string): Promise<any[]> {
  try {
    const storageKey = getVehiclesStorageKey(userId);
    let cachedRaw = await AsyncStorage.getItem(storageKey);

    if (!cachedRaw) {
      const legacyRaw = await AsyncStorage.getItem(LEGACY_VEHICLES_KEY);
      if (legacyRaw) {
        cachedRaw = legacyRaw;
        await AsyncStorage.setItem(storageKey, legacyRaw);
      }
    }

    const cachedVehiclesRaw = cachedRaw ? JSON.parse(cachedRaw) : [];
    const cachedVehicles = await Promise.all(
      cachedVehiclesRaw.map(async (vehicle: any) => {
        if (vehicle?.photoUri) {
          return vehicle;
        }
        const localPhoto = await getCachedVehiclePhoto(vehicle.id, userId);
        if (localPhoto) {
          return { ...vehicle, photoUri: localPhoto };
        }
        return vehicle;
      }),
    );

    if (cachedVehicles.length > 0) {
      if (userId) {
        const isOnline = await offlineService.checkConnection();
        if (isOnline) {
          // Mise à jour en arrière-plan depuis Supabase
          vehiclesService
            .getUserVehicles(userId)
            .then(({ vehicles, error }) => {
              if (!error && vehicles) {
                Promise.all(
                  vehicles.map(async (vehicle: any) => {
                    // Récupérer l'URL depuis Supabase
                    const supabasePhotoUrl = vehicle?.photoUrl || vehicle?.photoUri || null;
                    
                    // Vérifier si l'image est déjà en cache local
                    const cachedPhoto = await getCachedVehiclePhoto(vehicle.id, userId);
                    if (cachedPhoto) {
                      // Vérifier que le fichier existe toujours
                      const fileInfo = await FileSystem.getInfoAsync(cachedPhoto);
                      if (fileInfo.exists) {
                        // Image déjà en cache et existe, pas besoin de re-télécharger
                        return { 
                          ...vehicle, 
                          photoUrl: supabasePhotoUrl,
                          photoUri: cachedPhoto 
                        };
                      }
                    }
                    
                    // Si pas de cache ou cache invalide, télécharger depuis Supabase
                    if (supabasePhotoUrl) {
                      const localPhoto = await cacheVehiclePhoto(supabasePhotoUrl, vehicle.id, userId);
                      return { 
                        ...vehicle, 
                        photoUrl: supabasePhotoUrl,
                        photoUri: localPhoto || supabasePhotoUrl 
                      };
                    }
                    
                    return { 
                      ...vehicle, 
                      photoUri: cachedPhoto || null 
                    };
                  }),
                )
                  .then(async (vehiclesWithPhoto) => {
                    const serialized = JSON.stringify(vehiclesWithPhoto);
                    await AsyncStorage.setItem(storageKey, serialized);
                    await AsyncStorage.setItem(LEGACY_VEHICLES_KEY, serialized);
                  })
                  .catch((err) => console.warn('Erreur mise à jour cache véhicules:', err));
              }
            })
            .catch((err) => console.warn('Erreur chargement véhicules en arrière-plan:', err));
        }
      }
      return cachedVehicles;
    }

    const isOnline = await offlineService.checkConnection();

    if (isOnline && userId) {
      // TOUJOURS récupérer depuis Supabase d'abord
      const { vehicles, error } = await vehiclesService.getUserVehicles(userId);
      if (error) {
        console.error('Erreur loadVehicles Supabase:', error);
        return cachedVehicles;
      }
      
      // Pour chaque véhicule, télécharger et sauvegarder l'image localement
      const vehiclesWithPhoto = await Promise.all(
        (vehicles || []).map(async (vehicle: any) => {
          // Récupérer l'URL depuis Supabase (photoUrl ou photoUri)
          const supabasePhotoUrl = vehicle?.photoUrl || vehicle?.photoUri || null;
          
          // Vérifier d'abord si l'image est déjà en cache local
          const cachedPhoto = await getCachedVehiclePhoto(vehicle.id, userId);
          if (cachedPhoto) {
            const fileInfo = await FileSystem.getInfoAsync(cachedPhoto);
            if (fileInfo.exists) {
              // Image déjà en cache et valide, pas besoin de re-télécharger
              return { 
                ...vehicle, 
                photoUrl: supabasePhotoUrl,
                photoUri: cachedPhoto 
              };
            }
          }
          
          // Si pas de cache valide et qu'on a une URL Supabase, télécharger
          if (supabasePhotoUrl) {
            const localPhoto = await cacheVehiclePhoto(supabasePhotoUrl, vehicle.id, userId);
            return { 
              ...vehicle, 
              photoUrl: supabasePhotoUrl,
              photoUri: localPhoto || supabasePhotoUrl 
            };
          }
          
          return { 
            ...vehicle, 
            photoUri: cachedPhoto || null 
          };
        }),
      );
      
      // Sauvegarder dans le cache local
      const serialized = JSON.stringify(vehiclesWithPhoto);
      await AsyncStorage.setItem(storageKey, serialized);
      await AsyncStorage.setItem(LEGACY_VEHICLES_KEY, serialized);
      return vehiclesWithPhoto;
    }

    return cachedVehicles;
  } catch (e) {
    console.error('Erreur loadVehicles:', e);
    try {
      const storageKey = getVehiclesStorageKey(userId);
      const raw = await AsyncStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

export async function loadDefaultVehicleId(userId: string): Promise<string | null> {
  try {
    const storageKey = getDefaultVehicleStorageKey(userId);
    let cachedId = await AsyncStorage.getItem(storageKey);

    if (!cachedId) {
      cachedId = await AsyncStorage.getItem(LEGACY_DEFAULT_VEHICLE_KEY);
      if (cachedId) {
        await AsyncStorage.setItem(storageKey, cachedId);
      }
    }

    if (cachedId) {
      if (userId) {
        const isOnline = await offlineService.checkConnection();
        if (isOnline) {
          vehiclesService.getDefaultVehicle(userId)
            .then(({ vehicle, error }) => {
              if (!error && vehicle?.id) {
                Promise.all([
                  AsyncStorage.setItem(storageKey, String(vehicle.id)),
                  AsyncStorage.setItem(LEGACY_DEFAULT_VEHICLE_KEY, String(vehicle.id)),
                ]).catch((err) => console.warn('Erreur mise à jour cache véhicule par défaut:', err));
              }
            })
            .catch((err) => console.warn('Erreur chargement véhicule par défaut en arrière-plan:', err));
        }
      }
      return cachedId;
    }

    const isOnline = await offlineService.checkConnection();

    if (isOnline && userId) {
      const { vehicle, error } = await vehiclesService.getDefaultVehicle(userId);
      if (error) {
        console.error('Erreur loadDefaultVehicleId Supabase:', error);
        return null;
      }

      const defaultId = vehicle?.id || null;
      if (defaultId) {
        await AsyncStorage.setItem(storageKey, String(defaultId));
        await AsyncStorage.setItem(LEGACY_DEFAULT_VEHICLE_KEY, String(defaultId));
      }
      return defaultId;
    }

    return null;
  } catch (e) {
    console.error('Erreur loadDefaultVehicleId:', e);
    try {
      const storageKey = getDefaultVehicleStorageKey(userId);
      const id = await AsyncStorage.getItem(storageKey);
      return id || null;
    } catch {
      return null;
    }
  }
}

export async function setDefaultVehicleId(id: string | null | undefined, userId: string) {
  try {
    const storageKey = getDefaultVehicleStorageKey(userId);
    const isOnline = await offlineService.checkConnection();

    if (isOnline && userId && id) {
      const { error } = await vehiclesService.setDefaultVehicle(userId, id);
      if (error) {
        console.error('Erreur setDefaultVehicleId Supabase:', error);
      }
    }

    if (id === null || id === undefined) {
      await AsyncStorage.removeItem(storageKey);
      await AsyncStorage.removeItem(LEGACY_DEFAULT_VEHICLE_KEY);
    } else {
      await AsyncStorage.setItem(storageKey, String(id));
      await AsyncStorage.setItem(LEGACY_DEFAULT_VEHICLE_KEY, String(id));
    }
  } catch (e) {
    console.error('Erreur setDefaultVehicleId:', e);
  }
}

export async function saveVehicle(vehicleData: any, userId: string) {
  try {
    const storageKey = getVehiclesStorageKey(userId);
    const isOnline = await offlineService.checkConnection();

    if (isOnline && userId) {
      const dataWithUser = { ...vehicleData, userId };
      const { vehicle, error } = await vehiclesService.createVehicle(dataWithUser);
      if (error) {
        console.error('Erreur saveVehicle Supabase:', error);
        await offlineService.enqueue('CREATE_VEHICLE', dataWithUser);
      } else {
        let vehicleWithPhoto = vehicle;
        if (vehicleData.photoUri) {
          const localPhoto = await cacheVehiclePhoto(vehicleData.photoUri, vehicle.id, userId);
          vehicleWithPhoto = { ...vehicleWithPhoto, photoUri: localPhoto || vehicleData.photoUri };
        }
        const vehicles = await loadVehicles(userId);
        const filtered = vehicles.filter((item) => String(item.id) !== String(vehicle.id));
        const updated = [...filtered, vehicleWithPhoto];
        const serialized = JSON.stringify(updated);
        await AsyncStorage.setItem(storageKey, serialized);
        await AsyncStorage.setItem(LEGACY_VEHICLES_KEY, serialized);
        return vehicleWithPhoto;
      }
    } else {
      await offlineService.enqueue('CREATE_VEHICLE', { ...vehicleData, userId });
    }

    const vehicles = await loadVehicles(userId);
    const newVehicle = {
      id: vehicleData.id || Date.now().toString(),
      ...vehicleData,
    };
    if (vehicleData.photoUri) {
      const localPhoto = await cacheVehiclePhoto(vehicleData.photoUri, newVehicle.id, userId);
      newVehicle.photoUri = localPhoto || vehicleData.photoUri;
    }
    const updatedCache = [...vehicles, newVehicle];
    const serialized = JSON.stringify(updatedCache);
    await AsyncStorage.setItem(storageKey, serialized);
    await AsyncStorage.setItem(LEGACY_VEHICLES_KEY, serialized);
    return newVehicle;
  } catch (e) {
    console.error('Erreur saveVehicle:', e);
    throw e;
  }
}

export async function deleteVehicle(vehicleId: string, userId: string) {
  try {
    const storageKey = getVehiclesStorageKey(userId);
    const isOnline = await offlineService.checkConnection();

    if (isOnline && userId) {
      const { error } = await vehiclesService.deleteVehicle(vehicleId);
      if (error) {
        console.error('Erreur deleteVehicle Supabase:', error);
        await offlineService.enqueue('DELETE_VEHICLE', { vehicleId });
      }
    } else {
      await offlineService.enqueue('DELETE_VEHICLE', { vehicleId });
    }

    const vehicles = await loadVehicles(userId);
    const filtered = vehicles.filter((v) => String(v.id) !== String(vehicleId));
    const serialized = JSON.stringify(filtered);
    await AsyncStorage.setItem(storageKey, serialized);
    await AsyncStorage.setItem(LEGACY_VEHICLES_KEY, serialized);
    await AsyncStorage.removeItem(getVehiclePhotoKey(vehicleId, userId));
  } catch (e) {
    console.error('Erreur deleteVehicle:', e);
    throw e;
  }
}

export async function updateVehicle(vehicleId: string, updates: any, userId: string) {
  try {
    const storageKey = getVehiclesStorageKey(userId);
    const isOnline = await offlineService.checkConnection();

    if (isOnline && userId) {
      const { error } = await vehiclesService.updateVehicle(vehicleId, updates);
      if (error) {
        console.error('Erreur updateVehicle Supabase:', error);
        await offlineService.enqueue('UPDATE_VEHICLE', { vehicleId, updates });
      }
    } else {
      await offlineService.enqueue('UPDATE_VEHICLE', { vehicleId, updates });
    }

    const vehicles = await loadVehicles(userId);
    const index = vehicles.findIndex((v) => String(v.id) === String(vehicleId));
    if (index !== -1) {
      const nextVehicle = { ...vehicles[index], ...updates };
      const photoSource = updates?.photoUri || updates?.photoUrl || null;
      if (photoSource) {
        const localPhoto = await cacheVehiclePhoto(photoSource, vehicleId, userId);
        nextVehicle.photoUri = localPhoto || photoSource;
      }
      vehicles[index] = nextVehicle;
      const serialized = JSON.stringify(vehicles);
      await AsyncStorage.setItem(storageKey, serialized);
      await AsyncStorage.setItem(LEGACY_VEHICLES_KEY, serialized);
    }
  } catch (e) {
    console.error('Erreur updateVehicle:', e);
    throw e;
  }
}

export function getVehicleIconByType(type: string): string {
  const iconMap: Record<string, string> = {
    car: 'car',
    motorcycle: 'speedometer',
    bicycle: 'bicycle',
    bike: 'bicycle',
    scooter: 'flash',
  };
  return iconMap[type] || 'car';
}

