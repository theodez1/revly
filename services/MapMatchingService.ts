// Récupérer le token depuis les variables d'environnement Expo
// Utiliser EXPO_PUBLIC_MAPBOX_TOKEN pour qu'il soit disponible côté client.
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

// Log pour vérifier que le token est chargé (uniquement en dev)
if (__DEV__) {
  if (MAPBOX_ACCESS_TOKEN) {
    console.log(
      '[MapMatching] ✅ Mapbox Access Token chargé:',
      MAPBOX_ACCESS_TOKEN.substring(0, 20) + '...',
    );
  } else {
    console.warn(
      '[MapMatching] ⚠️ Aucun Mapbox Access Token trouvé (EXPO_PUBLIC_MAPBOX_TOKEN manquant)',
    );
  }
}
const MAPBOX_MATCHING_API_URL = 'https://api.mapbox.com/matching/v5/mapbox/driving';

interface Coordinate {
    latitude: number;
    longitude: number;
    timestamp?: number;
}

interface MatchResponse {
    matchings: {
        confidence: number;
        geometry: string; // Polyline string
        duration: number;
        distance: number;
    }[];
    code: string;
}

/**
 * Service to match a raw GPS trace to the road network using Mapbox Map Matching API.
 */
export const MapMatchingService = {
    /**
     * Matches a list of coordinates to the road network.
     * Note: Mapbox API has a limit of 100 coordinates per request.
     * We need to sample the input if it's too large, or implement batching (splitting into multiple requests).
     * For simplicity in this first version, we'll sample down to 100 points if needed.
     */
    matchTrace: async (points: Coordinate[]): Promise<Coordinate[] | null> => {
        if (!points || points.length < 2) {
            return null;
        }

        if (!MAPBOX_ACCESS_TOKEN) {
            console.warn('[MapMatching] No Mapbox Access Token found.');
            return null;
        }

        try {
            // 1. Prepare coordinates (Limit to 100 for now by sampling)
            // TODO: Implement proper batching for longer trips to keep full precision
            const MAX_POINTS = 99; // Safety margin
            let sampledPoints = points;

            if (points.length > MAX_POINTS) {
                const step = Math.ceil(points.length / MAX_POINTS);
                sampledPoints = points.filter((_, index) => index % step === 0);
                // Ensure last point is included
                if (sampledPoints[sampledPoints.length - 1] !== points[points.length - 1]) {
                    sampledPoints.push(points[points.length - 1]);
                }
            }

            // Format: "lng,lat;lng,lat;..."
            const coordinatesString = sampledPoints
                .map(p => `${p.longitude},${p.latitude}`)
                .join(';');

            // 2. Call API
            // geometries=geojson returns a GeoJSON LineString
            // geometries=polyline returns an encoded polyline (more compact)
            const url = `${MAPBOX_MATCHING_API_URL}/${coordinatesString}?access_token=${MAPBOX_ACCESS_TOKEN}&geometries=geojson&overview=full&tidy=true`;

            console.log(`[MapMatching] Sending ${sampledPoints.length} points to Mapbox API...`);
            const response = await fetch(url);
            const data: MatchResponse = await response.json();

            if (data.code !== 'Ok') {
                console.warn('[MapMatching] API Error:', data.code, data);
                return null;
            }

            if (!data.matchings || data.matchings.length === 0) {
                console.warn('[MapMatching] No match found.');
                return null;
            }

            // 3. Extract best match
            // The API can return multiple matchings, the first one is the most confident
            const bestMatch = data.matchings[0];
            console.log(`[MapMatching] Match success! Confidence: ${bestMatch.confidence}`);

            // Parse GeoJSON geometry from response
            // @ts-ignore - We requested geojson, so geometry is an object, not string
            const coordinates = bestMatch.geometry.coordinates;

            // Convert back to our Coordinate format
            const matchedPoints: Coordinate[] = coordinates.map((coord: number[]) => ({
                latitude: coord[1],
                longitude: coord[0],
                // Note: Map Matching doesn't return timestamps for the snapped points easily
                // We might lose timestamp accuracy here, but for "History" view it's usually fine.
                // If we need timestamps, we'd need to interpolate them based on the original trace.
                timestamp: 0,
            }));

            console.log(`[MapMatching] Returning ${matchedPoints.length} matched points.`);
            return matchedPoints;

        } catch (error) {
            console.error('[MapMatching] Error calling API:', error);
            return null;
        }
    }
};
