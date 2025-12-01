import { supabase } from '../../config/supabase';

/**
 * Service de gestion des posts, likes et commentaires Supabase
 */
class PostsService {
  /**
   * Créer un nouveau post
   * @param {Object} postData - {group_id, author_id, title, content, type}
   * @returns {Promise<{post, error}>}
   */
  async createPost(postData) {
    try {
      const { group_id, author_id, title, content, type } = postData;

      if (!group_id || !author_id || !content) {
        throw new Error('group_id, author_id et content sont requis');
      }

      const { data, error } = await supabase
        .from('group_posts')
        .insert({
          group_id,
          author_id,
          title: title || null,
          content,
          type: type || 'Discussion',
        })
        .select('*')
        .single();

      if (error) throw error;

      // Charger le profil de l'auteur séparément
      let author = null;
      try {
        const { data: authorData } = await supabase
          .from('users')
          .select('id, username, first_name, last_name, avatar_url')
          .eq('id', data.author_id)
          .single();
        author = authorData;
      } catch (authorError) {
        console.warn('Erreur chargement profil auteur:', authorError);
      }

      const post = this._formatPost({ ...data, author });
      return { post, error: null };
    } catch (error) {
      console.error('Erreur createPost:', error);
      return { post: null, error };
    }
  }

  /**
   * Mettre à jour un post
   * @param {string} id - ID du post
   * @param {Object} updates - Champs à mettre à jour
   * @returns {Promise<{post, error}>}
   */
  async updatePost(id, updates) {
    try {
      const { data, error } = await supabase
        .from('group_posts')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;

      // Charger le profil de l'auteur séparément
      let author = null;
      try {
        const { data: authorData } = await supabase
          .from('users')
          .select('id, username, first_name, last_name, avatar_url')
          .eq('id', data.author_id)
          .single();
        author = authorData;
      } catch (authorError) {
        console.warn('Erreur chargement profil auteur:', authorError);
      }

      return { post: this._formatPost({ ...data, author }), error: null };
    } catch (error) {
      console.error('Erreur updatePost:', error);
      return { post: null, error };
    }
  }

  /**
   * Supprimer un post
   * @param {string} id - ID du post
   * @returns {Promise<{error}>}
   */
  async deletePost(id) {
    try {
      const { error } = await supabase.from('group_posts').delete().eq('id', id);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Erreur deletePost:', error);
      return { error };
    }
  }

  /**
   * Récupérer un post par ID avec toutes ses interactions
   * @param {string} id - ID du post
   * @returns {Promise<{post, error}>}
   */
  async getPostById(id) {
    try {
      const { data, error } = await supabase
        .from('group_posts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Charger le profil de l'auteur séparément
      let author = null;
      try {
        const { data: authorData } = await supabase
          .from('users')
          .select('id, username, first_name, last_name, avatar_url')
          .eq('id', data.author_id)
          .single();
        author = authorData;
      } catch (authorError) {
        console.warn('Erreur chargement profil auteur:', authorError);
      }

      const post = this._formatPost({ ...data, author });

      // Charger les likes et commentaires
      const [likesResult, commentsResult] = await Promise.all([
        this.getPostLikes(id),
        this.getPostComments(id),
      ]);

      post.likes = likesResult.likes || [];
      post.likesCount = post.likes.length;
      post.comments = commentsResult.comments || [];
      post.commentsCount = post.comments.length;

      return { post, error: null };
    } catch (error) {
      console.error('Erreur getPostById:', error);
      return { post: null, error };
    }
  }

  /**
   * Récupérer les likes d'un post
   * @param {string} postId - ID du post
   * @returns {Promise<{likes, error}>}
   */
  async getPostLikes(postId) {
    try {
      const { data, error } = await supabase
        .from('post_likes')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Charger les profils utilisateur séparément
      const userIds = [...new Set((data || []).map(like => like.user_id))];
      const userProfiles = {};
      
      if (userIds.length > 0) {
        try {
          const { data: usersData } = await supabase
            .from('users')
            .select('id, username, first_name, last_name, avatar_url')
            .in('id', userIds);
          
          (usersData || []).forEach(user => {
            userProfiles[user.id] = user;
          });
        } catch (userError) {
          console.warn('Erreur chargement profils utilisateurs:', userError);
        }
      }

      const likes = (data || []).map(like => {
        const user = userProfiles[like.user_id];
        return {
          id: like.id,
          userId: like.user_id,
          userName: user?.first_name && user?.last_name
            ? `${user.first_name} ${user.last_name}`
            : user?.username || 'Utilisateur',
          createdAt: like.created_at,
        };
      });

      return { likes, error: null };
    } catch (error) {
      console.error('Erreur getPostLikes:', error);
      return { likes: [], error };
    }
  }

  /**
   * Ajouter ou retirer un like sur un post
   * @param {string} postId - ID du post
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<{liked, error}>}
   */
  async toggleLike(postId, userId) {
    try {
      // Vérifier si l'utilisateur a déjà liké
      const { data: existing } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        // Retirer le like
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('id', existing.id);

        if (error) throw error;
        return { liked: false, error: null };
      } else {
        // Ajouter le like
        const { error } = await supabase.from('post_likes').insert({
          post_id: postId,
          user_id: userId,
        });

        if (error) throw error;
        return { liked: true, error: null };
      }
    } catch (error) {
      console.error('Erreur toggleLike:', error);
      return { liked: false, error };
    }
  }

