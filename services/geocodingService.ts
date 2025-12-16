import * as Location from 'expo-location';

const DEFAULT_MAX_SAMPLES = 12;

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface RideData {
  routeCoordinates?: Coordinate[];
  startCity?: string | null;
  endCity?: string | null;
  cities?: string[];
  pendingCityLookup?: boolean;
  [key: string]: any;
}

const normalizeCityName = (value: any): string | null => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.replace(/\s+/g, ' ') : null;
};

const extractCityFromPayload = (payload: any): string | null => {
  if (!payload) return null;

  const candidates = [
    payload.city,
    payload.name,
    payload.town,
    payload.village,
    payload.municipality,
    payload.district,
    payload.subregion,
    payload.region,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeCityName(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

const buildSampleIndexes = (totalPoints: number, maxSamples: number): number[] => {
  if (totalPoints <= 0) return [];

  const indexes = new Set([0]);

  if (totalPoints > 1) {
    indexes.add(totalPoints - 1);

    const effectiveSamples = Math.max(2, Math.min(maxSamples, totalPoints));
    const step = Math.max(1, Math.floor(totalPoints / effectiveSamples));

    for (let i = step; i < totalPoints - 1; i += step) {
      indexes.add(i);
      if (indexes.size >= effectiveSamples) break;
    }
  }

  return Array.from(indexes).sort((a, b) => a - b);
};

const shouldLookupCities = (rideData: RideData): boolean => {
  if (!rideData) return false;
  if (rideData.pendingCityLookup) return true;
  if (!rideData.startCity || !rideData.endCity) return true;
  if (!Array.isArray(rideData.cities) || rideData.cities.length === 0) return true;
  return false;
};

const pushCity = (list: string[], cityName: string) => {
  const normalized = normalizeCityName(cityName);
  if (!normalized) return;

  if (list.length === 0 || list[list.length - 1] !== normalized) {
    list.push(normalized);
  }
};

export const geocodingService = {
  /**
   * Complète les informations de ville pour un trajet.
   * Modifie directement l'objet `rideData` afin d'éviter des copies inutiles.
   *
   * @param {Object} rideData - Données du trajet (mutées en place)
   * @param {Object} options
   * @param {boolean} [options.isOnline=true] - Indique si une connexion internet est disponible
   * @param {number} [options.maxSamples=DEFAULT_MAX_SAMPLES] - Nombre max de points à géocoder
   * @returns {Promise<Object>} - `rideData` enrichi
   */
  async populateRideCities(rideData: RideData, options: { isOnline?: boolean; maxSamples?: number } = {}): Promise<RideData> {
    const { isOnline = true, maxSamples = DEFAULT_MAX_SAMPLES } = options;

    if (!rideData || !Array.isArray(rideData.routeCoordinates) || rideData.routeCoordinates.length === 0) {
      return rideData;
    }

    if (!isOnline) {
      rideData.pendingCityLookup = true;
      return rideData;
    }

    if (!shouldLookupCities(rideData)) {
      rideData.pendingCityLookup = false;
      return rideData;
    }

    const indexes = buildSampleIndexes(rideData.routeCoordinates.length, maxSamples);
    const orderedCities: string[] = [];
    let startCityCandidate = normalizeCityName(rideData.startCity);
    let endCityCandidate = normalizeCityName(rideData.endCity);
    let successCount = 0;

    for (const index of indexes) {
      const point = rideData.routeCoordinates[index];
      if (!point || typeof point.latitude !== 'number' || typeof point.longitude !== 'number') {
        continue;
      }

      try {
        const geocodeResults = await Location.reverseGeocodeAsync({
          latitude: point.latitude,
          longitude: point.longitude,
        });

        if (!Array.isArray(geocodeResults) || geocodeResults.length === 0) {
          continue;
        }

        const cityName = extractCityFromPayload(geocodeResults[0]);
        if (!cityName) {
          continue;
        }

        successCount += 1;
        if (index === 0 && !startCityCandidate) {
          startCityCandidate = cityName;
        }
        if (index === rideData.routeCoordinates.length - 1) {
          endCityCandidate = cityName;
        }

        pushCity(orderedCities, cityName);
      } catch (error) {
        console.warn('geocodingService.populateRideCities: reverse geocode error', error);
      }
    }

    if (successCount === 0) {
      rideData.pendingCityLookup = true;
      return rideData;
    }

    const startCity = startCityCandidate || (orderedCities.length > 0 ? orderedCities[0] : null);
    const endCity = endCityCandidate || (orderedCities.length > 0 ? orderedCities[orderedCities.length - 1] : startCity);

    if (startCity) {
      if (orderedCities.length === 0 || orderedCities[0] !== startCity) {
        orderedCities.unshift(startCity);
      }
    }

    if (endCity) {
      if (orderedCities.length === 0 || orderedCities[orderedCities.length - 1] !== endCity) {
        orderedCities.push(endCity);
      }
    }

    rideData.startCity = startCity || null;
    rideData.endCity = endCity || null;
    rideData.cities = orderedCities.length > 0 ? orderedCities : rideData.cities || [];
    rideData.pendingCityLookup = false;

    return rideData;
  },
};

export default geocodingService;

