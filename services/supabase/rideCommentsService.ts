import { supabase } from '../../config/supabase';

export interface RideComment {
  id: string;
  content: string;
  createdAt: string;
  author_id: string;
  author: string;
  avatar: string | null;
}

/**
 * Service pour gérer les commentaires sur les trajets (rides)
 */
class RideCommentsService {
    /**
     * Récupérer tous les commentaires d'un trajet
     * @param {string} rideId - ID du trajet
     * @returns {Promise<{comments: RideComment[], error: any}>}
     */
    async getRideComments(rideId: string): Promise<{ comments: RideComment[]; error: any }> {
        try {
            const { data, error } = await supabase
                .from('ride_comments')
                .select(`
          *,
          author:users!author_id (
            id,
            username,
            first_name,
            last_name,
            avatar_url
          )
        `)
                .eq('ride_id', rideId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Formater les commentaires pour l'interface
            const formattedComments: RideComment[] = (data || []).map((comment: any) => {
                const author = comment.author;
                let authorName = 'Utilisateur';

                if (author) {
                    if (author.username) {
                        authorName = author.username;
                    } else if (author.first_name) {
                        authorName = author.first_name;
                        if (author.last_name) {
                            authorName += ` ${author.last_name}`;
                        }
                    }
                }

                return {
                    id: comment.id,
                    content: comment.content || '',
                    createdAt: comment.created_at,
                    author_id: comment.author_id,
                    author: authorName,
                    avatar: author?.avatar_url || null,
                };
            });

            return { comments: formattedComments, error: null };
        } catch (error) {
            console.error('Erreur getRideComments:', error);
            return { comments: [], error };
        }
    }

    /**
     * Créer un commentaire sur un trajet
     * @param {string} rideId - ID du trajet
     * @param {string} authorId - ID de l'auteur
     * @param {string} content - Contenu du commentaire
     * @returns {Promise<{comment: RideComment | null, error: any}>}
     */
    async createRideComment(rideId: string, authorId: string, content: string): Promise<{ comment: RideComment | null; error: any }> {
        try {
            const { data, error } = await supabase
                .from('ride_comments')
                .insert({
                    ride_id: rideId,
                    author_id: authorId,
                    content,
                })
                .select(`
          *,
          author:users!author_id (
            id,
            username,
            first_name,
            last_name,
            avatar_url
          )
        `)
                .single();

            if (error) {
                console.error('❌ Erreur Supabase createRideComment:', error);
                throw error;
            }

            if (!data) {
                console.error('❌ Aucune donnée retournée par Supabase');
                return { comment: null, error: new Error('Aucune donnée retournée') };
            }

            // Formater le commentaire
            const author = data.author;
            let authorName = 'Utilisateur';

            if (author) {
                if (author.username) {
                    authorName = author.username;
                } else if (author.first_name) {
                    authorName = author.first_name;
                    if (author.last_name) {
                        authorName += ` ${author.last_name}`;
                    }
                }
            }

            const formattedComment: RideComment = {
                id: data.id,
                content: data.content || '',
                createdAt: data.created_at,
                author_id: data.author_id,
                author: authorName,
                avatar: author?.avatar_url || null,
            };


            return { comment: formattedComment, error: null };
        } catch (error) {
            console.error('Erreur createRideComment:', error);
            return { comment: null, error };
        }
    }

    /**
     * Supprimer un commentaire (seulement par l'auteur)
     * @param {string} commentId - ID du commentaire
     * @param {string} authorId - ID de l'auteur (pour vérification)
     * @returns {Promise<{error: any}>}
     */
    async deleteRideComment(commentId: string, authorId: string): Promise<{ error: any }> {
        try {
            const { error } = await supabase
                .from('ride_comments')
                .delete()
                .eq('id', commentId)
                .eq('author_id', authorId);

            if (error) throw error;
            return { error: null };
        } catch (error) {
            console.error('Erreur deleteRideComment:', error);
            return { error };
        }
    }

    /**
     * Compter le nombre de commentaires sur un trajet
     * @param {string} rideId - ID du trajet
     * @returns {Promise<{count: number, error: any}>}
     */
    async getRideCommentsCount(rideId: string): Promise<{ count: number; error: any }> {
        try {
            const { count, error } = await supabase
                .from('ride_comments')
                .select('*', { count: 'exact', head: true })
                .eq('ride_id', rideId);

            if (error) throw error;
            return { count: count || 0, error: null };
        } catch (error) {
            console.error('Erreur getRideCommentsCount:', error);
            return { count: 0, error };
        }
    }
}

export default new RideCommentsService();

