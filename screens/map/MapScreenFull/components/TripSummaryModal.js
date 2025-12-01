import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { autoDetectTrim, formatTrimDuration } from '../utils/autoTrimDetection';
import { Ionicons } from '@expo/vector-icons';

const TripSummaryModal = ({
  visible,
  onClose,
  totalDistance = 0,
  maxSpeed = 0,
  tripSteps = [],
  trackingPoints = [],
  tripName,
  setTripName,
  tripDescription,
  setTripDescription,
  saveTripWithSteps,
  isSaving = false,
  formatTripTime,
  getCurrentTripTime,
  selectedVehicleId,
  getVehicleIcon,
  getVehicleName,
}) => {
  const { photoSteps, otherSteps } = useMemo(() => {
    const photos = [];
    const others = [];
    tripSteps.forEach((step) => {
      if (step?.type === 'photo' && step?.photo) {
        photos.push(step);
      } else {
        others.push(step);
      }
    });
    return { photoSteps: photos, otherSteps: others };
  }, [tripSteps]);

  const [snapshotSeconds, setSnapshotSeconds] = useState(0);
  const [stepCities, setStepCities] = useState({});

  useEffect(() => {
    if (visible && typeof getCurrentTripTime === 'function') {
      setSnapshotSeconds(getCurrentTripTime());
    }
  }, [visible, getCurrentTripTime]);

  useEffect(() => {
    if (!visible || otherSteps.length === 0) {
      return;
    }

    let cancelled = false;

    (async () => {
      const updates = {};
      const stepsToResolve = otherSteps.slice(0, 15).filter(
        (step) => step.location && !stepCities[step.id],
      );

      for (const step of stepsToResolve) {
        try {
          const { latitude, longitude } = step.location;
          if (typeof latitude !== 'number' || typeof longitude !== 'number') continue;

          const results = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (!Array.isArray(results) || results.length === 0) continue;

          const payload = results[0] || {};
          const candidate =
            payload.city ||
            payload.name ||
            payload.town ||
            payload.village ||
            payload.municipality ||
            payload.district ||
            payload.subregion ||
            payload.region;

          if (candidate && !cancelled) {
            updates[step.id] = candidate;
          }
        } catch (e) {
          // silencieux pour ne pas gêner l'UX
        }
      }

      if (!cancelled && Object.keys(updates).length > 0) {
        setStepCities((prev) => ({ ...prev, ...updates }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, otherSteps, stepCities]);

  const [trimStartIndex, setTrimStartIndex] = useState(0);
  const [trimEndIndex, setTrimEndIndex] = useState(0);
  const [autoTrimApplied, setAutoTrimApplied] = useState(false);
  const [trimmedStartDuration, setTrimmedStartDuration] = useState(0);
  const [trimmedEndDuration, setTrimmedEndDuration] = useState(0);
  const [privacyStartEnabled, setPrivacyStartEnabled] = useState(false);
  const [privacyEndEnabled, setPrivacyEndEnabled] = useState(false);
  const [privacyStartKm, setPrivacyStartKm] = useState('0.3');
  const [privacyEndKm, setPrivacyEndKm] = useState('0.3');
  const [displayStats, setDisplayStats] = useState({
    distance: totalDistance,
    maxSpeed: maxSpeed,
    duration: 0,
    pointsCount: tripSteps.length
  });

  // Auto-detect and apply trim when modal opens
  useEffect(() => {
    if (visible && trackingPoints.length > 0) {
      const { startIndex, endIndex, trimmedStart, trimmedEnd } = autoDetectTrim(trackingPoints);

      setTrimStartIndex(startIndex);
      setTrimEndIndex(endIndex);
      setTrimmedStartDuration(trimmedStart);
      setTrimmedEndDuration(trimmedEnd);
      setAutoTrimApplied(trimmedStart > 0 || trimmedEnd > 0);

      const currentDuration = typeof getCurrentTripTime === 'function' ? getCurrentTripTime() : 0;
      setDisplayStats({
        distance: totalDistance,
        maxSpeed: maxSpeed,
        duration: currentDuration,
        pointsCount: tripSteps.length
      });
    }
  }, [visible, trackingPoints, totalDistance, maxSpeed, getCurrentTripTime, tripSteps.length]);

  // Recalculate stats when trim indices change
  useEffect(() => {
    if (!trackingPoints || trackingPoints.length === 0) return;
    if (trimStartIndex >= trimEndIndex) return;

    const trimmedPoints = trackingPoints.slice(trimStartIndex, trimEndIndex + 1);

    if (trimmedPoints.length < 2) return;

    // Recalculate Distance
    let newDistance = 0;
    for (let i = 1; i < trimmedPoints.length; i++) {
      const p2 = trimmedPoints[i];
      if (p2.distance) {
        newDistance += p2.distance;
      }
    }

    // Recalculate Max Speed
    const newMaxSpeed = trimmedPoints.reduce((max, p) => Math.max(max, (p.speed || 0) * 3.6), 0);

    // Calculate duration
    const startTime = trimmedPoints[0].timestamp;
    const endTime = trimmedPoints[trimmedPoints.length - 1].timestamp;
    const duration = (endTime - startTime) / 1000;

    setDisplayStats({
      distance: newDistance / 1000,
      maxSpeed: newMaxSpeed,
      duration: duration,
      pointsCount: trimmedPoints.length
    });

  }, [trimStartIndex, trimEndIndex, trackingPoints]);

  const handleDisableAutoTrim = useCallback(() => {
    setTrimStartIndex(0);
    setTrimEndIndex(trackingPoints.length - 1);
    setAutoTrimApplied(false);
    setTrimmedStartDuration(0);
    setTrimmedEndDuration(0);
  }, [trackingPoints.length]);

  const handleSave = () => {
    // Apply trim if needed
    if (trimStartIndex > 0 || trimEndIndex < trackingPoints.length - 1) {
      if (!trackingPoints || trackingPoints.length === 0) {
        saveTripWithSteps({
          privacy_start_enabled: privacyStartEnabled,
          privacy_end_enabled: privacyEndEnabled,
          privacy_start_km: parseFloat(privacyStartKm) || 0.3,
          privacy_end_km: parseFloat(privacyEndKm) || 0.3,
        });
        return;
      }

      const trimmedPoints = trackingPoints.slice(trimStartIndex, trimEndIndex + 1);

      // Filter steps based on trimmed time range
      const newStartTime = trimmedPoints[0].timestamp;
      const newEndTime = trimmedPoints[trimmedPoints.length - 1].timestamp;
      const trimmedSteps = tripSteps.filter(s => s.timestamp >= newStartTime && s.timestamp <= newEndTime);

      saveTripWithSteps({
        trackingPoints: trimmedPoints,
        tripSteps: trimmedSteps,
        totalDistance: displayStats.distance,
        maxSpeed: displayStats.maxSpeed,
        startTime: newStartTime,
        getCurrentTripTime: () => displayStats.duration,
        privacy_start_enabled: privacyStartEnabled,
        privacy_end_enabled: privacyEndEnabled,
        privacy_start_km: parseFloat(privacyStartKm) || 0.3,
        privacy_end_km: parseFloat(privacyEndKm) || 0.3,
      });
    } else {
      saveTripWithSteps({
        privacy_start_enabled: privacyStartEnabled,
        privacy_end_enabled: privacyEndEnabled,
        privacy_start_km: parseFloat(privacyStartKm) || 0.3,
        privacy_end_km: parseFloat(privacyEndKm) || 0.3,
      });
    }
  };

  const elapsedSeconds = visible ? displayStats.duration : 0;
  const elapsedTimeText = formatTripTime ? formatTripTime(elapsedSeconds) : `${elapsedSeconds.toFixed(0)}s`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Résumé du trajet</Text>
            <TextInput
              style={styles.heroTitleInput}
              value={tripName}
              onChangeText={setTripName}
              placeholder="Donne un nom à ce trajet..."
              placeholderTextColor="rgba(255,255,255,0.7)"
              selectionColor="#FFFFFF"
            />
            <Text style={styles.heroTime}>{elapsedTimeText}</Text>
            <View style={styles.metricsRow}>
              <View style={styles.metricPill}>
                <Text style={styles.metricValue}>{(displayStats.distance || 0).toFixed(2)} km</Text>
                <Text style={styles.metricLabel}>Distance</Text>
              </View>
              <View style={styles.metricPill}>
                <Text style={styles.metricValue}>{(displayStats.maxSpeed || 0).toFixed(0)} km/h</Text>
                <Text style={styles.metricLabel}>Vitesse max</Text>
              </View>
              <View style={styles.metricPill}>
                <Text style={styles.metricValue}>{tripSteps.length}</Text>
                <Text style={styles.metricLabel}>Moments</Text>
              </View>
            </View>
          </View>

          {/* Auto-Trim Info */}
          {autoTrimApplied && (
            <View style={styles.autoTrimCard}>
              <View style={styles.autoTrimHeader}>
                <Text style={styles.autoTrimIcon}>✂️</Text>
                <View style={styles.autoTrimTextContainer}>
                  <Text style={styles.autoTrimTitle}>Périodes d'inactivité supprimées</Text>
                  <Text style={styles.autoTrimSubtitle}>
                    {trimmedStartDuration > 0 && `${formatTrimDuration(trimmedStartDuration)} au début`}
                    {trimmedStartDuration > 0 && trimmedEndDuration > 0 && ' • '}
                    {trimmedEndDuration > 0 && `${formatTrimDuration(trimmedEndDuration)} à la fin`}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.disableAutoTrimButton}
                onPress={handleDisableAutoTrim}
              >
                <Text style={styles.disableAutoTrimText}>Garder le trajet complet</Text>
              </TouchableOpacity>
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

          <View style={styles.vehicleHighlight}>
            <View style={styles.vehicleBadge}>
              <Text style={styles.vehicleBadgeText}>Véhicule</Text>
            </View>
            <Text style={styles.vehicleName}>{getVehicleName(selectedVehicleId)}</Text>
            <Text style={styles.vehicleHint}>Personnalise-le depuis ton profil si besoin</Text>
          </View>

          <View style={styles.detailsCard}>
            <Text style={styles.cardTitle}>Notes rapides</Text>
            <TextInput
              style={styles.detailInput}
              value={tripDescription}
              onChangeText={setTripDescription}
              placeholder="Ajoute une description pour te souvenir de ce trajet..."
              multiline
            />
          </View>

          {photoSteps.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Highlights ({photoSteps.length})</Text>
                <Text style={styles.sectionSubtitle}>Les plus belles photos de ce run</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photoRow}
              >
                {photoSteps.map((step) => (
                  <View key={step.id} style={styles.photoCard}>
                    <Image source={{ uri: step.photo }} style={styles.photo} />
                    <View style={styles.photoMeta}>
                      <Text style={styles.photoTime}>
                        {new Date(step.timestamp).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                      {step.title ? <Text style={styles.photoCaption}>{step.title}</Text> : null}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Timeline</Text>
              <Text style={styles.sectionSubtitle}>
                {otherSteps.length > 0 ? `${otherSteps.length} étape(s)` : 'Ajoute une étape pour détailler ton trajet.'}
              </Text>
            </View>
            {otherSteps.length > 0 ? (
              <View style={styles.timelineWrapper}>
                {otherSteps.map((step, index) => {
                  const isLast = index === otherSteps.length - 1;
                  const time = step.timestamp
                    ? new Date(step.timestamp).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                    : null;
                  const city = stepCities[step.id];

                  return (
                    <View key={step.id} style={[styles.timelineRow, isLast && styles.timelineRowLast]}>
                      <View style={styles.timelineLeftColumn}>
                        <View style={styles.timelineDot} />
                        {!isLast && (
                          <View style={styles.timelineLine} />
                        )}
                      </View>
                      <View style={styles.timelineRightColumn}>
                        <Text style={styles.timelineTitle}>{step.title}</Text>
                        {step.description ? (
                          <Text style={styles.timelineDescription}>{step.description}</Text>
                        ) : null}
                        {(time || city) && (
                          <View style={styles.timelineMeta}>
                            {time && <Text style={styles.timelineMetaText}>{time}</Text>}
                            {city && (
                              <>
                                {time && <Text style={styles.timelineMetaSeparator}> • </Text>}
                                <Text style={styles.timelineMetaText}>{city}</Text>
                              </>
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyTimeline}>
                <Text style={styles.emptyTimelineText}>
                  Aucune étape textuelle. Ajoute des repères pendant ton trajet pour enrichir ce résumé.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <View style={styles.saveButtonLoading}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Sauvegarde en cours...</Text>
              </View>
            ) : (
              <Text style={styles.saveButtonText}>Sauvegarder le trajet</Text>
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
  heroLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
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
  trimCard: {
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
  trimRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  trimControl: {
    flex: 1,
  },
  trimLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
    fontWeight: '600',
  },
  trimInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
  },
  trimButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  trimButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  trimValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  trimHint: {
    marginTop: 12,
    fontSize: 13,
    color: '#059669',
    fontWeight: '500',
    textAlign: 'center',
  },
  vehicleHighlight: {
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
  vehicleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    marginBottom: 10,
  },
  vehicleBadgeText: {
    color: '#1D4ED8',
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  vehicleName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  vehicleHint: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
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
    minHeight: 80,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 15,
    color: '#0F172A',
    textAlignVertical: 'top',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  photoRow: {
    gap: 14,
    paddingHorizontal: 2,
  },
  photoCard: {
    width: 200,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  photo: {
    width: '100%',
    height: 140,
  },
  photoMeta: {
    padding: 10,
    backgroundColor: 'rgba(15,23,42,0.9)',
  },
  photoTime: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  photoCaption: {
    color: 'rgba(255,255,255,0.8)',
  },
  timelineWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineRowLast: {
    marginBottom: 0,
  },
  timelineLeftColumn: {
    width: 30,
    alignItems: 'center',
    marginRight: 16,
    position: 'relative',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1D4ED8',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 2,
    position: 'relative',
    marginTop: 4,
    marginBottom: 4,
  },
  timelineLine: {
    position: 'absolute',
    top: 20,
    left: 14,
    width: 2,
    bottom: -20,
    backgroundColor: '#E2E8F0',
    zIndex: 1,
  },
  timelineRightColumn: {
    flex: 1,
    paddingTop: 0,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  timelineDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 6,
  },
  timelineMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineMetaText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  timelineMetaSeparator: {
    fontSize: 12,
    color: '#94A3B8',
  },
  emptyTimeline: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTimelineText: {
    fontSize: 14,
    color: '#475569',
  },
  footer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  saveButton: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  autoTrimCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  autoTrimHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  autoTrimIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  autoTrimTextContainer: {
    flex: 1,
  },
  autoTrimTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 2,
  },
  autoTrimSubtitle: {
    fontSize: 13,
    color: '#047857',
  },
  disableAutoTrimButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    alignSelf: 'flex-start',
  },
  disableAutoTrimText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
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

export default TripSummaryModal;
