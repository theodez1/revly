import { supabase } from '../../config/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

/**
 * Service de gestion des groupes Supabase
 */
class GroupsService {
  /**
   * Récupérer tous les groupes (avec filtres optionnels)
   * @param {Object} options - {limit, offset, location, search}
   * @returns {Promise<{groups, error}>}
   */
  async getAllGroups(options = {}) {
    try {
      const { limit = 50, offset = 0, location, search } = options;

      let query = supabase
        .from('groups')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (location) {
        query = query.ilike('location', `%${location}%`);
      }

      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      const groups = (data || []).map(group => this._formatGroup(group));

      // Charger les membres pour chaque groupe pour avoir le memberCount
      const groupsWithMembers = await Promise.all(
        groups.map(async (group) => {
          try {
            const membersResult = await this.getGroupMembers(group.id, group.createdBy);
            group.members = membersResult.members || [];

            // Toujours compter le créateur même s'il n'est pas dans la liste
            const creatorInMembers = group.createdBy && group.members.some(m => m.id === group.createdBy);
            group.memberCount = group.members.length + (group.createdBy && !creatorInMembers ? 1 : 0);

            return group;
          } catch (memberError) {
            console.warn('⚠️ [getAllGroups] Erreur chargement membres pour groupe', group.id, ':', memberError);
            // Si erreur, au moins s'assurer que le créateur est compté
            if (group.createdBy) {
              group.members = [{
                id: group.createdBy,
                name: 'Créateur',
                avatar: null,
                role: 'owner',
                joinedAt: group.createdAt || new Date().toISOString(),
              }];
              group.memberCount = 1;
            } else {
              group.members = [];
              group.memberCount = 0;
            }
            return group;
          }
        })
      );

      return { groups: groupsWithMembers, error: null };
    } catch (error) {
      console.error('Erreur getAllGroups:', error);
      return { groups: [], error };
    }
  }

