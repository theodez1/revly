import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
export default function AllChallengesScreen({ route, navigation }) {
  const { challenges = [] } = route?.params || {};

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tous les défis</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, !challenges.length && styles.emptyContainer]}
        showsVerticalScrollIndicator={false}
      >
        {challenges.length ? (
          challenges.map((challenge) => {
            const hasProgress =
              typeof challenge.progress === 'number' && typeof challenge.target === 'number' && challenge.target > 0;
            const completionRatio = hasProgress ? Math.min(Math.max(challenge.progress / challenge.target, 0), 1) : 0;

            return (
              <View key={challenge.id} style={styles.challengeCard}>
                <Text style={styles.challengeTitle}>{challenge.title}</Text>
                <Text style={styles.challengeDescription}>{challenge.description}</Text>

                {hasProgress ? (
                  <View style={styles.progressSection}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${completionRatio * 100}%` }]} />
                    </View>
                    <Text style={styles.progressLabel}>
                      {challenge.progress} / {challenge.target} km • {Math.round(completionRatio * 100)}%
                    </Text>
                  </View>
                ) : (
                  <View style={styles.speedRow}>
                    {(() => {
                      const leader = challenge.currentLeader || challenge.leader;
                      if (!leader) {
                        return (
                          <Text style={styles.speedContent}>
                            <Text style={styles.speedValue}>Classement libre</Text>
                          </Text>
                        );
                      }
                      if (challenge.type === 'speed' && challenge.bestSpeed) {
                        return (
                          <>
                            <Ionicons name="speedometer" size={18} color="#2563EB" />
                            <Text style={styles.speedContent}>
                              <Text style={styles.speedValue}>{challenge.bestSpeed} km/h</Text>
                              <Text style={styles.speedLabel}> par {leader}</Text>
                            </Text>
                          </>
                        );
                      }
                      if (challenge.type === 'count' && challenge.progress) {
                        return (
                          <>
                            <Ionicons name="list" size={18} color="#2563EB" />
                            <Text style={styles.speedContent}>
                              <Text style={styles.speedValue}>{challenge.progress} trajets</Text>
                              <Text style={styles.speedLabel}> par {leader}</Text>
                            </Text>
                          </>
                        );
                      }
                      if (challenge.type === 'distance' && challenge.progress) {
                        return (
                          <>
                            <Ionicons name="map" size={18} color="#2563EB" />
                            <Text style={styles.speedContent}>
                              <Text style={styles.speedValue}>{challenge.progress} km</Text>
                              <Text style={styles.speedLabel}> par {leader}</Text>
                            </Text>
                          </>
                        );
                      }
                      return (
                        <Text style={styles.speedContent}>
                          <Text style={styles.speedValue}>Classement libre</Text>
                          <Text style={styles.speedLabel}> par {leader}</Text>
                        </Text>
                      );
                    })()}
                  </View>
                )}

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>{challenge.participants} participants</Text>
                  <Text style={styles.metaText}>{challenge.daysLeft} jours restants</Text>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={40} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>Aucun défi disponible</Text>
            <Text style={styles.emptySubtitle}>Revenez plus tard pour découvrir de nouveaux défis.</Text>
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
  challengeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  challengeTitle: {
      fontSize: 16, fontWeight: '700',
    color: '#0F172A',
  },
  challengeDescription: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  progressSection: {
    gap: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 4,
  },
  progressLabel: {
      fontSize: 12, fontWeight: '400',
    color: '#475569',
    textAlign: 'center',
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  speedContent: {
    fontSize: 13,
    color: '#475569',
  },
  speedValue: {color: '#2563EB',
  },
  speedLabel: {
    color: '#475569',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
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
  },
});
