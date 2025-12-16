import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
const formatDistance = (km = 0) => {
  if (km >= 1000) {
    return `${(km / 1000).toFixed(1)}k km`;
  }
  return `${km.toFixed(0)} km`;
};

export default function AllGroupsScreen({ route, navigation }) {
  const { groups = [] } = route?.params || {};

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tous les groupes</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, !groups.length && styles.emptyContainer]}
        showsVerticalScrollIndicator={false}
      >
        {groups.length ? (
          groups.map((group) => (
            <TouchableOpacity
              key={group.id}
              style={styles.groupCard}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('GroupDetail', { group })}
            >
              <View style={styles.groupRow}>
                <View style={styles.avatarWrapper}>
                  {group.avatar ? (
                    <Image source={{ uri: group.avatar }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Ionicons name="people" size={24} color="#1F2937" />
                    </View>
                  )}
                </View>
                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>{group.name}</Text>
                  <Text style={styles.groupMeta}>{group.memberCount} membres</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
              </View>

              <View style={styles.statRow}>
                <Text style={styles.statText}>{formatDistance(group.totalDistance)}</Text>
                <Text style={styles.statText}>{group.totalRides} trajets</Text>
              </View>

              {group.recentActivity && (
                <Text style={styles.activityLine}>
                  <Text style={styles.activityUser}>{group.recentActivity.user}</Text>
                  {' a roulé '}
                  <Text style={styles.activityHighlight}>{group.recentActivity.distance} km</Text>
                  {' • '}
                  {group.recentActivity.ago}
                </Text>
              )}
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="people-circle-outline" size={40} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>Aucun groupe trouvé</Text>
            <Text style={styles.emptySubtitle}>
              Rejoignez un groupe depuis la page principale pour le retrouver ici.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
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
    fontSize: 20,color: '#0F172A',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 16,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrapper: {
    width: 52,
    height: 52,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
    backgroundColor: '#F4F4F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  groupInfo: {
    flex: 1,
    gap: 4,
  },
  groupName: {
      fontSize: 16, fontWeight: '700',
    color: '#0F172A',
  },
  groupMeta: {
    fontSize: 13,
    color: '#64748B',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statText: {
    fontSize: 12,
    color: '#475569',
  },
  activityLine: {
    fontSize: 12,
    color: '#475569',
  },
  activityUser: {color: '#0F172A',
  },
  activityHighlight: {color: '#1F2937',
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
  },
  emptyTitle: {
      fontSize: 18, fontWeight: '700',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

