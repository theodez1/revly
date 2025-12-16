import * as geolib from 'geolib';

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface Turn {
  index: number;
  coord: Coordinate;
  angle: number;
  direction: 'left' | 'right';
  type: 'normal' | 'u-turn' | 'sharp';
  bearingIn: number;
  bearingOut: number;
}

interface AnalysisResult {
  totalTurns: number;
  sharpTurns: number;
  turns: Turn[];
}

interface AnalysisOptions {
  minTurnAngle?: number;
  minDistanceBetweenTurns?: number;
  sharpTurnThreshold?: number;
  uTurnThreshold?: number;
  sampleDistance?: number;
}

/**
 * Service dedicated to analyzing ride data, specifically turn detection.
 */
export class RideAnalysisService {
    /**
     * Calculate bearing between two points
     * @param {Object} p1 - {latitude, longitude}
     * @param {Object} p2 - {latitude, longitude}
     * @returns {number} Bearing in degrees (0-360)
     */
    static calculateBearing(p1: Coordinate, p2: Coordinate): number {
        if (!p1 || !p2) return 0;

        const toRadians = (deg: number) => (deg * Math.PI) / 180;
        const toDegrees = (rad: number) => (rad * 180) / Math.PI;

        const lat1 = toRadians(p1.latitude);
        const lat2 = toRadians(p2.latitude);
        const deltaLng = toRadians(p2.longitude - p1.longitude);

        const y = Math.sin(deltaLng) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

        let bearing = toDegrees(Math.atan2(y, x));
        return (bearing + 360) % 360;
    }

    /**
     * Get turn direction (left or right)
     * @param {number} bearing1 
     * @param {number} bearing2 
     * @returns {string} 'left' | 'right'
     */
    static getTurnDirection(bearing1: number, bearing2: number): 'left' | 'right' {
        let diff = bearing2 - bearing1;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        return diff > 0 ? 'right' : 'left';
    }

