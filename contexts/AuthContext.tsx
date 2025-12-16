import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import authService from '../services/supabase/authService';
import { clearProfilePhotoCache } from '../services/ProfilePhoto';

export interface UserProfile {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  premium_until?: string;
  bio?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  isPremium: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, profileData?: any) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

/**
 * Context d'authentification global
 */
const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  isAuthenticated: false,
  isPremium: false,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => ({ error: null }),
  refreshProfile: async () => {},
  resetPassword: async () => ({ error: null }),
});

/**
 * Hook pour utiliser le context d'authentification
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

/**
 * Provider d'authentification
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Charger le profil utilisateur
   */
  const loadProfile = async (userId: string) => {
    try {
      const { profile: loadedProfile, error } = await authService.getProfile(userId);
      if (error) {
        console.error('Erreur chargement profil:', error);
        return null;
      }
      setProfile(loadedProfile);
      return loadedProfile;
    } catch (error) {
      console.error('Erreur loadProfile:', error);
      return null;
    }
  };

  /**
   * Initialiser la session au démarrage
   */
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Vérifier s'il y a une session active
        const { session: currentSession } = await authService.getSession();

        if (currentSession?.user) {
          setUser(currentSession.user);
          setSession(currentSession);

          // ⚡ OPTIMISATION: Ne pas attendre le profil pour débloquer l'UI
          // On lance le chargement en arrière-plan
          loadProfile(currentSession.user.id).catch(err =>
            console.error('Erreur chargement profil background:', err)
          );

          // Données chargées à la demande par chaque écran
        }
      } catch (error) {
        console.error('Erreur initialisation auth:', error);
      } finally {
        // On débloque l'UI immédiatement après avoir vérifié la session locale
        setLoading(false);
      }
    };

    initAuth();

    // Écouter les changements d'authentification
    const { unsubscribe } = authService.onAuthStateChange(async (newSession: Session | null) => {


      const newUserId = newSession?.user?.id;
      const currentUserId = user?.id;

      // Si on change d'utilisateur (nouveau compte différent de l'ancien), vider le cache
      if (currentUserId && newUserId && currentUserId !== newUserId) {

        try {
          await clearProfilePhotoCache(currentUserId);

        } catch (cacheError) {
          console.warn('⚠️ Erreur vidage cache lors changement utilisateur:', cacheError);
        }
      }

      setSession(newSession);
      setUser(newSession?.user || null);

      if (newSession?.user) {
        await loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Connexion
   */
  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { user: signedUser, session: signedSession, error } = await authService.signIn(email, password);

      if (error) {
        return { error };
      }

      setUser(signedUser);
      setSession(signedSession);

      if (signedUser) {
        await loadProfile(signedUser.id);
      }

      return { error: null };
    } catch (error) {
      console.error('Erreur signIn:', error);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Inscription
   */
  const signUp = async (email: string, password: string, profileData: any) => {
    try {
      setLoading(true);
      const { user: newUser, session: newSession, error } = await authService.signUp(
        email,
        password,
        profileData
      );

      if (error) {
        return { error };
      }

      setUser(newUser);
      setSession(newSession);

      if (newUser) {
        await loadProfile(newUser.id);
      }

      return { error: null };
    } catch (error) {
      console.error('Erreur signUp:', error);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Déconnexion
   */
  const signOut = async () => {
    try {
      setLoading(true);

      // Vider le cache de la photo de profil avant de déconnecter
      if (user?.id) {
        try {
          await clearProfilePhotoCache(user.id);

        } catch (cacheError) {
          console.warn('⚠️ Erreur vidage cache photo:', cacheError);
        }
      }

      const { error } = await authService.signOut();

      if (error) {
        return { error };
      }

      setUser(null);
      setSession(null);
      setProfile(null);

      return { error: null };
    } catch (error) {
      console.error('Erreur signOut:', error);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Rafraîchir le profil
   */
  const refreshProfile = async () => {
    if (!user) return;
    await loadProfile(user.id);
  };

  /**
   * Réinitialiser le mot de passe
   */
  const resetPassword = async (email: string) => {
    try {
      const { error } = await authService.resetPassword(email);
      if (error) {
        return { error };
      }
      return { error: null };
    } catch (error) {
      console.error('Erreur resetPassword:', error);
      return { error };
    }
  };

  const isPremium = useMemo(() => {
    if (!profile || !profile.premium_until) return false;
    const ts = new Date(profile.premium_until).getTime();
    return Number.isFinite(ts) && Date.now() < ts;
  }, [profile]);

  const value = {
    user,
    session,
    profile,
    isPremium,
    loading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

