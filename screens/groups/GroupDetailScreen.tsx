import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Dimensions,
  Animated,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import GroupsService from '../../services/GroupsService';
import PostsService from '../../services/PostsService';
import LaunchChallengeSheet from '../../components/LaunchChallengeSheet';
import GroupSettingsSheet from '../../components/GroupSettingsSheet';
import InviteMembersSheet from '../../components/InviteMembersSheet';
import ManageMembersSheet from '../../components/ManageMembersSheet';
import CreatePostSheet from '../../components/CreatePostSheet';
import CommentsSheet from '../../components/CommentsSheet';

interface GroupMember {
  id: string;
  name: string;
  avatar?: string | null;
  role?: string;
  joinedAt?: string;
}

interface PostLike {
  userId: string;
}

interface Post {
  id: string;
  author?: string;
  avatar?: string;
  createdAt?: string;
  title?: string;
  content: string;
  likesCount?: number;
  commentsCount?: number;
  likes?: PostLike[];
}

interface JoinRequest {
  id: string;
  userId: string;
  groupId: string;
  status: string;
  createdAt?: string;
  user?: {
    id: string;
    name: string;
    avatar?: string | null;
  };
}
const APP_BLUE = '#1F2937'; // Gris foncé au lieu de bleu
const APP_BLUE_LIGHT = '#F1F5F9'; // Gris clair au lieu de bleu clair

const formatDistance = (km = 0) => {
  if (km >= 1000) {
    return `${(km / 1000).toFixed(1)}k km`;
  }
  return `${km.toFixed(0)} km`;
};

