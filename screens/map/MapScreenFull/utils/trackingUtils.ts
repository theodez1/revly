/**
 * Utility functions for GPS tracking calculations
 */

interface GPSPoint {
  latitude: number;
  longitude: number;
  timestamp?: number;
  speed?: number;
}

interface FilterOptions {
  minDistance?: number;
  maxSpeed?: number;
}

/**
 * Calculate distance between two GPS points using Haversine formula
 * @param {Object} pointA - {latitude, longitude}
 * @param {Object} pointB - {latitude, longitude}
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (pointA: GPSPoint, pointB: GPSPoint): number => {
  if (!pointA || !pointB || !pointA.latitude || !pointB.latitude) {
    return 0;
  }

  const lat1 = pointA.latitude * Math.PI / 180;
  const lat2 = pointB.latitude * Math.PI / 180;
  const deltaLat = (pointB.latitude - pointA.latitude) * Math.PI / 180;
  const deltaLng = (pointB.longitude - pointA.longitude) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const earthRadiusKm = 6371;
  return earthRadiusKm * c;
};

/**
 * Calculate speed from distance and time
 * @param {number} distanceKm - Distance in kilometers
 * @param {number} timeMs - Time difference in milliseconds
 * @returns {number} Speed in km/h
 */
export const calculateSpeed = (distanceKm: number, timeMs: number): number => {
  if (!timeMs || timeMs <= 0) {
    return 0;
  }
  const timeHours = timeMs / (1000 * 3600);
  return distanceKm / timeHours;
};

/**
 * Calculate bearing between two GPS points
 * @param {Object} point1 - {latitude, longitude}
 * @param {Object} point2 - {latitude, longitude}
 * @returns {number} Bearing in degrees (0-360)
 */
export const calculateBearing = (point1: GPSPoint, point2: GPSPoint): number => {
  if (!point1 || !point2 || !point1.latitude || !point2.latitude) {
    return 0;
  }

  const lat1 = point1.latitude * Math.PI / 180;
  const lat2 = point2.latitude * Math.PI / 180;
  const deltaLng = (point2.longitude - point1.longitude) * Math.PI / 180;

  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
};

/**
 * Filter GPS point based on quality criteria
 * @param {Object} point - GPS point to filter
 * @param {Object} lastPoint - Previous GPS point
 * @param {Object} options - Filtering options
 * @returns {boolean} Whether the point should be kept
 */
export const filterGPSPoint = (point: GPSPoint, lastPoint: GPSPoint | null, options: FilterOptions = {}): boolean => {
  const {
    minDistance = 2, // Minimum distance in meters
    maxSpeed = 400, // Maximum speed in km/h
  } = options;

  // Check valid coordinates
  if (!point.latitude || !point.longitude ||
    Math.abs(point.latitude) > 90 ||
    Math.abs(point.longitude) > 180) {
    return false;
  }

  // If no last point, accept it
  if (!lastPoint) {
    return true;
  }

  // Calculate distance
  const distanceKm = calculateDistance(lastPoint, point);
  const distanceM = distanceKm * 1000;

  // Check minimum distance
  if (distanceM < minDistance) {
    return false;
  }

  // Check speed if timestamp is available
  if (point.timestamp && lastPoint.timestamp) {
    const timeMs = point.timestamp - lastPoint.timestamp;
    if (timeMs > 0) {
      const speedKmh = calculateSpeed(distanceKm, timeMs);
      if (speedKmh > maxSpeed) {
        return false;
      }
    }
  }

  return true;
};

/**
 * Detect if tracking should be paused based on speed
 * @param {number} speedKmh - Current speed in km/h
 * @param {number} threshold - Speed threshold in km/h (default: 5)
 * @param {number} durationMs - Duration at low speed in milliseconds
 * @param {number} minDurationMs - Minimum duration to trigger pause (default: 120000 = 2 minutes)
 * @returns {boolean} Whether pause should be detected
 */
export const detectPause = (speedKmh: number, threshold = 5, durationMs = 0, minDurationMs = 120000): boolean => {
  if (speedKmh >= threshold) {
    return false;
  }
  return durationMs >= minDurationMs;
};

/**
 * Calculate calories burned during a trip
 * @param {number} distanceKm - Distance in kilometers
 * @param {number} durationHours - Duration in hours
 * @param {number} weightKg - Weight in kilograms (default: 70)
 * @param {string} activityType - Type of activity (default: 'driving')
 * @returns {number} Estimated calories burned
 */
export const calculateCalories = (distanceKm: number, durationHours: number, weightKg = 70, activityType = 'driving'): number => {
  // Basic calorie calculation - very simplified
  // For driving, calories are minimal compared to cycling/running
  if (activityType === 'driving') {
    // Minimal calories for driving (mostly sitting)
    return Math.round(durationHours * 50); // ~50 cal/hour for sitting
  }

  // For other activities, use MET (Metabolic Equivalent of Task) values
  const metValues: Record<string, number> = {
    cycling: 8,
    running: 10,
    walking: 3.5,
  };

  const met = metValues[activityType] || 3;
  // Calories = MET × weight(kg) × duration(hours)
  return Math.round(met * weightKg * durationHours);
};