  /**
   * Récupérer un groupe par ID avec tous ses détails
   * @param {string} id - ID du groupe
   * @returns {Promise<{group, error}>}
   */
  async getGroupById(id) {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      const group = this._formatGroup(data);
      console.log('🔵 [getGroupById] Groupe formaté:', { id: group.id, name: group.name, createdBy: group.createdBy });

      // Charger les membres en passant le créateur pour le fallback
      const membersResult = await this.getGroupMembers(id, group.createdBy);
      group.members = membersResult.members || [];
      console.log('📊 [getGroupById] Membres après getGroupMembers:', group.members.length, group.members.map(m => ({ id: m.id, name: m.name })));

      // S'assurer que le créateur est dans la liste des membres
      if (group.createdBy) {
        const creatorInMembers = group.members.some(m => m.id === group.createdBy);
        console.log('🔍 [getGroupById] Créateur dans membres?', creatorInMembers, 'créateur ID:', group.createdBy);
        if (!creatorInMembers) {
          console.warn('⚠️ [getGroupById] Créateur non trouvé dans les membres, tentative d\'ajout...');
          // Essayer d'ajouter le créateur comme membre
          const { error: joinError } = await supabase
            .from('group_members')
            .upsert({
              group_id: id,
              user_id: group.createdBy,
              role: 'owner',
              status: 'active',
              joined_at: group.createdAt || new Date().toISOString(),
            }, {
              onConflict: 'group_id,user_id'
            });

          if (!joinError) {
            console.log('✅ [getGroupById] Créateur ajouté avec upsert, rechargement membres...');
            // Recharger les membres
            const retryMembersResult = await this.getGroupMembers(id, group.createdBy);
            group.members = retryMembersResult.members || [];
            console.log('📊 [getGroupById] Membres après rechargement:', group.members.length);
          } else {
            console.error('❌ [getGroupById] Erreur ajout créateur:', joinError);
            // Ajouter le créateur manuellement en premier dans la liste
            group.members.unshift({
              id: group.createdBy,
              name: 'Créateur',
              avatar: null,
              role: 'owner',
              joinedAt: group.createdAt || new Date().toISOString(),
            });
            console.log('✅ [getGroupById] Créateur ajouté manuellement');
          }
        }
      }

      // Toujours compter le créateur même s'il n'est pas dans la liste
      const creatorInMembers = group.createdBy && group.members.some(m => m.id === group.createdBy);
      group.memberCount = group.members.length + (group.createdBy && !creatorInMembers ? 1 : 0);
      console.log('✅ [getGroupById] Groupe final:', { id: group.id, memberCount: group.memberCount, members: group.members.map(m => ({ id: m.id, name: m.name })) });

      return { group, error: null };
    } catch (error) {
      console.error('Erreur getGroupById:', error);
      return { group: null, error };
    }
  }

  /**
   * Récupérer uniquement les stats d'un groupe (rapide, sans charger membres/défis/posts)
   * @param {string} id - ID du groupe
   * @returns {Promise<{stats, error}>}
   */
  async getGroupStats(id) {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('id, total_distance, total_rides, updated_at')
        .eq('id', id)
        .single();

      if (error) throw error;

      return {
        stats: {
          totalDistance: Number(data.total_distance) || 0,
          totalRides: Number(data.total_rides) || 0,
          updatedAt: data.updated_at,
        },
        error: null,
      };
    } catch (error) {
      console.error('Erreur getGroupStats:', error);
      return { stats: null, error };
    }
  }

  /**
   * Récupérer les groupes d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<{groups, error}>}
   */
  async getUserGroups(userId) {
    try {
      console.log('🔵 [getUserGroups] Récupération groupes pour utilisateur:', userId);

      const { data, error } = await supabase
        .from('group_members')
        .select(`
          group:groups(*)
        `)
        .eq('user_id', userId)
        .eq('status', 'active');

      if (error) throw error;

      const groups = (data || [])
        .map(item => item.group)
        .filter(Boolean)
        .map(group => this._formatGroup(group));

      console.log('📊 [getUserGroups] Groupes trouvés:', groups.length);

      // Charger les membres pour chaque groupe pour avoir le memberCount
      const groupsWithMembers = await Promise.all(
        groups.map(async (group) => {
          try {
            const membersResult = await this.getGroupMembers(group.id, group.createdBy);
            group.members = membersResult.members || [];

            // Toujours compter le créateur même s'il n'est pas dans la liste
            const creatorInMembers = group.createdBy && group.members.some(m => m.id === group.createdBy);
            group.memberCount = group.members.length + (group.createdBy && !creatorInMembers ? 1 : 0);

            console.log('👥 [getUserGroups] Groupe:', group.name, 'membres trouvés:', group.members.length, 'memberCount:', group.memberCount, 'créateur inclus?', creatorInMembers);
            return group;
          } catch (memberError) {
            console.warn('⚠️ [getUserGroups] Erreur chargement membres pour groupe', group.id, ':', memberError);
            // Si erreur, au moins s'assurer que le créateur est compté
            if (group.createdBy) {
              group.members = [{
                id: group.createdBy,
                name: 'Créateur',
                avatar: null,
                role: 'owner',
                joinedAt: group.createdAt || new Date().toISOString(),
              }];
              group.memberCount = 1;
            } else {
              group.members = [];
              group.memberCount = 0;
            }
            return group;
          }
        })
      );

      console.log('✅ [getUserGroups] Groupes avec membres chargés:', groupsWithMembers.length);

      return { groups: groupsWithMembers, error: null };
    } catch (error) {
      console.error('Erreur getUserGroups:', error);
      return { groups: [], error };
    }
  }

  /**
   * Créer un nouveau groupe
   * @param {Object} groupData - {name, description, location, avatar_url, created_by}
   * @returns {Promise<{group, error}>}
   */
  async createGroup(groupData) {
    console.log('🚀 [groupsService.createGroup] DÉBUT, données:', groupData);
    try {
      const { name, description, location, avatar_url, created_by, is_private } = groupData;
      console.log('📋 [groupsService.createGroup] Données extraites:', { name, created_by, is_private });

      if (!name || !created_by) {
        throw new Error('name et created_by sont requis');
      }

      const { data, error } = await supabase
        .from('groups')
        .insert({
          name,
          description: description || null,
          location: location || null,
          avatar_url: avatar_url || null,
          created_by,
          is_private: is_private || false,
        })
        .select('*')
        .single();

      if (error) throw error;

      // Ajouter le créateur comme owner du groupe
      console.log('🔵 [createGroup] Ajout du créateur comme membre:', {
        group_id: data.id,
        user_id: created_by,
        role: 'owner'
      });

      // Utiliser upsert pour éviter les erreurs de doublon
      const { error: memberError } = await supabase
        .from('group_members')
        .upsert({
          group_id: data.id,
          user_id: created_by,
          role: 'owner',
          status: 'active',
          joined_at: new Date().toISOString(),
        }, {
          onConflict: 'group_id,user_id'
        });

      if (memberError) {
        console.error('❌ [createGroup] Erreur upsert créateur comme membre:', memberError);
        // Réessayer avec insert simple si upsert échoue
        const { error: insertError } = await supabase
          .from('group_members')
          .insert({
            group_id: data.id,
            user_id: created_by,
            role: 'owner',
            status: 'active',
          });

        if (insertError) {
          console.error('❌ [createGroup] Erreur insert créateur comme membre:', insertError);
        } else {
          console.log('✅ [createGroup] Créateur ajouté avec insert (après échec upsert)');
        }
      } else {
        console.log('✅ [createGroup] Créateur ajouté avec upsert');
      }

      return { group: this._formatGroup(data), error: null };
    } catch (error) {
      console.error('Erreur createGroup:', error);
      return { group: null, error };
    }
  }

  /**
   * Mettre à jour un groupe
   * @param {string} id - ID du groupe
   * @param {Object} updates - Champs à mettre à jour
   * @returns {Promise<{group, error}>}
   */
  async updateGroup(id, updates) {
    try {
      // Convertir 'avatar' en 'avatar_url' pour la base de données
      const dbUpdates = { ...updates };
      if ('avatar' in dbUpdates) {
        dbUpdates.avatar_url = dbUpdates.avatar;
        delete dbUpdates.avatar;
      }

      const { data, error } = await supabase
        .from('groups')
        .update(dbUpdates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;

      return { group: this._formatGroup(data), error: null };
    } catch (error) {
      console.error('Erreur updateGroup:', error);
      return { group: null, error };
    }
  }

  /**
   * Supprimer un groupe
   * @param {string} id - ID du groupe
   * @returns {Promise<{error}>}
   */
  async deleteGroup(id) {
    try {
      const { error } = await supabase.from('groups').delete().eq('id', id);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Erreur deleteGroup:', error);
      return { error };
    }
  }

  /**
   * Rejoindre un groupe
   * @param {string} groupId - ID du groupe
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<{member, error}>}
   */
  async joinGroup(groupId, userId) {
    try {
      // Vérifier si l'utilisateur est déjà membre
      const { data: existing } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        // Si le membre existe mais a quitté, le réactiver
        if (existing.status !== 'active') {
          const { data, error } = await supabase
            .from('group_members')
            .update({ status: 'active', joined_at: new Date().toISOString() })
            .eq('id', existing.id)
            .select()
            .single();

          if (error) throw error;
          return { member: data, error: null };
        }
        return { member: existing, error: null };
      }

      // Créer un nouveau membre
      const { data, error } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          user_id: userId,
          role: 'member',
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      return { member: data, error: null };
    } catch (error) {
      console.error('Erreur joinGroup:', error);
      return { member: null, error };
    }
  }

  /**
   * Quitter un groupe
   * @param {string} groupId - ID du groupe
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<{error}>}
   */
  async leaveGroup(groupId, userId) {
    try {
      const { error } = await supabase
        .from('group_members')
        .update({ status: 'left' })
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Erreur leaveGroup:', error);
      return { error };
    }
  }

  /**
   * Récupérer les membres d'un groupe
   * @param {string} groupId - ID du groupe
   * @param {string} createdBy - ID du créateur (optionnel, pour fallback)
   * @returns {Promise<{members, error}>}
   */
  async getGroupMembers(groupId, createdBy = null) {
    try {
      console.log('🔵 [getGroupMembers] Récupération membres pour groupe:', groupId, 'créateur:', createdBy);

      // D'abord, vérifier si le membre créateur existe directement
      if (createdBy) {
        console.log('🔍 [getGroupMembers] Vérification directe du créateur...');
        const { data: creatorCheck, error: creatorError } = await supabase
          .from('group_members')
          .select('*')
          .eq('group_id', groupId)
          .eq('user_id', createdBy)
          .maybeSingle();

        if (creatorError) {
          console.error('❌ [getGroupMembers] Erreur vérification créateur:', creatorError);
        } else {
          console.log('👤 [getGroupMembers] Créateur trouvé directement?', !!creatorCheck, creatorCheck);
        }
      }

      const { data, error } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .order('joined_at', { ascending: true });

      if (error) {
        console.error('❌ [getGroupMembers] Erreur requête group_members:', error);
        throw error;
      }

      console.log('📊 [getGroupMembers] Membres trouvés dans group_members:', data?.length || 0);
      if (data && data.length > 0) {
        console.log('📋 [getGroupMembers] Détails membres:', data.map(m => ({ id: m.id, user_id: m.user_id, role: m.role, status: m.status })));
      } else {
        console.warn('⚠️ [getGroupMembers] AUCUN MEMBRE TROUVÉ dans la base de données!');
      }

      // Charger les profils utilisateur séparément
      const userIds = [...new Set((data || []).map(item => item.user_id))];
      console.log('👥 [getGroupMembers] IDs utilisateurs à charger:', userIds);
      const userProfiles = {};

      if (userIds.length > 0) {
        try {
          const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, username, first_name, last_name, avatar_url')
            .in('id', userIds);

          if (usersError) {
            console.warn('⚠️ [getGroupMembers] Erreur chargement profils utilisateurs:', usersError);
          } else {
            console.log('✅ [getGroupMembers] Profils utilisateurs chargés:', usersData?.length || 0);
            (usersData || []).forEach(user => {
              userProfiles[user.id] = user;
            });
          }
        } catch (userError) {
          console.warn('⚠️ [getGroupMembers] Exception chargement profils (table users peut ne pas exister):', userError);
          // Si la table users n'existe pas, on continue sans les profils
        }
      }

      const members = (data || []).map(item => {
        const user = userProfiles[item.user_id];
        const member = {
          id: item.user_id,
          name: user?.first_name && user?.last_name
            ? `${user.first_name} ${user.last_name}`
            : user?.username || 'Membre',
          avatar: user?.avatar_url || null,
          role: item.role,
          joinedAt: item.joined_at,
        };
        console.log('👤 [getGroupMembers] Membre formaté:', member);
        return member;
      });

      console.log('📋 [getGroupMembers] Liste membres avant fallback:', members.length, members.map(m => ({ id: m.id, name: m.name, role: m.role })));

      // Vérifier si le créateur est dans la liste
      let creatorInList = false;
      if (createdBy) {
        creatorInList = members.some(m => m.id === createdBy);
        console.log('🔍 [getGroupMembers] Créateur dans la liste?', creatorInList, 'créateur ID:', createdBy);
        if (!creatorInList) {
          console.warn('⚠️ [getGroupMembers] Créateur manquant, ajout...');
          members.unshift({
            id: createdBy,
            name: 'Créateur',
            avatar: null,
            role: 'owner',
            joinedAt: new Date().toISOString(),
          });
        }
      }

      // Si aucun membre trouvé mais qu'on a un créateur, l'ajouter
      if (members.length === 0 && createdBy) {
        console.warn('⚠️ [getGroupMembers] Aucun membre trouvé, ajout du créateur en fallback');
        members.push({
          id: createdBy,
          name: 'Créateur',
          avatar: null,
          role: 'owner',
          joinedAt: new Date().toISOString(),
        });
      }

      console.log('✅ [getGroupMembers] Liste membres finale:', members.length, members.map(m => ({ id: m.id, name: m.name, role: m.role })));

      return { members, error: null };
    } catch (error) {
      console.error('Erreur getGroupMembers:', error);
      // Si erreur et qu'on a un créateur, retourner au moins le créateur
      if (createdBy) {
        return {
          members: [{
            id: createdBy,
            name: 'Créateur',
            avatar: null,
            role: 'owner',
            joinedAt: new Date().toISOString(),
          }],
          error: null
        };
      }
      return { members: [], error };
    }
  }

  /**
   * Récupérer les défis d'un groupe
   * @param {string} groupId - ID du groupe
   * @returns {Promise<{challenges, error}>}
   */
  async getGroupChallenges(groupId) {
    try {
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { challenges: data || [], error: null };
    } catch (error) {
      console.error('Erreur getGroupChallenges:', error);
      return { challenges: [], error };
    }
  }

  /**
   * Récupérer les posts d'un groupe
   * @param {string} groupId - ID du groupe
   * @param {Object} options - {limit, offset}
   * @returns {Promise<{posts, error}>}
   */
  async getGroupPosts(groupId, options = {}) {
    try {
      const { limit = 20, offset = 0 } = options;

      const { data, error } = await supabase
        .from('group_posts')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Charger les profils des auteurs séparément
      const authorIds = [...new Set((data || []).map(post => post.author_id))];
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

      const posts = (data || []).map(post => {
        const author = authorProfiles[post.author_id];
        return {
          id: post.id,
          author: author?.first_name && author?.last_name
            ? `${author.first_name} ${author.last_name}`
            : author?.username || 'Utilisateur',
          avatar: author?.avatar_url || null,
          title: post.title,
          content: post.content,
          type: post.type,
          createdAt: post.created_at,
        };
      });

      return { posts, error: null };
    } catch (error) {
      console.error('Erreur getGroupPosts:', error);
      return { posts: [], error };
    }
  }

  /**
   * Annuler une demande d'adhésion (par l'utilisateur)
   * @param {string} groupId - ID du groupe
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<{success, error}>}
   */
  async cancelJoinRequest(groupId, userId) {
    try {
      const { error } = await supabase
        .from('group_join_requests')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .eq('status', 'pending');

      if (error) throw error;

      return { success: true, error: null };
    } catch (error) {
      console.error('Erreur cancelJoinRequest:', error);
      return { success: false, error };
    }
  }

  /**
   * Récupérer les groupes suggérés pour un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} filters - Filtres optionnels
   * @returns {Promise<{groups, error}>}
   */
  async getSuggestedGroups(userId, filters = {}) {
    try {
      // 1. Récupérer les groupes où l'utilisateur n'est PAS membre
      // On récupère d'abord les IDs des groupes où il est membre
      const { data: userGroups } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId)
        .eq('status', 'active');

      const userGroupIds = (userGroups || []).map(g => g.group_id);

      // 2. Récupérer aussi les demandes en attente pour savoir si on affiche "En attente"
      const { data: pendingRequests } = await supabase
        .from('group_join_requests')
        .select('group_id')
        .eq('user_id', userId)
        .eq('status', 'pending');

      const pendingGroupIds = new Set((pendingRequests || []).map(r => r.group_id));

      // 3. Construire la requête pour les groupes suggérés
      let query = supabase
        .from('groups')
        .select('*')
        .order('created_at', { ascending: false });

      if (userGroupIds.length > 0) {
        query = query.not('id', 'in', `(${userGroupIds.join(',')})`);
      }

      // Appliquer les filtres
      if (filters.location) {
        query = query.ilike('location', `%${filters.location}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Formater et ajouter le statut de la demande
      const groups = (data || []).map(group => {
        const formatted = this._formatGroup(group);
        // Ajouter le statut de la demande pour l'UI
        formatted.requestStatus = pendingGroupIds.has(group.id) ? 'pending' : null;
        return formatted;
      });

      // Charger les membres pour le compteur (optimisation possible: faire un count SQL)
      const groupsWithCounts = await Promise.all(
        groups.map(async (group) => {
          const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id)
            .eq('status', 'active');

          group.memberCount = count || 0;
          return group;
        })
      );

      return { groups: groupsWithCounts, error: null };
    } catch (error) {
      console.error('Erreur getSuggestedGroups:', error);
      return { groups: [], error };
    }
  }

  /**
   * Uploader un avatar de groupe vers Supabase Storage
   * @param {string} groupId - ID du groupe
   * @param {string} photoUri - URI de la photo locale
   * @returns {Promise<{url, error}>}
   */
  async uploadGroupAvatar(groupId, photoUri) {
    try {

      // Lire le fichier en base64
      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Déterminer l'extension du fichier
      const ext = photoUri.split('.').pop().toLowerCase();
      const contentType = ext === 'png' ? 'image/png' :
        ext === 'webp' ? 'image/webp' : 'image/jpeg';

      const fileName = `${groupId}/avatar.${ext}`;

      // Supprimer l'ancien avatar s'il existe
      await supabase.storage
        .from('group-avatars')
        .remove([fileName]);

      // Upload du nouveau fichier
      const { data, error } = await supabase.storage
        .from('group-avatars')
        .upload(fileName, decode(base64), {
          contentType,
          upsert: true,
        });

      if (error) throw error;

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('group-avatars')
        .getPublicUrl(fileName);

      // Mettre à jour le groupe avec la nouvelle URL
      await supabase
        .from('groups')
        .update({ avatar_url: publicUrl })
        .eq('id', groupId);

      return { url: publicUrl, error: null };
    } catch (error) {
      console.error('Erreur uploadGroupAvatar:', error);
      return { url: null, error };
    }
  }

  /**
   * Supprimer un groupe (Owner uniquement)
   * @param {string} groupId - ID du groupe
   * @returns {Promise<{success, error}>}
   */
  async deleteGroup(groupId) {
    try {
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      return { success: true, error: null };
    } catch (error) {
      console.error('Erreur deleteGroup:', error);
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
  async transferOwnership(groupId, newOwnerId, currentOwnerId) {
    try {
      console.log('👑 [transferOwnership] Début transfert:', { groupId, newOwnerId, currentOwnerId });

      // 1. Mettre à jour le créateur du groupe
      const { error: groupError } = await supabase
        .from('groups')
        .update({ created_by: newOwnerId })
        .eq('id', groupId);

      if (groupError) throw groupError;
      console.log('✅ [transferOwnership] created_by mis à jour');

      // 2. Mettre le nouveau propriétaire comme 'owner' dans group_members
      const { error: newOwnerError } = await supabase
        .from('group_members')
        .update({ role: 'owner' })
        .eq('group_id', groupId)
        .eq('user_id', newOwnerId);

      if (newOwnerError) throw newOwnerError;
      console.log('✅ [transferOwnership] Nouveau owner promu');

      // 3. Mettre l'ancien propriétaire comme 'admin' dans group_members
      const { error: oldOwnerError } = await supabase
        .from('group_members')
        .update({ role: 'admin' })
        .eq('group_id', groupId)
        .eq('user_id', currentOwnerId);

      if (oldOwnerError) throw oldOwnerError;
      console.log('✅ [transferOwnership] Ancien owner rétrogradé admin');

      return { success: true, error: null };
    } catch (error) {
      console.error('Erreur transferOwnership:', error);
      return { success: false, error };
    }
  }

  /**
   * Promouvoir un membre en admin (owner uniquement)
   * @param {string} groupId - ID du groupe
   * @param {string} userId - ID de l'utilisateur à promouvoir
   * @param {string} currentUserId - ID de l'utilisateur qui effectue l'action
   * @returns {Promise<{success, error}>}
   */
  async promoteToAdmin(groupId, userId, currentUserId) {
    try {
      // Vérifier que currentUserId est le créateur
      const { data: group } = await supabase
        .from('groups')
        .select('created_by')
        .eq('id', groupId)
        .single();

      if (!group || group.created_by !== currentUserId) {
        return { success: false, error: new Error('Seul le créateur peut promouvoir des admins') };
      }

      // Mettre à jour le rôle
      const { error } = await supabase
        .from('group_members')
        .update({ role: 'admin' })
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .eq('status', 'active');

      if (error) throw error;

      return { success: true, error: null };
    } catch (error) {
      console.error('Erreur promoteToAdmin:', error);
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
  async demoteFromAdmin(groupId, userId, currentUserId) {
    try {
      // Vérifier que currentUserId est le créateur
      const { data: group } = await supabase
        .from('groups')
        .select('created_by')
        .eq('id', groupId)
        .single();

      if (!group || group.created_by !== currentUserId) {
        return { success: false, error: new Error('Seul le créateur peut rétrograder des admins') };
      }

      // Mettre à jour le rôle
      const { error } = await supabase
        .from('group_members')
        .update({ role: 'member' })
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .eq('status', 'active');

      if (error) throw error;

      return { success: true, error: null };
    } catch (error) {
      console.error('Erreur demoteFromAdmin:', error);
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
  async removeMember(groupId, userId, currentUserId) {
    try {
      // Vérifier que currentUserId est owner ou admin
      const { data: currentMember } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', currentUserId)
        .eq('status', 'active')
        .single();

      if (!currentMember || !['owner', 'admin'].includes(currentMember.role)) {
        return { success: false, error: new Error('Seuls les admins et le créateur peuvent expulser des membres') };
      }

      // Vérifier que userId n'est pas le créateur
      const { data: group } = await supabase
        .from('groups')
        .select('created_by')
        .eq('id', groupId)
        .single();

      if (group && group.created_by === userId) {
        return { success: false, error: new Error('Le créateur ne peut pas être expulsé') };
      }

      // Mettre à jour le statut du membre
      const { error } = await supabase
        .from('group_members')
        .update({ status: 'removed' })
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (error) throw error;

      return { success: true, error: null };
    } catch (error) {
      console.error('Erreur removeMember:', error);
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
  async requestToJoin(groupId, userId, message = null) {
    try {
      // Vérifier si une demande existe déjà
      const { data: existing } = await supabase
        .from('group_join_requests')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        if (existing.status === 'pending') {
          return { request: existing, error: null };
        }
        // Si rejected ou approved, créer une nouvelle demande
        const { error: deleteError } = await supabase
          .from('group_join_requests')
          .delete()
          .eq('id', existing.id);

        if (deleteError) throw deleteError;
      }

      // Créer la demande
      const { data, error } = await supabase
        .from('group_join_requests')
        .insert({
          group_id: groupId,
          user_id: userId,
          message,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      return { request: data, error: null };
    } catch (error) {
      console.error('Erreur requestToJoin:', error);
      return { request: null, error };
    }
  }

  /**
   * Récupérer toutes les demandes en attente pour un groupe
   * @param {string} groupId - ID du groupe
   * @returns {Promise<{requests, error}>}
   */
  async getJoinRequests(groupId) {
    try {
      const { data, error } = await supabase
        .from('group_join_requests')
        .select('*')
        .eq('group_id', groupId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Charger les profils utilisateurs
      const userIds = [...new Set((data || []).map(req => req.user_id))];
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

      const requests = (data || []).map(req => {
        const user = userProfiles[req.user_id];
        return {
          id: req.id,
          userId: req.user_id,
          user: {
            id: req.user_id,
            name: user?.first_name && user?.last_name
              ? `${user.first_name} ${user.last_name}`
              : user?.username || 'Utilisateur',
            avatar: user?.avatar_url || null,
          },
          message: req.message,
          createdAt: req.created_at,
        };
      });

      return { requests, error: null };
    } catch (error) {
      console.error('Erreur getJoinRequests:', error);
      return { requests: [], error };
    }
  }

  /**
   * Approuver une demande d'adhésion
   * @param {string} requestId - ID de la demande
   * @param {string} approverId - ID de l'utilisateur qui approuve
   * @returns {Promise<{success, error}>}
   */
  async approveJoinRequest(requestId, approverId) {
    try {
      // Récupérer la demande
      const { data: request, error: reqError } = await supabase
        .from('group_join_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (reqError) throw reqError;
      if (!request) throw new Error('Demande inexistante');

      // Vérifier que approverId est owner ou admin
      const { data: approver } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', request.group_id)
        .eq('user_id', approverId)
        .eq('status', 'active')
        .single();

      if (!approver || !['owner', 'admin'].includes(approver.role)) {
        return { success: false, error: new Error('Seuls les admins peuvent approuver des demandes') };
      }

      // Ajouter l'utilisateur au groupe
      const { error: joinError } = await supabase
        .from('group_members')
        .insert({
          group_id: request.group_id,
          user_id: request.user_id,
          role: 'member',
          status: 'active',
        });

      if (joinError) throw joinError;

      // Mettre à jour la demande
      const { error: updateError } = await supabase
        .from('group_join_requests')
        .update({ status: 'approved' })
        .eq('id', requestId);

      if (updateError) throw updateError;

      return { success: true, error: null };
    } catch (error) {
      console.error('Erreur approveJoinRequest:', error);
      return { success: false, error };
    }
  }

  /**
   * Rejeter une demande d'adhésion
   * @param {string} requestId - ID de la demande
   * @param {string} rejectorId - ID de l'utilisateur qui rejette
   * @returns {Promise<{success, error}>}
   */
  async rejectJoinRequest(requestId, rejectorId) {
    try {
      // Récupérer la demande
      const { data: request, error: reqError } = await supabase
        .from('group_join_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (reqError) throw reqError;
      if (!request) throw new Error('Demande inexistante');

      // Vérifier que rejectorId est owner ou admin
      const { data: rejector } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', request.group_id)
        .eq('user_id', rejectorId)
        .eq('status', 'active')
        .single();

      if (!rejector || !['owner', 'admin'].includes(rejector.role)) {
        return { success: false, error: new Error('Seuls les admins peuvent rejeter des demandes') };
      }

      // Mettre à jour la demande
      const { error: updateError } = await supabase
        .from('group_join_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (updateError) throw updateError;

      return { success: true, error: null };
    } catch (error) {
      console.error('Erreur rejectJoinRequest:', error);
      return { success: false, error };
    }
  }

  /**
   * Formater un groupe pour correspondre au format attendu par l'UI
   * @private
   */
  _formatGroup(group) {
    if (!group) return null;

    return {
      id: group.id,
      name: group.name,
      description: group.description || null,
      location: group.location || null,
      avatar: group.avatar_url || null,
      createdBy: group.created_by,
      createdAt: group.created_at,
      totalDistance: Number(group.total_distance) || 0,
      totalRides: Number(group.total_rides) || 0,
      isPrivate: group.is_private || false,
      // Données calculées (seront ajoutées par le service wrapper)
      memberCount: 0,
      challenges: [],
      members: [],
      recentActivity: null,
      posts: [],
    };
  }
}

export default new GroupsService();


