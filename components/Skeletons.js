import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';

// Animation de shimmer pour les skeletons
const Shimmer = ({ style }) => {
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View style={[style, { opacity }]} />
  );
};

// Skeleton de base
export const SkeletonBox = ({ width, height, borderRadius = 8, style }) => (
  <View style={[styles.skeletonBox, { width, height, borderRadius }, style]}>
    <Shimmer style={StyleSheet.absoluteFill} />
  </View>
);

// Skeleton pour une carte de trajet (Feed)
export const RideCardSkeleton = () => (
  <View style={styles.rideCardSkeleton}>
    <View style={styles.rideCardHeader}>
      <SkeletonBox width={35} height={35} borderRadius={18} />
      <View style={styles.rideCardHeaderText}>
        <SkeletonBox width={120} height={16} style={styles.marginBottom} />
        <SkeletonBox width={80} height={12} />
      </View>
    </View>
    <SkeletonBox width="90%" height={20} style={styles.marginBottom} />
    <SkeletonBox width="70%" height={16} style={styles.marginBottom} />
    <SkeletonBox width="100%" height={200} borderRadius={12} style={styles.marginBottom} />
    <View style={styles.rideCardStats}>
      <SkeletonBox width={60} height={16} />
      <SkeletonBox width={60} height={16} />
      <SkeletonBox width={60} height={16} />
    </View>
    <View style={styles.rideCardActions}>
      <SkeletonBox width={24} height={24} borderRadius={12} />
      <SkeletonBox width={24} height={24} borderRadius={12} />
      <SkeletonBox width={24} height={24} borderRadius={12} />
    </View>
  </View>
);

// Skeleton pour le Feed (liste de trajets)
export const FeedSkeleton = () => (
  <View style={styles.feedSkeleton}>
    {[1, 2, 3].map((i) => (
      <RideCardSkeleton key={i} />
    ))}
  </View>
);

// Skeleton pour une carte de groupe
export const GroupCardSkeleton = () => (
  <View style={styles.groupCardSkeleton}>
    <SkeletonBox width="100%" height={120} borderRadius={12} style={styles.marginBottom} />
    <SkeletonBox width="80%" height={16} style={styles.marginBottom} />
    <SkeletonBox width="60%" height={12} />
  </View>
);

// Skeleton pour l'écran Groups
export const GroupsSkeleton = () => (
  <View style={styles.groupsSkeleton}>
    {/* Section Découvrir */}
    <View style={styles.groupsSkeletonSection}>
      <SkeletonBox width={120} height={20} style={styles.marginBottom} />
      <View style={styles.discoverCardSkeleton}>
        <SkeletonBox width={48} height={48} borderRadius={24} />
        <View style={styles.discoverCardSkeletonContent}>
          <SkeletonBox width="70%" height={16} style={styles.marginBottom} />
          <SkeletonBox width="90%" height={14} />
        </View>
        <SkeletonBox width={20} height={20} />
      </View>
    </View>

    {/* Section Défis en cours */}
    <View style={styles.groupsSkeletonSection}>
      <View style={styles.groupsSkeletonSectionHeader}>
        <SkeletonBox width={140} height={20} />
        <SkeletonBox width={60} height={16} />
      </View>
      <View style={styles.groupsSkeletonHorizontalScroll}>
        {[1, 2].map((i) => (
          <View key={i} style={styles.challengeCardSkeleton}>
            <View style={styles.challengeCardSkeletonHeader}>
              <SkeletonBox width={40} height={40} borderRadius={20} />
              <View style={styles.challengeCardSkeletonInfo}>
                <SkeletonBox width="80%" height={16} style={styles.marginBottom} />
                <SkeletonBox width="100%" height={12} />
                <SkeletonBox width="60%" height={12} style={styles.marginTop} />
              </View>
            </View>
            <SkeletonBox width="100%" height={8} borderRadius={4} style={styles.marginTop} />
            <SkeletonBox width="70%" height={12} style={styles.marginTop} />
            <View style={styles.challengeCardSkeletonFooter}>
              <SkeletonBox width={80} height={12} />
              <SkeletonBox width={100} height={12} />
            </View>
          </View>
        ))}
      </View>
    </View>

    {/* Section Mes groupes */}
    <View style={styles.groupsSkeletonSection}>
      <View style={styles.groupsSkeletonSectionHeader}>
        <SkeletonBox width={120} height={20} />
        <SkeletonBox width={60} height={16} />
      </View>
      <View style={styles.groupsSkeletonHorizontalScroll}>
        {[1, 2, 3].map((i) => (
          <GroupCardSkeleton key={i} />
        ))}
      </View>
    </View>

    {/* Section Invitations */}
    <View style={styles.groupsSkeletonSection}>
      <SkeletonBox width={120} height={20} style={styles.marginBottom} />
      <View style={styles.invitationCardSkeleton}>
        <View style={styles.invitationCardSkeletonHeader}>
          <SkeletonBox width={48} height={48} borderRadius={24} />
          <View style={styles.invitationCardSkeletonInfo}>
            <SkeletonBox width="60%" height={16} style={styles.marginBottom} />
            <SkeletonBox width="80%" height={12} />
          </View>
        </View>
        <View style={styles.invitationCardSkeletonActions}>
          <SkeletonBox width="48%" height={44} borderRadius={12} />
          <SkeletonBox width="48%" height={44} borderRadius={12} />
        </View>
      </View>
    </View>
  </View>
);

