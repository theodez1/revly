import * as FileSystem from 'expo-file-system/legacy';

// Chemin du fichier de log
const LOG_FILE_NAME = 'tracking_logs.txt';
let logFilePath = null;

// Initialiser le chemin du fichier de log
const initLogFilePath = () => {
  if (!logFilePath) {
    logFilePath = `${FileSystem.documentDirectory}${LOG_FILE_NAME}`;
  }
  return logFilePath;
};

// Buffer pour les logs (écrit périodiquement pour éviter trop d'écritures)
let logBuffer = [];
let logBufferTimer = null;
const LOG_BUFFER_MAX = 50; // Écrire quand on atteint 50 logs
const LOG_BUFFER_FLUSH_INTERVAL = 5000; // Ou toutes les 5 secondes

// Écrire le buffer dans le fichier
const flushLogBuffer = async () => {
  if (logBuffer.length === 0) {
    return;
  }

  // Sauvegarder les logs avant de vider le buffer
  const logsToSave = [...logBuffer];
  logBuffer = [];

  try {
    const filePath = initLogFilePath();
    const logsToAppend = logsToSave.join('\n') + '\n';

    // Vérifier si le fichier existe
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      // Lire le contenu existant et ajouter les nouveaux logs
      const existingContent = await FileSystem.readAsStringAsync(filePath);
      // Limiter la taille du fichier (garder seulement les 5000 dernières lignes)
      const allLines = (existingContent + logsToAppend).split('\n');
      const limitedLines = allLines.length > 5000 ? allLines.slice(-5000) : allLines;
      await FileSystem.writeAsStringAsync(filePath, limitedLines.join('\n'));
    } else {
      // Créer le fichier avec les nouveaux logs
      await FileSystem.writeAsStringAsync(filePath, logsToAppend);
    }
  } catch (error) {
    // Fallback vers console si l'écriture échoue
    console.error('[Logger] Erreur écriture fichier:', error);
    logsToSave.forEach(log => console.log(log));
  }
};

// Logger principal
const logger = {
  log: (message, tag = '') => {
    const timestamp = new Date().toISOString();
    const logMessage = tag 
      ? `[${timestamp}] [${tag}] ${message}`
      : `[${timestamp}] ${message}`;
    
    // Toujours log dans la console
    console.log(logMessage);
    
    // Ajouter au buffer pour écriture fichier
    logBuffer.push(logMessage);
    
    // Flush si buffer plein
    if (logBuffer.length >= LOG_BUFFER_MAX) {
      flushLogBuffer();
    }
    
    // Programmer un flush périodique
    if (logBufferTimer) {
      clearTimeout(logBufferTimer);
    }
    logBufferTimer = setTimeout(flushLogBuffer, LOG_BUFFER_FLUSH_INTERVAL);
  },

  error: (message, error, tag = '') => {
    const timestamp = new Date().toISOString();
    const errorMessage = error?.stack || error?.message || String(error);
    const logMessage = tag
      ? `[${timestamp}] [${tag}] ❌ ${message}\n${errorMessage}`
      : `[${timestamp}] ❌ ${message}\n${errorMessage}`;
    
    // Toujours log dans la console
    console.error(logMessage);
    
    // Ajouter au buffer
    logBuffer.push(logMessage);
    
    // Flush immédiat pour les erreurs
    if (logBuffer.length >= 10) {
      flushLogBuffer();
    }
  },

  warn: (message, tag = '') => {
    const timestamp = new Date().toISOString();
    const logMessage = tag
      ? `[${timestamp}] [${tag}] ⚠️ ${message}`
      : `[${timestamp}] ⚠️ ${message}`;
    
    console.warn(logMessage);
    logBuffer.push(logMessage);
    
    if (logBuffer.length >= LOG_BUFFER_MAX) {
      flushLogBuffer();
    }
  },

  // Forcer l'écriture du buffer
  flush: async () => {
    await flushLogBuffer();
  },

  // Lire le fichier de log
  readLogs: async () => {
    try {
      const filePath = initLogFilePath();
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        return await FileSystem.readAsStringAsync(filePath);
      }
      return '';
    } catch (error) {
      console.error('[Logger] Erreur lecture logs:', error);
      return '';
    }
  },

  // Vider le fichier de log
  clearLogs: async () => {
    try {
      const filePath = initLogFilePath();
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      logBuffer = [];
      return true;
    } catch (error) {
      console.error('[Logger] Erreur suppression logs:', error);
      return false;
    }
  },

  // Obtenir le chemin du fichier (pour partage/affichage)
  getLogFilePath: () => {
    const path = initLogFilePath();
    // Log le chemin au démarrage pour faciliter le debug
    console.log('[Logger] 📁 Chemin du fichier de logs:', path);
    return path;
  },

  // Partager les logs (nécessite expo-sharing)
  shareLogs: async () => {
    try {
      const filePath = initLogFilePath();
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        console.log('[Logger] ⚠️ Aucun fichier de log à partager');
        return false;
      }

      // Forcer l'écriture du buffer avant partage
      await flushLogBuffer();

      // Partager via expo-sharing (si disponible)
      const Sharing = await import('expo-sharing').catch(() => null);
      if (Sharing && Sharing.default && await Sharing.default.isAvailableAsync()) {
        await Sharing.default.shareAsync(filePath);
        console.log('[Logger] ✅ Logs partagés');
        return true;
      } else {
        console.log('[Logger] ⚠️ Partage non disponible, chemin:', filePath);
        return false;
      }
    } catch (error) {
      console.error('[Logger] ❌ Erreur partage logs:', error);
      return false;
    }
  },
};

export default logger;

