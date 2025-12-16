import { supabase } from '../../config/supabase';

export interface Challenge {
  id: string;
  title: string;
  description: string | null;
  type: 'speed' | 'count' | 'distance' | string;
  target: number | null;
  startDate: string;
  endDate: string | null;
  daysLeft?: number | null;
  // Champs enrichis côté client
  progress?: number | null;
  bestSpeed?: number | null;
}

export interface ChallengeParticipant {
  id: string;
  name: string;
  avatar: string | null;
  progress: number;
  bestSpeed: number | null;
  updatedAt: string;
}

/**
 * Service de gestion des défis Supabase
 */
class ChallengesService {
  /**
   * Créer un nouveau défi
   * @param {Object} challengeData - {group_id, title, description, type, target_value, start_date, end_date, created_by}
   * @returns {Promise<{challenge: any, error: any}>}
   */
  async createChallenge(challengeData: any): Promise<{ challenge: any; error: any }> {
    try {
      const {
        group_id,
        title,
        description,
        type,
        target_value,
        start_date,
        end_date,
        created_by,
      } = challengeData;

      if (!group_id || !title || !type || !created_by) {
        throw new Error('group_id, title, type et created_by sont requis');
      }

      const { data, error } = await supabase
        .from('challenges')
        .insert({
          group_id,
          title,
          description: description || null,
          type,
          target_value: target_value || null,
          start_date: start_date || new Date().toISOString(),
          end_date: end_date || null,
          created_by,
          // Les conditions de validation sont fixes dans la fonction SQL (1 km, 5 min)
        })
        .select()
        .single();

      if (error) throw error;

      return { challenge: data, error: null };
    } catch (error) {
      console.error('Erreur createChallenge:', error);
      return { challenge: null, error };
    }
  }

  /**
   * Mettre à jour un défi
   * @param {string} id - ID du défi
   * @param {Object} updates - Champs à mettre à jour
   * @returns {Promise<{challenge: any, error: any}>}
   */
  async updateChallenge(id: string, updates: any): Promise<{ challenge: any; error: any }> {
    try {
      const { data, error } = await supabase
        .from('challenges')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return { challenge: data, error: null };
    } catch (error) {
      console.error('Erreur updateChallenge:', error);
      return { challenge: null, error };
    }
  }

  /**
   * Supprimer un défi
   * @param {string} id - ID du défi
   * @returns {Promise<{error: any}>}
   */
  async deleteChallenge(id: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase.from('challenges').delete().eq('id', id);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Erreur deleteChallenge:', error);
      return { error };
    }
  }

  /**
   * Récupérer un défi par ID
   * @param {string} id - ID du défi
   * @returns {Promise<{challenge: any, error: any}>}
   */
  async getChallengeById(id: string): Promise<{ challenge: any; error: any }> {
    try {
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return { challenge: data, error: null };
    } catch (error) {
      console.error('Erreur getChallengeById:', error);
      return { challenge: null, error };
    }
  }

  /**
   * Récupérer les participants d'un défi avec leurs progrès
   * @param {string} challengeId - ID du défi
   * @returns {Promise<{participants: ChallengeParticipant[], error: any}>}
   */
  async getChallengeParticipants(challengeId: string): Promise<{ participants: ChallengeParticipant[]; error: any }> {
    try {
      const { data, error } = await supabase
        .from('challenge_participants')
        .select('*')
        .eq('challenge_id', challengeId)
        .order('progress', { ascending: false });

      if (error) throw error;

      // Charger les profils utilisateur séparément
      const userIds = [...new Set((data || []).map((item: any) => item.user_id))];
      const userProfiles: Record<string, any> = {};

      if (userIds.length > 0) {
        try {
          const { data: usersData } = await supabase
            .from('users')
            .select('id, username, first_name, last_name, avatar_url')
            .in('id', userIds);

          (usersData || []).forEach((user: any) => {
            userProfiles[user.id] = user;
          });
        } catch (userError) {
          console.warn('Erreur chargement profils utilisateurs:', userError);
        }
      }

      const participants = (data || []).map((item: any) => {
        const user = userProfiles[item.user_id];
        return {
          id: item.user_id,
          name: user?.first_name && user?.last_name
            ? `${user.first_name} ${user.last_name}`
            : user?.username || 'Utilisateur',
          avatar: user?.avatar_url || null,
          progress: Number(item.progress) || 0,
          bestSpeed: Number(item.best_speed) || null,
          updatedAt: item.updated_at,
        };
      });

      return { participants, error: null };
    } catch (error) {
      console.error('Erreur getChallengeParticipants:', error);
      return { participants: [], error };
    }
  }

  /**
   * Mettre à jour le progrès d'un participant
   * @param {string} challengeId - ID du défi
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} progressData - {progress, best_speed}
   * @returns {Promise<{participant: any, error: any}>}
   */
  async updateParticipantProgress(challengeId: string, userId: string, progressData: any): Promise<{ participant: any; error: any }> {
    try {
      const { progress, best_speed } = progressData;

      // Vérifier si le participant existe
      const { data: existing } = await supabase
        .from('challenge_participants')
        .select('*')
        .eq('challenge_id', challengeId)
        .eq('user_id', userId)
        .single();

      let result;
      if (existing) {
        // Mettre à jour
        const updates: any = {};
        if (progress !== undefined) updates.progress = progress;
        if (best_speed !== undefined) updates.best_speed = best_speed;

        const { data, error } = await supabase
          .from('challenge_participants')
          .update(updates)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Créer
        const { data, error } = await supabase
          .from('challenge_participants')
          .insert({
            challenge_id: challengeId,
            user_id: userId,
            progress: progress || 0,
            best_speed: best_speed || null,
          })
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      return { participant: result, error: null };
    } catch (error) {
      console.error('Erreur updateParticipantProgress:', error);
      return { participant: null, error };
    }
  }

  /**
   * Récupérer les défis actifs d'un groupe
   * @param {string} groupId - ID du groupe
   * @returns {Promise<{challenges: Challenge[], error: any}>}
   */
  async getActiveChallenges(groupId: string): Promise<{ challenges: Challenge[]; error: any }> {
    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('group_id', groupId)
        .lte('start_date', now)
        .or(`end_date.is.null,end_date.gte.${now}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Formater les défis pour correspondre au format attendu
      const challenges = (data || []).map((challenge: any) => {
        const formatted: Challenge = {
          id: challenge.id,
          title: challenge.title,
          description: challenge.description || null,
          type: challenge.type,
          target: Number(challenge.target_value) || null,
          startDate: challenge.start_date,
          endDate: challenge.end_date,
        };

        // Calculer les jours restants
        if (challenge.end_date) {
          const endDate = new Date(challenge.end_date).getTime();
          const nowTime = new Date().getTime();
          const diffTime = endDate - nowTime;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          formatted.daysLeft = Math.max(0, diffDays);
        } else {
          formatted.daysLeft = null;
        }

        return formatted;
      });

      return { challenges, error: null };
    } catch (error) {
      console.error('Erreur getActiveChallenges:', error);
      return { challenges: [], error };
    }
  }
}

export default new ChallengesService();

