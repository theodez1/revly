import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Utilitaire pour gérer les opérations AsyncStorage avec gestion de chargement et d'erreurs
 */

/**
 * Exécute une opération AsyncStorage avec gestion d'erreur silencieuse
 * @param {Function} operation - Fonction AsyncStorage à exécuter
 * @param {Object} options - Options de configuration
 * @param {boolean} options.silent - Si true, les erreurs sont silencieuses (défaut: true)
 * @param {Function} options.onError - Callback appelé en cas d'erreur
 * @returns {Promise} - Promesse résolue avec le résultat ou null en cas d'erreur
 */
export const safeAsyncStorageOperation = async (
  operation,
  options = {},
) => {
  const { silent = true, onError } = options;

  try {
    return await operation();
  } catch (error) {
    if (onError && typeof onError === 'function') {
      onError(error);
    } else if (!silent) {
      console.error('Erreur AsyncStorage:', error);
    }
    return null;
  }
};

/**
 * Sauvegarde une valeur dans AsyncStorage de manière sécurisée
 * @param {string} key - Clé de stockage
 * @param {string|number|Object} value - Valeur à sauvegarder
 * @param {Object} options - Options de configuration
 * @returns {Promise<boolean>} - True si la sauvegarde a réussi
 */
export const safeSetItem = async (key, value, options = {}) => {
  if (!key || typeof key !== 'string') {
    console.warn('safeSetItem: key doit être une chaîne non vide');
    return false;
  }

  let stringValue;
  try {
    if (typeof value === 'object' && value !== null) {
      stringValue = JSON.stringify(value);
    } else {
      stringValue = String(value);
    }
  } catch (error) {
    console.error(`Erreur lors de la sérialisation de la valeur pour ${key}:`, error);
    return false;
  }

  return safeAsyncStorageOperation(
    () => AsyncStorage.setItem(key, stringValue),
    options,
  ).then((result) => result !== null);
};

/**
 * Récupère une valeur depuis AsyncStorage de manière sécurisée
 * @param {string} key - Clé de stockage
 * @param {Object} options - Options de configuration
 * @param {*} options.defaultValue - Valeur par défaut si la clé n'existe pas
 * @param {Function} options.parser - Fonction de parsing personnalisée
 * @returns {Promise<*>} - Valeur récupérée ou defaultValue
 */
export const safeGetItem = async (key, options = {}) => {
  if (!key || typeof key !== 'string') {
    console.warn('safeGetItem: key doit être une chaîne non vide');
    return options.defaultValue ?? null;
  }

  const result = await safeAsyncStorageOperation(
    () => AsyncStorage.getItem(key),
    options,
  );

  if (result === null) {
    return options.defaultValue ?? null;
  }

  if (options.parser && typeof options.parser === 'function') {
    try {
      return options.parser(result);
    } catch (error) {
      console.error(`Erreur lors du parsing de ${key}:`, error);
      return options.defaultValue ?? null;
    }
  }

  // Tentative de parsing JSON automatique
  try {
    return JSON.parse(result);
  } catch {
    // Si ce n'est pas du JSON, retourner la chaîne brute
    return result;
  }
};

/**
 * Supprime une valeur de AsyncStorage de manière sécurisée
 * @param {string} key - Clé à supprimer
 * @param {Object} options - Options de configuration
 * @returns {Promise<boolean>} - True si la suppression a réussi
 */
export const safeRemoveItem = async (key, options = {}) => {
  if (!key || typeof key !== 'string') {
    console.warn('safeRemoveItem: key doit être une chaîne non vide');
    return false;
  }

  return safeAsyncStorageOperation(
    () => AsyncStorage.removeItem(key),
    options,
  ).then((result) => result !== null);
};

/**
 * Exécute plusieurs opérations AsyncStorage en parallèle
 * @param {Array<Function>} operations - Tableau de fonctions AsyncStorage
 * @param {Object} options - Options de configuration
 * @returns {Promise<Array>} - Tableau des résultats
 */
export const safeMultiGet = async (keys, options = {}) => {
  if (!Array.isArray(keys) || keys.length === 0) {
    return [];
  }

  return safeAsyncStorageOperation(
    () => AsyncStorage.multiGet(keys),
    options,
  ).then((result) => result || []);
};

/**
 * Sauvegarde plusieurs valeurs dans AsyncStorage en parallèle
 * @param {Array<Array<string, string>>} keyValuePairs - Tableau de paires [key, value]
 * @param {Object} options - Options de configuration
 * @returns {Promise<boolean>} - True si toutes les sauvegardes ont réussi
 */
export const safeMultiSet = async (keyValuePairs, options = {}) => {
  if (!Array.isArray(keyValuePairs) || keyValuePairs.length === 0) {
    return false;
  }

  // Convertir les valeurs en chaînes
  const stringPairs = keyValuePairs.map(([key, value]) => {
    let stringValue;
    try {
      if (typeof value === 'object' && value !== null) {
        stringValue = JSON.stringify(value);
      } else {
        stringValue = String(value);
      }
    } catch (error) {
      console.error(`Erreur lors de la sérialisation pour ${key}:`, error);
      return null;
    }
    return [key, stringValue];
  }).filter((pair) => pair !== null);

  if (stringPairs.length === 0) {
    return false;
  }

  return safeAsyncStorageOperation(
    () => AsyncStorage.multiSet(stringPairs),
    options,
  ).then((result) => result !== null);
};