// Skeleton pour une carte de trajet dans l'historique
export const HistoryRideSkeleton = () => (
  <View style={styles.historyRideSkeleton}>
    {/* Menu options */}
    <View style={styles.historyRideMenuButton}>
      <SkeletonBox width={20} height={20} borderRadius={10} />
    </View>

    {/* Date du trajet */}
    <View style={styles.historyRideHeader}>
      <SkeletonBox width={16} height={16} borderRadius={8} />
      <SkeletonBox width={120} height={12} />
    </View>

    {/* Titre du trajet */}
    <View style={styles.historyRideTitleSection}>
      <SkeletonBox width="85%" height={18} style={styles.marginBottom} />
      <View style={styles.historyRideMetaInfo}>
        <SkeletonBox width={80} height={16} />
        <SkeletonBox width={140} height={13} />
      </View>
    </View>

    {/* Carte miniature */}
    <SkeletonBox width="100%" height={200} borderRadius={12} style={styles.historyRideMapSection} />

    {/* Stats */}
    <View style={styles.historyRideStats}>
      <View style={styles.historyRideStatItem}>
        <SkeletonBox width={16} height={16} borderRadius={8} />
        <SkeletonBox width={50} height={16} />
      </View>
      <View style={styles.historyRideStatItem}>
        <SkeletonBox width={16} height={16} borderRadius={8} />
        <SkeletonBox width={50} height={16} />
      </View>
      <View style={styles.historyRideStatItem}>
        <SkeletonBox width={16} height={16} borderRadius={8} />
        <SkeletonBox width={50} height={16} />
      </View>
    </View>
  </View>
);

// Skeleton pour l'écran History
export const HistorySkeleton = () => (
  <View style={styles.historySkeleton}>
    {[1, 2, 3].map((i) => (
      <View key={i}>
        {i > 1 && (
          <View style={styles.historyRideSeparator} />
        )}
        <HistoryRideSkeleton />
      </View>
    ))}
  </View>
);

// Skeleton pour le profil
export const ProfileSkeleton = () => (
  <View style={styles.profileSkeleton}>
    <View style={styles.profileHeader}>
      <SkeletonBox width={80} height={80} borderRadius={40} />
      <SkeletonBox width={150} height={24} style={styles.marginTop} />
      <SkeletonBox width={100} height={16} style={styles.marginTop} />
    </View>
    <View style={styles.profileStats}>
      <View style={styles.profileStatItem}>
        <SkeletonBox width={40} height={20} />
        <SkeletonBox width={60} height={14} style={styles.marginTop} />
      </View>
      <View style={styles.profileStatItem}>
        <SkeletonBox width={40} height={20} />
        <SkeletonBox width={60} height={14} style={styles.marginTop} />
      </View>
      <View style={styles.profileStatItem}>
        <SkeletonBox width={40} height={20} />
        <SkeletonBox width={60} height={14} style={styles.marginTop} />
      </View>
    </View>
  </View>
);

