import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { autoDetectTrim, formatTrimDuration } from '../../map/MapScreenFull/utils/autoTrimDetection';

const EditTripModal = ({
    visible,
    onClose,
    ride,
    onSave,
    isSaving
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [privacyStartEnabled, setPrivacyStartEnabled] = useState(false);
    const [privacyEndEnabled, setPrivacyEndEnabled] = useState(false);
    const [privacyStartKm, setPrivacyStartKm] = useState('0.3');
    const [privacyEndKm, setPrivacyEndKm] = useState('0.3');
    const [showTrimInfo, setShowTrimInfo] = useState(false);
    const [trimInfo, setTrimInfo] = useState(null);

    useEffect(() => {
        if (ride) {
            setName(ride.name || '');
            setDescription(ride.description || '');
            setPrivacyStartEnabled(ride.privacy_start_enabled || false);
            setPrivacyEndEnabled(ride.privacy_end_enabled || false);
            setPrivacyStartKm(String(ride.privacy_start_km || 0.3));
            setPrivacyEndKm(String(ride.privacy_end_km || 0.3));

            // Detect if trim can be applied
            if (ride.routeCoordinates && ride.routeCoordinates.length > 0) {
                const detected = autoDetectTrim(ride.routeCoordinates);
                if (detected.trimmedStart > 0 || detected.trimmedEnd > 0) {
                    setTrimInfo(detected);
                    setShowTrimInfo(true);
                }
            }
        }
    }, [ride]);

    const handleSave = () => {
        if (onSave) {
            onSave({
                name,
                description,
                privacy_start_enabled: privacyStartEnabled,
                privacy_end_enabled: privacyEndEnabled,
                privacy_start_km: parseFloat(privacyStartKm) || 0.3,
                privacy_end_km: parseFloat(privacyEndKm) || 0.3,
            });
        }
    };


    // Format duration
    const formatDuration = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m ${secs}s`;
        return `${secs}s`;
    };

    const elapsedTimeText = ride?.duration ? formatDuration(ride.duration) : '0s';
    const distanceKm = ride?.distance ? (ride.distance / 1000).toFixed(2) : '0.00';
    const maxSpeedKmh = ride?.maxSpeed ? ride.maxSpeed.toFixed(0) : '0';

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Hero Card */}
                    <View style={styles.heroCard}>
                        <View style={styles.heroHeader}>
                            <Text style={styles.heroLabel}>Modifier le trajet</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.8)" />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.heroTitleInput}
                            value={name}
                            onChangeText={setName}
                            placeholder="Nom du trajet..."
                            placeholderTextColor="rgba(255,255,255,0.6)"
                            selectionColor="#FFFFFF"
                        />

                        <Text style={styles.heroTime}>{elapsedTimeText}</Text>

                        {/* Metrics Row */}
                        <View style={styles.metricsRow}>
                            <View style={styles.metricPill}>
                                <Text style={styles.metricValue}>{distanceKm} km</Text>
                                <Text style={styles.metricLabel}>Distance</Text>
                            </View>
                            <View style={styles.metricPill}>
                                <Text style={styles.metricValue}>{maxSpeedKmh} km/h</Text>
                                <Text style={styles.metricLabel}>Vitesse max</Text>
                            </View>
                            <View style={styles.metricPill}>
                                <Text style={styles.metricValue}>{ride?.vehicle || 'car'}</Text>
                                <Text style={styles.metricLabel}>Véhicule</Text>
                            </View>
                        </View>
                    </View>

                    {/* Description Card */}
                    <View style={styles.detailsCard}>
                        <Text style={styles.cardTitle}>Description</Text>
                        <TextInput
                            style={styles.detailInput}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Ajoute une description pour te souvenir de ce trajet..."
                            placeholderTextColor="#94A3B8"
                            multiline
                            textAlignVertical="top"
                        />
                    </View>

                    {/* Trim Info Card */}
                    {showTrimInfo && trimInfo && (
                        <View style={styles.trimInfoCard}>
                            <View style={styles.trimInfoHeader}>
                                <Text style={styles.trimInfoIcon}>✂️</Text>
                                <View style={styles.trimInfoTextContainer}>
                                    <Text style={styles.trimInfoTitle}>Périodes d'inactivité détectées</Text>
                                    <Text style={styles.trimInfoSubtitle}>
                                        {trimInfo.trimmedStart > 0 && `${formatTrimDuration(trimInfo.trimmedStart)} au début`}
                                        {trimInfo.trimmedStart > 0 && trimInfo.trimmedEnd > 0 && ' • '}
                                        {trimInfo.trimmedEnd > 0 && `${formatTrimDuration(trimInfo.trimmedEnd)} à la fin`}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.trimInfoNote}>
                                💡 Utilisez "Garder le trajet complet" dans le résumé pour réappliquer le trim
                            </Text>
                        </View>
                    )}

                    {/* Privacy Card */}
                    <View style={styles.privacyCard}>
                        <View style={styles.privacyHeader}>
                            <Ionicons name="lock-closed" size={20} color="#7C3AED" />
                            <Text style={styles.privacyTitle}>Confidentialité</Text>
                        </View>
                        <Text style={styles.privacyDescription}>
                            Masquer le début et la fin du trajet pour protéger ton adresse
                        </Text>

                        {/* Start Privacy */}
                        <View style={styles.privacySection}>
                            <View style={styles.privacyToggleRow}>
                                <View style={styles.privacyToggleLabel}>
                                    <Ionicons name="flag" size={18} color="#64748B" />
                                    <Text style={styles.privacyToggleText}>Masquer le début</Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.toggle, privacyStartEnabled && styles.toggleActive]}
                                    onPress={() => setPrivacyStartEnabled(!privacyStartEnabled)}
                                >
                                    <View style={[styles.toggleThumb, privacyStartEnabled && styles.toggleThumbActive]} />
                                </TouchableOpacity>
                            </View>

                            {privacyStartEnabled && (
                                <View style={styles.kmInputContainer}>
                                    <TextInput
                                        style={styles.kmInput}
                                        value={privacyStartKm}
                                        onChangeText={setPrivacyStartKm}
                                        keyboardType="decimal-pad"
                                        placeholder="0.3"
                                    />
                                    <Text style={styles.kmLabel}>km</Text>
                                </View>
                            )}
                        </View>

                        {/* End Privacy */}
                        <View style={styles.privacySection}>
                            <View style={styles.privacyToggleRow}>
                                <View style={styles.privacyToggleLabel}>
                                    <Ionicons name="flag-outline" size={18} color="#64748B" />
                                    <Text style={styles.privacyToggleText}>Masquer la fin</Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.toggle, privacyEndEnabled && styles.toggleActive]}
                                    onPress={() => setPrivacyEndEnabled(!privacyEndEnabled)}
                                >
                                    <View style={[styles.toggleThumb, privacyEndEnabled && styles.toggleThumbActive]} />
                                </TouchableOpacity>
                            </View>

                            {privacyEndEnabled && (
                                <View style={styles.kmInputContainer}>
                                    <TextInput
                                        style={styles.kmInput}
                                        value={privacyEndKm}
                                        onChangeText={setPrivacyEndKm}
                                        keyboardType="decimal-pad"
                                        placeholder="0.3"
                                    />
                                    <Text style={styles.kmLabel}>km</Text>
                                </View>
                            )}
                        </View>

                        {(privacyStartEnabled || privacyEndEnabled) && (
                            <View style={styles.privacyWarning}>
                                <Ionicons name="eye-off" size={16} color="#7C3AED" />
                                <Text style={styles.privacyWarningText}>
                                    Les autres utilisateurs ne verront pas ces portions
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Info Card */}
                    <View style={styles.infoCard}>
                        <Ionicons name="information-circle" size={20} color="#3B82F6" />
                        <Text style={styles.infoText}>
                            Les modifications seront synchronisées avec le cloud
                        </Text>
                    </View>
                </ScrollView>

                {/* Footer */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={onClose}
                        disabled={isSaving}
                    >
                        <Text style={styles.cancelButtonText}>Annuler</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.saveButton, isSaving && styles.disabledButton]}
                        onPress={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <View style={styles.saveButtonLoading}>
                                <ActivityIndicator size="small" color="#FFFFFF" />
                                <Text style={styles.saveButtonText}>Enregistrement...</Text>
                            </View>
                        ) : (
                            <Text style={styles.saveButtonText}>Enregistrer</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FB',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    heroCard: {
        backgroundColor: '#111827',
        borderRadius: 20,
        padding: 20,
        marginBottom: 18,
    },
    heroHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    heroLabel: {
        color: 'rgba(255,255,255,0.65)',
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    closeButton: {
        padding: 4,
    },
    heroTitleInput: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    heroTime: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 14,
    },
    metricsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    metricPill: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 10,
    },
    metricValue: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    metricLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
    },
    detailsCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 18,
        marginBottom: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 10,
    },
    detailInput: {
        minHeight: 100,
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        fontSize: 15,
        color: '#0F172A',
        textAlignVertical: 'top',
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        padding: 12,
        marginBottom: 18,
        gap: 10,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: '#1E40AF',
    },
    footer: {
        flexDirection: 'row',
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F1F5F9',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748B',
    },
    saveButton: {
        flex: 2,
        backgroundColor: '#0F172A',
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    saveButtonLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    disabledButton: {
        opacity: 0.7,
    },
    trimInfoCard: {
        backgroundColor: '#FEF3C7',
        borderRadius: 16,
        padding: 16,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    trimInfoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    trimInfoIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    trimInfoTextContainer: {
        flex: 1,
    },
    trimInfoTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#92400E',
        marginBottom: 2,
    },
    trimInfoSubtitle: {
        fontSize: 13,
        color: '#B45309',
    },
    trimInfoNote: {
        fontSize: 12,
        color: '#92400E',
        fontStyle: 'italic',
    },
    privacyCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 18,
        marginBottom: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    },
    privacyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    privacyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    privacyDescription: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 16,
    },
    privacySection: {
        marginBottom: 16,
    },
    privacyToggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    privacyToggleLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    privacyToggleText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0F172A',
    },
    toggle: {
        width: 50,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#E2E8F0',
        padding: 2,
        justifyContent: 'center',
    },
    toggleActive: {
        backgroundColor: '#7C3AED',
    },
    toggleThumb: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    toggleThumbActive: {
        transform: [{ translateX: 22 }],
    },
    kmInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginLeft: 26,
    },
    kmInput: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: '#0F172A',
        padding: 0,
    },
    kmLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
        marginLeft: 8,
    },
    privacyWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        gap: 8,
        backgroundColor: '#F5F3FF',
        padding: 10,
        borderRadius: 8,
    },
    privacyWarningText: {
        flex: 1,
        fontSize: 12,
        color: '#7C3AED',
    },
});

export default EditTripModal;
