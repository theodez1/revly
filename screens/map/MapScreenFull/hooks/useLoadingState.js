import { useCallback, useRef, useState } from 'react';

/**
 * Hook pour gérer les états de chargement de manière centralisée et homogène
 * @param {Object} options - Options de configuration
 * @param {boolean} options.initialState - État initial de chargement
 * @param {number} options.debounceMs - Délai de debounce pour les mises à jour (optionnel)
 * @returns {Object} - Objet contenant les fonctions et états de chargement
 */
const useLoadingState = (options = {}) => {
  const { initialState = false, debounceMs = 0 } = options;
  const [isLoading, setIsLoading] = useState(initialState);
  const [loadingOperations, setLoadingOperations] = useState(new Set());
  const debounceTimerRef = useRef(null);
  const operationsRef = useRef(new Set());

  /**
   * Démarre une opération de chargement
   * @param {string} operationId - Identifiant unique de l'opération
   */
  const startLoading = useCallback(
    (operationId = 'default') => {
      if (debounceMs > 0) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          operationsRef.current.add(operationId);
          setLoadingOperations(new Set(operationsRef.current));
          setIsLoading(true);
        }, debounceMs);
      } else {
        operationsRef.current.add(operationId);
        setLoadingOperations(new Set(operationsRef.current));
        setIsLoading(true);
      }
    },
    [debounceMs],
  );

  /**
   * Arrête une opération de chargement
   * @param {string} operationId - Identifiant unique de l'opération
   */
  const stopLoading = useCallback(
    (operationId = 'default') => {
      operationsRef.current.delete(operationId);
      const newOperations = new Set(operationsRef.current);
      setLoadingOperations(newOperations);
      setIsLoading(newOperations.size > 0);
    },
    [],
  );

  /**
   * Exécute une fonction asynchrone avec gestion automatique du chargement
   * @param {Function} asyncFn - Fonction asynchrone à exécuter
   * @param {string} operationId - Identifiant unique de l'opération
   * @returns {Promise} - Promesse résolue avec le résultat de la fonction
   */
  const executeWithLoading = useCallback(
    async (asyncFn, operationId = 'default') => {
      if (typeof asyncFn !== 'function') {
        console.warn('executeWithLoading: asyncFn doit être une fonction');
        return null;
      }

      startLoading(operationId);
      try {
        const result = await asyncFn();
        return result;
      } catch (error) {
        console.error(`Erreur lors de l'exécution de l'opération ${operationId}:`, error);
        throw error;
      } finally {
        stopLoading(operationId);
      }
    },
    [startLoading, stopLoading],
  );

  /**
   * Réinitialise tous les états de chargement
   */
  const resetLoading = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    operationsRef.current.clear();
    setLoadingOperations(new Set());
    setIsLoading(false);
  }, []);

  /**
   * Vérifie si une opération spécifique est en cours
   * @param {string} operationId - Identifiant de l'opération
   * @returns {boolean} - True si l'opération est en cours
   */
  const isOperationLoading = useCallback(
    (operationId) => {
      return loadingOperations.has(operationId);
    },
    [loadingOperations],
  );

  return {
    isLoading,
    loadingOperations: Array.from(loadingOperations),
    startLoading,
    stopLoading,
    executeWithLoading,
    resetLoading,
    isOperationLoading,
  };
};

export default useLoadingState;