// Skeleton pour UserProfileScreen (profil d'un autre utilisateur)
export const UserProfileSkeleton = () => (
  <View style={styles.userProfileSkeleton}>
    {/* Header avec chevron, username et ... */}
    <View style={styles.userProfileTopHeader}>
      <SkeletonBox width={40} height={40} borderRadius={20} />
      <SkeletonBox width={120} height={18} />
      <SkeletonBox width={40} height={40} borderRadius={20} />
    </View>

    {/* Header fixe */}
    <View style={styles.userProfileFixedHeader}>
      {/* Avatar et nom/username */}
      <View style={styles.userProfileHeaderSection}>
        <View style={styles.userProfileCenterContent}>
          <SkeletonBox width={80} height={80} borderRadius={40} />
          <View style={styles.userProfileNameSection}>
            <SkeletonBox width={150} height={20} style={styles.marginBottom} />
            <SkeletonBox width={100} height={16} />
          </View>
        </View>
        <SkeletonBox width={100} height={36} borderRadius={18} />
      </View>

      {/* Statistiques principales */}
      <View style={styles.userProfileStatsRow}>
        <View style={styles.userProfileStatItem}>
          <SkeletonBox width={40} height={20} />
          <SkeletonBox width={60} height={14} style={styles.marginTop} />
        </View>
        <View style={styles.userProfileStatItem}>
          <SkeletonBox width={40} height={20} />
          <SkeletonBox width={60} height={14} style={styles.marginTop} />
        </View>
        <View style={styles.userProfileStatItem}>
          <SkeletonBox width={40} height={20} />
          <SkeletonBox width={60} height={14} style={styles.marginTop} />
        </View>
      </View>

      {/* Bio */}
      <SkeletonBox width="100%" height={16} style={styles.marginTop} />
      <SkeletonBox width="80%" height={16} style={styles.marginTop} />
    </View>

    {/* Onglets */}
    <View style={styles.userProfileTabsRow}>
      <SkeletonBox width={24} height={24} borderRadius={12} />
      <SkeletonBox width={24} height={24} borderRadius={12} />
      <SkeletonBox width={24} height={24} borderRadius={12} />
      <SkeletonBox width={24} height={24} borderRadius={12} />
    </View>

    {/* Grille de posts */}
    <View style={styles.userProfileGrid}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <SkeletonBox key={i} width="33%" height={120} borderRadius={0} style={{ aspectRatio: 1 }} />
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  skeletonBox: {
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  marginBottom: {
    marginBottom: 8,
  },
  marginTop: {
    marginTop: 4,
  },
  rideCardSkeleton: {
    width: '100%',
  },
  rideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rideCardHeaderText: {
    marginLeft: 10,
    flex: 1,
  },
  rideCardStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 16,
  },
  rideCardActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  feedSkeleton: {
    width: '100%',
    padding: 16,
  },
  groupCardSkeleton: {
    width: 180,
    marginRight: 16,
    padding: 16,
  },
  groupsSkeleton: {
    paddingHorizontal: 20,
  },
  groupsSkeletonSection: {
    marginTop: 24,
  },
  groupsSkeletonSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  groupsSkeletonHorizontalScroll: {
    flexDirection: 'row',
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  discoverCardSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  discoverCardSkeletonContent: {
    flex: 1,
  },
  challengeCardSkeleton: {
    minWidth: 250,
    borderRadius: 18,
    marginRight: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  challengeCardSkeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  challengeCardSkeletonInfo: {
    flex: 1,
  },
  challengeCardSkeletonFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  invitationCardSkeleton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  invitationCardSkeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  invitationCardSkeletonInfo: {
    flex: 1,
  },
  invitationCardSkeletonActions: {
    flexDirection: 'row',
    gap: 8,
  },
  section: {
    marginTop: 24,
  },
  horizontalScroll: {
    flexDirection: 'row',
    marginTop: 16,
  },
  historyRideSkeleton: {
    backgroundColor: 'transparent',
    marginBottom: 0,
    position: 'relative',
  },
  historyRideMenuButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 10,
  },
  historyRideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 10,
  },
  historyRideTitleSection: {
    paddingHorizontal: 15,
    paddingBottom: 8,
  },
  historyRideMetaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyRideMapSection: {
    marginHorizontal: 15,
    marginBottom: 8,
  },
  historyRideStats: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 24,
  },
  historyRideStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyRideSeparator: {
    marginTop: 8,
    borderTopWidth: 4,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
  },
  historySkeleton: {
    paddingBottom: 20,
  },
  profileSkeleton: {
    padding: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profileStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 24,
  },
  profileStatItem: {
    alignItems: 'center',
  },
  userProfileSkeleton: {
    flex: 1,
    backgroundColor: '#fff',
  },
  userProfileTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  userProfileFixedHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  userProfileHeaderSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  userProfileCenterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userProfileNameSection: {
    marginLeft: 12,
  },
  userProfileStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  userProfileStatItem: {
    alignItems: 'center',
  },
  userProfileTabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  userProfileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});

