import AsyncStorage from '@react-native-async-storage/async-storage';
import postsService, { Post } from './supabase/postsService';
import offlineService from './offlineService';

class PostsService {
  static POSTS_KEY = '@posts';
  static POST_LIKES_KEY = '@post_likes';
  static POST_COMMENTS_KEY = '@post_comments';

  /**
   * Créer un nouveau post
   * @param {Object} postData - {group_id, author_id, title, content, type}
   * @returns {Promise<Object>}
   */
  static async createPost(postData: any) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        const { post, error } = await postsService.createPost(postData);
        if (error) {
          console.error('Erreur createPost Supabase:', error);
          await offlineService.enqueue('CREATE_POST', postData);
          return await this._saveLocalPost(postData);
        }

        await this._addToLocalCache(post);
        return post;
      } else {
        await offlineService.enqueue('CREATE_POST', postData);
        return await this._saveLocalPost(postData);
      }
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }

  /**
   * Ajouter ou retirer un like sur un post
   * @param {string} postId - ID du post
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Object>}
   */
  static async toggleLike(postId: string, userId: string) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        const { liked, error } = await postsService.toggleLike(postId, userId);
        if (error) {
          console.error('Erreur toggleLike Supabase:', error);
          await offlineService.enqueue('TOGGLE_POST_LIKE', { postId, userId });
          return { liked: false, error };
        }

        return { liked, error: null };
      } else {
        await offlineService.enqueue('TOGGLE_POST_LIKE', { postId, userId });
        return { liked: false, error: null };
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      throw error;
    }
  }

  /**
   * Créer un commentaire
   * @param {string} postId - ID du post
   * @param {string} authorId - ID de l'auteur
   * @param {string} content - Contenu du commentaire
   * @returns {Promise<Object>}
   */
  static async createComment(postId: string, authorId: string, content: string) {
    try {
      const isOnline = await offlineService.checkConnection();

      const commentData = {
        post_id: postId,
        author_id: authorId,
        content,
      };

      if (isOnline) {
        const { comment, error } = await postsService.createComment(commentData);
        if (error) {
          console.error('Erreur createComment Supabase:', error);
          await offlineService.enqueue('CREATE_COMMENT', commentData);
          return await this._saveLocalComment(commentData);
        }

        await this._addCommentToCache(postId, comment);
        return comment;
      } else {
        await offlineService.enqueue('CREATE_COMMENT', commentData);
        return await this._saveLocalComment(commentData);
      }
    } catch (error) {
      console.error('Error creating comment:', error);
      throw error;
    }
  }

  /**
   * Récupérer un post avec toutes ses interactions (likes et commentaires)
   * @param {string} postId - ID du post
   * @returns {Promise<Object>}
   */
  static async getPostWithInteractions(postId: string) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        const { post, error } = await postsService.getPostById(postId);
        if (error) {
          // Si le post n'existe pas dans Supabase (ride non publié comme post)
          // retourner une structure vide plutôt qu'une erreur
          if (error.code === 'PGRST116') {

            return {
              id: postId,
              comments: [],
              commentsCount: 0,
              likes: [],
              likesCount: 0,
            };
          }
          console.error('Erreur getPostWithInteractions Supabase:', error);
          return await this._getLocalPostWithInteractions(postId);
        }

        return post;
      } else {
        return await this._getLocalPostWithInteractions(postId);
      }
    } catch (error) {
      console.error('Error getting post with interactions:', error);
      // Retourner structure vide en cas d'erreur
      return {
        id: postId,
        comments: [],
        commentsCount: 0,
        likes: [],
        likesCount: 0,
      };
    }
  }

  // ========== Méthodes privées pour le cache local ==========

  static async _getLocalPostWithInteractions(postId: string) {
    try {
      const postsJson = await AsyncStorage.getItem(this.POSTS_KEY);
      if (!postsJson) return null;

      const posts = JSON.parse(postsJson);
      const post = posts.find((p: any) => p.id === postId);
      if (!post) return null;

      // Charger les likes et commentaires depuis le cache
      const [likes, comments] = await Promise.all([
        this._getLocalPostLikes(postId),
        this._getLocalPostComments(postId),
      ]);

      return {
        ...post,
        likes,
        likesCount: likes.length,
        comments,
        commentsCount: comments.length,
      };
    } catch (error) {
      console.error('Error loading local post with interactions:', error);
      return null;
    }
  }

  static async _getLocalPostLikes(postId: string) {
    try {
      const likesJson = await AsyncStorage.getItem(`${this.POST_LIKES_KEY}_${postId}`);
      if (!likesJson) return [];
      return JSON.parse(likesJson);
    } catch (error) {
      console.error('Error loading local post likes:', error);
      return [];
    }
  }

  static async _getLocalPostComments(postId: string) {
    try {
      const commentsJson = await AsyncStorage.getItem(`${this.POST_COMMENTS_KEY}_${postId}`);
      if (!commentsJson) return [];
      return JSON.parse(commentsJson);
    } catch (error) {
      console.error('Error loading local post comments:', error);
      return [];
    }
  }

  static async _saveLocalPost(postData: any) {
    try {
      const postsJson = await AsyncStorage.getItem(this.POSTS_KEY);
      const posts = postsJson ? JSON.parse(postsJson) : [];

      const newPost = {
        id: postData.id || `local_${Date.now()}`,
        ...postData,
        createdAt: new Date().toISOString(),
        likes: [],
        likesCount: 0,
        comments: [],
        commentsCount: 0,
      };

      posts.push(newPost);
      await AsyncStorage.setItem(this.POSTS_KEY, JSON.stringify(posts));
      return newPost;
    } catch (error) {
      console.error('Error saving local post:', error);
      throw error;
    }
  }

  static async _saveLocalComment(commentData: any) {
    try {
      const comments = await this._getLocalPostComments(commentData.post_id);
      const newComment = {
        id: `local_${Date.now()}`,
        ...commentData,
        createdAt: new Date().toISOString(),
      };
      comments.push(newComment);
      await AsyncStorage.setItem(
        `${this.POST_COMMENTS_KEY}_${commentData.post_id}`,
        JSON.stringify(comments)
      );
      return newComment;
    } catch (error) {
      console.error('Error saving local comment:', error);
      throw error;
    }
  }

  static async _addToLocalCache(post: any) {
    try {
      const postsJson = await AsyncStorage.getItem(this.POSTS_KEY);
      const posts = postsJson ? JSON.parse(postsJson) : [];
      const existingIndex = posts.findIndex((p: any) => p.id === post.id);
      if (existingIndex >= 0) {
        posts[existingIndex] = post;
      } else {
        posts.push(post);
      }
      await AsyncStorage.setItem(this.POSTS_KEY, JSON.stringify(posts));
    } catch (error) {
      console.error('Error adding to cache:', error);
    }
  }

  static async _addCommentToCache(postId: string, comment: any) {
    try {
      const comments = await this._getLocalPostComments(postId);
      comments.push(comment);
      await AsyncStorage.setItem(
        `${this.POST_COMMENTS_KEY}_${postId}`,
        JSON.stringify(comments)
      );
    } catch (error) {
      console.error('Error adding comment to cache:', error);
    }
  }
}

export default PostsService;

