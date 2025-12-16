import AsyncStorage from '@react-native-async-storage/async-storage';
import challengesService, { Challenge, ChallengeParticipant } from './supabase/challengesService';
import challengeRankingsService from './supabase/challengeRankingsService';
import offlineService from './offlineService';

class ChallengesService {
  static CHALLENGES_KEY = '@challenges';
  static CHALLENGE_PARTICIPANTS_KEY = '@challenge_participants';

  /**
   * Créer un nouveau défi
   * @param {Object} challengeData - {group_id, title, description, type, target_value, start_date, end_date, created_by}
   * @returns {Promise<Object>}
   */
  static async createChallenge(challengeData: any) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        const { challenge, error } = await challengesService.createChallenge(challengeData);
        if (error) {
          console.error('Erreur createChallenge Supabase:', error);
          await offlineService.enqueue('CREATE_CHALLENGE', challengeData);
          return await this._saveLocalChallenge(challengeData);
        }

        await this._addToLocalCache(challenge);
        return challenge;
      } else {
        await offlineService.enqueue('CREATE_CHALLENGE', challengeData);
        return await this._saveLocalChallenge(challengeData);
      }
    } catch (error) {
      console.error('Error creating challenge:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour le progrès d'un participant
   * @param {string} challengeId - ID du défi
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} progressData - {progress, best_speed}
   * @returns {Promise<Object>}
   */
  static async updateChallengeProgress(challengeId: string, userId: string, progressData: any) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        const { participant, error } = await challengesService.updateParticipantProgress(
          challengeId,
          userId,
          progressData
        );
        if (error) {
          console.error('Erreur updateChallengeProgress Supabase:', error);
          await offlineService.enqueue('UPDATE_CHALLENGE_PROGRESS', {
            challengeId,
            userId,
            progressData,
          });
          return await this._updateLocalProgress(challengeId, userId, progressData);
        }

        return participant;
      } else {
        await offlineService.enqueue('UPDATE_CHALLENGE_PROGRESS', {
          challengeId,
          userId,
          progressData,
        });
        return await this._updateLocalProgress(challengeId, userId, progressData);
      }
    } catch (error) {
      console.error('Error updating challenge progress:', error);
      throw error;
    }
  }

  /**
   * Récupérer les défis actifs d'un groupe
   * @param {string} groupId - ID du groupe
   * @returns {Promise<Array>}
   */
  static async getActiveChallenges(groupId: string) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        const { challenges, error } = await challengesService.getActiveChallenges(groupId);
        if (error) {
          console.error('Erreur getActiveChallenges Supabase:', error);
          return await this._getLocalChallenges(groupId);
        }

        // Charger les participants et les classements pour chaque défi
        const challengesWithParticipants = await Promise.all(
          challenges.map(async challenge => {
            const { participants } = await challengesService.getChallengeParticipants(
              challenge.id
            );

            // Charger les classements pour obtenir le leader réel
            let leader: string | null = null;
            let leaderScore: string | number | null = null;
            try {
              const { rankings } = await challengeRankingsService.getChallengeRankings(challenge.id);
              if (rankings && rankings.length > 0) {
                const firstPlace = rankings[0]; // Premier = rank 1
                leader = firstPlace.user?.name || 'Utilisateur';
                
                // Score selon le type de défi
                if (challenge.type === 'distance') {
                  const km = (firstPlace.totalDistance || 0) / 1000;
                  const truncatedKm = Math.trunc(km * 10) / 10;
                  leaderScore = truncatedKm.toFixed(1); // km tronqués à 1 décimale
                } else if (challenge.type === 'speed') {
                  const speed = Number(firstPlace.maxSpeed) || 0;
                  const truncatedSpeed = Math.trunc(speed);
                  leaderScore = truncatedSpeed.toString(); // km/h tronqués à l'entier inférieur
                } else if (challenge.type === 'count') {
                  leaderScore = firstPlace.totalRides;
                }
              }
            } catch (rankingError) {
              console.warn('Erreur chargement classements pour défi', challenge.id, ':', rankingError);
            }

            // Calculer le progrès total et le meilleur speed (fallback si pas de classements)
            const totalProgress = participants.reduce((sum, p) => sum + (p.progress || 0), 0);
            const bestSpeed = participants.reduce(
              (max, p) => Math.max(max, p.bestSpeed || 0),
              0
            );
            const fallbackLeader = participants
              .sort((a, b) => (b.progress || 0) - (a.progress || 0))[0];

            // Pour les défis de type 'count', utiliser le progress du leader (nombre de trajets)
            // Pour les défis de type 'distance', utiliser le totalProgress
            // Pour les défis de type 'speed', progress reste null
            let challengeProgress: any = null;
            if (challenge.type === 'distance') {
              challengeProgress = leaderScore ? parseFloat(String(leaderScore)) * 1000 : totalProgress; // Utiliser le score du leader si disponible
            } else if (challenge.type === 'count' && leaderScore) {
              challengeProgress = leaderScore;
            } else if (challenge.type === 'count' && fallbackLeader) {
              challengeProgress = fallbackLeader.progress || 0;
            }

            return {
              ...challenge,
              participants: participants.length,
              progress: challengeProgress,
              bestSpeed: challenge.type === 'speed' && leaderScore ? parseFloat(String(leaderScore)) : (challenge.type === 'speed' ? bestSpeed : null),
              leader: leader || fallbackLeader?.name || null,
              leaderScore: leaderScore, // Score du leader pour affichage
            };
          })
        );

        await this._cacheChallenges(groupId, challengesWithParticipants);
        return challengesWithParticipants;
      } else {
        return await this._getLocalChallenges(groupId);
      }
    } catch (error) {
      console.error('Error loading active challenges:', error);
      return await this._getLocalChallenges(groupId);
    }
  }

  // ========== Méthodes privées pour le cache local ==========

  static async _getLocalChallenges(groupId: string) {
    try {
      const challengesJson = await AsyncStorage.getItem(
        `${this.CHALLENGES_KEY}_${groupId}`
      );
      if (!challengesJson) return [];
      return JSON.parse(challengesJson);
    } catch (error) {
      console.error('Error loading local challenges:', error);
      return [];
    }
  }

  static async _cacheChallenges(groupId: string, challenges: any[]) {
    try {
      await AsyncStorage.setItem(
        `${this.CHALLENGES_KEY}_${groupId}`,
        JSON.stringify(challenges)
      );
    } catch (error) {
      console.error('Error caching challenges:', error);
    }
  }

  static async _saveLocalChallenge(challengeData: any) {
    const challenges = await this._getLocalChallenges(challengeData.group_id);
    const newChallenge = {
      id: challengeData.id || `local_${Date.now()}`,
      ...challengeData,
      createdAt: new Date().toISOString(),
    };
    challenges.push(newChallenge);
    await this._cacheChallenges(challengeData.group_id, challenges);
    return newChallenge;
  }

  static async _updateLocalProgress(challengeId: string, userId: string, progressData: any) {
    // Cette méthode serait utilisée pour mettre à jour le cache local
    // Pour simplifier, on retourne juste les données
    return {
      challenge_id: challengeId,
      user_id: userId,
      ...progressData,
    };
  }

  static async _addToLocalCache(challenge: any) {
    try {
      const challenges = await this._getLocalChallenges(challenge.group_id);
      const existingIndex = challenges.findIndex((c: any) => c.id === challenge.id);
      if (existingIndex >= 0) {
        challenges[existingIndex] = challenge;
      } else {
        challenges.push(challenge);
      }
      await this._cacheChallenges(challenge.group_id, challenges);
    } catch (error) {
      console.error('Error adding to cache:', error);
    }
  }
}

export default ChallengesService;

