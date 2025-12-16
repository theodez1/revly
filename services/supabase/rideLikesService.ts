import { supabase } from '../../config/supabase';

class RideLikesService {
    /**
     * Toggle like on a ride
     * @param {string} rideId - The ride ID
     * @param {string} userId - The user ID
     * @returns {Promise<{liked: boolean, count: number, error: any}>}
     */
    async toggleLike(rideId: string, userId: string): Promise<{ liked: boolean; count: number; error: any }> {
        try {
            // Check if already liked
            const { data: existingLike, error: checkError } = await supabase
                .from('ride_likes')
                .select('id')
                .eq('ride_id', rideId)
                .eq('user_id', userId)
                .single();

            if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
                throw checkError;
            }

            let liked = false;

            if (existingLike) {
                // Unlike
                const { error: deleteError } = await supabase
                    .from('ride_likes')
                    .delete()
                    .eq('id', existingLike.id);

                if (deleteError) throw deleteError;
                liked = false;
            } else {
                // Like
                const { error: insertError } = await supabase
                    .from('ride_likes')
                    .insert({
                        ride_id: rideId,
                        user_id: userId
                    });

                if (insertError) throw insertError;
                liked = true;
            }

            // Get updated count
            const { count, error: countError } = await supabase
                .from('ride_likes')
                .select('*', { count: 'exact', head: true })
                .eq('ride_id', rideId);

            if (countError) throw countError;

            return { liked, count: count || 0, error: null };
        } catch (error) {
            console.error('Error toggling like:', error);
            return { liked: false, count: 0, error };
        }
    }

    /**
     * Check if user has liked a ride
     * @param {string} rideId 
     * @param {string} userId 
     * @returns {Promise<boolean>}
     */
    async hasLiked(rideId: string, userId: string): Promise<boolean> {
        try {
            const { data, error } = await supabase
                .rpc('has_liked_ride', {
                    p_ride_id: rideId,
                    p_user_id: userId
                });

            if (error) throw error;
            return !!data;
        } catch (error) {
            console.error('Error checking like status:', error);
            return false;
        }
    }

    /**
     * Get likes count for a ride
     * @param {string} rideId 
     * @returns {Promise<number>}
     */
    async getLikesCount(rideId: string): Promise<number> {
        try {
            const { count, error } = await supabase
                .from('ride_likes')
                .select('*', { count: 'exact', head: true })
                .eq('ride_id', rideId);

            if (error) throw error;
            return count || 0;
        } catch (error) {
            console.error('Error getting likes count:', error);
            return 0;
        }
    }
}

export default new RideLikesService();

