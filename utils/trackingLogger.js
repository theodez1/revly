import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

// Configuration
const MAX_LOG_ENTRIES = 1000; // Garder max 1000 entrées par session
const MAX_SESSIONS = 5; // Garder max 5 dernières sessions
const LOG_STORAGE_KEY = '@tracking_logs';
const CURRENT_SESSION_KEY = '@current_session_id';

/**
 * Système de logging interne pour debugging tracking
 * Enregistre tous les événements importants pendant un trajet
 */
class TrackingLogger {
    constructor() {
        this.currentSessionId = null;
        this.sessionLogs = [];
        this.sessionStartTime = null;
    }

    /**
     * Démarrer une nouvelle session de logging
     */
    async startSession(sessionInfo = {}) {
        this.currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.sessionStartTime = Date.now();
        this.sessionLogs = [];

        await AsyncStorage.setItem(CURRENT_SESSION_KEY, this.currentSessionId);

        this.log('SESSION_START', {
            sessionId: this.currentSessionId,
            timestamp: this.sessionStartTime,
            ...sessionInfo,
        });
    }

    /**
     * Terminer la session courante et sauvegarder
     */
    async endSession(sessionInfo = {}) {
        if (!this.currentSessionId) {
            return;
        }

        this.log('SESSION_END', {
            sessionId: this.currentSessionId,
            duration: Date.now() - this.sessionStartTime,
            totalLogs: this.sessionLogs.length,
            ...sessionInfo,
        });

        await this.saveSession();
        await this.cleanup();

        this.currentSessionId = null;
        this.sessionLogs = [];
        this.sessionStartTime = null;
    }

    /**
     * Logger un événement
     */
    log(eventType, data = {}) {
        const logEntry = {
            timestamp: Date.now(),
            relativeTime: this.sessionStartTime ? Date.now() - this.sessionStartTime : 0,
            eventType,
            data,
        };

        this.sessionLogs.push(logEntry);

        // Limiter le nombre d'entrées en mémoire
        if (this.sessionLogs.length > MAX_LOG_ENTRIES) {
            this.sessionLogs.shift();
        }

        // Console log pour debugging temps réel
        const timeStr = new Date(logEntry.timestamp).toLocaleTimeString('fr-FR');
        const relativeStr = `+${(logEntry.relativeTime / 1000).toFixed(1)}s`;
        console.log(`📝 [${timeStr}] [${relativeStr}] ${eventType}:`, data);
    }

    /**
     * Logger un point GPS
     */
    logGPSPoint(point, status = 'accepted') {
        this.log('GPS_POINT', {
            status,
            latitude: point.latitude?.toFixed(6),
            longitude: point.longitude?.toFixed(6),
            accuracy: point.accuracy?.toFixed(1),
            speed: point.speed ? (point.speed * 3.6).toFixed(1) : 'N/A',
            altitude: point.altitude?.toFixed(1),
        });
    }

    /**
     * Logger un événement de tracking
     */
    logTrackingEvent(event, details = {}) {
        this.log('TRACKING_EVENT', {
            event,
            ...details,
        });
    }

    /**
     * Logger une erreur
     */
    logError(error, context = {}) {
        this.log('ERROR', {
            message: error.message || String(error),
            stack: error.stack,
            ...context,
        });
    }

    /**
     * Logger le heartbeat
     */
    logHeartbeat(age, status = 'OK') {
        this.log('HEARTBEAT', {
            age,
            status,
        });
    }

    /**
     * Logger une sauvegarde
     */
    logSave(pointsCount, success = true) {
        this.log('SAVE', {
            pointsCount,
            success,
        });
    }