  /**
   * Récupérer les commentaires d'un post
   * @param {string} postId - ID du post
   * @returns {Promise<{comments, error}>}
   */
  async getPostComments(postId) {
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Charger les profils des auteurs séparément
      const authorIds = [...new Set((data || []).map(comment => comment.author_id))];
      const authorProfiles = {};
      
      if (authorIds.length > 0) {
        try {
          const { data: authorsData } = await supabase
            .from('users')
            .select('id, username, first_name, last_name, avatar_url')
            .in('id', authorIds);
          
          (authorsData || []).forEach(author => {
            authorProfiles[author.id] = author;
          });
        } catch (authorError) {
          console.warn('Erreur chargement profils auteurs:', authorError);
        }
      }

      const comments = (data || []).map(comment => {
        const author = authorProfiles[comment.author_id];
        return {
          id: comment.id,
          author: author?.first_name && author?.last_name
            ? `${author.first_name} ${author.last_name}`
            : author?.username || 'Utilisateur',
          avatar: author?.avatar_url || null,
          content: comment.content,
          createdAt: comment.created_at,
          updatedAt: comment.updated_at,
        };
      });

      return { comments, error: null };
    } catch (error) {
      console.error('Erreur getPostComments:', error);
      return { comments: [], error };
    }
  }

  /**
   * Créer un commentaire
   * @param {Object} commentData - {post_id, author_id, content}
   * @returns {Promise<{comment, error}>}
   */
  async createComment(commentData) {
    try {
      const { post_id, author_id, content } = commentData;

      if (!post_id || !author_id || !content) {
        throw new Error('post_id, author_id et content sont requis');
      }

      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          post_id,
          author_id,
          content,
        })
        .select('*')
        .single();

      if (error) throw error;

      // Charger le profil de l'auteur séparément
      let author = null;
      try {
        const { data: authorData } = await supabase
          .from('users')
          .select('id, username, first_name, last_name, avatar_url')
          .eq('id', data.author_id)
          .single();
        author = authorData;
      } catch (authorError) {
        console.warn('Erreur chargement profil auteur:', authorError);
      }

      const comment = {
        id: data.id,
        author: author?.first_name && author?.last_name
          ? `${author.first_name} ${author.last_name}`
          : author?.username || 'Utilisateur',
        avatar: author?.avatar_url || null,
        content: data.content,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      return { comment, error: null };
    } catch (error) {
      console.error('Erreur createComment:', error);
      return { comment: null, error };
    }
  }

  /**
   * Mettre à jour un commentaire
   * @param {string} id - ID du commentaire
   * @param {Object} updates - Champs à mettre à jour
   * @returns {Promise<{comment, error}>}
   */
  async updateComment(id, updates) {
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;

      // Charger le profil de l'auteur séparément
      let author = null;
      try {
        const { data: authorData } = await supabase
          .from('users')
          .select('id, username, first_name, last_name, avatar_url')
          .eq('id', data.author_id)
          .single();
        author = authorData;
      } catch (authorError) {
        console.warn('Erreur chargement profil auteur:', authorError);
      }

      const comment = {
        id: data.id,
        author: author?.first_name && author?.last_name
          ? `${author.first_name} ${author.last_name}`
          : author?.username || 'Utilisateur',
        avatar: author?.avatar_url || null,
        content: data.content,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      return { comment, error: null };
    } catch (error) {
      console.error('Erreur updateComment:', error);
      return { comment: null, error };
    }
  }

  /**
   * Supprimer un commentaire
   * @param {string} id - ID du commentaire
   * @returns {Promise<{error}>}
   */
  async deleteComment(id) {
    try {
      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Erreur deleteComment:', error);
      return { error };
    }
  }

  /**
   * Formater un post pour correspondre au format attendu par l'UI
   * @private
   */
  _formatPost(post) {
    if (!post) return null;

    return {
      id: post.id,
      author: post.author?.first_name && post.author?.last_name
        ? `${post.author.first_name} ${post.author.last_name}`
        : post.author?.username || 'Utilisateur',
      avatar: post.author?.avatar_url || null,
      title: post.title,
      content: post.content,
      type: post.type,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
    };
  }
}

export default new PostsService();
