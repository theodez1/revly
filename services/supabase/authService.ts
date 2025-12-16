import { supabase } from '../../config/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Session, User } from '@supabase/supabase-js';

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: any;
}

export interface ProfileUpdates {
  username?: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  premium_until?: string;
}

/**
 * Service d'authentification Supabase
 */
class AuthService {
  /**
   * Inscription d'un nouvel utilisateur
   * @param {string} email 
   * @param {string} password 
   * @param {Object} profile - {username, firstName, lastName}
   * @returns {Promise<{user, session, error}>}
   */
  async signUp(email: string, password: string, profile: any = {}): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: profile.username || `user_${Date.now()}`,
            first_name: profile.firstName || '',
            last_name: profile.lastName || '',
          },
        },
      });

      if (error) throw error;

      return { user: data.user, session: data.session, error: null };
    } catch (error) {
      console.error('Erreur signup:', error);
      return { user: null, session: null, error };
    }
  }

  /**
   * Connexion d'un utilisateur
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<{user, session, error}>}
   */
  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return { user: data.user, session: data.session, error: null };
    } catch (error) {
      console.error('Erreur signin:', error);
      return { user: null, session: null, error };
    }
  }

  /**
   * Déconnexion
   * @returns {Promise<{error}>}
   */
  async signOut(): Promise<{ error: any }> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Erreur signout:', error);
      return { error };
    }
  }

  /**
   * Obtenir l'utilisateur actuellement connecté
   * @returns {Promise<{user, error}>}
   */
  async getCurrentUser(): Promise<{ user: User | null; error: any }> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return { user, error: null };
    } catch (error) {
      console.error('Erreur getCurrentUser:', error);
      return { user: null, error };
    }
  }

  /**
   * Obtenir la session actuelle
   * @returns {Promise<{session, error}>}
   */
  async getSession(): Promise<{ session: Session | null; error: any }> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return { session, error: null };
    } catch (error) {
      console.error('Erreur getSession:', error);
      return { session: null, error };
    }
  }

  /**
   * Obtenir le profil complet de l'utilisateur
   * @param {string} userId 
   * @returns {Promise<{profile, error}>}
   */
  async getProfile(userId: string): Promise<{ profile: any; error: any }> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      return { profile: data, error: null };
    } catch (error) {
      console.error('Erreur getProfile:', error);
      return { profile: null, error };
    }
  }

  /**
   * Mettre à jour le profil utilisateur
   * @param {string} userId 
   * @param {Object} updates - {username, firstName, lastName, bio, premium_until}
   * @returns {Promise<{profile, error}>}
   */
  async updateProfile(userId: string, updates: ProfileUpdates): Promise<{ profile: any; error: any }> {
    try {
      const updateData: any = {};
      if (updates.username) updateData.username = updates.username;
      if (updates.firstName !== undefined) updateData.first_name = updates.firstName;
      if (updates.lastName !== undefined) updateData.last_name = updates.lastName;
      if (updates.bio !== undefined) updateData.bio = updates.bio;
      if (updates.premium_until !== undefined) updateData.premium_until = updates.premium_until;

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      return { profile: data, error: null };
    } catch (error) {
      console.error('Erreur updateProfile:', error);
      return { profile: null, error };
    }
  }

  /**
   * Upload d'un avatar
   * @param {string} userId 
   * @param {string} photoUri - URI locale de la photo
   * @returns {Promise<{url, error}>}
   */
  async uploadAvatar(userId: string, photoUri: string): Promise<{ url: string | null; error: any }> {
    try {
      // Lire le fichier en base64
      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: 'base64',
      });

      // Déterminer l'extension du fichier
      const ext = photoUri.split('.').pop()?.toLowerCase() || 'jpg';
      const contentType = ext === 'png' ? 'image/png' :
        ext === 'webp' ? 'image/webp' : 'image/jpeg';

      const fileName = `${userId}/avatar.${ext}`;

      // Supprimer l'ancien avatar s'il existe
      await supabase.storage
        .from('avatars')
        .remove([fileName]);

      // Upload du nouveau fichier
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, decode(base64), {
          contentType,
          upsert: true,
        });

      if (error) throw error;

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Mettre à jour le profil avec la nouvelle URL
      await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      return { url: publicUrl, error: null };
    } catch (error) {
      console.error('Erreur uploadAvatar:', error);
      return { url: null, error };
    }
  }

  /**
   * Écouter les changements d'état d'authentification
   * @param {Function} callback - Fonction appelée lors des changements (session)
   * @returns {Object} - Objet avec méthode unsubscribe()
   */
  onAuthStateChange(callback: (session: Session | null) => void) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        callback(session);
      }
    );

    return {
      unsubscribe: () => subscription.unsubscribe(),
    };
  }

  /**
   * Réinitialisation du mot de passe
   * @param {string} email 
   * @returns {Promise<{error}>}
   */
  async resetPassword(email: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Erreur resetPassword:', error);
      return { error };
    }
  }

  /**
   * Mise à jour du mot de passe
   * @param {string} newPassword 
   * @returns {Promise<{error}>}
   */
  async updatePassword(newPassword: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Erreur updatePassword:', error);
      return { error };
    }
  }
}

export default new AuthService();