    /**
     * Detect turns in a sequence of coordinates
     * @param {Array} coords - Array of {latitude, longitude}
     * @param {Object} options - Configuration options
     * @returns {Object} { totalTurns, sharpTurns, turns: Array }
     */
    static detectTurns(coords: Coordinate[], options: AnalysisOptions = {}): AnalysisResult {
        const {
            minTurnAngle = 30, // Minimum angle to consider a turn (increased from 20 to reduce noise)
            minDistanceBetweenTurns = 50, // Minimum meters between turns
            sharpTurnThreshold = 60, // Angle for sharp turn
            uTurnThreshold = 120, // Angle for U-turn
            sampleDistance = 20, // Sample points every ~20m to smooth out GPS noise
        } = options;

        if (!coords || coords.length < 3) {
            return { totalTurns: 0, sharpTurns: 0, turns: [] };
        }

        // 1. Resample coordinates to have regular spacing (approx sampleDistance)
        // This is crucial to avoid micro-turns due to GPS jitter at low speeds
        const sampledCoords: Coordinate[] = [];
        sampledCoords.push(coords[0]);

        let lastPoint = coords[0];
        for (let i = 1; i < coords.length; i++) {
            const dist = geolib.getDistance(lastPoint, coords[i]);
            if (dist >= sampleDistance) {
                sampledCoords.push(coords[i]);
                lastPoint = coords[i];
            }
        }
        // Always include last point
        if (sampledCoords[sampledCoords.length - 1] !== coords[coords.length - 1]) {
            sampledCoords.push(coords[coords.length - 1]);
        }

        if (sampledCoords.length < 3) {
            return { totalTurns: 0, sharpTurns: 0, turns: [] };
        }

        // 2. Calculate bearings
        const bearings: number[] = [];
        for (let i = 0; i < sampledCoords.length - 1; i++) {
            bearings.push(this.calculateBearing(sampledCoords[i], sampledCoords[i + 1]));
        }

        // 3. Detect turns
        const detectedTurns: Turn[] = [];

        for (let i = 0; i < bearings.length - 1; i++) {
            const bearing1 = bearings[i];
            const bearing2 = bearings[i + 1];

            let angleDiff = Math.abs(bearing2 - bearing1);
            if (angleDiff > 180) {
                angleDiff = 360 - angleDiff;
            }

            if (angleDiff >= minTurnAngle) {
                const direction = this.getTurnDirection(bearing1, bearing2);
                let type: Turn['type'] = 'normal';
                if (angleDiff >= uTurnThreshold) type = 'u-turn';
                else if (angleDiff >= sharpTurnThreshold) type = 'sharp';

                detectedTurns.push({
                    index: i, // Index in sampledCoords (approx)
                    coord: sampledCoords[i + 1], // The vertex of the turn
                    angle: angleDiff,
                    direction,
                    type,
                    bearingIn: bearing1,
                    bearingOut: bearing2
                });
            }
        }

        // 4. Filter duplicates and merge consecutive turns
        const finalTurns: Turn[] = [];

        // Group turns that are close to each other and have the same direction
        let currentGroup: Turn[] = [];

        for (let i = 0; i < detectedTurns.length; i++) {
            const turn = detectedTurns[i];

            if (currentGroup.length === 0) {
                currentGroup.push(turn);
                continue;
            }

            const lastTurnInGroup = currentGroup[currentGroup.length - 1];
            const dist = geolib.getDistance(lastTurnInGroup.coord, turn.coord);

            // If close enough and same direction, add to group
            // Increased distance for merging same-direction turns (e.g. long curves)
            if (dist < minDistanceBetweenTurns * 2 && lastTurnInGroup.direction === turn.direction) {
                currentGroup.push(turn);
            } else {
                // Process the completed group
                processGroup(currentGroup, finalTurns, minDistanceBetweenTurns);
                // Start new group
                currentGroup = [turn];
            }
        }

        // Process the last group
        if (currentGroup.length > 0) {
            processGroup(currentGroup, finalTurns, minDistanceBetweenTurns);
        }

        const sharpTurnsCount = finalTurns.filter(t => t.type === 'sharp' || t.type === 'u-turn').length;

        return {
            totalTurns: finalTurns.length,
            sharpTurns: sharpTurnsCount,
            turns: finalTurns
        };
    }
}

// Helper to process a group of potential turns
function processGroup(group: Turn[], finalTurns: Turn[], minDistance: number) {
    if (group.length === 0) return;

    // If it's a single turn, check distance with previous final turn
    if (group.length === 1) {
        const turn = group[0];
        if (finalTurns.length > 0) {
            const lastFinal = finalTurns[finalTurns.length - 1];
            const dist = geolib.getDistance(lastFinal.coord, turn.coord);
            if (dist < minDistance) {
                // Too close to previous turn (different direction), likely noise or S-turn noise
                // Keep the one with larger angle?
                if (turn.angle > lastFinal.angle) {
                    finalTurns[finalTurns.length - 1] = turn;
                }
                return;
            }
        }
        finalTurns.push(turn);
        return;
    }

    // If it's a group of same-direction turns (a curve)
    // We want to represent it as a single turn event, maybe at the point of max curvature (sharpest angle)
    // Or maybe sum the angles?
    // For now, let's pick the "sharpest" point in the curve as the turn location

    // Find the turn with max angle in the group
    const maxAngleTurn = group.reduce((prev, current) => (prev.angle > current.angle) ? prev : current);

    // Check distance with previous final turn
    if (finalTurns.length > 0) {
        const lastFinal = finalTurns[finalTurns.length - 1];
        const dist = geolib.getDistance(lastFinal.coord, maxAngleTurn.coord);
        if (dist < minDistance) {
            if (maxAngleTurn.angle > lastFinal.angle) {
                finalTurns[finalTurns.length - 1] = maxAngleTurn;
            }
            return;
        }
    }

    finalTurns.push(maxAngleTurn);
}

export default RideAnalysisService;

