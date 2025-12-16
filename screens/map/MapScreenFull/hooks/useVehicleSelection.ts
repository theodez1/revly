import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadVehicles,
  loadDefaultVehicleId,
  getCachedVehiclePhoto,
} from '../../../../services/Vehicles';

const vehicleTypeToIcon = (type?: string) => {
  switch (type) {
    case 'car':
      return 'car';
    case 'bike':
    case 'bicycle':
      return 'bicycle';
    case 'scooter':
      return 'flash';
    case 'motorcycle':
      return 'speedometer';
    default:
      return 'car';
  }
};

const resolveVehicleName = (vehicleId: string | null, vehicles: any[]) => {
  if (!vehicleId || !vehicles?.length) {
    return '';
  }
  const match = vehicles.find((vehicle) => String(vehicle.id) === String(vehicleId));
  return match?.name || '';
};

const useVehicleSelection = (userId: string | null) => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isMountedRef = useRef(true);
  const loadAbortRef = useRef(false);

  const loadAndSelectVehicles = useCallback(
    async ({ keepSelection = false } = {}) => {
      loadAbortRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(true);
      }

      try {
        if (!userId) {
          if (isMountedRef.current) {
            setVehicles([]);
            setSelectedVehicleId(null);
            setSelectedVehicle('');
          }
          return { vehicles: [], selectedId: null };
        }

        const [loadedVehiclesRaw, defaultVehicleId] = await Promise.all([
          loadVehicles(userId),
          loadDefaultVehicleId(userId),
        ]);

        const loadedVehicles = await Promise.all(
          (loadedVehiclesRaw || []).map(async (vehicle: any) => {
            if (vehicle.photoUri) {
              return vehicle;
            }
            const localPhoto = await getCachedVehiclePhoto(vehicle.id, userId);
            return localPhoto ? { ...vehicle, photoUri: localPhoto } : vehicle;
          }),
        );

        if (!isMountedRef.current) {
          return { vehicles: [], selectedId: null };
        }

        if (loadAbortRef.current) {
          return { vehicles: [], selectedId: null };
        }

        setVehicles(loadedVehicles);

        let nextVehicleId = null;
        if (keepSelection && selectedVehicleId) {
          const existsInList = loadedVehicles.some(
            (vehicle) => String(vehicle.id) === String(selectedVehicleId),
          );
          if (existsInList) {
            nextVehicleId = selectedVehicleId;
          }
        }

        if (!nextVehicleId) {
          nextVehicleId =
            defaultVehicleId ||
            (loadedVehicles.length > 0 ? loadedVehicles[0].id : null);
        }

        const nextVehicleName = resolveVehicleName(nextVehicleId, loadedVehicles);

        setSelectedVehicleId(nextVehicleId);
        setSelectedVehicle(nextVehicleName);
        return { vehicles: loadedVehicles, selectedId: nextVehicleId };
      } catch (error) {
        console.error('Erreur chargement véhicules:', error);
        return { vehicles: [], selectedId: null };
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [selectedVehicleId, userId],
  );

  useEffect(() => {
    isMountedRef.current = true;
    loadAndSelectVehicles();

    return () => {
      isMountedRef.current = false;
      loadAbortRef.current = true;
    };
  }, [loadAndSelectVehicles]);

  const refreshVehicles = useCallback(
    () => {
      // Ne pas recharger si on a déjà des véhicules chargés
      if (vehicles.length > 0) {
        return;
      }
      loadAndSelectVehicles({ keepSelection: true });
    },
    [loadAndSelectVehicles, vehicles.length],
  );

  const handleVehicleSelect = useCallback(
    (vehicleId: string) => {
      setSelectedVehicleId(vehicleId);
      setSelectedVehicle(resolveVehicleName(vehicleId, vehicles));
    },
    [vehicles],
  );

  const getVehicleIcon = useCallback(
    (vehicleId: string | null) => {
      if (!vehicleId) {
        return vehicleTypeToIcon();
      }
      const vehicle = vehicles.find((item) => String(item.id) === String(vehicleId));
      return vehicleTypeToIcon(vehicle?.type);
    },
    [vehicles],
  );

  const getVehicleName = useCallback(
    (vehicleId: string | null) => resolveVehicleName(vehicleId, vehicles),
    [vehicles],
  );

  return {
    vehicles,
    selectedVehicleId,
    selectedVehicle,
    vehicleTypeToIcon,
    getVehicleIcon,
    getVehicleName,
    handleVehicleSelect,
    refreshVehicles,
    isLoadingVehicles: isLoading,
  };
};

export default useVehicleSelection;

