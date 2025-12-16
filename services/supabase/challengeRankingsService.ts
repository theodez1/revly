import { supabase } from '../../config/supabase';

export interface ChallengeRanking {
  userId: string;
  user: {
    id: string;
    name: string;
    avatar: string | null;
  };
  totalDistance: number;
  totalRides: number;
  maxSpeed: number;
  totalDuration: number;
  rank: number;
  challenge?: {
    id: string;
    type: string;
    title: string;
    startDate: string;
    endDate: string | null;
  };
}

/**
 * Service de gestion des classements de défis
 */
class ChallengeRankingsService {
  /**
   * Récupérer les classements d'un défi
   * @param {string} challengeId - ID du défi
   * @returns {Promise<{rankings: ChallengeRanking[], error: any}>}
   */
  async getChallengeRankings(challengeId: string): Promise<{ rankings: ChallengeRanking[]; error: any }> {
    try {
      // Mettre à jour les classements avant de les récupérer
      // Les conditions de validation sont maintenant stockées dans la table challenges
      const { error: updateError } = await supabase.rpc('update_challenge_rankings', {
        p_challenge_id: challengeId,
      });

      if (updateError) {
        // Ignorer l'erreur de contrainte unique (23505) - l'enregistrement existe déjà
        if (updateError.code === '23505') {
          // L'enregistrement existe déjà, ce n'est pas une erreur critique
          // La fonction RPC devrait utiliser UPSERT mais on gère cette erreur ici
        } else {
          console.warn('Erreur mise à jour classements défi:', updateError);
        }
      }

      // Récupérer les classements
      const { data, error } = await supabase
        .from('challenge_rankings')
        .select(`
          *,
          challenge:challenges!inner(
            id,
            type,
            title,
            start_date,
            end_date
          )
        `)
        .eq('challenge_id', challengeId)
        .order('rank', { ascending: true });

      if (error) throw error;

      // Charger les profils utilisateur séparément
      const userIds = [...new Set((data || []).map((item: any) => item.user_id))];
      const userProfiles: Record<string, any> = {};

      if (userIds.length > 0) {
        try {
          const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, username, first_name, last_name, avatar_url')
            .in('id', userIds);

          if (!usersError && usersData) {
            usersData.forEach((user: any) => {
              userProfiles[user.id] = user;
            });
          }
        } catch (userError) {
          console.warn('Erreur chargement profils utilisateurs:', userError);
        }
      }

      const rankings: ChallengeRanking[] = (data || []).map((item: any) => {
        const user = userProfiles[item.user_id];
        return {
          userId: item.user_id,
          user: {
            id: item.user_id,
            name: user?.first_name && user?.last_name
              ? `${user.first_name} ${user.last_name}`
              : user?.username || 'Utilisateur',
            avatar: user?.avatar_url || null,
          },
          totalDistance: Number(item.total_distance) || 0,
          totalRides: Number(item.total_rides) || 0,
          maxSpeed: Number(item.max_speed) || 0,
          totalDuration: Number(item.total_duration) || 0,
          rank: Number(item.rank) || 0,
          challenge: {
            id: item.challenge.id,
            type: item.challenge.type,
            title: item.challenge.title,
            startDate: item.challenge.start_date,
            endDate: item.challenge.end_date,
          },
        };
      });

      return { rankings, error: null };
    } catch (error) {
      console.error('Erreur getChallengeRankings:', error);
      return { rankings: [], error };
    }
  }

  /**
   * Récupérer le classement d'un utilisateur pour un défi
   * @param {string} challengeId - ID du défi
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<{ranking: ChallengeRanking | null, error: any}>}
   */
  async getUserRanking(challengeId: string, userId: string): Promise<{ ranking: ChallengeRanking | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('challenge_rankings')
        .select('*')
        .eq('challenge_id', challengeId)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Pas de classement trouvé
          return { ranking: null, error: null };
        }
        throw error;
      }

      // We need to construct a partial ranking object because user profile is not fetched here
      // This is a limitation of the original JS code logic or usage.
      // Assuming the caller might fetch user profile or it's not needed for this specific call context.
      // But to satisfy the interface, we'd need user info.
      // Let's modify the interface or fetch user info. Fetching seems safer.

      let userProfile = { id: userId, name: 'Utilisateur', avatar: null };
      try {
          const { data: userData } = await supabase
            .from('users')
            .select('id, username, first_name, last_name, avatar_url')
            .eq('id', userId)
            .single();
          
          if(userData) {
             userProfile = {
                id: userData.id,
                name: userData.first_name && userData.last_name
                  ? `${userData.first_name} ${userData.last_name}`
                  : userData.username || 'Utilisateur',
                avatar: userData.avatar_url
             };
          }
      } catch (e) {
          // ignore
      }

      const ranking: ChallengeRanking = {
          userId: data.user_id,
          user: userProfile,
          totalDistance: Number(data.total_distance) || 0,
          totalRides: Number(data.total_rides) || 0,
          maxSpeed: Number(data.max_speed) || 0,
          totalDuration: Number(data.total_duration) || 0,
          rank: Number(data.rank) || 0,
      };

      return {
        ranking,
        error: null,
      };
    } catch (error) {
      console.error('Erreur getUserRanking:', error);
      return { ranking: null, error };
    }
  }

  /**
   * Forcer la mise à jour des classements d'un défi
   * @param {string} challengeId - ID du défi
   * @param {number} minRideDurationSeconds - Durée minimale (défaut: 300)
   * @returns {Promise<{error: any}>}
   */
  async refreshChallengeRankings(challengeId: string, minRideDurationSeconds: number = 300): Promise<{ error: any }> {
    try {
      const { error } = await supabase.rpc('update_challenge_rankings', {
        p_challenge_id: challengeId,
        p_min_ride_duration_seconds: minRideDurationSeconds,
      });

      if (error) {
        // Ignorer l'erreur de contrainte unique (23505) - l'enregistrement existe déjà
        if (error.code === '23505') {
          // L'enregistrement existe déjà, ce n'est pas une erreur critique
          return { error: null };
        }
        throw error;
      }

      return { error: null };
    } catch (error) {
      console.error('Erreur refreshChallengeRankings:', error);
      return { error };
    }
  }
}

export default new ChallengeRankingsService();

