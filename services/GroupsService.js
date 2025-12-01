import AsyncStorage from '@react-native-async-storage/async-storage';
import groupsService from './supabase/groupsService';
import challengesService from './supabase/challengesService';
import ChallengesService from './ChallengesService';
import postsService from './supabase/postsService';
import offlineService from './offlineService';

class GroupsService {
  static GROUPS_KEY = '@groups';
  static GROUP_MEMBERS_KEY = '@group_members';
  static GROUP_CHALLENGES_KEY = '@group_challenges';
  static GROUP_POSTS_KEY = '@group_posts';

  /**
   * Récupérer tous les groupes (depuis Supabase ou cache)
   * @param {Object} options - {limit, offset, location, search}
   * @returns {Promise<Array>}
   */
  static async getAllGroups(options = {}) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        const { groups, error } = await groupsService.getAllGroups(options);
        if (error) {
          console.error('Erreur getAllGroups Supabase:', error);
          return await this._getLocalGroups();
        }

        // Mettre à jour le cache
        await this._cacheGroups(groups);
        return groups;
      } else {
        return await this._getLocalGroups();
      }
    } catch (error) {
      console.error('Error loading groups:', error);
      return await this._getLocalGroups();
    }
  }

  /**
   * Récupérer un groupe par ID avec tous ses détails
   * @param {string} id - ID du groupe
   * @returns {Promise<Object|null>}
   */
  static async getGroupById(id) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        const { group, error } = await groupsService.getGroupById(id);
        if (error) {
          console.error('Erreur getGroupById Supabase:', error);
          return await this._getLocalGroupById(id);
        }

        console.log('🔵 [GroupsService.getGroupById] Groupe reçu:', { id: group.id, createdBy: group.createdBy, membersCount: group.members?.length || 0 });

        // Les membres sont déjà chargés dans getGroupById avec le créateur en fallback
        // Recharger pour être sûr que tout est à jour
        const membersResult = await groupsService.getGroupMembers(id, group.createdBy);
        group.members = membersResult.members || [];
        console.log('📊 [GroupsService.getGroupById] Membres après rechargement:', group.members.length, group.members.map(m => ({ id: m.id, name: m.name })));

        // Double vérification : s'assurer que le créateur est toujours dans la liste
        if (group.createdBy) {
          const creatorInMembers = group.members.some(m => m.id === group.createdBy);
          console.log('🔍 [GroupsService.getGroupById] Créateur dans membres?', creatorInMembers);
          if (!creatorInMembers) {
            console.warn('⚠️ [GroupsService.getGroupById] Créateur manquant dans les membres après rechargement, ajout manuel...');
            // Ajouter le créateur manuellement en premier
            group.members.unshift({
              id: group.createdBy,
              name: 'Créateur',
              avatar: null,
              role: 'owner',
              joinedAt: group.createdAt || new Date().toISOString(),
            });
            console.log('✅ [GroupsService.getGroupById] Créateur ajouté manuellement');
          }
        }

        // Toujours compter le créateur même s'il n'est pas dans la liste
        const creatorInMembers = group.createdBy && group.members.some(m => m.id === group.createdBy);
        group.memberCount = group.members.length + (group.createdBy && !creatorInMembers ? 1 : 0);
        console.log('✅ [GroupsService.getGroupById] Groupe final:', { id: group.id, memberCount: group.memberCount, members: group.members.map(m => ({ id: m.id, name: m.name })) });

        // Charger les challenges et posts si nécessaire (optionnel, peut être fait séparément)
        try {
          console.log('🔵 [GroupsService.getGroupById] Chargement des défis pour le groupe:', id);
          const challengesResult = await this.getGroupChallenges(id);
          console.log('📊 [GroupsService.getGroupById] Résultat getGroupChallenges:', challengesResult?.length || 0, challengesResult);
          group.challenges = Array.isArray(challengesResult) ? challengesResult : [];
          console.log('✅ [GroupsService.getGroupById] Défis assignés au groupe:', group.challenges.length, group.challenges.map(c => ({ id: c.id, title: c.title })));
        } catch (challengesError) {
          console.error('❌ [GroupsService.getGroupById] Erreur chargement challenges:', challengesError);
          group.challenges = [];
        }

        try {
          const postsResult = await this.getGroupPosts(id);
          group.posts = postsResult || [];
        } catch (postsError) {
          console.warn('⚠️ [GroupsService.getGroupById] Erreur chargement posts:', postsError);
          group.posts = [];
        }

        // Mettre à jour le cache
        await this._updateGroupInCache(group);

        return group;
      } else {
        return await this._getLocalGroupById(id);
      }
    } catch (error) {
      console.error('Error getting group by ID:', error);
      return await this._getLocalGroupById(id);
    }
  }

  /**
   * Récupérer uniquement les stats d'un groupe (rapide, sans charger membres/défis/posts)
   * @param {string} id - ID du groupe
   * @returns {Promise<{totalDistance, totalRides}>}
   */
  static async getGroupStats(id) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        const { stats, error } = await groupsService.getGroupStats(id);
        if (error) {
          console.error('Erreur getGroupStats Supabase:', error);
          return { totalDistance: 0, totalRides: 0 };
        }

        return {
          totalDistance: stats?.totalDistance || 0,
          totalRides: stats?.totalRides || 0,
        };
      } else {
        // En mode offline, retourner les stats du cache local
        const localGroup = await this._getLocalGroupById(id);
        return {
          totalDistance: localGroup?.totalDistance || 0,
          totalRides: localGroup?.totalRides || 0,
        };
      }
    } catch (error) {
      console.error('Error getting group stats:', error);
      return { totalDistance: 0, totalRides: 0 };
    }
  }

  /**
   * Récupérer les groupes d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Array>}
   */
  static async getUserGroups(userId) {
    try {
      // Validation UUID simple
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
      if (!userId || userId === 'default' || !isUuid) {
        console.log('⚠️ [GroupsService] getUserGroups ignoré: userId invalide', userId);
        return [];
      }

      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        const { groups, error } = await groupsService.getUserGroups(userId);
        if (error) {
          console.error('Erreur getUserGroups Supabase:', error);
          return await this._getLocalGroups();
        }

        // Charger les défis pour chaque groupe
        const groupsWithChallenges = await Promise.all(
          groups.map(async (group) => {
            try {
              const challenges = await this.getGroupChallenges(group.id);
              group.challenges = Array.isArray(challenges) ? challenges : [];
            } catch (challengeError) {
              console.warn('⚠️ [GroupsService.getUserGroups] Erreur chargement défis pour groupe', group.id, ':', challengeError);
              group.challenges = [];
            }
            return group;
          })
        );

        await this._cacheGroups(groupsWithChallenges);
        return groupsWithChallenges;
      } else {
        return await this._getLocalGroups();
      }
    } catch (error) {
      console.error('Error loading user groups:', error);
      return await this._getLocalGroups();
    }
  }

  /**
   * Créer un nouveau groupe
   * @param {Object} groupData - {name, description, location, avatar_url, created_by}
   * @returns {Promise<Object>}
   */
  static async createGroup(groupData) {
    try {
      console.log('🚀 [GroupsService.createGroup] DÉBUT création groupe:', groupData);
      const isOnline = await offlineService.checkConnection();
      console.log('🌐 [GroupsService.createGroup] En ligne?', isOnline);

      if (isOnline) {
        console.log('📤 [GroupsService.createGroup] Appel groupsService.createGroup...');
        const { group, error } = await groupsService.createGroup(groupData);
        console.log('📥 [GroupsService.createGroup] Réponse reçue:', { group: group?.id, error });

        if (error) {
          console.error('❌ [GroupsService.createGroup] Erreur createGroup Supabase:', error);
          // Ajouter à la queue offline
          await offlineService.enqueue('CREATE_GROUP', groupData);
          // Sauvegarder localement en attendant
          return await this._saveLocalGroup(groupData);
        }

        console.log('⏳ [GroupsService.createGroup] Attente 500ms pour synchronisation...');
        // Attendre un peu pour s'assurer que le membre créateur est bien enregistré
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('👥 [GroupsService.createGroup] Chargement des membres pour groupe:', group.id, 'créateur:', groupData.created_by);
        // Attendre un peu plus pour s'assurer que l'insertion est bien propagée
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Charger les membres pour avoir le bon memberCount
        const membersResult = await groupsService.getGroupMembers(group.id, groupData.created_by);
        group.members = membersResult.members || [];
        // Toujours compter le créateur même s'il n'est pas dans la liste
        const creatorInMembers = group.createdBy && group.members.some(m => m.id === group.createdBy);
        group.memberCount = group.members.length + (group.createdBy && !creatorInMembers ? 1 : 0);
        console.log('📊 [GroupsService.createGroup] Membres chargés (1er essai):', group.memberCount, group.members.map(m => ({ id: m.id, name: m.name })));

        // Si aucun membre n'est trouvé, le créateur n'a pas été ajouté, on le force
        if (group.memberCount === 0 && groupData.created_by) {
          console.warn('⚠️ [GroupsService.createGroup] Aucun membre trouvé après création, réessai d\'ajout du créateur...');

          // Essayer d'ajouter le créateur avec upsert
          try {
            const { error: joinError } = await groupsService.joinGroup(group.id, groupData.created_by);
            if (joinError) {
              console.error('❌ [GroupsService.createGroup] Erreur joinGroup:', joinError);
            } else {
              console.log('✅ [GroupsService.createGroup] Créateur ajouté avec joinGroup');
            }
          } catch (joinErr) {
            console.error('❌ [GroupsService.createGroup] Exception joinGroup:', joinErr);
          }

          // Attendre un peu puis recharger
          await new Promise(resolve => setTimeout(resolve, 500));
          const retryMembersResult = await groupsService.getGroupMembers(group.id, groupData.created_by);
          group.members = retryMembersResult.members || [];
          // Toujours compter le créateur même s'il n'est pas dans la liste
          const creatorInMembersRetry = group.createdBy && group.members.some(m => m.id === group.createdBy);
          group.memberCount = group.members.length + (group.createdBy && !creatorInMembersRetry ? 1 : 0);
          console.log('📊 [GroupsService.createGroup] Membres après réessai:', group.memberCount, group.members.map(m => ({ id: m.id, name: m.name })));

          // Si toujours 0, ajouter manuellement
          if (group.memberCount === 0) {
            console.warn('⚠️ [GroupsService.createGroup] Toujours 0 membres, ajout manuel du créateur');
            group.members = [{
              id: groupData.created_by,
              name: 'Créateur',
              avatar: null,
              role: 'owner',
              joinedAt: group.createdAt || new Date().toISOString(),
            }];
            group.memberCount = 1;
            console.log('✅ [GroupsService.createGroup] Créateur ajouté manuellement');
          }
        }

        console.log('💾 [GroupsService.createGroup] Mise à jour du cache...');
        // Mettre à jour le cache
        await this._addToLocalCache(group);
        console.log('✅ [GroupsService.createGroup] Groupe créé avec succès:', { id: group.id, memberCount: group.memberCount });
        return group;
      } else {
        // Mode offline: sauvegarder localement et ajouter à la queue
        await offlineService.enqueue('CREATE_GROUP', groupData);
        return await this._saveLocalGroup(groupData);
      }
    } catch (error) {
      console.error('Error creating group:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour un groupe
   * @param {string} id - ID du groupe
   * @param {Object} updates - Champs à mettre à jour
   * @returns {Promise<Object>}
   */
  static async updateGroup(id, updates) {
    try {
      console.log('📝 [GroupsService.updateGroup] Début mise à jour groupe:', id, 'updates:', updates);
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        const { group, error } = await groupsService.updateGroup(id, updates);
        if (error) {
          console.error('❌ [GroupsService.updateGroup] Erreur Supabase:', error);
          await offlineService.enqueue('UPDATE_GROUP', { id, updates });
          const localGroup = await this._updateLocalGroup(id, updates);
          return { group: localGroup, error: null };
        }

        console.log('✅ [GroupsService.updateGroup] Groupe mis à jour, avatar:', group?.avatar);
        await this._updateGroupInCache(group);
        return { group, error: null };
      } else {
        await offlineService.enqueue('UPDATE_GROUP', { id, updates });
        const localGroup = await this._updateLocalGroup(id, updates);
        return { group: localGroup, error: null };
      }
    } catch (error) {
      console.error('❌ [GroupsService.updateGroup] Exception:', error);
      return { group: null, error };
    }
  }

  /**
   * Uploader l'avatar d'un groupe
   * @param {string} groupId - ID du groupe
   * @param {string} photoUri - URI de la photo locale
   * @returns {Promise<Object>}
   */
  static async uploadGroupAvatar(groupId, photoUri) {
    try {
      console.log('📤 [GroupsService.uploadGroupAvatar] Début upload pour groupe:', groupId);
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        const { url, error } = await groupsService.uploadGroupAvatar(groupId, photoUri);
        if (error) {
          console.error('❌ [GroupsService.uploadGroupAvatar] Erreur Supabase:', error);
          return { avatarUrl: null, error };
        }

        console.log('✅ [GroupsService.uploadGroupAvatar] Upload réussi, URL:', url);
        return { avatarUrl: url, error: null };
      } else {
        console.warn('⚠️ [GroupsService.uploadGroupAvatar] Pas de connexion internet');
        return { avatarUrl: null, error: new Error('Pas de connexion internet') };
      }
    } catch (error) {
      console.error('❌ [GroupsService.uploadGroupAvatar] Exception:', error);
      return { avatarUrl: null, error };
    }
  }

  /**
   * Rejoindre un groupe
   * @param {string} groupId - ID du groupe
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Object>}
   */
  static async joinGroup(groupId, userId) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        const { member, error } = await groupsService.joinGroup(groupId, userId);
        if (error) {
          console.error('Erreur joinGroup Supabase:', error);
          await offlineService.enqueue('JOIN_GROUP', { groupId, userId });
          return { success: false, error };
        }

        return { success: true, member };
      } else {
        await offlineService.enqueue('JOIN_GROUP', { groupId, userId });
        return { success: true, member: null };
      }
    } catch (error) {
      console.error('Error joining group:', error);
      throw error;
    }
  }

  /**
   * Quitter un groupe
   * @param {string} groupId - ID du groupe
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Object>}
   */
  static async leaveGroup(groupId, userId) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        const { error } = await groupsService.leaveGroup(groupId, userId);
        if (error) {
          console.error('Erreur leaveGroup Supabase:', error);
          await offlineService.enqueue('LEAVE_GROUP', { groupId, userId });
        }
      } else {
        await offlineService.enqueue('LEAVE_GROUP', { groupId, userId });
      }

      return { success: true };
    } catch (error) {
      console.error('Error leaving group:', error);
      throw error;
    }
  }

  /**
   * Récupérer les membres d'un groupe
   * @param {string} groupId - ID du groupe
   * @returns {Promise<Array>}
   */
  static async getGroupMembers(groupId) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        const { members, error } = await groupsService.getGroupMembers(groupId);
        if (error) {
          console.error('Erreur getGroupMembers Supabase:', error);
          return await this._getLocalGroupMembers(groupId);
        }

        await this._cacheGroupMembers(groupId, members);
        return members;
      } else {
        return await this._getLocalGroupMembers(groupId);
      }
    } catch (error) {
      console.error('Error loading group members:', error);
      return await this._getLocalGroupMembers(groupId);
    }
  }

  /**
   * Récupérer les défis d'un groupe
   * @param {string} groupId - ID du groupe
   * @returns {Promise<Array>}
   */
  static async getGroupChallenges(groupId) {
    try {
      console.log('🔵 [GroupsService.getGroupChallenges] Début chargement défis pour groupe:', groupId);
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        // Utiliser ChallengesService.getActiveChallenges qui retourne directement un tableau
        console.log('📡 [GroupsService.getGroupChallenges] Appel ChallengesService.getActiveChallenges...');
        const challenges = await ChallengesService.getActiveChallenges(groupId);
        console.log('📊 [GroupsService.getGroupChallenges] Résultat brut:', challenges);
        console.log('📊 [GroupsService.getGroupChallenges] Type:', typeof challenges, 'Is Array?', Array.isArray(challenges));
        console.log('📊 [GroupsService.getGroupChallenges] Longueur:', challenges?.length || 0, 'défis');

        if (!challenges) {
          console.log('⚠️ [GroupsService.getGroupChallenges] Challenges est null/undefined');
          return [];
        }

        if (!Array.isArray(challenges)) {
          console.error('❌ [GroupsService.getGroupChallenges] Challenges n\'est pas un tableau:', challenges);
          return [];
        }

        if (challenges.length === 0) {
          console.log('⚠️ [GroupsService.getGroupChallenges] Aucun défi trouvé pour le groupe:', groupId);
          return [];
        }

        console.log('💾 [GroupsService.getGroupChallenges] Mise en cache des défis...');
        await this._cacheGroupChallenges(groupId, challenges);
        console.log('✅ [GroupsService.getGroupChallenges] Défis chargés et mis en cache:', challenges.length, challenges.map(c => ({ id: c.id, title: c.title })));
        return challenges;
      } else {
        console.log('📴 [GroupsService.getGroupChallenges] Mode hors ligne, chargement depuis le cache...');
        return await this._getLocalGroupChallenges(groupId);
      }
    } catch (error) {
      console.error('❌ [GroupsService.getGroupChallenges] Erreur:', error);
      console.error('❌ [GroupsService.getGroupChallenges] Stack:', error.stack);
      return await this._getLocalGroupChallenges(groupId);
    }
  }

  /**
   * Récupérer les posts d'un groupe
   * @param {string} groupId - ID du groupe
   * @param {Object} options - {limit, offset}
   * @returns {Promise<Array>}
   */
  static async getGroupPosts(groupId, options = {}) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        const { posts, error } = await groupsService.getGroupPosts(groupId, options);
        if (error) {
          console.error('Erreur getGroupPosts Supabase:', error);
          return await this._getLocalGroupPosts(groupId);
        }

        // Charger les likes et commentaires pour chaque post
        const postsWithInteractions = await Promise.all(
          posts.map(async post => {
            const [likesResult, commentsResult] = await Promise.all([
              postsService.getPostLikes(post.id),
              postsService.getPostComments(post.id),
            ]);

            return {
              ...post,
              likes: likesResult.likes || [],
              likesCount: (likesResult.likes || []).length,
              comments: commentsResult.comments || [],
              commentsCount: (commentsResult.comments || []).length,
            };
          })
        );

        await this._cacheGroupPosts(groupId, postsWithInteractions);
        return postsWithInteractions;
      } else {
        return await this._getLocalGroupPosts(groupId);
      }
    } catch (error) {
      console.error('Error loading group posts:', error);
      return await this._getLocalGroupPosts(groupId);
    }
  }

  /**
   * Récupérer les groupes suggérés
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} filters - {location, tags, minMembers, maxMembers}
   * @returns {Promise<Array>}
   */
  static async getSuggestedGroups(userId, filters = {}) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        const { groups, error } = await groupsService.getSuggestedGroups(userId, filters);
        if (error) {
          console.error('Erreur getSuggestedGroups Supabase:', error);
          return [];
        }

        return groups;
      } else {
        return [];
      }
    } catch (error) {
      console.error('Error loading suggested groups:', error);
      return [];
    }
  }

  /**
   * Promouvoir un membre en admin (owner uniquement)
   * @param {string} groupId - ID du groupe
   * @param {string} userId - ID de l'utilisateur à promouvoir
   * @param {string} currentUserId - ID de l'utilisateur qui effectue l'action
   * @returns {Promise<{success, error}>}
   */
  static async promoteToAdmin(groupId, userId, currentUserId) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        return await groupsService.promoteToAdmin(groupId, userId, currentUserId);
      } else {
        await offlineService.enqueue('PROMOTE_TO_ADMIN', { groupId, userId, currentUserId });
        return { success: true, error: null };
      }
    } catch (error) {
      console.error('Error promoting to admin:', error);
      return { success: false, error };
    }
  }

  /**
   * Rétrograder un admin en membre (owner uniquement)
   * @param {string} groupId - ID du groupe
   * @param {string} userId - ID de l'utilisateur à rétrograder
   * @param {string} currentUserId - ID de l'utilisateur qui effectue l'action
   * @returns {Promise<{success, error}>}
   */
  static async demoteFromAdmin(groupId, userId, currentUserId) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        return await groupsService.demoteFromAdmin(groupId, userId, currentUserId);
      } else {
        await offlineService.enqueue('DEMOTE_FROM_ADMIN', { groupId, userId, currentUserId });
        return { success: true, error: null };
      }
    } catch (error) {
      console.error('Error demoting from admin:', error);
      return { success: false, error };
    }
  }

  /**
   * Supprimer un groupe (Owner uniquement)
   * @param {string} groupId - ID du groupe
   * @returns {Promise<{success, error}>}
   */
  static async deleteGroup(groupId) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        return await groupsService.deleteGroup(groupId);
      } else {
        await offlineService.enqueue('DELETE_GROUP', { groupId });
        return { success: true, error: null };
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      return { success: false, error };
    }
  }

  /**
   * Transférer la propriété du groupe (Owner uniquement)
   * @param {string} groupId - ID du groupe
   * @param {string} newOwnerId - ID du nouveau propriétaire
   * @param {string} currentOwnerId - ID du propriétaire actuel
   * @returns {Promise<{success, error}>}
   */
  static async transferOwnership(groupId, newOwnerId, currentOwnerId) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        return await groupsService.transferOwnership(groupId, newOwnerId, currentOwnerId);
      } else {
        await offlineService.enqueue('TRANSFER_OWNERSHIP', { groupId, newOwnerId, currentOwnerId });
        return { success: true, error: null };
      }
    } catch (error) {
      console.error('Error transferring ownership:', error);
      return { success: false, error };
    }
  }

  /**
   * Expulser un membre du groupe (owner ou admin)
   * @param {string} groupId - ID du groupe
   * @param {string} userId - ID de l'utilisateur à expulser
   * @param {string} currentUserId - ID de l'utilisateur qui effectue l'action
   * @returns {Promise<{success, error}>}
   */
  static async removeMember(groupId, userId, currentUserId) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        return await groupsService.removeMember(groupId, userId, currentUserId);
      } else {
        await offlineService.enqueue('REMOVE_MEMBER', { groupId, userId, currentUserId });
        return { success: true, error: null };
      }
    } catch (error) {
      console.error('Error removing member:', error);
      return { success: false, error };
    }
  }

  /**
   * Créer une demande pour rejoindre un groupe privé
   * @param {string} groupId - ID du groupe
   * @param {string} userId - ID de l'utilisateur
   * @param {string} message - Message optionnel
   * @returns {Promise<{request, error}>}
   */
  static async requestToJoin(groupId, userId, message = null) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        return await groupsService.requestToJoin(groupId, userId, message);
      } else {
        await offlineService.enqueue('REQUEST_TO_JOIN', { groupId, userId, message });
        return { request: null, error: new Error('Offline - request queued') };
      }
    } catch (error) {
      console.error('Error requesting to join group:', error);
      return { request: null, error };
    }
  }

  /**
   * Récupérer toutes les demandes en attente pour un groupe
   * @param {string} groupId - ID du groupe
   * @returns {Promise<Array>}
   */
  static async getJoinRequests(groupId) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        const { requests, error } = await groupsService.getJoinRequests(groupId);
        if (error) {
          console.error('Erreur getJoinRequests Supabase:', error);
          return [];
        }
        return requests;
      } else {
        return [];
      }
    } catch (error) {
      console.error('Error loading join requests:', error);
      return [];
    }
  }

  /**
   * Annuler une demande d'adhésion
   * @param {string} groupId - ID du groupe
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<{success, error}>}
   */
  static async cancelJoinRequest(groupId, userId) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        return await groupsService.cancelJoinRequest(groupId, userId);
      } else {
        await offlineService.enqueue('CANCEL_JOIN_REQUEST', { groupId, userId });
        return { success: true, error: null };
      }
    } catch (error) {
      console.error('Error cancelling join request:', error);
      return { success: false, error };
    }
  }

  /**
   * Approuver une demande d'adhésion
   * @param {string} requestId - ID de la demande
   * @param {string} approverId - ID de l'utilisateur qui approuve
   * @returns {Promise<{success, error}>}
   */
  static async approveJoinRequest(requestId, approverId) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        return await groupsService.approveJoinRequest(requestId, approverId);
      } else {
        await offlineService.enqueue('APPROVE_JOIN_REQUEST', { requestId, approverId });
        return { success: true, error: null };
      }
    } catch (error) {
      console.error('Error approving join request:', error);
      return { success: false, error };
    }
  }

  /**
   * Rejeter une demande d'adhésion
   * @param {string} requestId - ID de la demande
   * @param {string} rejectorId - ID de l'utilisateur qui rejette
   * @returns {Promise<{success, error}>}
   */
  static async rejectJoinRequest(requestId, rejectorId) {
    try {
      const isOnline = await offlineService.checkConnection();

      if (isOnline) {
        return await groupsService.rejectJoinRequest(requestId, rejectorId);
      } else {
        await offlineService.enqueue('REJECT_JOIN_REQUEST', { requestId, rejectorId });
        return { success: true, error: null };
      }
    } catch (error) {
      console.error('Error rejecting join request:', error);
      return { success: false, error };
    }
  }

  // ========== Méthodes privées pour le cache local ==========

  static async _getLocalGroups() {
    try {
      const groupsJson = await AsyncStorage.getItem(this.GROUPS_KEY);
      if (!groupsJson) return [];
      return JSON.parse(groupsJson);
    } catch (error) {
      console.error('Error loading local groups:', error);
      return [];
    }
  }

  static async _getLocalGroupById(id) {
    try {
      const groups = await this._getLocalGroups();
      return groups.find(g => g.id === id) || null;
    } catch (error) {
      console.error('Error loading local group by ID:', error);
      return null;
    }
  }

  static async _cacheGroups(groups) {
    try {
      await AsyncStorage.setItem(this.GROUPS_KEY, JSON.stringify(groups));
    } catch (error) {
      console.error('Error caching groups:', error);
    }
  }

  static async _saveLocalGroup(groupData) {
    const groups = await this._getLocalGroups();
    const newGroup = {
      id: groupData.id || `local_${Date.now()}`,
      ...groupData,
      createdAt: new Date().toISOString(),
    };
    groups.push(newGroup);
    await AsyncStorage.setItem(this.GROUPS_KEY, JSON.stringify(groups));
    return newGroup;
  }

  static async _updateLocalGroup(id, updates) {
    const groups = await this._getLocalGroups();
    const index = groups.findIndex(g => g.id === id);
    if (index >= 0) {
      groups[index] = { ...groups[index], ...updates };
      await AsyncStorage.setItem(this.GROUPS_KEY, JSON.stringify(groups));
      return groups[index];
    }
    return null;
  }

  static async _addToLocalCache(group) {
    try {
      const groups = await this._getLocalGroups();
      const existingIndex = groups.findIndex(g => g.id === group.id);
      if (existingIndex >= 0) {
        groups[existingIndex] = group;
      } else {
        groups.push(group);
      }
      await AsyncStorage.setItem(this.GROUPS_KEY, JSON.stringify(groups));
    } catch (error) {
      console.error('Error adding to cache:', error);
    }
  }

  static async _updateGroupInCache(group) {
    await this._addToLocalCache(group);
  }

  static async _getLocalGroupMembers(groupId) {
    try {
      const membersJson = await AsyncStorage.getItem(`${this.GROUP_MEMBERS_KEY}_${groupId}`);
      if (!membersJson) return [];
      return JSON.parse(membersJson);
    } catch (error) {
      console.error('Error loading local group members:', error);
      return [];
    }
  }

  static async _cacheGroupMembers(groupId, members) {
    try {
      await AsyncStorage.setItem(
        `${this.GROUP_MEMBERS_KEY}_${groupId}`,
        JSON.stringify(members)
      );
    } catch (error) {
      console.error('Error caching group members:', error);
    }
  }

  static async _getLocalGroupChallenges(groupId) {
    try {
      const challengesJson = await AsyncStorage.getItem(`${this.GROUP_CHALLENGES_KEY}_${groupId}`);
      if (!challengesJson) return [];
      return JSON.parse(challengesJson);
    } catch (error) {
      console.error('Error loading local group challenges:', error);
      return [];
    }
  }

  static async _cacheGroupChallenges(groupId, challenges) {
    try {
      await AsyncStorage.setItem(
        `${this.GROUP_CHALLENGES_KEY}_${groupId}`,
        JSON.stringify(challenges)
      );
    } catch (error) {
      console.error('Error caching group challenges:', error);
    }
  }

  static async _getLocalGroupPosts(groupId) {
    try {
      const postsJson = await AsyncStorage.getItem(`${this.GROUP_POSTS_KEY}_${groupId}`);
      if (!postsJson) return [];
      return JSON.parse(postsJson);
    } catch (error) {
      console.error('Error loading local group posts:', error);
      return [];
    }
  }

  static async _cacheGroupPosts(groupId, posts) {
    try {
      await AsyncStorage.setItem(
        `${this.GROUP_POSTS_KEY}_${groupId}`,
        JSON.stringify(posts)
      );
    } catch (error) {
      console.error('Error caching group posts:', error);
    }
  }
}

export default GroupsService;


