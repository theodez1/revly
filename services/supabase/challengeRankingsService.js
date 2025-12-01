import { supabase } from '../../config/supabase';

/**
 * Service de gestion des classements de défis
 */
class ChallengeRankingsService {
  /**
   * Récupérer les classements d'un défi
   * @param {string} challengeId - ID du défi
   * @returns {Promise<{rankings, error}>}
   */
  async getChallengeRankings(challengeId) {
    try {
      // Mettre à jour les classements avant de les récupérer
      // Les conditions de validation sont maintenant stockées dans la table challenges
      const { error: updateError } = await supabase.rpc('update_challenge_rankings', {
        p_challenge_id: challengeId,
      });

      if (updateError) {
        console.warn('Erreur mise à jour classements défi:', updateError);
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
      const userIds = [...new Set((data || []).map(item => item.user_id))];
      const userProfiles = {};
      
      if (userIds.length > 0) {
        try {
          const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, username, first_name, last_name, avatar_url')
            .in('id', userIds);
          
          if (!usersError && usersData) {
            usersData.forEach(user => {
              userProfiles[user.id] = user;
            });
          }
        } catch (userError) {
          console.warn('Erreur chargement profils utilisateurs:', userError);
        }
      }

      const rankings = (data || []).map(item => {
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
   * @returns {Promise<{ranking, error}>}
   */
  async getUserRanking(challengeId, userId) {
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

      return {
        ranking: {
          userId: data.user_id,
          totalDistance: Number(data.total_distance) || 0,
          totalRides: Number(data.total_rides) || 0,
          maxSpeed: Number(data.max_speed) || 0,
          totalDuration: Number(data.total_duration) || 0,
          rank: Number(data.rank) || 0,
        },
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
   * @returns {Promise<{error}>}
   */
  async refreshChallengeRankings(challengeId, minRideDurationSeconds = 300) {
    try {
      const { error } = await supabase.rpc('update_challenge_rankings', {
        p_challenge_id: challengeId,
        p_min_ride_duration_seconds: minRideDurationSeconds,
      });

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Erreur refreshChallengeRankings:', error);
      return { error };
    }
  }
}

export default new ChallengeRankingsService();
