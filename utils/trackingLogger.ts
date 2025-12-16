import * as FileSystem from 'expo-file-system/legacy';

// Same pattern as in ProfilePhoto: access documentDirectory through `any`
// to avoid TS issues with the expo-file-system type definitions.
const DOCUMENT_DIR: string = ((FileSystem as any).documentDirectory as string) || '';

const LOG_DIR = `${DOCUMENT_DIR}logs/`;
const CURRENT_LOG_FILE = `${LOG_DIR}tracking_${new Date().toISOString().split('T')[0]}.txt`;

class TrackingLogger {
  private static instance: TrackingLogger;

  private constructor() {
    this.ensureLogDirectory();
  }

  static getInstance(): TrackingLogger {
    if (!TrackingLogger.instance) {
      TrackingLogger.instance = new TrackingLogger();
    }
    return TrackingLogger.instance;
  }

  private async ensureLogDirectory() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(LOG_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(LOG_DIR, { intermediates: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  /**
   * Démarre une « session » de tracking logique.
   * Méthode légère ajoutée pour éviter les erreurs TypeScript
   * lorsque le logger est utilisé comme s'il supportait des sessions.
   */
  async startSession(context: any = {}): Promise<void> {
    try {
      await this.log('SESSION_START', context);
    } catch {
      // En cas d'erreur, on ne bloque jamais le reste de l'app
    }
  }

  async log(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message} ${data ? JSON.stringify(data) : ''}\n`;

    try {
      await this.appendLog(logMessage);
      if (__DEV__) {
        console.log(`[Tracking] ${message}`, data || '');
      }
    } catch (error) {
      console.error('Failed to write tracking log:', error);
    }
  }

  private async appendLog(content: string) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(CURRENT_LOG_FILE);
      if (fileInfo.exists) {
        const currentContent = await FileSystem.readAsStringAsync(CURRENT_LOG_FILE);
        await FileSystem.writeAsStringAsync(CURRENT_LOG_FILE, currentContent + content);
      } else {
        await FileSystem.writeAsStringAsync(CURRENT_LOG_FILE, content);
      }
    } catch (error) {
      // Fallback to console if file write fails
      console.warn('Could not write to log file', error);
    }
  }

  async getLogs(): Promise<string> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(CURRENT_LOG_FILE);
      if (fileInfo.exists) {
        return await FileSystem.readAsStringAsync(CURRENT_LOG_FILE);
      }
      return '';
    } catch (error) {
      return `Error reading logs: ${error}`;
    }
  }

  async clearLogs() {
    try {
      await FileSystem.deleteAsync(LOG_DIR, { idempotent: true });
      await this.ensureLogDirectory();
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }
}

export default TrackingLogger.getInstance();

