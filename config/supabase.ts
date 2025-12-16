import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuration Supabase depuis les variables d'environnement
// Utilise en priorité les variables Expo publiques (injectées au build),
// puis retombe sur les variables classiques Node si besoin.
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Supabase URL ou Anon Key manquants. Configurez-les dans un fichier .env (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).',
  );
}

// Créer le client Supabase
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Écouter les changements d'état de l'application pour rafraîchir la session si nécessaire
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

