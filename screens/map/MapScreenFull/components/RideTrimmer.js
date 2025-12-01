import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Rect, Line, G } from 'react-native-svg';
import { PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedGestureHandler,
    withSpring,
    runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRAPH_WIDTH = SCREEN_WIDTH - 80;
const GRAPH_HEIGHT = 120;
const HANDLE_WIDTH = 20;

const RideTrimmer = ({
    trackingPoints = [],
    onTrimChange,
    initialTrimStart = 0,
    initialTrimEnd = null,
}) => {
    const endIndex = initialTrimEnd ?? trackingPoints.length - 1;

    const [trimStart, setTrimStart] = useState(initialTrimStart);
    const [trimEnd, setTrimEnd] = useState(endIndex);

    // Shared values for handle positions (in pixels)
    const startHandleX = useSharedValue((trimStart / trackingPoints.length) * GRAPH_WIDTH);
    const endHandleX = useSharedValue((trimEnd / trackingPoints.length) * GRAPH_WIDTH);

    // Generate speed graph path
    const speedPath = useMemo(() => {
        if (trackingPoints.length < 2) return '';

        const maxSpeed = Math.max(...trackingPoints.map(p => (p.speed || 0) * 3.6));
        const points = trackingPoints.map((point, index) => {
            const x = (index / (trackingPoints.length - 1)) * GRAPH_WIDTH;
            const speedKmh = (point.speed || 0) * 3.6;
            const y = GRAPH_HEIGHT - (speedKmh / maxSpeed) * GRAPH_HEIGHT;
            return { x, y };
        });

        // Create smooth path
        let path = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            path += ` L ${points[i].x} ${points[i].y}`;
        }

        return path;
    }, [trackingPoints]);

    // Calculate time labels
    const { startTime, endTime, selectedDuration, totalDuration } = useMemo(() => {
        if (trackingPoints.length === 0) {
            return { startTime: '0:00', endTime: '0:00', selectedDuration: '0:00', totalDuration: '0:00' };
        }

        const firstPoint = trackingPoints[0];
        const lastPoint = trackingPoints[trackingPoints.length - 1];
        const trimStartPoint = trackingPoints[trimStart];
        const trimEndPoint = trackingPoints[trimEnd];

        const formatTime = (ms) => {
            const totalSeconds = Math.floor(ms / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        };

        const totalMs = lastPoint.timestamp - firstPoint.timestamp;
        const selectedMs = trimEndPoint.timestamp - trimStartPoint.timestamp;
        const startMs = trimStartPoint.timestamp - firstPoint.timestamp;
        const endMs = trimEndPoint.timestamp - firstPoint.timestamp;

        return {
            startTime: formatTime(startMs),
            endTime: formatTime(endMs),
            selectedDuration: formatTime(selectedMs),
            totalDuration: formatTime(totalMs),
        };
    }, [trackingPoints, trimStart, trimEnd]);

    // Handle drag gestures
    const createGestureHandler = useCallback((isStart) => {
        return useAnimatedGestureHandler({
            onStart: (_, ctx) => {
                ctx.startX = isStart ? startHandleX.value : endHandleX.value;
                runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
            },
            onActive: (event, ctx) => {
                const newX = Math.max(0, Math.min(GRAPH_WIDTH, ctx.startX + event.translationX));

                if (isStart) {
                    // Constrain start handle to not pass end handle
                    if (newX < endHandleX.value - HANDLE_WIDTH) {
                        startHandleX.value = newX;
                    }
                } else {
                    // Constrain end handle to not pass start handle
                    if (newX > startHandleX.value + HANDLE_WIDTH) {
                        endHandleX.value = newX;
                    }
                }
            },
            onEnd: () => {
                runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);

                // Convert pixel positions to indices
                const startIdx = Math.round((startHandleX.value / GRAPH_WIDTH) * (trackingPoints.length - 1));
                const endIdx = Math.round((endHandleX.value / GRAPH_WIDTH) * (trackingPoints.length - 1));

                runOnJS(setTrimStart)(startIdx);
                runOnJS(setTrimEnd)(endIdx);

                if (onTrimChange) {
                    runOnJS(onTrimChange)(startIdx, endIdx);
                }
            },
        });
    }, [trackingPoints.length, onTrimChange]);

    const startGestureHandler = useMemo(() => createGestureHandler(true), [createGestureHandler]);
    const endGestureHandler = useMemo(() => createGestureHandler(false), [createGestureHandler]);

    // Animated styles for handles
    const startHandleStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: startHandleX.value }],
    }));

    const endHandleStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: endHandleX.value }],
    }));

    const selectionStyle = useAnimatedStyle(() => ({
        left: startHandleX.value,
        width: endHandleX.value - startHandleX.value,
    }));

    if (trackingPoints.length < 2) {
        return (
            <View style={styles.container}>
                <Text style={styles.emptyText}>Pas assez de données pour afficher le graphique</Text>
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Ajuster le trajet</Text>
                <Text style={styles.subtitle}>
                    Sélectionné: {selectedDuration} / {totalDuration}
                </Text>
            </View>

            <View style={styles.graphContainer}>
                {/* SVG Speed Graph */}
                <Svg width={GRAPH_WIDTH} height={GRAPH_HEIGHT} style={styles.svg}>
                    {/* Background grid */}
                    <Line x1="0" y1={GRAPH_HEIGHT / 2} x2={GRAPH_WIDTH} y2={GRAPH_HEIGHT / 2} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4,4" />

                    {/* Speed curve */}
                    <Path d={speedPath} stroke="#94A3B8" strokeWidth="2" fill="none" />
                </Svg>

                {/* Overlay for dimmed areas */}
                <View style={styles.overlayContainer}>
                    {/* Left dimmed area */}
                    <Animated.View style={[styles.dimmedArea, { width: startHandleX }]} />

                    {/* Selected area highlight */}
                    <Animated.View style={[styles.selectedArea, selectionStyle]} />

                    {/* Right dimmed area */}
                    <Animated.View style={[styles.dimmedArea, { left: endHandleX, right: 0 }]} />
                </View>

                {/* Start Handle */}
                <PanGestureHandler onGestureEvent={startGestureHandler}>
                    <Animated.View style={[styles.handle, styles.startHandle, startHandleStyle]}>
                        <View style={styles.handleBar} />
                        <Text style={styles.handleLabel}>{startTime}</Text>
                    </Animated.View>
                </PanGestureHandler>

                {/* End Handle */}
                <PanGestureHandler onGestureEvent={endGestureHandler}>
                    <Animated.View style={[styles.handle, styles.endHandle, endHandleStyle]}>
                        <View style={styles.handleBar} />
                        <Text style={styles.handleLabel}>{endTime}</Text>
                    </Animated.View>
                </PanGestureHandler>
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>Glissez les poignées pour ajuster</Text>
            </View>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
    },
    header: {
        marginBottom: 16,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#64748B',
    },
    graphContainer: {
        height: GRAPH_HEIGHT + 60,
        position: 'relative',
        marginBottom: 16,
    },
    svg: {
        position: 'absolute',
        top: 30,
        left: 0,
    },
    overlayContainer: {
        position: 'absolute',
        top: 30,
        left: 0,
        right: 0,
        height: GRAPH_HEIGHT,
        flexDirection: 'row',
    },
    dimmedArea: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        backgroundColor: 'rgba(148, 163, 184, 0.3)',
    },
    selectedArea: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderLeftWidth: 2,
        borderRightWidth: 2,
        borderColor: '#2563EB',
    },
    handle: {
        position: 'absolute',
        width: HANDLE_WIDTH,
        height: GRAPH_HEIGHT + 40,
        top: 10,
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    startHandle: {
        marginLeft: -HANDLE_WIDTH / 2,
    },
    endHandle: {
        marginLeft: -HANDLE_WIDTH / 2,
    },
    handleBar: {
        width: 4,
        height: GRAPH_HEIGHT + 20,
        backgroundColor: '#2563EB',
        borderRadius: 2,
        marginTop: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    handleLabel: {
        position: 'absolute',
        top: 0,
        fontSize: 12,
        fontWeight: '600',
        color: '#2563EB',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#2563EB',
    },
    footer: {
        alignItems: 'center',
    },
    footerText: {
        fontSize: 13,
        color: '#94A3B8',
        fontStyle: 'italic',
    },
    emptyText: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        padding: 20,
    },
});

export default RideTrimmer;
