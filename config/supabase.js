import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Configuration Supabase depuis les variables d'environnement
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase URL ou Anon Key manquants. Configurez-les dans app.json ou .env');
}

// Créer le client Supabase
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    storage: {
      // Utiliser AsyncStorage pour persister la session
      getItem: async (key) => {
        const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
        return await AsyncStorage.getItem(key);
      },
      setItem: async (key, value) => {
        const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
        await AsyncStorage.setItem(key, value);
      },
      removeItem: async (key) => {
        const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
        await AsyncStorage.removeItem(key);
      },
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});







