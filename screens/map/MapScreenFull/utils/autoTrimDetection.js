/**
 * Automatic Ride Trimming Utility
 * Detects and removes inactive periods at the start and end of rides
 */

/**
 * Automatically detect trim points based on speed/activity
 * @param {Array} trackingPoints - Array of GPS points with speed and timestamp
 * @param {Object} options - Configuration options
 * @returns {Object} { startIndex, endIndex, trimmedStart, trimmedEnd }
 */
export const autoDetectTrim = (trackingPoints, options = {}) => {
    const {
        speedThreshold = 5, // km/h - minimum speed to consider "active"
        consecutivePoints = 3, // number of consecutive active points required
        maxTrimRatio = 0.5, // max 50% of ride can be trimmed
        minPoints = 10, // minimum points to keep
        minDurationSeconds = 120, // minimum 2 minutes duration
    } = options;

    // Validation
    if (!trackingPoints || trackingPoints.length < minPoints) {
        return {
            startIndex: 0,
            endIndex: trackingPoints.length - 1,
            trimmedStart: 0,
            trimmedEnd: 0,
        };
    }

    // Check total duration
    const firstPoint = trackingPoints[0];
    const lastPoint = trackingPoints[trackingPoints.length - 1];
    const totalDuration = (lastPoint.timestamp - firstPoint.timestamp) / 1000;

    if (totalDuration < minDurationSeconds) {
        return {
            startIndex: 0,
            endIndex: trackingPoints.length - 1,
            trimmedStart: 0,
            trimmedEnd: 0,
        };
    }

    // Find start trim point (first sustained activity)
    let startIndex = 0;
    for (let i = 0; i <= trackingPoints.length - consecutivePoints; i++) {
        const speeds = trackingPoints
            .slice(i, i + consecutivePoints)
            .map((p) => (p.speed || 0) * 3.6);

        if (speeds.every((s) => s >= speedThreshold)) {
            startIndex = i;
            break;
        }
    }

    // Find end trim point (last sustained activity)
    let endIndex = trackingPoints.length - 1;
    for (let i = trackingPoints.length - 1; i >= consecutivePoints - 1; i--) {
        const speeds = trackingPoints
            .slice(i - consecutivePoints + 1, i + 1)
            .map((p) => (p.speed || 0) * 3.6);

        if (speeds.every((s) => s >= speedThreshold)) {
            endIndex = i;
            break;
        }
    }

    // Safety check: ensure we don't trim too much
    const trimmedLength = endIndex - startIndex + 1;
    const trimRatio = 1 - trimmedLength / trackingPoints.length;

    if (trimRatio > maxTrimRatio || trimmedLength < minPoints) {
        // Too much would be trimmed, keep original
        return {
            startIndex: 0,
            endIndex: trackingPoints.length - 1,
            trimmedStart: 0,
            trimmedEnd: 0,
        };
    }

    // Calculate trimmed durations
    const trimmedStartDuration = startIndex > 0
        ? (trackingPoints[startIndex].timestamp - firstPoint.timestamp) / 1000
        : 0;

    const trimmedEndDuration = endIndex < trackingPoints.length - 1
        ? (lastPoint.timestamp - trackingPoints[endIndex].timestamp) / 1000
        : 0;

    return {
        startIndex,
        endIndex,
        trimmedStart: trimmedStartDuration,
        trimmedEnd: trimmedEndDuration,
    };
};

/**
 * Format duration in seconds to human-readable string
 * @param {number} seconds
 * @returns {string}
 */
export const formatTrimDuration = (seconds) => {
    if (seconds < 60) {
        return `${Math.round(seconds)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (secs === 0) {
        return `${minutes} min`;
    }
    return `${minutes} min ${secs}s`;
};