const formatTimeAgo = (dateString?: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
      const now = new Date();
      const diffInMinutes = Math.floor(((now as any) - (date as any)) / (1000 * 60));

  if (diffInMinutes < 1) return 'À l’instant';
  if (diffInMinutes < 60) return `Il y a ${diffInMinutes} min`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Il y a ${diffInHours} h`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `Il y a ${diffInDays} j`;

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

export default function GroupDetailScreen({ route, navigation }: any) {
  console.log('🎬 [GroupDetailScreen] COMPOSANT MONTÉ');
  const { group: initialGroup, groupId } = route.params || {};
  console.log('📥 [GroupDetailScreen] Route params:', {
    initialGroup: initialGroup?.id || groupId,
    hasMembers: !!initialGroup?.members,
    memberCount: initialGroup?.memberCount,
    membersLength: initialGroup?.members?.length || 0
  });
  const { user } = useAuth();
  console.log('👤 [GroupDetailScreen] User:', user?.id);
  const [group, setGroup] = useState<any>(initialGroup || null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(!initialGroup);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(() => new Set<string>());
  const screenWidth = Dimensions.get('window').width;
  const [activeTab, setActiveTab] = useState('overview');
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [newPost, setNewPost] = useState('');
  const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);
  const [memberActionsVisible, setMemberActionsVisible] = useState(false);
  const pagerRef = useRef<ScrollView | null>(null);
  const launchChallengeSheetRef = useRef<BottomSheetModal>(null!);
  const groupSettingsSheetRef = useRef<BottomSheetModal>(null!);
  const inviteMembersSheetRef = useRef<BottomSheetModal>(null!);
  const manageMembersSheetRef = useRef<BottomSheetModal>(null!);
  const createPostSheetRef = useRef<BottomSheetModal>(null!);
  const commentsSheetRef = useRef<BottomSheetModal>(null!);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // Charger les données du groupe au montage
  useEffect(() => {
    const groupId = initialGroup?.id || route.params?.groupId;
    console.log('🔵 [GroupDetailScreen] useEffect déclenché:', {
      id: groupId,
      hasMembers: !!initialGroup?.members,
      memberCount: initialGroup?.memberCount,
      membersLength: initialGroup?.members?.length || 0,
      hasChallenges: !!initialGroup?.challenges,
      challengesCount: initialGroup?.challenges?.length || 0
    });

    if (groupId) {
      // Toujours recharger si memberCount est 0 ou si members est vide
      // OU si les défis ne sont pas chargés
      const shouldReload = !initialGroup?.members ||
        initialGroup.members.length === 0 ||
        initialGroup.memberCount === 0 ||
        initialGroup.memberCount === undefined ||
        !initialGroup?.challenges ||
        !Array.isArray(initialGroup.challenges);

      if (shouldReload) {
        console.log('🔄 [GroupDetailScreen] Chargement des données du groupe (members ou défis manquants)...');
        loadGroupData();
      } else {
        console.log('✅ [GroupDetailScreen] Groupe a déjà les membres et défis, chargement des posts...');
        // Charger les posts même si les membres sont déjà présents
        const groupId = initialGroup?.id || route.params?.groupId;
        if (groupId) {
          console.log('📝 [GroupDetailScreen] Chargement des posts pour groupe:', groupId);
          GroupsService.getGroupPosts(groupId).then((groupPosts) => {
            console.log('✅ [GroupDetailScreen] Posts chargés:', groupPosts?.length || 0);
            setPosts(groupPosts || []);
            // Initialiser les likes
            const liked = new Set<string>();
            (groupPosts || []).forEach(post => {
              if (post.likes?.some(like => like.userId === user?.id)) {
                liked.add(post.id);
              }
            });
            setLikedPosts(liked);
          }).catch((error) => {
            console.error('❌ [GroupDetailScreen] Erreur chargement posts:', error);
          });
        }
        // Même si les membres sont présents, charger les défis s'ils ne le sont pas
        if (!initialGroup.challenges || initialGroup.challenges.length === 0) {
          console.log('🔄 [GroupDetailScreen] Chargement des défis uniquement...');
          loadChallengesOnly(groupId);
        } else {
          setLoading(false);
        }
      }
    } else {
      console.warn('⚠️ [GroupDetailScreen] Pas d\'ID de groupe');
      setLoading(false);
    }
  }, [initialGroup?.id, route.params?.groupId]);

  const loadChallengesOnly = async (groupId) => {
    try {
      console.log('🔵 [GroupDetailScreen] Chargement des défis uniquement pour le groupe:', groupId);
      const challenges = await GroupsService.getGroupChallenges(groupId);
      console.log('✅ [GroupDetailScreen] Défis chargés:', challenges.length);
      setGroup(prev => ({
        ...prev,
        challenges: Array.isArray(challenges) ? challenges : []
      }));
    } catch (error) {
      console.error('❌ [GroupDetailScreen] Erreur chargement défis:', error);
      setGroup(prev => ({
        ...prev,
        challenges: []
      }));
    } finally {
      setLoading(false);
    }
  };

  const loadGroupData = async () => {
    try {
      setLoading(true);
      const groupId = initialGroup?.id || route.params?.groupId;
      console.log('🔵 [GroupDetailScreen] Chargement groupe:', groupId);
      const fullGroup = await GroupsService.getGroupById(groupId);
      console.log('📊 [GroupDetailScreen] Groupe chargé:', {
        id: fullGroup?.id,
        name: fullGroup?.name,
        createdBy: fullGroup?.createdBy,
        membersCount: fullGroup?.members?.length || 0,
        members: fullGroup?.members?.map(m => ({ id: m.id, name: m.name })) || [],
        challengesCount: fullGroup?.challenges?.length || 0,
        challenges: fullGroup?.challenges?.map(c => ({ id: c.id, title: c.title })) || []
      });

      if (fullGroup) {
        // Vérification finale : s'assurer que le créateur est toujours dans la liste
        if (fullGroup.createdBy) {
          const creatorIsMember = fullGroup.members?.some(m => m.id === fullGroup.createdBy);
          console.log('🔍 [GroupDetailScreen] Créateur dans membres?', creatorIsMember, 'créateur ID:', fullGroup.createdBy, 'user ID:', user?.id);
          if (!creatorIsMember) {
            console.warn('⚠️ [GroupDetailScreen] Créateur manquant dans les membres, ajout manuel final...');
            // Initialiser members si vide
            if (!fullGroup.members) {
              fullGroup.members = [];
            }
            // Ajouter le créateur en premier
            fullGroup.members.unshift({
              id: fullGroup.createdBy,
              name: user?.id === fullGroup.createdBy ? 'Vous' : 'Créateur',
              avatar: null,
              role: 'owner',
              joinedAt: fullGroup.createdAt || new Date().toISOString(),
            });
            fullGroup.memberCount = fullGroup.members.length;
            console.log('✅ [GroupDetailScreen] Créateur ajouté manuellement, nouveau count:', fullGroup.memberCount);
          }
        } else if (!fullGroup.members || fullGroup.members.length === 0) {
          // Si pas de créateur défini et pas de membres, initialiser une liste vide
          console.warn('⚠️ [GroupDetailScreen] Pas de créateur et pas de membres');
          fullGroup.members = [];
          fullGroup.memberCount = 0;
        }

        console.log('✅ [GroupDetailScreen] Groupe final avant setGroup:', {
          memberCount: fullGroup.memberCount,
          members: fullGroup.members?.map(m => ({ id: m.id, name: m.name, role: m.role })) || [],
          challengesCount: fullGroup.challenges?.length || 0
        });
        // S'assurer que challenges est toujours un tableau
        if (!fullGroup.challenges || !Array.isArray(fullGroup.challenges)) {
          console.log('⚠️ [GroupDetailScreen] Challenges invalides, initialisation à []');
          fullGroup.challenges = [];
        }
        console.log('✅ [GroupDetailScreen] Groupe final avec défis:', {
          challengesCount: fullGroup.challenges.length,
          challenges: fullGroup.challenges.map(c => ({ id: c.id, title: c.title }))
        });
        setGroup(fullGroup);
        setLoading(false);

        // Charger les demandes d'adhésion si groupe privé et utilisateur est admin/owner
        if (fullGroup.isPrivate && canManage(fullGroup)) {
          const requests = await GroupsService.getJoinRequests(fullGroup.id);
          setJoinRequests(requests || []);
        }
        // Charger les posts avec interactions
        const groupId = fullGroup?.id || initialGroup?.id || route.params?.groupId;
        let groupPosts = [];
        if (groupId) {
          console.log('📝 [GroupDetailScreen] Chargement des posts pour groupe:', groupId);
          groupPosts = await GroupsService.getGroupPosts(groupId);
          console.log('✅ [GroupDetailScreen] Posts chargés:', groupPosts?.length || 0);
          setPosts(groupPosts || []);
        } else {
          console.warn('⚠️ [GroupDetailScreen] Pas d\'ID de groupe pour charger les posts');
          setPosts([]);
        }
        // Initialiser les likes
        const liked = new Set<string>();
        (groupPosts || []).forEach(post => {
          if (post.likes?.some(like => like.userId === user?.id)) {
            liked.add(post.id);
          }
        });
        setLikedPosts(liked);
      }
    } catch (error) {
      console.error('Erreur chargement groupe:', error);
    } finally {
      setLoading(false);
    }
  };

  // Recharger uniquement les stats du groupe à chaque fois que l'écran revient au focus
  // (beaucoup plus rapide que de recharger tout le groupe)
  useFocusEffect(
    useCallback(() => {
      const groupId = initialGroup?.id || route.params?.groupId;
      if (groupId) {
        console.log('🔄 [GroupDetailScreen] Screen focus - Rechargement complet du groupe');
        // Recharger tout le groupe pour avoir les défis mis à jour
        loadGroupData();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialGroup?.id, route.params?.groupId])
  );

  const openPostSheet = useCallback(() => {
    createPostSheetRef.current?.present();
  }, []);

  const onTabPress = (tab, index) => {
    if (activeTab === tab) return;
    setActiveTab(tab);
    pagerRef.current?.scrollTo({
      x: index * screenWidth,
      animated: true,
    });
  };

  const indicatorTranslate = scrollX.interpolate({
    inputRange: [0, screenWidth],
    outputRange: [0, screenWidth / 2],
    extrapolate: 'clamp',
  });
  const indicatorStyle = {
    transform: [{ translateX: indicatorTranslate }],
  };

  // Composant Skeleton pour les éléments de chargement
  const SkeletonBox = ({ width, height, style }: { width?: number | string; height?: number | string; style?: any }) => (
    <View style={[styles.skeleton, { width, height }, style]} />
  );

  const SkeletonText = ({ width = '100%', height = 16, style }: { width?: number | string; height?: number | string; style?: any }) => (
    <SkeletonBox width={width} height={height} style={[styles.skeletonText, style]} />
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.headerAvatarWrapper}>
            <SkeletonBox width={40} height={40} style={{ borderRadius: 20 }} />
          </View>
          <View style={styles.headerInfo}>
            <SkeletonText width={120} height={20} style={{ marginBottom: 4 }} />
            <SkeletonText width={80} height={14} />
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.tabBar}>
          <View style={[styles.tabButton, { opacity: 0.5 }]}>
            <SkeletonText width={60} height={16} />
          </View>
          <View style={[styles.tabButton, { opacity: 0.5 }]}>
            <SkeletonText width={60} height={16} />
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
          <View style={styles.heroSection}>
            <View style={styles.heroInfoRow}>
              <SkeletonText width={80} height={16} style={{ marginRight: 16 }} />
              <SkeletonText width={80} height={16} style={{ marginRight: 16 }} />
              <SkeletonText width={80} height={16} />
            </View>
          </View>

          <View style={styles.section}>
            <SkeletonText width={100} height={18} style={{ marginBottom: 12 }} />
            <SkeletonText width="100%" height={14} style={{ marginBottom: 8 }} />
            <SkeletonText width="90%" height={14} style={{ marginBottom: 8 }} />
            <SkeletonText width="95%" height={14} />
          </View>

          <View style={styles.section}>
            <SkeletonText width={120} height={18} style={{ marginBottom: 12 }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {[1, 2].map((i) => (
                  <View key={i} style={[styles.challengeCard, { width: 280 }]}>
                    <SkeletonText width={200} height={18} style={{ marginBottom: 8 }} />
                    <SkeletonText width="100%" height={14} style={{ marginBottom: 12 }} />
                    <SkeletonBox width="100%" height={8} style={{ borderRadius: 4, marginBottom: 8 }} />
                    <SkeletonText width={100} height={12} />
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Helper functions
  const canManage = (grp) => {
    if (!grp || !user?.id) return false;
    const member = grp.members?.find(m => m.id === user.id);
    return member?.role === 'owner' || member?.role === 'admin' || grp.createdBy === user.id;
  };

  const isOwner = (grp) => {
    if (!grp || !user?.id) return false;
    return grp.createdBy === user.id;
  };

  // Action handlers
  const handleApproveRequest = async (requestId) => {
    try {
      const result = await GroupsService.approveJoinRequest(requestId, user.id);
      if (result.success) {
        Alert.alert('Approuvé', 'Le membre a été ajouté au groupe');
        // Recharger les demandes et les membres
        const requests = await GroupsService.getJoinRequests(group.id);
        setJoinRequests(requests || []);
        loadGroupData();
      } else {
        Alert.alert('Erreur', 'Impossible d\'approuver la demande');
      }
    } catch (error) {
      console.error('Erreur approbation:', error);
      Alert.alert('Erreur', 'Une erreur s\'est produite');
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      const result = await GroupsService.rejectJoinRequest(requestId, user.id);
      if (result.success) {
        const requests = await GroupsService.getJoinRequests(group.id);
        setJoinRequests(requests || []);
      }
    } catch (error) {
      console.error('Erreur rejet:', error);
    }
  };

  const handleToggleAdmin = async () => {
    if (!selectedMember) return;
    try {
      const isAdmin = selectedMember.role === 'admin';
      const result = isAdmin
        ? await GroupsService.demoteFromAdmin(group.id, selectedMember.id, user.id)
        : await GroupsService.promoteToAdmin(group.id, selectedMember.id, user.id);

      if (result.success) {
        Alert.alert('Succès', isAdmin ? 'Membre rétrogradé' : 'Membre promu admin');
        setMemberActionsVisible(false);
        loadGroupData();
      } else {
        Alert.alert('Erreur', result.error?.message || 'Action impossible');
      }
    } catch (error) {
      console.error('Erreur toggle admin:', error);
      Alert.alert('Erreur', 'Une erreur s\'est produite');
    }
  };

  const handleKickMember = async () => {
    if (!selectedMember) return;
    Alert.alert(
      'Expulser ce membre',
      `Êtes-vous sûr de vouloir expulser ${selectedMember.name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Expulser',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await GroupsService.removeMember(group.id, selectedMember.id, user.id);
              if (result.success) {
                Alert.alert('Succès', 'Membre expulsé');
                setMemberActionsVisible(false);
                loadGroupData();
              } else {
                Alert.alert('Erreur', result.error?.message || 'Expulsion impossible');
              }
            } catch (error) {
              console.error('Erreur expulsion:', error);
              Alert.alert('Erreur', 'Une erreur s\'est produite');
            }
          }
        }
      ]
    );
  };



  const handleTransferOwnership = async () => {
    if (!selectedMember) return;
    Alert.alert(
      'Transférer la propriété',
      `Voulez-vous transférer la propriété du groupe à ${selectedMember.name} ? Vous deviendrez administrateur.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Transférer',
          style: 'default',
          onPress: async () => {
            try {
              const result = await GroupsService.transferOwnership(group.id, selectedMember.id, user.id);
              if (result.success) {
                Alert.alert('Succès', 'Propriété transférée');
                setMemberActionsVisible(false);
                loadGroupData();
              } else {
                Alert.alert('Erreur', result.error?.message || 'Transfert impossible');
              }
            } catch (error) {
              console.error('Erreur transfert propriété:', error);
              Alert.alert('Erreur', 'Une erreur s\'est produite');
            }
          }
        }
      ]
    );
  };

  if (!group) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Groupe</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={40} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>Impossible d'afficher ce groupe</Text>
          <Text style={styles.emptySubtitle}>Veuillez revenir en arrière et réessayer.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <BottomSheetModalProvider>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={22} color="#0F172A" />
            </TouchableOpacity>
            <View style={styles.headerAvatarWrapper}>
              {group.avatar ? (
                <Image source={{ uri: group.avatar }} style={styles.headerAvatar} />
              ) : (
                <View style={styles.headerAvatarPlaceholder}>
                  <Ionicons name="people" size={20} color="#475569" />
                </View>
              )}
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>{group.name}</Text>
              <Text style={styles.headerSubtitle}>
                {group.location || `${group.memberCount} membres`}
              </Text>
            </View>
            {(group.createdBy === user?.id || group.members?.some(m => m.id === user?.id && m.role === 'owner')) ? (
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => groupSettingsSheetRef.current?.present()}
                activeOpacity={0.7}
              >
                <Ionicons name="settings-outline" size={20} color="#475569" />
              </TouchableOpacity>
            ) : (
              <View style={styles.headerSpacer} />
            )}
          </View>

          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'infos' && styles.tabButtonActive]}
              onPress={() => onTabPress('infos', 0)}
            >
              <Text style={[styles.tabLabel, activeTab === 'infos' && styles.tabLabelActive]}>Infos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'posts' && styles.tabButtonActive]}
              onPress={() => onTabPress('posts', 1)}
            >
              <Text style={[styles.tabLabel, activeTab === 'posts' && styles.tabLabelActive]}>Posts</Text>
            </TouchableOpacity>
            <Animated.View style={[styles.tabIndicator, indicatorStyle, { width: screenWidth / 2 }]} />
          </View>

          <Animated.ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: true }
            )}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
              setActiveTab(index === 0 ? 'infos' : 'posts');
            }}
            scrollEventThrottle={16}
          >
            <ScrollView
              style={{ width: screenWidth }}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              <View style={styles.heroSection}>
                <View style={styles.heroInfoRow}>
                  <View style={styles.heroInfoItem}>
                    <Ionicons name="people" size={16} color="#475569" />
                    <Text style={styles.heroInfoText}>{group.memberCount} membres</Text>
                  </View>
                  <View style={styles.heroInfoItem}>
                    <Ionicons name="trail-sign" size={16} color="#475569" />
                    <Text style={styles.heroInfoText}>{formatDistance(group.totalDistance || 0)}</Text>
                  </View>
                  <View style={styles.heroInfoItem}>
                    <Ionicons name="timer" size={16} color="#475569" />
                    <Text style={styles.heroInfoText}>{group.totalRides || 0} trajets</Text>
                  </View>
                  {group.isPrivate && (
                    <View style={styles.privacyBadgeContainer}>
                      <Ionicons name="lock-closed" size={14} color="#EF4444" />
                      <Text style={styles.privacyBadgeText}>Privé</Text>
                    </View>
                  )}
                </View>
              </View>

              {group.description ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>À propos</Text>
                  <Text style={styles.sectionText}>{group.description}</Text>
                </View>
              ) : null}

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Défis du groupe</Text>
                  <View style={styles.sectionHeaderActions}>
                    {/* Bouton pour lancer un défi (visible uniquement pour les admins/owners) */}
                    {(group.createdBy === user?.id || group.members?.some(m => m.id === user?.id && m.role === 'owner')) && (
                      <TouchableOpacity
                        onPress={() => launchChallengeSheetRef.current?.present()}
                        activeOpacity={0.7}
                        style={styles.addButton}
                      >
                        <Ionicons name="add" size={24} color="#1F2937" />
                      </TouchableOpacity>
                    )}
                    {group.challenges && group.challenges.length > 0 && (
                      <TouchableOpacity
                        onPress={() => navigation.navigate('AllChallenges', { challenges: group.challenges })}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.sectionLink}>Voir tout</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                {group.challenges && Array.isArray(group.challenges) && group.challenges.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.challengeCarousel}
                  >
                    {group.challenges.map((challenge) => {
                      // Déterminer les données selon le type de défi
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

                      const leader = challenge.leader || challenge.currentLeader;
                      const leaderScore = challenge.leaderScore;

                      return (
                        <View key={challenge.id} style={styles.challengeCompactCard}>
                          <View style={styles.challengeCompactHeader}>
                            <View style={styles.challengeCompactIconContainer}>
                              <Ionicons name="trophy" size={20} color="#D97706" />
                            </View>
                            <View style={styles.challengeCompactHeaderText}>
                              <Text style={styles.challengeCompactTitle} numberOfLines={1}>
                                {challenge.title}
                              </Text>
                            </View>
                          </View>

                          {challenge.description && (
                            <Text style={styles.challengeCompactSubtitle} numberOfLines={2}>
                              {challenge.description}
                            </Text>
                          )}

                          <View style={styles.challengeCompactBody}>
                            {leader && leaderScore ? (
                              challenge.type === 'distance' && targetValue ? (
                                <>
                                  <View style={styles.challengeCompactProgressBar}>
                                    <View style={[styles.challengeCompactProgressFill, { width: `${progressRatio * 100}%` }]} />
                                  </View>
                                  <Text style={styles.challengeCompactValue}>
                                    {leaderScore} {unit} par {leader}
                                  </Text>
                                </>
                              ) : (
                                <Text style={styles.challengeCompactValue}>
                                  {leaderScore} {unit} par {leader}
                                </Text>
                              )
                            ) : hasData ? (
                              challenge.type === 'distance' && targetValue ? (
                                <>
                                  <View style={styles.challengeCompactProgressBar}>
                                    <View style={[styles.challengeCompactProgressFill, { width: `${progressRatio * 100}%` }]} />
                                  </View>
                                  <Text style={styles.challengeCompactValue}>
                                    {currentValue} / {targetValue} {unit} • {Math.round(progressRatio * 100)}%
                                  </Text>
                                </>
                              ) : (
                                <Text style={styles.challengeCompactValue}>
                                  {currentValue} {unit}
                                </Text>
                              )
                            ) : (
                              <Text style={styles.challengeCompactValueEmpty}>
                                Pas encore de participations
                              </Text>
                            )}
                          </View>

                          {challenge.participants > 0 && (
                            <View style={styles.challengeCompactFooter}>
                              <Ionicons name="people" size={12} color="#94A3B8" />
                              <Text style={styles.challengeCompactParticipants}>
                                {challenge.participants} participant{challenge.participants > 1 ? 's' : ''}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <View style={styles.emptyChallengesContainer}>
                    <Ionicons name="trophy-outline" size={32} color="#CBD5E1" />
                    <Text style={styles.emptyChallengesText}>Aucun défi actif</Text>
                    {(group.createdBy === user?.id || group.members?.some(m => m.id === user?.id && m.role === 'owner')) && (
                      <Text style={styles.emptyChallengesSubtext}>
                        Lancez un défi pour motiver les membres !
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {group.recentActivity ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Activité récente</Text>
                  <View style={styles.activityCard}>
                    <View style={styles.activityIcon}>
                      <Ionicons name="flash" size={18} color="#1F2937" />
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityText}>
                        <Text style={styles.activityUser}>{group.recentActivity.user}</Text>
                        {' a roulé '}
                        <Text style={styles.activityHighlight}>{group.recentActivity.distance} km</Text>
                        {' en '}
                        <Text style={styles.activityHighlight}>{group.recentActivity.time}</Text>
                      </Text>
                      <Text style={styles.activityTime}>{group.recentActivity.ago}</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {group.members?.length ? (
                <View style={styles.section}>
                  <View style={styles.membersHeader}>
                    <Text style={styles.sectionTitle}>Membres</Text>
                    {(group.createdBy === user?.id || group.members?.some(m => m.id === user?.id && m.role === 'owner')) && (
                      <View style={styles.membersActions}>
                        <TouchableOpacity
                          style={styles.memberActionButton}
                          onPress={() => inviteMembersSheetRef.current?.present()}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="person-add-outline" size={18} color="#1F2937" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.memberActionButton}
                          onPress={() => manageMembersSheetRef.current?.present()}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="people-outline" size={18} color="#1F2937" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  <View style={styles.membersGrid}>
                    {group.members.map((member) => (
                      <View key={member.id} style={styles.memberChip}>
                        {member.avatar ? (
                          <Image source={{ uri: member.avatar }} style={styles.memberAvatar} />
                        ) : (
                          <View style={styles.memberAvatarPlaceholder}>
                            <Text style={styles.memberInitial}>{member.name.charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>{member.name}</Text>
                          {member.role && (
                            <View style={styles.roleBadge}>
                              <Text style={[
                                styles.roleText,
                                member.role === 'owner' && styles.roleOwner,
                                member.role === 'admin' && styles.roleAdmin,
                              ]}>
                                {member.role === 'owner' ? '👑 Créateur' :
                                  member.role === 'admin' ? '⚡ Admin' : 'Membre'}
                              </Text>
                            </View>
                          )}
                        </View>
                        {canManage(group) && member.role !== 'owner' && member.id !== user?.id && (
                          <TouchableOpacity
                            style={styles.memberMoreButton}
                            onPress={() => {
                              setSelectedMember(member);
                              setMemberActionsVisible(true);
                            }}
                          >
                            <Ionicons name="ellipsis-vertical" size={18} color="#64748B" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Join Requests Section (private groups only) */}
              {group.isPrivate && canManage(group) && joinRequests.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.requestsHeader}>
                    <Text style={styles.sectionTitle}>Demandes en attente</Text>
                    <View style={styles.requestsBadge}>
                      <Text style={styles.requestsCount}>{joinRequests.length}</Text>
                    </View>
                  </View>
                  {joinRequests.map((request) => (
                    <View key={request.id} style={styles.requestCard}>
                      <TouchableOpacity
                        style={styles.requestUserInfo}
                        onPress={() => navigation.navigate('UserProfile', { userId: request.user.id })}
                        activeOpacity={0.7}
                      >
                        {request.user.avatar ? (
                          <Image source={{ uri: request.user.avatar }} style={styles.requestAvatar} />
                        ) : (
                          <View style={styles.requestAvatarPlaceholder}>
                            <Text style={styles.requestAvatarInitial}>
                              {request.user.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={styles.requestUserDetails}>
                          <Text style={styles.requestUserName}>{request.user.name}</Text>
                          <Text style={styles.requestTime}>{formatTimeAgo(request.createdAt)}</Text>
                        </View>
                      </TouchableOpacity>
                      <View style={styles.requestActions}>
                        <TouchableOpacity
                          style={styles.approveButton}
                          onPress={() => handleApproveRequest(request.id)}
                        >
                          <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.rejectButton}
                          onPress={() => handleRejectRequest(request.id)}
                        >
                          <Ionicons name="close" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

            </ScrollView>

            <View style={[styles.postsTabContainer, { width: screenWidth }]}>
              <ScrollView
                contentContainerStyle={styles.postsContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                <View style={styles.postList}>
                  {posts.map((post, index) => (
                    <React.Fragment key={post.id}>
                      <View style={styles.postItem}>
                        <View style={styles.postHeader}>
                          <View style={styles.postAvatar}>
                            {post.avatar ? (
                              <Image source={{ uri: post.avatar }} style={styles.postAvatarImage} />
                            ) : (
                              <View style={styles.postAvatarPlaceholder}>
                                <Text style={styles.postAvatarInitial}>{post.author?.charAt(0) || '?'}</Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.postHeaderInfo}>
                            <Text style={styles.postAuthor}>{post.author}</Text>
                            <Text style={styles.postTimestamp}>{formatTimeAgo(post.createdAt)}</Text>
                          </View>
                          <TouchableOpacity>
                            <Ionicons name="ellipsis-horizontal" size={18} color="#CBD5E1" />
                          </TouchableOpacity>
                        </View>
                        {post.title ? <Text style={styles.postContentTitle}>{post.title}</Text> : null}
                        <Text style={styles.postContent}>{post.content}</Text>
                        <View style={styles.postActions}>
                          <TouchableOpacity
                            style={styles.postAction}
                            onPress={async () => {
                              if (!user?.id) return;
                              const isLiked = likedPosts.has(post.id);
                              try {
                                const { liked } = await PostsService.toggleLike(post.id, user.id);
                                if (liked) {
                                  setLikedPosts(prev => new Set([...prev, post.id]));
                                } else {
                                  setLikedPosts(prev => {
                                    const newSet = new Set(prev);
                                    newSet.delete(post.id);
                                    return newSet;
                                  });
                                }
                                // Recharger le post pour mettre à jour le nombre de likes
                                const updatedPost = await PostsService.getPostWithInteractions(post.id);
                                setPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));
                              } catch (error) {
                                console.error('Erreur toggle like:', error);
                              }
                            }}
                          >
                            <Ionicons
                              name={likedPosts.has(post.id) ? 'heart' : 'heart-outline'}
                              size={16}
                              color={likedPosts.has(post.id) ? '#DC2626' : '#64748B'}
                            />
                            <Text style={styles.postActionText}>
                              {post.likesCount || 0} J'aime
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.postAction}
                            onPress={() => {
                              setSelectedPost(post);
                              commentsSheetRef.current?.present();
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="chatbubble-ellipses-outline" size={16} color="#64748B" />
                            <Text style={styles.postActionText}>
                              {post.commentsCount || 0} Réponses
                            </Text>
                          </TouchableOpacity>
                          <View style={styles.postAction}>
                            <Ionicons name="share-outline" size={16} color="#64748B" />
                            <Text style={styles.postActionText}>Partager</Text>
                          </View>
                        </View>
                      </View>
                      {index !== posts.length - 1 && <View style={styles.postDivider} />}
                    </React.Fragment>
                  ))}
                  {posts.length === 0 && (
                    <View style={styles.postEmptyState}>
                      <Ionicons name="chatbubble-ellipses-outline" size={32} color="#CBD5E1" />
                      <Text style={styles.postEmptyTitle}>Aucun post pour le moment</Text>
                      <Text style={styles.postEmptySubtitle}>
                        Lancez la discussion pour planifier la prochaine sortie.
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>
              <TouchableOpacity style={styles.postFab} onPress={openPostSheet}>
                <Ionicons name="add" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </View>


          </Animated.ScrollView>

          <CreatePostSheet
            sheetRef={createPostSheetRef}
            groupId={group?.id}
            userId={user?.id}
            onPostCreated={(newPost) => {
              setPosts((prev) => [newPost, ...prev]);
            }}
          />
        </SafeAreaView>
        <LaunchChallengeSheet
          sheetRef={launchChallengeSheetRef}
          groupId={group?.id}
          userId={user?.id}
          onChallengeCreated={async (challenge) => {
            console.log('🎉 [GroupDetailScreen] Défi créé, rechargement des données...');
            // Recharger les défis du groupe
            await loadGroupData();
            console.log('✅ [GroupDetailScreen] Données rechargées après création défi');
          }}
        />
        <GroupSettingsSheet
          sheetRef={groupSettingsSheetRef}
          group={group}
          onGroupUpdated={(updatedGroup) => {
            setGroup(updatedGroup);
            loadGroupData();
          }}
          onGroupDeleted={() => {
            Alert.alert('Succès', 'Groupe supprimé');
            navigation.goBack();
          }}
        />
        <InviteMembersSheet
          sheetRef={inviteMembersSheetRef}
          group={group}
          onInvitationSent={() => {
            // Recharger les données si nécessaire
          }}
        />
        <ManageMembersSheet
          sheetRef={manageMembersSheetRef}
          group={group}
          onMembersUpdated={() => {
            loadGroupData();
          }}
        />
        <CommentsSheet
          ref={commentsSheetRef}
          type="post"
          entityId={selectedPost?.id}
          onCommentAdded={(newComment) => {
            // Mettre à jour le compte de commentaires du post
            setPosts(prev => prev.map(p =>
              p.id === selectedPost?.id
                ? { ...p, commentsCount: (p.commentsCount || 0) + 1 }
                : p
            ));
          }}
        />

        {/* Member Actions Modal */}
        <Modal
          visible={memberActionsVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMemberActionsVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setMemberActionsVisible(false)}
          >
            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
              <Text style={styles.modalTitle}>
                Actions pour {selectedMember?.name}
              </Text>

              {isOwner(group) && (
                <>
                  <TouchableOpacity
                    style={styles.modalAction}
                    onPress={() => {
                      setMemberActionsVisible(false);
                      setTimeout(handleToggleAdmin, 300);
                    }}
                  >
                    <Ionicons
                      name={selectedMember?.role === 'admin' ? "remove-circle-outline" : "star-outline"}
                      size={22}
                      color="#1E3A8A"
                    />
                    <Text style={styles.modalActionText}>
                      {selectedMember?.role === 'admin' ? 'Retirer admin' : 'Promouvoir admin'}
                    </Text>
                  </TouchableOpacity>

                  {selectedMember?.role !== 'owner' && (
                    <TouchableOpacity
                      style={styles.modalAction}
                      onPress={() => {
                        setMemberActionsVisible(false);
                        setTimeout(handleTransferOwnership, 300);
                      }}
                    >
                      <Ionicons name="key-outline" size={22} color="#F59E0B" />
                      <Text style={styles.modalActionText}>
                        Transférer propriété
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              <TouchableOpacity
                style={[styles.modalAction, styles.modalActionDanger]}
                onPress={() => {
                  setMemberActionsVisible(false);
                  setTimeout(handleKickMember, 300);
                }}
              >
                <Ionicons name="exit-outline" size={22} color="#EF4444" />
                <Text style={[styles.modalActionText, styles.modalActionTextDanger]}>
                  Expulser
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setMemberActionsVisible(false)}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </BottomSheetModalProvider>
    </>
  );
}

const styles = StyleSheet.create<any>({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 12,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18, fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748B',
  },
  headerAvatarWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#EFF6FF',
    marginLeft: 12,
  },
  headerAvatar: {
    width: '100%',
    height: '100%',
  },
  headerAvatarPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
  },
  headerSpacer: {
    width: 40,
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 20,
  },
  heroSection: {
    gap: 16,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  heroInfoRow: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  heroInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroInfoText: {
    fontSize: 13,
    color: '#4B5563',
  },
  heroMetaText: {
    fontSize: 13,
    color: '#475569',
  },
  heroDescription: {
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 20,
  },
  tabBar: {
    flexDirection: 'row',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 13, color: '#475569',
  },
  tabLabelActive: {
    color: '#111827',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    height: 2,
    backgroundColor: '#111827',
    left: 0,
  },
  postsTabContainer: {
    flex: 1,
    position: 'relative',
  },
  postsContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  postComposerCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 14,
  },
  postComposerTitle: {
    fontSize: 15, color: '#0F172A',
  },
  postTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  postTypeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  postTypeChipActive: {
    borderColor: APP_BLUE,
    backgroundColor: APP_BLUE_LIGHT,
  },
  postTypeChipLabel: {
    fontSize: 12, fontWeight: '400',
    color: '#475569',
  },
  postTypeChipLabelActive: {
    color: APP_BLUE,
  },
  postTitleInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  postBodyInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    textAlignVertical: 'top',
  },
  postPublishButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: APP_BLUE,
  },
  postPublishLabel: {
    fontSize: 13, color: '#FFFFFF',
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 10,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: APP_BLUE_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 18, fontWeight: '700',
    color: '#0F172A',
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyChallengesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyChallengesText: {
    fontSize: 14, color: '#64748B',
    marginTop: 12,
  },
  emptyChallengesSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16, fontWeight: '700',
    color: '#0F172A',
  },
  membersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  membersActions: {
    flexDirection: 'row',
    gap: 8,
  },
  memberActionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  sectionLink: {
    fontSize: 12, fontWeight: '400',
    color: APP_BLUE,
  },
  sectionText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
  },
  challengeCarousel: {
    gap: 14,
    paddingVertical: 4,
    paddingRight: 20,
  },
  challengeCompactCard: {
    width: 240,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    backgroundColor: '#FFFFFF',
    marginRight: 12,
  },
  challengeCompactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  challengeCompactIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeCompactHeaderText: {
    flex: 1,
  },
  challengeCompactTitle: {
    fontSize: 15, color: '#1F2937',
    lineHeight: 20,
  },
  challengeCompactSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 10,
  },
  challengeCompactBody: {
    marginTop: 8,
    marginBottom: 8,
  },
  challengeCompactProgressBar: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  challengeCompactProgressFill: {
    height: '100%',
    backgroundColor: '#D97706',
    borderRadius: 3,
  },
  challengeCompactValue: {
    fontSize: 13, color: '#1F2937',
  },
  challengeCompactValueEmpty: {
    fontSize: 12, color: '#94A3B8',
  },
  challengeCompactFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  challengeCompactParticipants: {
    fontSize: 11,
    color: '#94A3B8',
  },
  challengeBar: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  challengeFill: {
    height: '100%',
    backgroundColor: APP_BLUE,
  },
  challengeCompactLabel: {
    fontSize: 12, fontWeight: '400',
    color: '#4B5563',
  },
  activityCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: APP_BLUE_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityInfo: {
    flex: 1,
    gap: 6,
  },
  activityText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  activityUser: {
    color: '#0F172A',
  },
  activityHighlight: {
    color: APP_BLUE,
  },
  activityTime: {
    fontSize: 12,
    color: '#94A3B8',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  postComposerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  simpleComposerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  simpleComposerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: APP_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postList: {
    gap: 12,
  },
  postItem: {
    gap: 12,
    paddingVertical: 8,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: APP_BLUE_LIGHT,
  },
  postAvatarImage: {
    width: '100%',
    height: '100%',
  },
  postAvatarPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postAvatarInitial: {
    fontSize: 16, fontWeight: '700',
    color: APP_BLUE,
  },
  postHeaderInfo: {
    flex: 1,
    gap: 2,
  },
  postAuthor: {
    fontSize: 16, fontWeight: '700',
    color: '#0F172A',
  },
  postTimestamp: {
    fontSize: 12,
    color: '#94A3B8',
  },
  postContent: {
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 20,
  },
  postActions: {
    flexDirection: 'row',
    gap: 16,
  },
  postAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postActionText: {
    fontSize: 12, fontWeight: '400',
    color: '#64748B',
  },
  postDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  postFab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: APP_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  postSheetContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 16,
  },
  postEmptyState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  postEmptyTitle: {
    fontSize: 16, fontWeight: '700',
    color: '#0F172A',
  },
  postEmptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  membersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    gap: 8,
  },
  memberAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  memberAvatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: APP_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInitial: {
    fontSize: 12, color: '#FFFFFF',
  },
  memberName: {
    fontSize: 12, fontWeight: '400',
    color: '#334155',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18, fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  skeleton: {
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
  },
  skeletonText: {
    borderRadius: 4,
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
  memberInfo: {
    flex: 1,
    gap: 4,
  },
  roleBadge: {
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  roleOwner: {
    color: '#EF4444',
  },
  roleAdmin: {
    color: '#1E3A8A',
  },
  memberMoreButton: {
    padding: 8,
  },
  requestsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  requestsBadge: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  requestsCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  requestUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  requestAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  requestAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestAvatarInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  requestUserDetails: {
    flex: 1,
    gap: 2,
  },
  requestUserName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  requestTime: {
    fontSize: 12,
    color: '#64748B',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  approveButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  modalAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  modalActionDanger: {
    backgroundColor: '#FEF2F2',
  },
  modalActionText: {
    color: '#1F2937',
  },
  modalActionTextDanger: {
    color: '#EF4444',
  },
  modalCancel: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  deleteGroupContainer: {
    padding: 20,
    paddingBottom: 40,
    gap: 8,
    alignItems: 'center',
  },
  deleteGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    width: '100%',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  deleteGroupText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  deleteGroupHint: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  privacyBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  privacyBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
});
