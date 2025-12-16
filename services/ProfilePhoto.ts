import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const PROFILE_PHOTO_KEY = '@profilePhotoUri';
const PROFILE_PHOTO_CACHE_KEY = '@profilePhotoCacheUri';

// Some versions of the type definitions for expo-file-system don't expose
// `documentDirectory` even though it's available at runtime, so we safely
// access it through `any` and default to an empty string in edge cases.
const DOCUMENT_DIR: string = ((FileSystem as any).documentDirectory as string) || '';

const getProfilePhotoPath = (userId: string | null) =>
  `${DOCUMENT_DIR}profile/${userId || 'guest'}/avatar.jpg`;

/**
 * Cache une photo de profil depuis une URL Supabase vers le stockage local
 * @param {string} remoteUri - URL de la photo depuis Supabase
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<string|null>} URI locale ou null en cas d'erreur
 */
export async function cacheProfilePhoto(remoteUri: string, userId: string): Promise<string | null> {
  try {
    if (!remoteUri || !userId) {
      return null;
    }

    // Si c'est déjà une URL locale, vérifier qu'elle existe
    if (remoteUri.startsWith('file://')) {
      const fileInfo = await FileSystem.getInfoAsync(remoteUri);
      if (fileInfo.exists) {
        return remoteUri;
      }
      return null;
    }

    // Vérifier si l'image est déjà en cache et existe
    const existingCache = await getCachedProfilePhoto(userId);
    if (existingCache) {
      const fileInfo = await FileSystem.getInfoAsync(existingCache);
      if (fileInfo.exists) {
        // Photo déjà en cache, pas besoin de re-télécharger
        return existingCache;
      }
    }

    // Vérifier si on a déjà tenté de télécharger cette URL et qu'elle a échoué
    const failedKey = `@profilePhotoFailed:${userId}`;
    const failedUri = await AsyncStorage.getItem(failedKey);
    if (failedUri === remoteUri) {
      // On a déjà tenté de télécharger cette URL et ça a échoué, ne pas réessayer
      return null;
    }

    // Télécharger depuis Supabase uniquement si pas déjà en cache
    const directory = `${DOCUMENT_DIR}profile/${userId || 'guest'}`;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(() => { });
    const destination = getProfilePhotoPath(userId);

    try {
      // Télécharger depuis une URL (Supabase)
      const result = await FileSystem.downloadAsync(remoteUri, destination);

      // Vérifier que le téléchargement a réussi
      if (!result || (result.status !== 200)) {
        const statusCode = result?.status ?? 'undefined';
        console.warn('[CACHE] Erreur téléchargement photo profil, status:', statusCode);

        // Marquer cette URL comme ayant échoué pour éviter de réessayer
        await AsyncStorage.setItem(failedKey, remoteUri);

        // Supprimer le fichier partiel s'il existe
        try {
          const fileInfo = await FileSystem.getInfoAsync(destination);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(destination, { idempotent: true });
          }
        } catch { }

        return null; // Retourner null au lieu de remoteUri pour éviter les boucles
      }

      // Vérifier que le fichier téléchargé existe vraiment
      const fileInfo = await FileSystem.getInfoAsync(destination);
      if (!fileInfo.exists) {
        console.warn('[CACHE] Fichier téléchargé n\'existe pas:', destination);
        await AsyncStorage.setItem(failedKey, remoteUri);
        return null;
      }

      // Sauvegarder le chemin local dans AsyncStorage (par utilisateur uniquement)
      const cacheKey = `${PROFILE_PHOTO_CACHE_KEY}:${userId}`;
      await AsyncStorage.setItem(cacheKey, destination);

      // Nettoyer la clé d'échec si le téléchargement a réussi
      await AsyncStorage.removeItem(failedKey);


      return destination;
    } catch (downloadError) {
      console.warn('[CACHE] Erreur lors du téléchargement:', downloadError);
      await AsyncStorage.setItem(failedKey, remoteUri);
      return null;
    }
  } catch (error) {
    console.warn('[CACHE] Erreur cache profile photo:', error);
    return null; // Retourner null au lieu de remoteUri pour éviter les boucles
  }
}

/**
 * Récupère la photo de profil depuis le cache local
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<string|null>} URI locale ou null si pas en cache
 */
export async function getCachedProfilePhoto(userId: string): Promise<string | null> {
  try {
    // Essayer d'abord (et uniquement) la clé spécifique à l'utilisateur
    const cacheKey = `${PROFILE_PHOTO_CACHE_KEY}:${userId}`;
    const localUri = await AsyncStorage.getItem(cacheKey);

    if (!localUri) {
      return null;
    }

    const info = await FileSystem.getInfoAsync(localUri);
    if (!info.exists) {
      // Fichier n'existe plus, nettoyer le cache
      await AsyncStorage.removeItem(cacheKey);
      return null;
    }

    return localUri;
  } catch (error) {
    console.warn('[CACHE] Erreur récupération photo profil:', error);
    return null;
  }
}

/**
 * Charge et cache la photo de profil depuis Supabase si nécessaire
 * @param {string} remoteUri - URL de la photo depuis Supabase
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<string|null>} URI locale ou URL Supabase en fallback
 */
export async function loadAndCacheProfilePhoto(remoteUri: string, userId: string): Promise<string | null> {
  try {
    if (!remoteUri || !userId) {
      return null;
    }

    // Si c'est déjà une URL locale, vérifier qu'elle existe
    if (remoteUri.startsWith('file://')) {
      const fileInfo = await FileSystem.getInfoAsync(remoteUri);
      if (fileInfo.exists) {
        return remoteUri;
      }
      return null;
    }

    // Vérifier d'abord le cache local
    const cachedPhoto = await getCachedProfilePhoto(userId);
    if (cachedPhoto) {
      const fileInfo = await FileSystem.getInfoAsync(cachedPhoto);
      if (fileInfo.exists) {
        // Photo déjà en cache et valide

        return cachedPhoto;
      }
    }

    // Si pas de cache valide, télécharger et mettre en cache
    const localPhoto = await cacheProfilePhoto(remoteUri, userId);

    // Si le téléchargement a échoué, retourner null pour éviter les boucles
    // Les composants utiliseront alors l'URL Supabase directement si nécessaire
    if (!localPhoto) {
      return null;
    }

    return localPhoto;
  } catch (error) {
    console.warn('[CACHE] Erreur loadAndCacheProfilePhoto:', error);
    return null; // Retourner null au lieu de remoteUri pour éviter les boucles
  }
}

/**
 * Supprime la photo de profil du cache local
 * @param {string} userId - ID de l'utilisateur
 */
export async function clearProfilePhotoCache(userId: string): Promise<void> {
  try {
    const cacheKey = `${PROFILE_PHOTO_CACHE_KEY}:${userId}`;
    await AsyncStorage.removeItem(cacheKey);
    await AsyncStorage.removeItem(PROFILE_PHOTO_KEY);

    // Supprimer aussi le fichier physique
    const photoPath = getProfilePhotoPath(userId);
    const fileInfo = await FileSystem.getInfoAsync(photoPath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(photoPath, { idempotent: true });
    }
  } catch (error) {
    console.warn('[CACHE] Erreur clearProfilePhotoCache:', error);
  }
}

