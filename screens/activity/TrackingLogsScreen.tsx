import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Alert,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import trackingLogger from '../../utils/trackingLogger';

interface Session {
  startTime: number;
  duration: number;
  logsCount: number;
}

interface Sessions {
  [sessionId: string]: Session;
}

interface DiagnosticReport {
  summary: {
    gpsPoints: {
      accepted: number;
      rejected: number;
      total: number;
    };
    heartbeats: {
      ok: number;
      failed: number;
    };
    saves: {
      success: number;
      failed: number;
    };
    errors: Array<{
      time: string;
      message: string;
    }>;
    trackingEvents: Array<{
      time: string;
      event: string;
    }>;
  };
}

// Extended trackingLogger interface for methods used in this screen
interface ExtendedTrackingLogger {
  getSessions(): Promise<Sessions>;
  generateDiagnosticReport(sessionId: string): Promise<DiagnosticReport>;
  exportSessionToFile(sessionId: string, format: string): Promise<string>;
}

const extendedLogger = trackingLogger as any as ExtendedTrackingLogger;

type TrackingLogsScreenRouteProp = RouteProp<Record<string, never>, string>;

/**
 * Écran pour consulter les logs de tracking
 * Accessible depuis les paramètres ou après un trajet
 */
const TrackingLogsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<TrackingLogsScreenRouteProp>();
  const [sessions, setSessions] = useState<Sessions>({});
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const loadedSessions = await extendedLogger.getSessions();
      setSessions(loadedSessions);
    } catch (error) {
      console.error('Erreur chargement sessions:', error);
      Alert.alert('Erreur', 'Impossible de charger les sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSession = async (sessionId: string): Promise<void> => {
    try {
      setSelectedSession(sessionId);
      const report = await extendedLogger.generateDiagnosticReport(sessionId);
      setDiagnosticReport(report);
    } catch (error) {
      console.error('Erreur chargement rapport:', error);
      Alert.alert('Erreur', 'Impossible de générer le rapport');
    }
  };

  const handleExport = async (sessionId: string, format: string = 'txt'): Promise<void> => {
    try {
      const filepath = await extendedLogger.exportSessionToFile(sessionId, format);
      Alert.alert(
        'Export réussi',
        `Logs exportés vers:\n${filepath}`,
        [
          { text: 'OK' },
          {
            text: 'Partager',
            onPress: async () => {
              try {
                await Share.share({
                  url: filepath,
                  title: `Logs tracking ${sessionId}`,
                });
              } catch (error) {
                console.error('Erreur partage:', error);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Erreur export:', error);
      Alert.alert('Erreur', 'Impossible d\'exporter les logs');
    }
  };

  const renderSessionItem = ({ item: sessionId }: { item: string }) => {
    const session = sessions[sessionId];
    const durationMin = (session.duration / 1000 / 60).toFixed(1);
    const startDate = new Date(session.startTime).toLocaleString('fr-FR');

    return (
      <TouchableOpacity
        style={[
          styles.sessionItem,
          selectedSession === sessionId && styles.sessionItemSelected,
        ]}
        onPress={() => handleSelectSession(sessionId)}
      >
        <View style={styles.sessionHeader}>
          <Ionicons name="analytics-outline" size={24} color="#1E3A8A" />
          <View style={styles.sessionInfo}>
            <Text style={styles.sessionDate}>{startDate}</Text>
            <Text style={styles.sessionStats}>
              {durationMin} min • {session.logsCount} événements
            </Text>
          </View>
        </View>
        <View style={styles.sessionActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleExport(sessionId, 'txt')}
          >
            <Ionicons name="share-outline" size={20} color="#1E3A8A" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDiagnosticReport = () => {
    if (!diagnosticReport) {
      return null;
    }

    const { summary } = diagnosticReport;
    const hasErrors = summary.errors.length > 0;
    const hasFailedHeartbeats = summary.heartbeats.failed > 0;
    const hasFailedSaves = summary.saves.failed > 0;

    return (
      <ScrollView style={styles.reportContainer}>
        <Text style={styles.reportTitle}>Rapport de Diagnostic</Text>

        {/* Statut général */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Ionicons
              name={hasErrors || hasFailedHeartbeats || hasFailedSaves ? 'warning' : 'checkmark-circle'}
              size={32}
              color={hasErrors || hasFailedHeartbeats || hasFailedSaves ? '#EF4444' : '#10B981'}
            />
            <Text style={styles.statusText}>
              {hasErrors || hasFailedHeartbeats || hasFailedSaves
                ? 'Problèmes détectés'
                : 'Tracking OK'}
            </Text>
          </View>
        </View>

        {/* Points GPS */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>📍 Points GPS</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>Acceptés</Text>
            <Text style={styles.statsValue}>{summary.gpsPoints.accepted}</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>Rejetés</Text>
            <Text style={[styles.statsValue, summary.gpsPoints.rejected > 0 && styles.statsWarning]}>
              {summary.gpsPoints.rejected}
            </Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>Total</Text>
            <Text style={styles.statsValue}>{summary.gpsPoints.total}</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>Taux d'acceptation</Text>
            <Text style={styles.statsValue}>
              {summary.gpsPoints.total > 0
                ? ((summary.gpsPoints.accepted / summary.gpsPoints.total) * 100).toFixed(1)
                : 0}
              %
            </Text>
          </View>
        </View>

        {/* Heartbeats */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>💓 Heartbeats</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>OK</Text>
            <Text style={styles.statsValue}>{summary.heartbeats.ok}</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>Échoués</Text>
            <Text style={[styles.statsValue, summary.heartbeats.failed > 0 && styles.statsWarning]}>
              {summary.heartbeats.failed}
            </Text>
          </View>
        </View>

        {/* Sauvegardes */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>💾 Sauvegardes</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>Réussies</Text>
            <Text style={styles.statsValue}>{summary.saves.success}</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>Échouées</Text>
            <Text style={[styles.statsValue, summary.saves.failed > 0 && styles.statsWarning]}>
              {summary.saves.failed}
            </Text>
          </View>
        </View>

        {/* Erreurs */}
        {summary.errors.length > 0 && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>❌ Erreurs ({summary.errors.length})</Text>
            {summary.errors.map((error, index) => (
              <View key={index} style={styles.errorItem}>
                <Text style={styles.errorTime}>{error.time}</Text>
                <Text style={styles.errorMessage}>{error.message}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Événements de tracking */}
        {summary.trackingEvents.length > 0 && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>🎯 Événements</Text>
            {summary.trackingEvents.map((event, index) => (
              <View key={index} style={styles.eventItem}>
                <Text style={styles.eventTime}>{event.time}</Text>
                <Text style={styles.eventName}>{event.event}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  const sessionIds = Object.keys(sessions).sort((a, b) => {
    return sessions[b].startTime - sessions[a].startTime;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1E3A8A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Logs de Tracking</Text>
        <TouchableOpacity onPress={loadSessions} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#1E3A8A" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.sessionsList}>
          <Text style={styles.sectionTitle}>Sessions ({sessionIds.length})</Text>
          {isLoading ? (
            <Text style={styles.loadingText}>Chargement...</Text>
          ) : sessionIds.length === 0 ? (
            <Text style={styles.emptyText}>Aucune session enregistrée</Text>
          ) : (
            <FlatList
              data={sessionIds}
              renderItem={renderSessionItem}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.sessionListContent}
            />
          )}
        </View>

        {selectedSession && (
          <View style={styles.reportSection}>{renderDiagnosticReport()}</View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    color: '#1F2937',
  },
  refreshButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  sessionsList: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#6B7280',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  sessionListContent: {
    padding: 8,
  },
  sessionItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sessionItemSelected: {
    borderColor: '#1E3A8A',
    borderWidth: 2,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sessionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  sessionDate: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1F2937',
  },
  sessionStats: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  sessionActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
  },
  loadingText: {
    textAlign: 'center',
    color: '#6B7280',
    padding: 32,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    padding: 32,
  },
  reportSection: {
    flex: 2,
  },
  reportContainer: {
    flex: 1,
    padding: 16,
  },
  reportTitle: {
    fontSize: 20,
    color: '#1F2937',
    marginBottom: 16,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 18,
    marginLeft: 12,
    color: '#1F2937',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1F2937',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statsLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  statsValue: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1F2937',
  },
  statsWarning: {
    color: '#EF4444',
  },
  errorItem: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  errorTime: {
    fontSize: 12,
    fontWeight: '400',
    color: '#991B1B',
  },
  errorMessage: {
    fontSize: 13,
    color: '#DC2626',
    marginTop: 4,
  },
  eventItem: {
    borderLeftWidth: 3,
    borderLeftColor: '#1E3A8A',
    paddingLeft: 12,
    paddingVertical: 6,
    marginTop: 8,
  },
  eventTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  eventName: {
    fontSize: 14,
    color: '#1F2937',
    marginTop: 2,
  },
});

export default TrackingLogsScreen;

