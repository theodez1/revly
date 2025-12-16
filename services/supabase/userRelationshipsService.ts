import { supabase } from '../../config/supabase';

export interface UserFollow {
  userId: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  followedAt: string;
}

export interface FollowStats {
  followingCount: number;
  followersCount: number;
}

/**
 * Service de gestion des relations utilisateurs (follows, followers)
 */
class UserRelationshipsService {
    /**
     * Suivre un utilisateur
     * @param {string} followerId - ID de l'utilisateur qui suit
     * @param {string} followingId - ID de l'utilisateur suivi
     * @returns {Promise<{success: boolean, error: any}>}
     */
    async followUser(followerId: string, followingId: string): Promise<{ success: boolean; error: any }> {
        try {
            if (followerId === followingId) {
                return { success: false, error: 'Cannot follow yourself' };
            }

            const { error } = await supabase
                .from('user_follows')
                .insert({
                    follower_id: followerId,
                    following_id: followingId
                });

            if (error) throw error;

            return { success: true, error: null };
        } catch (error) {
            console.error('Erreur followUser:', error);
            return { success: false, error };
        }
    }

    /**
     * Ne plus suivre un utilisateur
     * @param {string} followerId - ID de l'utilisateur qui suit
     * @param {string} followingId - ID de l'utilisateur suivi
     * @returns {Promise<{success: boolean, error: any}>}
     */
    async unfollowUser(followerId: string, followingId: string): Promise<{ success: boolean; error: any }> {
        try {
            const { error } = await supabase
                .from('user_follows')
                .delete()
                .eq('follower_id', followerId)
                .eq('following_id', followingId);

            if (error) throw error;

            return { success: true, error: null };
        } catch (error) {
            console.error('Erreur unfollowUser:', error);
            return { success: false, error };
        }
    }

    /**
     * Obtenir la liste des utilisateurs suivis par un utilisateur
     * @param {string} userId - ID de l'utilisateur
     * @returns {Promise<{following: UserFollow[], error: any}>}
     */
    async getFollowing(userId: string): Promise<{ following: UserFollow[]; error: any }> {
        try {
            const { data, error } = await supabase
                .from('user_follows')
                .select(`
          following_id,
          created_at,
          following:users!following_id (
            id,
            username,
            first_name,
            last_name,
            avatar_url
          )
        `)
                .eq('follower_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const following: UserFollow[] = (data || []).map((item: any) => ({
                userId: item.following_id,
                username: item.following.username,
                fullName: `${item.following.first_name} ${item.following.last_name}`.trim(),
                avatarUrl: item.following.avatar_url,
                followedAt: item.created_at
            }));

            return { following, error: null };
        } catch (error) {
            console.error('Erreur getFollowing:', error);
            return { following: [], error };
        }
    }

    /**
     * Obtenir la liste des followers d'un utilisateur
     * @param {string} userId - ID de l'utilisateur
     * @returns {Promise<{followers: UserFollow[], error: any}>}
     */
    async getFollowers(userId: string): Promise<{ followers: UserFollow[]; error: any }> {
        try {
            const { data, error } = await supabase
                .from('user_follows')
                .select(`
          follower_id,
          created_at,
          follower:users!follower_id (
            id,
            username,
            first_name,
            last_name,
            avatar_url
          )
        `)
                .eq('following_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const followers: UserFollow[] = (data || []).map((item: any) => ({
                userId: item.follower_id,
                username: item.follower.username,
                fullName: `${item.follower.first_name} ${item.follower.last_name}`.trim(),
                avatarUrl: item.follower.avatar_url,
                followedAt: item.created_at
            }));

            return { followers, error: null };
        } catch (error) {
            console.error('Erreur getFollowers:', error);
            return { followers: [], error };
        }
    }

    /**
     * Vérifier si un utilisateur suit un autre
     * @param {string} followerId - ID de l'utilisateur qui suit
     * @param {string} followingId - ID de l'utilisateur suivi
     * @returns {Promise<{isFollowing: boolean, error: any}>}
     */
    async isFollowing(followerId: string, followingId: string): Promise<{ isFollowing: boolean; error: any }> {
        try {
            const { data, error } = await supabase
                .from('user_follows')
                .select('id')
                .eq('follower_id', followerId)
                .eq('following_id', followingId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                throw error;
            }

            return { isFollowing: !!data, error: null };
        } catch (error) {
            console.error('Erreur isFollowing:', error);
            return { isFollowing: false, error };
        }
    }

    /**
     * Obtenir les statistiques de follow d'un utilisateur
     * @param {string} userId - ID de l'utilisateur
     * @returns {Promise<{stats: FollowStats, error: any}>}
     */
    async getFollowStats(userId: string): Promise<{ stats: FollowStats; error: any }> {
        try {
            const [followingResult, followersResult] = await Promise.all([
                supabase
                    .from('user_follows')
                    .select('id', { count: 'exact', head: true })
                    .eq('follower_id', userId),
                supabase
                    .from('user_follows')
                    .select('id', { count: 'exact', head: true })
                    .eq('following_id', userId)
            ]);

            if (followingResult.error) throw followingResult.error;
            if (followersResult.error) throw followersResult.error;

            const stats = {
                followingCount: followingResult.count || 0,
                followersCount: followersResult.count || 0
            };

            return { stats, error: null };
        } catch (error) {
            console.error('Erreur getFollowStats:', error);
            return { stats: { followingCount: 0, followersCount: 0 }, error };
        }
    }

    /**
     * Obtenir les IDs des utilisateurs suivis (pour le feed algorithm)
     * @param {string} userId - ID de l'utilisateur
     * @returns {Promise<{followingIds: string[], error: any}>}
     */
    async getFollowingIds(userId: string): Promise<{ followingIds: string[]; error: any }> {
        try {
            const { data, error } = await supabase
                .from('user_follows')
                .select('following_id')
                .eq('follower_id', userId);

            if (error) throw error;

            const followingIds = (data || []).map((item: any) => item.following_id);

            return { followingIds, error: null };
        } catch (error) {
            console.error('Erreur getFollowingIds:', error);
            return { followingIds: [], error };
        }
    }

    /**
     * Toggle follow/unfollow
     * @param {string} followerId - ID de l'utilisateur qui suit
     * @param {string} followingId - ID de l'utilisateur suivi
     * @returns {Promise<{isFollowing: boolean, error: any}>}
     */
    async toggleFollow(followerId: string, followingId: string): Promise<{ isFollowing: boolean; error: any }> {
        try {
            const { isFollowing } = await this.isFollowing(followerId, followingId);

            if (isFollowing) {
                await this.unfollowUser(followerId, followingId);
                return { isFollowing: false, error: null };
            } else {
                await this.followUser(followerId, followingId);
                return { isFollowing: true, error: null };
            }
        } catch (error) {
            console.error('Erreur toggleFollow:', error);
            return { isFollowing: false, error };
        }
    }
}

export default new UserRelationshipsService();

