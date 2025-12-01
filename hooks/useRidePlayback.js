import { useRef, useState, useEffect, useCallback, useMemo } from 'react';

// Helper to calculate distance between two points (Haversine formula)
const getDistance = (p1, p2) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (p1.latitude * Math.PI) / 180;
    const φ2 = (p2.latitude * Math.PI) / 180;
    const Δφ = ((p2.latitude - p1.latitude) * Math.PI) / 180;
    const Δλ = ((p2.longitude - p1.longitude) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
};

// Helper to calculate bearing between two points
const getBearing = (p1, p2) => {
    const φ1 = (p1.latitude * Math.PI) / 180;
    const φ2 = (p2.latitude * Math.PI) / 180;
    const Δλ = ((p2.longitude - p1.longitude) * Math.PI) / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);

    return ((θ * 180) / Math.PI + 360) % 360; // Bearing in degrees
};

// Linear interpolation between two points
const interpolatePosition = (p1, p2, t) => {
    return {
        latitude: p1.latitude + (p2.latitude - p1.latitude) * t,
        longitude: p1.longitude + (p2.longitude - p1.longitude) * t,
    };
};

export const useRidePlayback = (routeCoordinates) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [speedMultiplier, setSpeedMultiplier] = useState(1);
    const [currentPosition, setCurrentPosition] = useState(null);
    const [currentHeading, setCurrentHeading] = useState(0);

    // Refs for animation state
    const animationFrameRef = useRef(null);
    const startTimeRef = useRef(null);
    const pausedTimeRef = useRef(0);
    const isPlayingRef = useRef(false);

    // Calculate cumulative distances along the route
    const routeData = useMemo(() => {
        if (!routeCoordinates || routeCoordinates.length < 2) {
            return { distances: [], totalDistance: 0 };
        }

        const distances = [0]; // First point is at distance 0
        let totalDistance = 0;

        for (let i = 1; i < routeCoordinates.length; i++) {
            const dist = getDistance(routeCoordinates[i - 1], routeCoordinates[i]);
            totalDistance += dist;
            distances.push(totalDistance);
        }

        return { distances, totalDistance };
    }, [routeCoordinates]);

    // Find position along route given a distance
    const getPositionAtDistance = useCallback(
        (targetDistance) => {
            if (!routeCoordinates || routeCoordinates.length < 2) {
                return null;
            }

            const { distances } = routeData;

            // Find the segment containing this distance
            for (let i = 1; i < distances.length; i++) {
                if (targetDistance <= distances[i]) {
                    const segmentStart = distances[i - 1];
                    const segmentEnd = distances[i];
                    const segmentLength = segmentEnd - segmentStart;

                    if (segmentLength === 0) {
                        return {
                            position: routeCoordinates[i - 1],
                            heading: i > 0 ? getBearing(routeCoordinates[i - 1], routeCoordinates[i]) : 0,
                        };
                    }

                    // Calculate interpolation factor (0-1) within this segment
                    const t = (targetDistance - segmentStart) / segmentLength;
                    const position = interpolatePosition(routeCoordinates[i - 1], routeCoordinates[i], t);
                    const heading = getBearing(routeCoordinates[i - 1], routeCoordinates[i]);

                    return { position, heading };
                }
            }

            // Return last point if we've gone past the end
            const lastIdx = routeCoordinates.length - 1;
            return {
                position: routeCoordinates[lastIdx],
                heading:
                    lastIdx > 0
                        ? getBearing(routeCoordinates[lastIdx - 1], routeCoordinates[lastIdx])
                        : 0,
            };
        },
        [routeCoordinates, routeData]
    );

    // Animation loop using RAF
    const animate = useCallback(() => {
        if (!isPlayingRef.current) return;

        const now = performance.now();
        if (!startTimeRef.current) {
            startTimeRef.current = now;
        }

        const elapsed = now - startTimeRef.current;
        const { totalDistance } = routeData;

        // Calculate travel speed: 60 km/h base speed * multiplier
        const baseSpeed = 60 * 1000 / 3600; // 60 km/h in m/s = ~16.67 m/s
        const speed = baseSpeed * speedMultiplier;

        // Calculate current distance traveled
        const distanceTraveled = (elapsed / 1000) * speed; // meters

        if (distanceTraveled >= totalDistance) {
            // Animation complete
            setProgress(1);
            const result = getPositionAtDistance(totalDistance);
            if (result) {
                setCurrentPosition(result.position);
                setCurrentHeading(result.heading);
            }
            setIsPlaying(false);
            return;
        }

        // Calculate progress (0-1)
        const currentProgress = totalDistance > 0 ? distanceTraveled / totalDistance : 0;
        setProgress(currentProgress);

        // Get current position and heading
        const result = getPositionAtDistance(distanceTraveled);
        if (result) {
            setCurrentPosition(result.position);
            setCurrentHeading(result.heading);
        }

        // Schedule next frame
        animationFrameRef.current = requestAnimationFrame(animate);
    }, [routeData, speedMultiplier, getPositionAtDistance]);

    // Start/stop animation when isPlaying changes
    useEffect(() => {
        isPlayingRef.current = isPlaying;

        if (isPlaying) {
            startTimeRef.current = null; // Reset start time
            animationFrameRef.current = requestAnimationFrame(animate);
        } else {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isPlaying, animate]);

    // Initialize position when route changes
    useEffect(() => {
        if (routeCoordinates && routeCoordinates.length > 0 && !currentPosition) {
            setCurrentPosition(routeCoordinates[0]);
            setCurrentHeading(
                routeCoordinates.length > 1 ? getBearing(routeCoordinates[0], routeCoordinates[1]) : 0
            );
        }
    }, [routeCoordinates, currentPosition]);

    const play = useCallback(() => {
        if (progress >= 0.99) {
            // Reset to beginning if at the end
            setProgress(0);
            setCurrentPosition(routeCoordinates?.[0] || null);
            setCurrentHeading(
                routeCoordinates && routeCoordinates.length > 1
                    ? getBearing(routeCoordinates[0], routeCoordinates[1])
                    : 0
            );
        }
        setIsPlaying(true);
    }, [progress, routeCoordinates]);

    const pause = useCallback(() => {
        setIsPlaying(false);
    }, []);

    const seek = useCallback(
        (newProgress) => {
            const { totalDistance } = routeData;
            const targetDistance = newProgress * totalDistance;

            setProgress(newProgress);
            const result = getPositionAtDistance(targetDistance);
            if (result) {
                setCurrentPosition(result.position);
                setCurrentHeading(result.heading);
            }

            // Reset animation timing
            startTimeRef.current = null;
        },
        [routeData, getPositionAtDistance]
    );

    const setSpeed = useCallback((multiplier) => {
        setSpeedMultiplier(multiplier);
        // Reset timing when speed changes
        startTimeRef.current = null;
    }, []);

    return {
        isPlaying,
        progress,
        speedMultiplier,
        currentPosition,
        currentHeading,
        play,
        pause,
        seek,
        setSpeed,
    };
};
