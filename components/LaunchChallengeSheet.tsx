import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, Keyboard, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import ChallengesService from '../services/ChallengesService';
import { CHALLENGE_TEMPLATES, ChallengeTemplate } from '../data/challengeTemplates';
import { Challenge } from '../services/supabase/challengesService';

interface LaunchChallengeSheetProps {
  sheetRef: React.RefObject<BottomSheetModal>;
  groupId: string;
  userId: string;
  onChallengeCreated?: (challenge: Challenge) => void;
}

const LaunchChallengeSheet: React.FC<LaunchChallengeSheetProps> = ({ sheetRef, groupId, userId, onChallengeCreated }) => {
  const [creating, setCreating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ChallengeTemplate | null>(null);
  const [durationDays, setDurationDays] = useState('7');
  const [customDuration, setCustomDuration] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Détecter l'ouverture/fermeture du clavier
  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const presetDurations = [5, 7, 10];

  const handleSelectTemplate = (template: ChallengeTemplate) => {
    setSelectedTemplate(template);
    setDurationDays('7');
    setCustomDuration('');
    setIsCustomMode(false);
  };

  const handleSelectPreset = (days: number) => {
    setDurationDays(days.toString());
    setCustomDuration('');
    setIsCustomMode(false);
  };

  const handleSelectCustom = () => {
    setIsCustomMode(true);
    setDurationDays('');
  };

  const handleCustomDurationChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    setCustomDuration(numericValue);
    if (numericValue && parseInt(numericValue, 10) > 0) {
      setDurationDays(numericValue);
    } else {
      setDurationDays('');
    }
  };

  const handleLaunchChallenge = async () => {
    if (!selectedTemplate) return;
    
    const days = parseInt(durationDays, 10);
    if (isNaN(days) || days < 1) {
      Alert.alert('Erreur', 'Veuillez entrer un nombre de jours valide (minimum 1 jour).');
      return;
    }

    try {
      setCreating(true);
      
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);
      
      const challenge = await ChallengesService.createChallenge({
        group_id: groupId,
        title: selectedTemplate.name,
        description: selectedTemplate.description,
        type: selectedTemplate.type,
        target_value: selectedTemplate.targetValue,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        created_by: userId,
        // Les conditions de validation sont fixes dans la fonction SQL (1 km, 5 min)
      });
      
      Alert.alert('Défi lancé', `Le défi "${selectedTemplate.name}" a été lancé avec succès !`, [
        {
          text: 'OK',
          onPress: () => {
            setSelectedTemplate(null);
            setDurationDays('7');
            sheetRef.current?.dismiss();
            if (onChallengeCreated) {
              onChallengeCreated(challenge);
            }
          },
        },
      ]);
    } catch (error) {
      console.error('Erreur lancement défi:', error);
      Alert.alert('Erreur', 'Impossible de lancer le défi. Veuillez réessayer.');
    } finally {
      setCreating(false);
    }
  };

  const getTypeIcon = (template: ChallengeTemplate): keyof typeof Ionicons.glyphMap => {
    return (template.icon || 'trophy-outline') as keyof typeof Ionicons.glyphMap;
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
      />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      enablePanDownToClose
      enableDynamicSizing={true}
      enableOverDrag={false}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      animateOnMount={true}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetScrollView 
        style={styles.contentContainer}
        contentContainerStyle={styles.contentContainerStyle}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>
            {selectedTemplate ? 'Configurer' : 'Nouveau défi'}
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (selectedTemplate) {
                setSelectedTemplate(null);
                setDurationDays('7');
              } else {
                sheetRef.current?.dismiss();
              }
            }}
            style={styles.closeButton}
          >
            <Ionicons name={selectedTemplate ? "arrow-back" : "close"} size={22} color="#1F2937" />
          </TouchableOpacity>
        </View>

        {selectedTemplate ? (
          <View style={styles.configContainer}>
            <View style={styles.selectedTemplateInfo}>
              <View style={styles.selectedIconContainer}>
                <Ionicons name={getTypeIcon(selectedTemplate)} size={28} color="#1F2937" />
              </View>
              <View style={styles.selectedContent}>
                <Text style={styles.selectedName}>{selectedTemplate.name}</Text>
                <Text style={styles.selectedDescription}>{selectedTemplate.description}</Text>
              </View>
            </View>

            <View style={styles.durationSection}>
              <Text style={styles.durationLabel}>Durée</Text>
              <View style={styles.presetButtons}>
                {presetDurations.map((days) => (
                  <TouchableOpacity
                    key={days}
                    style={[
                      styles.presetButton,
                      durationDays === days.toString() && !isCustomMode && styles.presetButtonActive
                    ]}
                    onPress={() => handleSelectPreset(days)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.presetButtonText,
                      durationDays === days.toString() && !isCustomMode && styles.presetButtonTextActive
                    ]}>
                      {days}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[
                    styles.presetButton,
                    styles.customButton,
                    isCustomMode && styles.presetButtonActive
                  ]}
                  onPress={handleSelectCustom}
                  activeOpacity={0.7}
                >
                  {isCustomMode ? (
                    <TextInput
                      style={styles.customInput}
                      value={customDuration}
                      onChangeText={handleCustomDurationChange}
                      keyboardType="number-pad"
                      placeholder="?"
                      maxLength={3}
                      autoFocus
                    />
                  ) : (
                    <Text style={[
                      styles.presetButtonText,
                      isCustomMode && styles.presetButtonTextActive
                    ]}>
                      ?
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
              <Text style={styles.durationUnit}>jours</Text>
            </View>

            <TouchableOpacity
              style={[styles.launchButton, (creating || !durationDays || parseInt(durationDays, 10) < 1) && styles.launchButtonDisabled]}
              onPress={handleLaunchChallenge}
              disabled={creating || !durationDays || parseInt(durationDays, 10) < 1}
              activeOpacity={0.7}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.launchButtonText}>Lancer</Text>
              )}
            </TouchableOpacity>
            {durationDays && (
              <Text style={styles.durationHint}>
                Le défi durera {durationDays} jour{parseInt(durationDays, 10) > 1 ? 's' : ''}
              </Text>
            )}
            {/* Espace pour le clavier */}
            {keyboardHeight > 0 && <View style={{ height: keyboardHeight }} />}
          </View>
        ) : (
          <View style={styles.templatesList}>
            {CHALLENGE_TEMPLATES.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={styles.templateCard}
                onPress={() => handleSelectTemplate(template)}
                activeOpacity={0.7}
              >
                <View style={styles.templateIconContainer}>
                  <Ionicons name={getTypeIcon(template)} size={24} color="#1F2937" />
                </View>
                <View style={styles.templateContent}>
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templateDescription}>{template.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#FFFFFF',
  },
  handleIndicator: {
    backgroundColor: '#CBD5E1',
    width: 40,
  },
  contentContainer: {
    flex: 1,
  },
  contentContainerStyle: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  configContainer: {
    paddingTop: 24,
    paddingBottom: 24,
  },
  selectedTemplateInfo: {
    flexDirection: 'row',
    marginBottom: 32,
  },
  selectedIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  selectedContent: {
    flex: 1,
    justifyContent: 'center',
  },
  selectedName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  selectedDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  durationSection: {
    marginBottom: 32,
  },
  durationLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  presetButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  presetButton: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetButtonActive: {
    backgroundColor: '#1F2937',
    borderColor: '#1F2937',
  },
  presetButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  presetButtonTextActive: {
    color: '#FFFFFF',
  },
  customButton: {
    // Même style que presetButton
  },
  customInput: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    width: 40,
    padding: 0,
  },
  durationUnit: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  durationHint: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
  },
  launchButton: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  launchButtonDisabled: {
    opacity: 0.5,
  },
  launchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  templatesList: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  templateIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  templateContent: {
    flex: 1,
  },
  templateName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
});

export default LaunchChallengeSheet;

