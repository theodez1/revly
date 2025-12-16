import { supabase } from '../../config/supabase';

export interface Invitation {
  id: string;
  groupId: string;
  groupName: string | null;
  groupAvatar: string | null;
  invitedBy: string;
  invitedByName: string;
  invitedUserId: string | null;
  email: string | null;
  status: string;
  createdAt: string;
}

/**
 * Service de gestion des invitations de groupe Supabase
 */
class InvitationsService {
  /**
   * Créer une invitation
   * @param {Object} invitationData - {group_id, invited_by, invited_user_id, email}
   * @returns {Promise<{invitation: Invitation | null, error: any}>}
   */
  async createInvitation(invitationData: any): Promise<{ invitation: Invitation | null; error: any }> {
    try {
      const { group_id, invited_by, invited_user_id, email } = invitationData;

      if (!group_id || !invited_by) {
        throw new Error('group_id et invited_by sont requis');
      }

      if (!invited_user_id && !email) {
        throw new Error('invited_user_id ou email est requis');
      }

      const { data, error } = await supabase
        .from('group_invitations')
        .insert({
          group_id,
          invited_by,
          invited_user_id: invited_user_id || null,
          email: email || null,
          status: 'pending',
        })
        .select('*')
        .single();

      if (error) throw error;

      // Charger les données du groupe et de l'inviteur séparément
      let group = null;
      let invitedByUser = null;

      try {
        const [groupResult, userResult] = await Promise.all([
          supabase.from('groups').select('id, name, avatar_url').eq('id', data.group_id).single(),
          supabase.from('users').select('id, username, first_name, last_name, avatar_url').eq('id', data.invited_by).single(),
        ]);
        group = groupResult.data;
        invitedByUser = userResult.data;
      } catch (loadError) {
        console.warn('Erreur chargement données invitation:', loadError);
      }

      const invitation: Invitation = {
        id: data.id,
        groupId: data.group_id,
        groupName: group?.name || null,
        groupAvatar: group?.avatar_url || null,
        invitedBy: data.invited_by,
        invitedByName: invitedByUser?.first_name && invitedByUser?.last_name
          ? `${invitedByUser.first_name} ${invitedByUser.last_name}`
          : invitedByUser?.username || 'Utilisateur',
        invitedUserId: data.invited_user_id,
        email: data.email,
        status: data.status,
        createdAt: data.created_at,
      };

      return { invitation, error: null };
    } catch (error) {
      console.error('Erreur createInvitation:', error);
      return { invitation: null, error };
    }
  }

  /**
   * Récupérer les invitations d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<{invitations: Invitation[], error: any}>}
   */
  async getUserInvitations(userId: string): Promise<{ invitations: Invitation[]; error: any }> {
    try {
      // Récupérer les invitations par user_id
      const { data: byUserId, error: error1 } = await supabase
        .from('group_invitations')
        .select('*')
        .eq('invited_user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error1) throw error1;

      // Récupérer les invitations par email (nécessite de récupérer l'email de l'utilisateur)
      const { data: userData } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      let byEmail: any[] = [];
      if (userData?.email) {
        const { data, error: error2 } = await supabase
          .from('group_invitations')
          .select('*')
          .eq('email', userData.email)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (error2) {
          console.warn('Erreur récupération invitations par email:', error2);
        } else {
          byEmail = data || [];
        }
      }

      // Combiner et dédupliquer
      const allInvitations = [...(byUserId || []), ...byEmail];
      const uniqueInvitations = Array.from(
        new Map(allInvitations.map((inv: any) => [inv.id, inv])).values()
      );

      // Charger les données des groupes et invités séparément
      const groupIds = [...new Set(uniqueInvitations.map((inv: any) => inv.group_id))];
      const invitedByIds = [...new Set(uniqueInvitations.map((inv: any) => inv.invited_by))];

      const groupsMap: Record<string, any> = {};
      const usersMap: Record<string, any> = {};

      try {
        const [groupsResult, usersResult] = await Promise.all([
          supabase.from('groups').select('id, name, avatar_url').in('id', groupIds),
          supabase.from('users').select('id, username, first_name, last_name, avatar_url').in('id', invitedByIds),
        ]);

        (groupsResult.data || []).forEach((group: any) => {
          groupsMap[group.id] = group;
        });

        (usersResult.data || []).forEach((user: any) => {
          usersMap[user.id] = user;
        });
      } catch (loadError) {
        console.warn('Erreur chargement données invitations:', loadError);
      }

      const invitations: Invitation[] = uniqueInvitations.map((data: any) => {
        const group = groupsMap[data.group_id];
        const invitedByUser = usersMap[data.invited_by];
        return {
          id: data.id,
          groupId: data.group_id,
          groupName: group?.name || null,
          groupAvatar: group?.avatar_url || null,
          invitedBy: data.invited_by,
          invitedByName: invitedByUser?.first_name && invitedByUser?.last_name
            ? `${invitedByUser.first_name} ${invitedByUser.last_name}`
            : invitedByUser?.username || 'Utilisateur',
          invitedUserId: data.invited_user_id,
          email: data.email,
          status: data.status,
          createdAt: data.created_at,
        };
      });

      return { invitations, error: null };
    } catch (error) {
      console.error('Erreur getUserInvitations:', error);
      return { invitations: [], error };
    }
  }

  /**
   * Accepter une invitation
   * @param {string} invitationId - ID de l'invitation
   * @param {string} userId - ID de l'utilisateur qui accepte
   * @returns {Promise<{member: any, error: any}>}
   */
  async acceptInvitation(invitationId: string, userId: string): Promise<{ member: any; error: any }> {
    try {
      // Récupérer l'invitation
      const { data: invitation, error: error1 } = await supabase
        .from('group_invitations')
        .select('*')
        .eq('id', invitationId)
        .single();

      if (error1) throw error1;

      if (invitation.status !== 'pending') {
        throw new Error('Cette invitation a déjà été traitée');
      }

      // Mettre à jour le statut de l'invitation
      const { error: error2 } = await supabase
        .from('group_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitationId);

      if (error2) throw error2;

      // Ajouter l'utilisateur au groupe
      const { data: member, error: error3 } = await supabase
        .from('group_members')
        .insert({
          group_id: invitation.group_id,
          user_id: userId,
          role: 'member',
          status: 'active',
        })
        .select()
        .single();

      if (error3) {
        // Si l'utilisateur est déjà membre, récupérer le membre existant
        const { data: existing } = await supabase
          .from('group_members')
          .select('*')
          .eq('group_id', invitation.group_id)
          .eq('user_id', userId)
          .single();

        if (existing) {
          return { member: existing, error: null };
        }
        throw error3;
      }

      return { member, error: null };
    } catch (error) {
      console.error('Erreur acceptInvitation:', error);
      return { member: null, error };
    }
  }

  /**
   * Refuser une invitation
   * @param {string} invitationId - ID de l'invitation
   * @returns {Promise<{error: any}>}
   */
  async declineInvitation(invitationId: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('group_invitations')
        .update({ status: 'declined' })
        .eq('id', invitationId);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Erreur declineInvitation:', error);
      return { error };
    }
  }
}

export default new InvitationsService();

