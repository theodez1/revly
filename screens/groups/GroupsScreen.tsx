import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, Alert, KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useAuth } from '../../contexts/AuthContext';
import GroupsService from '../../services/GroupsService';
import ChallengesService from '../../services/ChallengesService';
import InvitationsService from '../../services/supabase/invitationsService';

import { GroupsSkeleton } from '../../components/Skeletons';

interface Invitation {
  id: string;
  groupId: string;
  groupName?: string;
  status: string;
  // UI-only fields coming from API joins
  groupAvatar?: string | null;
  invitedByName?: string | null;
}

interface Group {
  id: string;
  name: string;
  description?: string | null;
  location?: string | null;
  // Additional fields used in UI cards
  avatar?: string | null;
  memberCount?: number;
}

interface Challenge {
  id: string;
  title: string;
  description?: string;
  groupId: string;
  // Challenge meta used for display
  type?: 'speed' | 'count' | 'distance' | string;
  bestSpeed?: number | null;
  progress?: number | null;
  target?: number | null;
  currentLeader?: string | null;
  leader?: string | null;
  leaderScore?: number | null;
  participants?: number;
  daysLeft?: number;
}

const APP_BLUE = '#1F2937'; // Gris foncé au lieu de bleu
const APP_BLUE_LIGHT = '#F1F5F9'; // Gris clair au lieu de bleu clair

