import React, { useMemo, useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import GroupsService from '../../services/GroupsService';
const filterOptions = [
  {
    id: 'type',
    label: 'Type',
    choices: [
      { id: 'all', label: 'Tous' },
      { id: 'nocturne', label: 'Nocturne' },
      { id: 'electric', label: 'Électrique' },
      { id: 'family', label: 'Famille' },
      { id: 'city', label: 'Ville' },
    ],
  },
  {
    id: 'members',
    label: 'Taille',
    choices: [
      { id: 'members-all', label: 'Toutes tailles' },
      { id: 'members-small', label: '< 50' },
      { id: 'members-medium', label: '50 - 150' },
      { id: 'members-large', label: '> 150' },
    ],
  },
  {
    id: 'challenge',
    label: 'Défis',
    choices: [
      { id: 'challenge-all', label: 'Aucun filtre' },
      { id: 'challenge-active', label: 'Défis en cours' },
      { id: 'challenge-none', label: 'Pas de défi' },
    ],
  },
];

export default function DiscoverGroupsScreen({ navigation }) {
  const { user } = useAuth();
  const [suggestedGroups, setSuggestedGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState(filterOptions[0].id);
  const [selectedFilters, setSelectedFilters] = useState({
    type: 'all',
    members: 'members-all',
    challenge: 'challenge-all',
  });

  // Charger les groupes suggérés au montage
  useEffect(() => {
    loadSuggestedGroups();
  }, [user]);

  const loadSuggestedGroups = async () => {
    try {
      setIsLoading(true);
      if (user?.id) {
        const filters = {
          location: selectedFilters.type !== 'all' ? selectedFilters.type : null,
        };
        const groups = await GroupsService.getSuggestedGroups(user.id, filters);
        setSuggestedGroups(groups || []);
      } else {
        const allGroups = await GroupsService.getAllGroups();
        setSuggestedGroups(allGroups || []);
      }
    } catch (error) {
      console.error('Erreur chargement groupes suggérés:', error);
      setSuggestedGroups([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredGroups = useMemo(() => {
    return suggestedGroups.filter((group) => {
      const matchesSearch =
        !search ||
        group.name?.toLowerCase().includes(search.toLowerCase()) ||
        group.description?.toLowerCase().includes(search.toLowerCase()) ||
        group.location?.toLowerCase().includes(search.toLowerCase());

      const membersFilter = selectedFilters.members;
      const membersCount = group.memberCount || 0;
      const matchesMembers =
        membersFilter === 'members-all' ||
        (membersFilter === 'members-small' && membersCount < 50) ||
        (membersFilter === 'members-medium' && membersCount >= 50 && membersCount <= 150) ||
        (membersFilter === 'members-large' && membersCount > 150);

      const challengeFilter = selectedFilters.challenge;
      const hasChallenges = (group.challenges || []).length > 0;
      const matchesChallenge =
        challengeFilter === 'challenge-all' ||
        (challengeFilter === 'challenge-active' && hasChallenges) ||
        (challengeFilter === 'challenge-none' && !hasChallenges);

      return matchesSearch && matchesMembers && matchesChallenge;
    });
  }, [search, selectedFilters, suggestedGroups]);

  const currentFilterChoices = filterOptions.find((opt) => opt.id === activeFilter)?.choices ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Découvrir des groupes</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#64748B" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher par nom, ville, thème…"
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabs}>
          {filterOptions.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[styles.filterTab, activeFilter === filter.id && styles.filterTabActive]}
              onPress={() => setActiveFilter(filter.id)}
            >
              <Text
                style={[styles.filterTabLabel, activeFilter === filter.id && styles.filterTabLabelActive]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChoices}
        >
          {currentFilterChoices.map((choice) => {
            const isSelected = selectedFilters[activeFilter] === choice.id;
            return (
              <TouchableOpacity
                key={choice.id}
                style={[styles.filterChoiceChip, isSelected && styles.filterChoiceChipActive]}
                onPress={() =>
                  setSelectedFilters((prev) => ({
                    ...prev,
                    [activeFilter]: choice.id,
                  }))
                }
              >
                <Text
                  style={[
                    styles.filterChoiceLabel,
                    isSelected && styles.filterChoiceLabelActive,
                  ]}
                >
                  {choice.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1F2937" />
          <Text style={styles.loadingText}>Chargement des groupes...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.resultsContainer, !filteredGroups.length && styles.emptyContainer]}
        >
          {filteredGroups.length ? (
            filteredGroups.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={styles.resultCard}
                activeOpacity={0.8}
                onPress={() =>
                  navigation.navigate('GroupDetail', {
                    group: {
                      id: group.id,
                      name: group.name,
                      memberCount: group.memberCount || 0,
                      avatar: group.avatar || null,
                      totalDistance: group.totalDistance || 0,
                      totalRides: group.totalRides || 0,
                      members: group.members || [],
                      recentActivity: group.recentActivity || null,
                      description: group.description,
                      location: group.location,
                      challenges: group.challenges || [],
                      posts: group.posts || [],
                    },
                  })
                }
              >
                {group.avatar && (
                  <Image source={{ uri: group.avatar }} style={styles.groupImage} />
                )}
                <View style={styles.cardHeader}>
                  <Text style={styles.groupName}>{group.name}</Text>
                  <Text style={styles.groupMembers}>{Math.max(1, group.memberCount || 0)} {Math.max(1, group.memberCount || 0) === 1 ? 'membre' : 'membres'}</Text>
                </View>
                {group.description && (
                  <Text style={styles.groupDescription}>{group.description}</Text>
                )}
                <View style={styles.cardFooter}>
                  {group.location && (
                    <View style={styles.location}>
                      <Ionicons name="location" size={14} color="#1F2937" />
                      <Text style={styles.locationText}>{group.location}</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.joinButton,
                      group.requestStatus === 'pending' && styles.pendingButton
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      if (group.requestStatus === 'pending') {
                        handleCancelRequest(group.id);
                      } else {
                        handleJoinGroup(group.id, group.isPrivate || group.is_private);
                      }
                    }}
                  >
                    <Ionicons
                      name={
                        group.requestStatus === 'pending' ? "close-circle" :
                          (group.isPrivate || group.is_private ? "lock-closed" : "add-circle")
                      }
                      size={18}
                      color={group.requestStatus === 'pending' ? "#EF4444" : "#FFFFFF"}
                    />
                    <Text style={[
                      styles.joinButtonText,
                      group.requestStatus === 'pending' && styles.pendingButtonText
                    ]}>
                      {group.requestStatus === 'pending' ? 'Annuler' :
                        (group.isPrivate || group.is_private ? 'Demander' : 'Rejoindre')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={38} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>Aucun groupe ne correspond</Text>
              <Text style={styles.emptySubtitle}>
                Essayez un autre mot-clé ou explorez une autre catégorie.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );

  async function handleCancelRequest(groupId) {
    try {
      Alert.alert(
        'Annuler la demande',
        'Voulez-vous vraiment annuler votre demande d\'adhésion ?',
        [
          { text: 'Non', style: 'cancel' },
          {
            text: 'Oui, annuler',
            style: 'destructive',
            onPress: async () => {
              // Optimistic update
              setSuggestedGroups(prev => prev.map(g =>
                g.id === groupId ? { ...g, requestStatus: null } : g
              ));

              const result = await GroupsService.cancelJoinRequest(groupId, user.id);
              if (result.success) {
                // Succès silencieux, l'UI est déjà à jour
              } else {
                // Revert en cas d'erreur
                setSuggestedGroups(prev => prev.map(g =>
                  g.id === groupId ? { ...g, requestStatus: 'pending' } : g
                ));
                Alert.alert('Erreur', 'Impossible d\'annuler la demande');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Erreur annulation:', error);
      loadSuggestedGroups();
    }
  }

  async function handleJoinGroup(groupId, isPrivate) {
    try {
      if (!user?.id) {
        Alert.alert('Erreur', 'Vous devez être connecté pour rejoindre un groupe');
        return;
      }

      if (isPrivate) {
        // Groupe privé : créer une demande
        // Optimistic update : Mettre à jour l'UI immédiatement
        setSuggestedGroups(prev => prev.map(g =>
          g.id === groupId ? { ...g, requestStatus: 'pending' } : g
        ));

        const result = await GroupsService.requestToJoin(groupId, user.id);
        if (result.error) {
          // Revert en cas d'erreur
          setSuggestedGroups(prev => prev.map(g =>
            g.id === groupId ? { ...g, requestStatus: null } : g
          ));
          Alert.alert('Erreur', 'Impossible d\'envoyer la demande');
        } else {
          // Succès silencieux ou toast, pas d'alerte bloquante
          // Le bouton est déjà passé à "Annuler" grâce à l'optimistic update
        }
      } else {
        // Groupe public : rejoindre directement
        const result = await GroupsService.joinGroup(groupId, user.id);
        if (result.success) {
          Alert.alert('Succès', 'Vous avez rejoint le groupe !', [
            {
              text: 'OK',
              onPress: () => {
                loadSuggestedGroups();
              }
            }
          ]);
        } else {
          Alert.alert('Erreur', 'Impossible de rejoindre le groupe');
        }
      }
    } catch (error) {
      console.error('Erreur lors de la demande:', error);
      Alert.alert('Erreur', 'Une erreur s\'est produite');
      // Revert en cas d'erreur
      loadSuggestedGroups();
    }
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20, color: '#1F2937',
  },
  headerSpacer: {
    width: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  filtersContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  filterTabs: {
    gap: 10,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F4F4F5',
  },
  filterTabActive: {
    backgroundColor: '#1F2937',
  },
  filterTabLabel: {
    fontSize: 13, color: '#475569',
  },
  filterTabLabelActive: {
    color: '#FFFFFF',
  },
  filterChoices: {
    gap: 8,
  },
  filterChoiceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  filterChoiceChipActive: {
    borderColor: '#1F2937',
    backgroundColor: '#F1F5F9',
  },
  filterChoiceLabel: {
    fontSize: 13, color: '#475569',
  },
  filterChoiceLabelActive: {
    color: '#1F2937',
  },
  resultsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 14,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
    overflow: 'hidden',
  },
  groupImage: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: '#F1F5F9',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupName: {
    fontSize: 17, color: '#1F2937',
  },
  groupMembers: {
    fontSize: 13, color: '#1F2937',
  },
  groupDescription: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 13,
    color: '#1F2937',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  joinButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pendingButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  pendingButtonText: {
    color: '#EF4444',
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tagPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11, color: '#475569',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
    maxWidth: 260,
  },
  emptyTitle: {
    fontSize: 18, fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
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

