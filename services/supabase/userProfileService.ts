import { supabase } from '../../config/supabase';
import groupsService from './groupsService';

export interface UserProfile {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  bio?: string;
  created_at: string;
}

export interface UserStats {
  totalRides: number;
  totalDistance: number;
}

/**
 * Service pour récupérer les profils d'autres utilisateurs
 */
class UserProfileService {
  /**
   * Obtenir le profil complet d'un utilisateur par son ID
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<{profile: UserProfile|null, error: any}>}
   */
  async getUserProfile(userId: string): Promise<{ profile: UserProfile | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, first_name, last_name, avatar_url, bio, created_at')
        .eq('id', userId)
        .single();

      if (error) throw error;

      return { profile: data as UserProfile, error: null };
    } catch (error) {
      console.error('Erreur getUserProfile:', error);
      return { profile: null, error };
    }
  }

  /**
   * Obtenir les trajets d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {number} limit - Nombre de trajets à récupérer
   * @param {number} offset - Offset pour la pagination
   * @returns {Promise<{rides: Array<any>, error: any}>}
   */
  async getUserRides(userId: string, limit: number = 20, offset: number = 0): Promise<{ rides: any[]; error: any }> {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return { rides: data || [], error: null };
    } catch (error) {
      console.error('Erreur getUserRides:', error);
      return { rides: [], error };
    }
  }

  /**
   * Obtenir les statistiques d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<{stats: UserStats, error: any}>}
   */
  async getUserStats(userId: string): Promise<{ stats: UserStats; error: any }> {
    try {
      // Compter les trajets
      const { count: ridesCount, error: ridesError } = await supabase
        .from('rides')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (ridesError) throw ridesError;

      // Calculer la distance totale
      const { data: ridesData, error: distanceError } = await supabase
        .from('rides')
        .select('distance')
        .eq('user_id', userId);

      if (distanceError) throw distanceError;

      const totalDistance = (ridesData || []).reduce((sum, ride) => sum + (ride.distance || 0), 0);

      return {
        stats: {
          totalRides: ridesCount || 0,
          totalDistance: totalDistance,
        },
        error: null,
      };
    } catch (error) {
      console.error('Erreur getUserStats:', error);
      return {
        stats: { totalRides: 0, totalDistance: 0 },
        error,
      };
    }
  }

  /**
   * Obtenir les groupes d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<{groups: Array<any>, error: any}>}
   */
  async getUserGroups(userId: string): Promise<{ groups: any[]; error: any }> {
    try {
      const { groups, error } = await groupsService.getUserGroups(userId);
      if (error) {
        return { groups: [], error };
      }
      return { groups: groups || [], error: null };
    } catch (error) {
      console.error('Erreur getUserGroups:', error);
      return { groups: [], error };
    }
  }
}

export default new UserProfileService();

