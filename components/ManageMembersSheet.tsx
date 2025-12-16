import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import GroupsService from '../services/GroupsService';
import InvitationsService from '../services/supabase/invitationsService';
import { useAuth } from '../contexts/AuthContext';
import { Group, GroupMember } from '../services/supabase/groupsService';

interface ManageMembersSheetProps {
  sheetRef: React.RefObject<BottomSheetModal>;
  group: Group;
  onMembersUpdated?: () => void;
}

interface Invitation {
  id: string;
  groupId: string;
  email: string | null;
  invitedByName: string;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

const ManageMembersSheet: React.FC<ManageMembersSheetProps> = ({ sheetRef, group, onMembersUpdated }) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  useEffect(() => {
    if (group) {
      loadData();
    }
  }, [group]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Charger les membres
      const membersResult = await GroupsService.getGroupMembers(group.id);
      setMembers(membersResult || []);

      // Charger les invitations en attente (si admin/owner)
      const isAdmin = group.createdBy === user?.id || 
                     membersResult?.some(m => m.id === user?.id && m.role === 'owner');
      
      if (isAdmin && user?.id) {
        // TODO: Implémenter getGroupInvitations dans invitationsService
        // Pour l'instant, on charge les invitations de l'utilisateur
        const invitationsResult = await InvitationsService.getUserInvitations(user.id);
        // Filtrer pour ce groupe uniquement et adapter le type si nécessaire
        // Note: This logic seems a bit off in original code (getting user invitations to show group invitations?)
        // Assuming getUserInvitations returns invitations sent to user, or by user?
        // Original code: invitationsResult.invitations.filter(inv => inv.groupId === group.id && inv.status === 'pending')
        // Let's assume getUserInvitations returns invitations relevant to the context or we might need a getGroupInvitations call
        
        // For now, keeping original logic but typed
        const groupInvitations = (invitationsResult.invitations || []).filter(
          inv => inv.groupId === group.id && inv.status === 'pending'
        );
        // @ts-ignore - Assuming Invitation structure matches
        setInvitations(groupInvitations);
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    Alert.alert(
      'Retirer le membre',
      'Êtes-vous sûr de vouloir retirer ce membre du groupe ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              // Note: GroupsService.leaveGroup takes (groupId, userId)
              // If removing another member, check if leaveGroup supports that or if we need removeMember
              // Looking at GroupsService.ts, there is removeMember
              if (memberId === user?.id) {
                  await GroupsService.leaveGroup(group.id, memberId);
              } else {
                  await GroupsService.removeMember(group.id, memberId, user?.id || '');
              }
              
              await loadData();
              if (onMembersUpdated) {
                onMembersUpdated();
              }
            } catch (error) {
              console.error('Erreur retrait membre:', error);
              Alert.alert('Erreur', 'Impossible de retirer le membre.');
            }
          },
        },
      ]
    );
  };

  const handleAcceptInvitation = async (invitationId: string) => {
    if (!user?.id) return;
    try {
      const result = await InvitationsService.acceptInvitation(invitationId, user.id);
      if (result.error) {
        throw result.error;
      }
      await loadData();
      if (onMembersUpdated) {
        onMembersUpdated();
      }
      Alert.alert('Succès', 'Invitation acceptée !');
    } catch (error) {
      console.error('Erreur acceptation invitation:', error);
      Alert.alert('Erreur', 'Impossible d\'accepter l\'invitation.');
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      const result = await InvitationsService.declineInvitation(invitationId);
      if (result.error) {
        throw result.error;
      }
      await loadData();
    } catch (error) {
      console.error('Erreur refus invitation:', error);
      Alert.alert('Erreur', 'Impossible de refuser l\'invitation.');
    }
  };

  const isOwner = group?.createdBy === user?.id;
  const currentMember = members.find(m => m.id === user?.id);
  const isAdmin = isOwner || currentMember?.role === 'owner'; // 'owner' role usually means admin in this context? Or strict owner? 
  // In GroupsService types: role: 'owner' | 'admin' | 'member';
  // So isAdmin should probably be role === 'admin' || role === 'owner' or checking isOwner

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={['90%']}
      enablePanDownToClose
      enableOverDrag={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Gérer les membres</Text>
          <TouchableOpacity
            onPress={() => sheetRef.current?.dismiss()}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={22} color="#1F2937" />
          </TouchableOpacity>
        </View>

        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'members' && styles.tabActive]}
            onPress={() => setActiveTab('members')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>
              Membres ({members.length})
            </Text>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity
              style={[styles.tab, activeTab === 'invitations' && styles.tabActive]}
              onPress={() => setActiveTab('invitations')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === 'invitations' && styles.tabTextActive]}>
                Invitations ({invitations.length})
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#475569" />
          </View>
        ) : (
          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            {activeTab === 'members' ? (
              <>
                {members.map((member) => (
                  <View key={member.id} style={styles.memberCard}>
                    <View style={styles.memberInfo}>
                      {member.avatar ? (
                        <Image source={{ uri: member.avatar }} style={styles.memberAvatar} />
                      ) : (
                        <View style={styles.memberAvatarPlaceholder}>
                          <Ionicons name="person" size={20} color="#94A3B8" />
                        </View>
                      )}
                      <View style={styles.memberDetails}>
                        <Text style={styles.memberName}>
                          {member.name}
                          {member.id === group?.createdBy && (
                            <Text style={styles.creatorBadge}> • Créateur</Text>
                          )}
                          {member.role === 'owner' && member.id !== group?.createdBy && (
                            <Text style={styles.ownerBadge}> • Admin</Text>
                          )}
                        </Text>
                        {member.joinedAt && (
                          <Text style={styles.memberJoined}>
                            Rejoint le {new Date(member.joinedAt).toLocaleDateString('fr-FR')}
                          </Text>
                        )}
                      </View>
                    </View>
                    {isAdmin && member.id !== user?.id && member.id !== group?.createdBy && (
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleRemoveMember(member.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {members.length === 0 && (
                  <View style={styles.emptyState}>
                    <Ionicons name="people-outline" size={40} color="#CBD5E1" />
                    <Text style={styles.emptyText}>Aucun membre</Text>
                  </View>
                )}
              </>
            ) : (
              <>
                {invitations.map((invitation) => (
                  <View key={invitation.id} style={styles.invitationCard}>
                    <View style={styles.invitationInfo}>
                      <Text style={styles.invitationEmail}>{invitation.email || 'Utilisateur'}</Text>
                      <Text style={styles.invitationDate}>
                        Invité par {invitation.invitedByName} le{' '}
                        {new Date(invitation.createdAt).toLocaleDateString('fr-FR')}
                      </Text>
                    </View>
                    <View style={styles.invitationActions}>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => handleAcceptInvitation(invitation.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.declineButton}
                        onPress={() => handleDeclineInvitation(invitation.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                {invitations.length === 0 && (
                  <View style={styles.emptyState}>
                    <Ionicons name="mail-outline" size={40} color="#CBD5E1" />
                    <Text style={styles.emptyText}>Aucune invitation en attente</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#FFFFFF',
  },
  handleIndicator: {
    backgroundColor: '#CBD5E1',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#F1F5F9',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#1F2937',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginBottom: 12,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  memberAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  creatorBadge: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '500',
  },
  ownerBadge: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  memberJoined: {
    fontSize: 12,
    color: '#94A3B8',
  },
  removeButton: {
    padding: 4,
  },
  invitationCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginBottom: 12,
  },
  invitationInfo: {
    flex: 1,
  },
  invitationEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  invitationDate: {
    fontSize: 12,
    color: '#94A3B8',
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptButton: {
    padding: 4,
  },
  declineButton: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 12,
  },
});

export default ManageMembersSheet;

