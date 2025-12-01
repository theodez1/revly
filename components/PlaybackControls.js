import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { GlassView } from 'expo-glass-effect';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDER_WIDTH = SCREEN_WIDTH - 40; // Padding 20 on each side
const KNOB_SIZE = 20;

export default function PlaybackControls({
    isPlaying,
    progress,
    onPlayPause,
    onSeek,
    speedMultiplier,
    onSpeedChange,
    onClose,
    currentTime,
    totalTime,
    currentDistance,
    totalDistance
}) {
    const translateX = useSharedValue(0);
    const isDragging = useSharedValue(false);

    // Sync knob with progress prop when not dragging
    useEffect(() => {
        if (!isDragging.value) {
            translateX.value = progress * (SLIDER_WIDTH - KNOB_SIZE);
        }
    }, [progress]);

    const panGesture = Gesture.Pan()
        .onStart(() => {
            isDragging.value = true;
        })
        .onUpdate((event) => {
            const newX = Math.max(0, Math.min(SLIDER_WIDTH - KNOB_SIZE, event.x));
            translateX.value = newX;
            const newProgress = newX / (SLIDER_WIDTH - KNOB_SIZE);
            runOnJS(onSeek)(newProgress);
        })
        .onEnd(() => {
            isDragging.value = false;
        });

    const knobStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const progressBarStyle = useAnimatedStyle(() => ({
        width: translateX.value + KNOB_SIZE / 2,
    }));

    const formatTime = (seconds) => {
        if (!seconds) return '00:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <View style={styles.container}>
            <GlassView
                style={styles.glassContainer}
                glassEffectStyle="regular"
                tintColor="rgba(255, 255, 255, 0.8)"
            >
                {/* Header Info */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.infoText}>
                            {currentDistance !== undefined ? `${currentDistance.toFixed(1)} km` : '--'} / {totalDistance !== undefined ? `${totalDistance.toFixed(1)} km` : '--'}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={20} color="#1F2937" />
                    </TouchableOpacity>
                </View>

                {/* Slider */}
                <View style={styles.sliderContainer}>
                    <View style={styles.trackBackground} />
                    <Animated.View style={[styles.trackFill, progressBarStyle]} />
                    <GestureDetector gesture={panGesture}>
                        <Animated.View style={[styles.knob, knobStyle]}>
                            <View style={styles.knobInner} />
                        </Animated.View>
                    </GestureDetector>
                </View>

                {/* Controls Row */}
                <View style={styles.controlsRow}>
                    {/* Speed Selector */}
                    <TouchableOpacity
                        style={styles.speedButton}
                        onPress={() => {
                            const speeds = [1, 2, 5, 10];
                            const idx = speeds.indexOf(speedMultiplier);
                            const nextSpeed = speeds[(idx + 1) % speeds.length];
                            onSpeedChange(nextSpeed);
                        }}
                    >
                        <Text style={styles.speedText}>{speedMultiplier}x</Text>
                    </TouchableOpacity>

                    {/* Play/Pause */}
                    <TouchableOpacity style={styles.playButton} onPress={onPlayPause}>
                        <Ionicons name={isPlaying ? "pause" : "play"} size={28} color="#FFFFFF" style={{ marginLeft: isPlaying ? 0 : 2 }} />
                    </TouchableOpacity>

                    {/* Placeholder for balance or other control */}
                    <View style={{ width: 40 }} />
                </View>
            </GlassView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 30,
        left: 10,
        right: 10,
        alignItems: 'center',
        zIndex: 1000,
    },
    glassContainer: {
        width: '100%',
        borderRadius: 24,
        padding: 16,
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.9)', // Fallback
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    infoText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4B5563',
        fontVariant: ['tabular-nums'],
    },
    closeButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sliderContainer: {
        height: 30,
        justifyContent: 'center',
        marginBottom: 12,
    },
    trackBackground: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 4,
        backgroundColor: '#E5E7EB',
        borderRadius: 2,
    },
    trackFill: {
        position: 'absolute',
        left: 0,
        height: 4,
        backgroundColor: '#2563EB',
        borderRadius: 2,
    },
    knob: {
        position: 'absolute',
        width: KNOB_SIZE,
        height: KNOB_SIZE,
        borderRadius: KNOB_SIZE / 2,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
    },
    knobInner: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#2563EB',
    },
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    playButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#2563EB',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    speedButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    speedText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#4B5563',
    },
});