    /**
     * Sauvegarder la session courante
     */
    async saveSession() {
        if (!this.currentSessionId || this.sessionLogs.length === 0) {
            return;
        }

        try {
            // Charger les sessions existantes
            const savedLogsStr = await AsyncStorage.getItem(LOG_STORAGE_KEY);
            const savedLogs = savedLogsStr ? JSON.parse(savedLogsStr) : {};

            // Ajouter la session courante
            savedLogs[this.currentSessionId] = {
                sessionId: this.currentSessionId,
                startTime: this.sessionStartTime,
                endTime: Date.now(),
                duration: Date.now() - this.sessionStartTime,
                logsCount: this.sessionLogs.length,
                logs: this.sessionLogs,
            };

            // Garder seulement les N dernières sessions
            const sessionIds = Object.keys(savedLogs).sort((a, b) => {
                return savedLogs[b].startTime - savedLogs[a].startTime;
            });

            if (sessionIds.length > MAX_SESSIONS) {
                const toDelete = sessionIds.slice(MAX_SESSIONS);
                toDelete.forEach((id) => delete savedLogs[id]);
            }

            await AsyncStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(savedLogs));
            console.log(`✅ Session ${this.currentSessionId} sauvegardée (${this.sessionLogs.length} logs)`);
        } catch (error) {
            console.error('❌ Erreur sauvegarde session logs:', error);
        }
    }

    /**
     * Nettoyer les anciennes sessions
     */
    async cleanup() {
        try {
            const savedLogsStr = await AsyncStorage.getItem(LOG_STORAGE_KEY);
            if (!savedLogsStr) return;

            const savedLogs = JSON.parse(savedLogsStr);
            const sessionIds = Object.keys(savedLogs);

            // Supprimer les sessions de plus de 7 jours
            const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            let deletedCount = 0;

            sessionIds.forEach((id) => {
                if (savedLogs[id].startTime < weekAgo) {
                    delete savedLogs[id];
                    deletedCount++;
                }
            });

            if (deletedCount > 0) {
                await AsyncStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(savedLogs));
                console.log(`🗑️ ${deletedCount} anciennes sessions supprimées`);
            }
        } catch (error) {
            console.error('❌ Erreur cleanup logs:', error);
        }
    }

    /**
     * Récupérer toutes les sessions sauvegardées
     */
    async getSessions() {
        try {
            const savedLogsStr = await AsyncStorage.getItem(LOG_STORAGE_KEY);
            if (!savedLogsStr) return {};

            return JSON.parse(savedLogsStr);
        } catch (error) {
            console.error('❌ Erreur récupération sessions:', error);
            return {};
        }
    }

    /**
     * Exporter les logs au format texte
     */
    async exportSessionToText(sessionId) {
        try {
            const sessions = await this.getSessions();
            const session = sessions[sessionId];

            if (!session) {
                throw new Error(`Session ${sessionId} introuvable`);
            }

            let text = `=== TRACKING LOGS - Session ${sessionId} ===\n`;
            text += `Date: ${new Date(session.startTime).toLocaleString('fr-FR')}\n`;
            text += `Durée: ${(session.duration / 1000 / 60).toFixed(1)} minutes\n`;
            text += `Nombre d'événements: ${session.logsCount}\n`;
            text += `\n`;

            session.logs.forEach((log) => {
                const time = new Date(log.timestamp).toLocaleTimeString('fr-FR');
                const relative = `+${(log.relativeTime / 1000).toFixed(1)}s`;
                text += `[${time}] [${relative}] ${log.eventType}\n`;
                text += `  ${JSON.stringify(log.data, null, 2)}\n`;
                text += `\n`;
            });

            return text;
        } catch (error) {
            console.error('❌ Erreur export logs:', error);
            throw error;
        }
    }

    /**
     * Exporter les logs au format JSON
     */
    async exportSessionToJSON(sessionId) {
        try {
            const sessions = await this.getSessions();
            const session = sessions[sessionId];

            if (!session) {
                throw new Error(`Session ${sessionId} introuvable`);
            }

            return JSON.stringify(session, null, 2);
        } catch (error) {
            console.error('❌ Erreur export logs JSON:', error);
            throw error;
        }
    }

    /**
     * Sauvegarder les logs dans un fichier
     */
    async exportSessionToFile(sessionId, format = 'txt') {
        try {
            const exportDir = `${FileSystem.documentDirectory}tracking_logs/`;
            await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true }).catch(() => { });

            const filename = `logs_${sessionId}_${Date.now()}.${format}`;
            const filepath = `${exportDir}${filename}`;

            let content;
            if (format === 'json') {
                content = await this.exportSessionToJSON(sessionId);
            } else {
                content = await this.exportSessionToText(sessionId);
            }

            await FileSystem.writeAsStringAsync(filepath, content);

            console.log(`✅ Logs exportés vers ${filepath}`);
            return filepath;
        } catch (error) {
            console.error('❌ Erreur export fichier logs:', error);
            throw error;
        }
    }

    /**
     * Générer un rapport de diagnostic
     */
    async generateDiagnosticReport(sessionId) {
        try {
            const sessions = await this.getSessions();
            const session = sessions[sessionId];

            if (!session) {
                throw new Error(`Session ${sessionId} introuvable`);
            }

            const report = {
                sessionId: session.sessionId,
                startTime: new Date(session.startTime).toLocaleString('fr-FR'),
                duration: `${(session.duration / 1000 / 60).toFixed(1)} minutes`,
                totalEvents: session.logsCount,
                summary: {
                    gpsPoints: {
                        accepted: 0,
                        rejected: 0,
                        total: 0,
                    },
                    errors: [],
                    heartbeats: {
                        ok: 0,
                        failed: 0,
                    },
                    saves: {
                        success: 0,
                        failed: 0,
                    },
                    trackingEvents: [],
                },
            };

            // Analyser les logs
            session.logs.forEach((log) => {
                switch (log.eventType) {
                    case 'GPS_POINT':
                        report.summary.gpsPoints.total++;
                        if (log.data.status === 'accepted') {
                            report.summary.gpsPoints.accepted++;
                        } else {
                            report.summary.gpsPoints.rejected++;
                        }
                        break;

                    case 'ERROR':
                        report.summary.errors.push({
                            time: new Date(log.timestamp).toLocaleTimeString('fr-FR'),
                            message: log.data.message,
                            context: log.data,
                        });
                        break;

                    case 'HEARTBEAT':
                        if (log.data.status === 'OK') {
                            report.summary.heartbeats.ok++;
                        } else {
                            report.summary.heartbeats.failed++;
                        }
                        break;

                    case 'SAVE':
                        if (log.data.success) {
                            report.summary.saves.success++;
                        } else {
                            report.summary.saves.failed++;
                        }
                        break;

                    case 'TRACKING_EVENT':
                        report.summary.trackingEvents.push({
                            time: new Date(log.timestamp).toLocaleTimeString('fr-FR'),
                            event: log.data.event,
                            details: log.data,
                        });
                        break;
                }
            });

            return report;
        } catch (error) {
            console.error('❌ Erreur génération rapport:', error);
            throw error;
        }
    }
}

// Instance singleton
const trackingLogger = new TrackingLogger();

export default trackingLogger;