export default function GroupsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const bottomSheetRef = useRef<BottomSheetModal | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupLocation, setNewGroupLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const snapPoints = useMemo(() => ['50%', '70%'], []);
  const screenWidth = Dimensions.get('window').width;
  const showcaseCardWidth = Math.min(screenWidth * 0.55, 180);

  const renderBackdrop = (props: any) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
  );

  const [groups, setGroups] = useState<Group[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [userInvitations, setUserInvitations] = useState<Invitation[]>([]);

  const loadInvitations = async () => {
    try {
      if (user?.id) {
        // Charger directement depuis l'API
        const { invitations } = await InvitationsService.getUserInvitations(user.id);
        setUserInvitations(invitations || []);
      }
    } catch (error) {
      console.error('Erreur chargement invitations:', error);
      setUserInvitations([]);
    }
  };

  const loadGroups = async () => {
    try {
      if (user?.id) {
        // Charger directement depuis l'API
        const userGroups = await GroupsService.getUserGroups(user.id);
        setGroups(userGroups || []);
      } else {
        const allGroups = await GroupsService.getAllGroups();
        setGroups(allGroups || []);
      }
    } catch (error) {
      console.error('Erreur chargement groupes:', error);
      setGroups([]);
    }
  };

  const loadChallenges = async () => {
    try {
      // Charger les défis de tous les groupes de l'utilisateur
      if (user?.id) {
        // Charger directement depuis l'API
        const userGroups = await GroupsService.getUserGroups(user.id);

        const allChallenges: Challenge[] = [];
        for (const group of userGroups) {
          const groupChallenges = await ChallengesService.getActiveChallenges(group.id);
          allChallenges.push(...groupChallenges);
        }
        // Limiter aux 2 plus récents
        setChallenges(allChallenges.slice(0, 2));
      } else {
        setChallenges([]);
      }
    } catch (error) {
      console.error('Erreur chargement défis:', error);
      setChallenges([]);
    }
  };

  // Charger toutes les données en parallèle
  const loadAllData = useCallback(async () => {
    try {
      setIsLoading(true);
      await Promise.all([
        loadGroups(),
        loadChallenges(),
        loadInvitations(),
      ]);
    } catch (error) {
      console.error('Erreur chargement données groupes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Charger au montage
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Recharger quand l'écran revient au focus (après création/join de groupe/suppression)
  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [loadAllData])
  );

  const getGroupInitial = (name: string) => {
    if (!name || typeof name !== 'string') return '?';
    return name.trim().charAt(0).toUpperCase();
  };

  const resetCreateForm = () => {
    setNewGroupName('');
    setNewGroupDescription('');
    setNewGroupLocation('');
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Nom requis', 'Merci de renseigner un nom de groupe.');
      return;
    }

    if (!user?.id) {
      Alert.alert('Erreur', 'Vous devez être connecté pour créer un groupe.');
      return;
    }

    setIsSubmitting(true);

    try {
      const newGroup = await GroupsService.createGroup({
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || null,
        location: newGroupLocation.trim() || null,
        created_by: user.id,
      });

      setGroups((prev) => [newGroup, ...prev]);
      resetCreateForm();
      bottomSheetRef.current?.dismiss();
      Alert.alert('Groupe créé', 'Votre groupe a été créé avec succès.');
    } catch (error) {
      console.error('Erreur création groupe:', error);
      Alert.alert('Erreur', 'Impossible de créer le groupe. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCreateSheet = () => {
    resetCreateForm();
    bottomSheetRef.current?.present();
  };

  const getChallengeTheme = () => {
    // Template unifié pour tous les défis avec couleurs simplifiées
    return {
      cardBackground: '#FFFFFF',
      borderColor: '#E2E8F0',
      iconBg: '#FEF3C7', // Fond or clair pour trophée
      iconColor: '#D97706', // Or pour l'icône trophée
      titleColor: '#1F2937', // Gris foncé doux au lieu de noir
      descriptionColor: '#64748B',
      metaIconColor: '#64748B', // Gris au lieu de bleu
      metaTextColor: '#64748B',
      dividerColor: '#E2E8F0',
      daysLeftBg: '#F8FAFC',
      daysLeftColor: '#475569', // Gris moyen au lieu de noir
      progressTrack: '#F1F5F9',
      progressFill: '#475569', // Gris moyen pour la barre de progression
      progressSummaryColor: '#475569',
      highlightBg: '#F8FAFC',
      speedValueColor: '#1F2937',
      speedLabelColor: '#64748B',
    };
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Groupes</Text>
          </View>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => {
              console.log('Navigating to CreateGroup...');
              try {
                navigation.navigate('CreateGroup');
              } catch (error) {
                console.error('Navigation error:', error);
                Alert.alert('Erreur', 'Impossible d\'ouvrir la page de création. Veuillez réessayer.');
              }
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color="#1F2937" />
            <Text style={styles.createButtonText}>Créer</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <GroupsSkeleton />
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Découvrir */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Découvrir</Text>
            </View>
            <TouchableOpacity style={styles.discoverCard} onPress={() => navigation.navigate('DiscoverGroups')}>
              <View style={styles.discoverIcon}>
                <Ionicons name="search" size={24} color="#1F2937" />
              </View>
              <View style={styles.discoverContent}>
                <Text style={styles.discoverTitle}>Rechercher des groupes</Text>
                <Text style={styles.discoverSubtitle}>
                  Trouvez des groupes par région, véhicule ou intérêt
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>
          </View>

          {/* Défis en cours */}
          {challenges.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Défis en cours</Text>
                <TouchableOpacity onPress={() => navigation.navigate('AllChallenges', { challenges })}>
                  <Text style={styles.seeAllText}>Voir tout</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.challengesScroll}>
                {challenges.map((challenge) => {
                  const theme = getChallengeTheme();

                  // Déterminer si on a des données selon le type de défi
                  let hasData = false;
                  let currentValue = 0;
                  let targetValue = null;
                  let unit = '';
                  let progressRatio = 0;

                  if (challenge.type === 'speed') {
                    hasData = challenge.bestSpeed !== undefined && challenge.bestSpeed !== null && challenge.bestSpeed > 0;
                    currentValue = challenge.bestSpeed || 0;
                    unit = 'km/h';
                  } else if (challenge.type === 'count') {
                    hasData = challenge.progress !== undefined && challenge.progress !== null && challenge.progress > 0;
                    currentValue = challenge.progress || 0;
                    unit = 'trajets';
                  } else if (challenge.type === 'distance') {
                    hasData = challenge.progress !== undefined && challenge.progress !== null && challenge.progress > 0;
                    currentValue = challenge.progress || 0;
                    targetValue = challenge.target;
                    unit = 'km';
                    if (targetValue && targetValue > 0) {
                      progressRatio = Math.min(Math.max(currentValue / targetValue, 0), 1);
                    }
                  }

                  return (
                    <View
                      key={challenge.id}
                      style={[
                        styles.challengeCard,
                        { backgroundColor: theme.cardBackground, borderColor: theme.borderColor },
                      ]}
                    >
                      <View style={styles.cardHeaderTemplate}>
                        <View style={styles.cardHeaderLeft}>
                          <View style={[styles.challengeIcon, { backgroundColor: theme.iconBg }]}>
                            <Ionicons name="trophy" size={20} color={theme.iconColor} />
                          </View>
                          <View style={styles.challengeInfo}>
                            <Text style={[styles.challengeTitle, { color: theme.titleColor }]}>{challenge.title}</Text>
                            <Text
                              style={[styles.challengeDescription, { color: theme.descriptionColor }]}
                              numberOfLines={2}
                            >
                              {challenge.description}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.cardBodyTemplate}>
                        {hasData ? (
                          <View style={styles.progressContainer}>
                            {challenge.type === 'distance' && targetValue ? (
                              <>
                                <View style={[styles.progressBar, { backgroundColor: theme.progressTrack }]}>
                                  <View
                                    style={[
                                      styles.progressFill,
                                      {
                                        width: `${progressRatio * 100}% `,
                                        backgroundColor: theme.progressFill,
                                      },
                                    ]}
                                  />
                                </View>
                                <Text style={[styles.progressSummary, { color: theme.progressSummaryColor }]}>
                                  {currentValue} / {targetValue} {unit} • {Math.round(progressRatio * 100)}%
                                </Text>
                              </>
                            ) : (
                              <Text style={[styles.progressSummary, { color: theme.progressSummaryColor }]}>
                                {(() => {
                                  const leader = challenge.currentLeader || challenge.leader;
                                  const leaderScore = challenge.leaderScore;

                                  if (leader && leaderScore) {
                                    return `${leaderScore} ${unit} par ${leader} `;
                                  }
                                  return `${currentValue} ${unit} `;
                                })()}
                              </Text>
                            )}
                          </View>
                        ) : (
                          <View style={styles.progressContainer}>
                            <Text style={[styles.progressSummary, { color: theme.progressSummaryColor }]}>
                              {(() => {
                                const leader = challenge.currentLeader || challenge.leader;
                                const leaderScore = challenge.leaderScore;

                                // Si on a un leader avec son score, l'afficher
                                if (leader && leaderScore) {
                                  if (challenge.type === 'speed') {
                                    return `${leaderScore} km / h par ${leader} `;
                                  } else if (challenge.type === 'count') {
                                    return `${leaderScore} trajets par ${leader} `;
                                  } else if (challenge.type === 'distance') {
                                    return `${leaderScore} km par ${leader} `;
                                  }
                                }

                                // Fallback : affichage classique
                                if (challenge.type === 'speed') {
                                  if (challenge.bestSpeed && challenge.bestSpeed > 0) {
                                    return `${challenge.bestSpeed} km / h`;
                                  }
                                  return 'Pas encore de participations';
                                }

                                if (challenge.type === 'count') {
                                  if (challenge.progress && challenge.progress > 0) {
                                    return `${challenge.progress} trajets`;
                                  }
                                  return 'Pas encore de participations';
                                }

                                if (challenge.type === 'distance') {
                                  if (challenge.progress && challenge.progress > 0) {
                                    return `${challenge.progress} km`;
                                  }
                                  return 'Pas encore de participations';
                                }

                                return 'Pas encore de participations';
                              })()}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={[styles.cardFooterTemplate, { borderTopColor: theme.dividerColor }]}>
                        <View style={styles.challengeMeta}>
                          <Ionicons name="people" size={14} color={theme.metaIconColor} />
                          <Text style={[styles.challengeMetaText, { color: theme.metaTextColor }]}>
                            {challenge.participants} participants
                          </Text>
                        </View>
                        <Text style={[styles.challengeDaysLeft, { color: theme.metaTextColor }]}>
                          {challenge.daysLeft} jours restants
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Mes groupes - Afficher seulement si l'utilisateur a des groupes */}
          {groups.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Mes groupes</Text>
                <TouchableOpacity onPress={() => navigation.navigate('AllGroups', { groups })}>
                  <Text style={styles.seeAllText}>Voir tout</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.groupShowcaseCarousel}
              >
                {groups.map((group, index) => (
                  <TouchableOpacity
                    key={group.id}
                    style={[
                      styles.groupShowcaseCard,
                      { width: showcaseCardWidth },
                      index === groups.length - 1 && { marginRight: 0 },
                    ]}
                    onPress={() => navigation.navigate('GroupDetail', { group })}
                    activeOpacity={0.8}
                  >
                    <View style={styles.groupVerticalPhoto}>
                      {group.avatar ? (
                        <Image source={{ uri: group.avatar }} style={styles.groupVerticalPhotoImage} />
                      ) : (
                        <View style={styles.groupVerticalPhotoPlaceholder}>
                          <Text style={styles.groupVerticalPhotoInitial}>{getGroupInitial(group.name)}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.groupShowcaseBody}>
                      <Text style={styles.groupShowcaseName} numberOfLines={1}>
                        {group.name}
                      </Text>
                      <Text style={styles.groupShowcaseMembers}>
                        {group.memberCount} membre{group.memberCount > 1 ? 's' : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Invitations */}
          {userInvitations.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Invitations</Text>
              </View>
              {userInvitations.map((invitation) => (
                <View key={invitation.id} style={styles.invitationCard}>
                  <View style={styles.invitationHeader}>
                    {invitation.groupAvatar ? (
                      <Image source={{ uri: invitation.groupAvatar }} style={styles.invitationGroupAvatar} />
                    ) : (
                      <View style={styles.invitationGroupAvatarPlaceholder}>
                        <Ionicons name="people" size={20} color="#94A3B8" />
                      </View>
                    )}
                    <View style={styles.invitationInfo}>
                      <Text style={styles.invitationGroupName}>{invitation.groupName}</Text>
                      <Text style={styles.invitationInvitedBy}>
                        Invité par {invitation.invitedByName}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.invitationActions}>
                    <TouchableOpacity
                      style={[styles.invitationButton, styles.invitationAcceptButton]}
                      onPress={async () => {
                        try {
                          const result = await InvitationsService.acceptInvitation(invitation.id, user?.id);
                          if (result.error) {
                            Alert.alert('Erreur', 'Impossible d\'accepter l\'invitation.');
                            return;
                          }
                          // Recharger les groupes et invitations
                          loadGroups();
                          loadInvitations();
                          Alert.alert('Succès', 'Vous avez rejoint le groupe !');
                        } catch (error) {
                          console.error('Erreur acceptation invitation:', error);
                          Alert.alert('Erreur', 'Impossible d\'accepter l\'invitation.');
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                      <Text style={styles.invitationAcceptText}>Accepter</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.invitationButton, styles.invitationDeclineButton]}
                      onPress={async () => {
                        try {
                          const result = await InvitationsService.declineInvitation(invitation.id);
                          if (result.error) {
                            Alert.alert('Erreur', 'Impossible de refuser l\'invitation.');
                            return;
                          }
                          // Recharger les invitations
                          loadInvitations();
                        } catch (error) {
                          console.error('Erreur refus invitation:', error);
                          Alert.alert('Erreur', 'Impossible de refuser l\'invitation.');
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close-circle" size={18} color="#EF4444" />
                      <Text style={styles.invitationDeclineText}>Refuser</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
          {userInvitations.length === 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Invitations</Text>
              </View>
              <View style={styles.emptyInvitations}>
                <Ionicons name="mail-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyInvitationsText}>Aucune invitation</Text>
                <Text style={styles.emptyInvitationsSubtext}>
                  Vos invitations de groupe apparaîtront ici
                </Text>
              </View>
            </View>
          )}

        </ScrollView>
      )
      }
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetContent}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Créer un groupe</Text>
            <Text style={styles.sheetSubtitle}>Rassemblez vos amis pour partager vos trajets.</Text>
          </View>

          <ScrollView
            style={styles.sheetForm}
            contentContainerStyle={{ paddingBottom: 20, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nom du groupe</Text>
              <TextInput
                value={newGroupName}
                onChangeText={setNewGroupName}
                placeholder="Ex: Road Warriors"
                placeholderTextColor="#94A3B8"
                style={styles.textInput}
                maxLength={40}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                value={newGroupDescription}
                onChangeText={setNewGroupDescription}
                placeholder="Décrivez votre groupe en quelques mots"
                placeholderTextColor="#94A3B8"
                style={[styles.textInput, styles.multilineInput]}
                multiline
                numberOfLines={3}
                maxLength={160}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ville / Région</Text>
              <TextInput
                value={newGroupLocation}
                onChangeText={setNewGroupLocation}
                placeholder="Ex: Paris, Île-de-France"
                placeholderTextColor="#94A3B8"
                style={styles.textInput}
                maxLength={60}
              />
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && { opacity: 0.7 }]}
            disabled={isSubmitting}
            onPress={handleCreateGroup}
          >
            <Text style={styles.submitButtonText}>{isSubmitting ? 'Création...' : 'Créer le groupe'}</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </BottomSheetModal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create<any>({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerAction: {
    padding: 8,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20, color: '#1F2937', // Gris foncé doux
  },
  seeAllText: {
    fontSize: 16, fontWeight: '400',
    color: '#64748B', // Gris pour les liens
  },
  challengesScroll: {
    marginHorizontal: -20,
  },
  challengeCard: {
    minHeight: 188,
    minWidth: 250,
    borderRadius: 18,
    marginRight: 16,
    marginLeft: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'column',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  cardHeaderTemplate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 50,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  challengeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 16, fontWeight: '700',
    color: '#1F2937', // Gris foncé doux
    marginBottom: 4,
  },
  challengeDescription: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  cardBodyTemplate: {
    flexGrow: 1,
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  challengeBody: {
    flex: 1,
    justifyContent: 'center',
  },
  cardFooterTemplate: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  challengeFooter: {},
  progressContainer: {
    gap: 10,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#475569', // Gris moyen (sera surchargé par le thème)
    borderRadius: 4,
  },
  progressSummary: {
    fontSize: 12, fontWeight: '400',
    color: '#64748B', // Harmonisé
    textAlign: 'center',
  },
  speedRecord: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  speedValue: {
    fontSize: 24, color: '#1F2937',
  },
  speedLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#475569',
  },
  challengeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  challengeMetaText: {
    fontSize: 12, fontWeight: '400',
    color: '#64748B', // Harmonisé
  },
  challengeDaysLeft: {
    fontSize: 12, fontWeight: '400',
    color: '#64748B', // Harmonisé
  },
  groupShowcaseCarousel: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    gap: 16,
  },
  groupShowcaseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginRight: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  groupVerticalPhoto: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9', // Gris clair au lieu d'or si pas d'image
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupVerticalPhotoImage: {
    width: '100%',
    height: '100%',
  },
  groupVerticalPhotoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupVerticalPhotoInitial: {
    fontSize: 32, color: '#64748B', // Gris pour les initiales
  },
  groupShowcaseBody: {
    alignItems: 'center',
    gap: 6,
  },
  groupShowcaseName: {
    fontSize: 15, color: '#1F2937', // Gris foncé doux
    textAlign: 'center',
  },
  groupShowcaseMembers: {
    fontSize: 12,
    color: '#64748B', textAlign: 'center',
  },
  groupShowcaseChallengesContainer: {
    marginTop: 8,
    maxHeight: 40,
  },
  groupShowcaseChallengesScroll: {
    gap: 8,
    paddingRight: 4,
  },
  groupShowcaseChallengeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
  },
  groupShowcaseChallengeTitle: {
    fontSize: 11,
    color: '#1F2937', maxWidth: 120,
  },
  groupShowcaseChallengesEmpty: {
    fontSize: 12,
    color: '#94A3B8', textAlign: 'center',
    marginTop: 8,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  groupAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  groupAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  groupAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F4F4F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  groupMemberBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  groupMemberCount: {
    fontSize: 10, color: '#FFFFFF',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18, fontWeight: '700',
    color: '#1F2937', // Gris foncé doux
    marginBottom: 6,
  },
  groupStats: {
    flexDirection: 'row',
    gap: 16,
  },
  groupStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  groupMetaText: {
    fontSize: 12, fontWeight: '400',
    marginTop: 6,
    color: '#94A3B8',
  },
  groupStatText: {
    fontSize: 13,
    color: '#64748B',
  },
  groupMembers: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  membersAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  memberAvatarImage: {
    width: '100%',
    height: '100%',
  },
  memberAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInitial: {
    fontSize: 12, color: '#FFFFFF',
  },
  memberAvatarMore: {
    backgroundColor: '#F4F4F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberMoreText: {
    fontSize: 10, color: '#64748B',
  },
  membersText: {
    flex: 1,
    fontSize: 13,
    color: '#64748B',
  },
  recentActivity: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#F4F4F5',
    borderRadius: 12,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 4,
  },
  activityUser: {
    color: '#1F2937', // Gris foncé doux
  },
  activityDistance: {
    color: '#1F2937', // Gris foncé doux pour la distance
  },
  activityTime: {
    fontSize: 12,
    color: '#94A3B8',
  },
  emptyInvitations: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyInvitationsText: {
    fontSize: 16, fontWeight: '400',
    color: '#64748B',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyInvitationsSubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  invitationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  invitationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  invitationGroupAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  invitationGroupAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  invitationInfo: {
    flex: 1,
  },
  invitationGroupName: {
    fontSize: 16, fontWeight: '400',
    color: '#1F2937',
    marginBottom: 4,
  },
  invitationInvitedBy: {
    fontSize: 12,
    color: '#94A3B8',
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  invitationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  invitationAcceptButton: {
    backgroundColor: '#F0FDF4',
  },
  invitationDeclineButton: {
    backgroundColor: '#FEF2F2',
  },
  invitationAcceptText: {
    fontSize: 16, fontWeight: '400',
    color: '#10B981',
  },
  invitationDeclineText: {
    fontSize: 16, fontWeight: '400',
    color: '#EF4444',
  },
  discoverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC', // Harmonisé avec les autres fonds clairs
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  discoverIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9', // Fond gris clair
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  discoverContent: {
    flex: 1,
  },
  discoverTitle: {
    fontSize: 16, fontWeight: '700',
    color: '#1F2937', // Gris foncé doux
    marginBottom: 4,
  },
  discoverSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHeader: {
    marginBottom: 12,
    gap: 6,
  },
  sheetTitle: {
    fontSize: 20, color: '#1F2937', // Gris foncé doux
  },
  sheetSubtitle: {
    fontSize: 14,
    color: '#475569',
  },
  sheetForm: {
    flex: 1,
    marginBottom: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 13, color: '#1F2937', // Gris foncé doux
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1F2937', // Gris foncé doux
    backgroundColor: '#FFFFFF',
  },
  multilineInput: {
    height: 96,
    textAlignVertical: 'top',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F2937', // Gris foncé
    paddingVertical: 14,
    borderRadius: 14,
    gap: 10,
    marginBottom: 16,
  },
  submitButtonText: {
    fontSize: 15, color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#64748B',
  },
});
