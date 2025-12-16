import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import InvitationsService from '../services/supabase/invitationsService';
import { useAuth } from '../contexts/AuthContext';
import { Group } from '../services/supabase/groupsService';

interface InviteMembersSheetProps {
  sheetRef: React.RefObject<BottomSheetModal>;
  group: Group;
  onInvitationSent?: () => void;
}

const InviteMembersSheet: React.FC<InviteMembersSheetProps> = ({ sheetRef, group, onInvitationSent }) => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

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

  const handleSendInvitation = async () => {
    if (!email.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse email.');
      return;
    }

    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté pour inviter des membres.');
      return;
    }

    // Validation basique de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse email valide.');
      return;
    }

    try {
      setSending(true);
      Keyboard.dismiss();

      const result = await InvitationsService.createInvitation({
        group_id: group.id,
        invited_by: user.id,
        email: email.trim(),
      });

      if (result.error) {
        throw result.error;
      }

      Alert.alert('Succès', 'Invitation envoyée avec succès !');
      setEmail('');
      if (onInvitationSent) {
        onInvitationSent();
      }
    } catch (error: any) {
      console.error('Erreur envoi invitation:', error);
      Alert.alert('Erreur', error.message || 'Impossible d\'envoyer l\'invitation.');
    } finally {
      setSending(false);
    }
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={['50%']}
      enablePanDownToClose
      enableOverDrag={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetScrollView
        style={styles.contentContainer}
        contentContainerStyle={styles.contentContainerStyle}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Inviter un membre</Text>
          <TouchableOpacity
            onPress={() => sheetRef.current?.dismiss()}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={22} color="#1F2937" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Adresse email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="email@exemple.com"
            placeholderTextColor="#94A3B8"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.hint}>
            L'invitation sera envoyée à cette adresse email
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.sendButton, sending && styles.sendButtonDisabled]}
          onPress={handleSendInvitation}
          disabled={sending}
          activeOpacity={0.7}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="send" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.sendButtonText}>Envoyer l'invitation</Text>
            </>
          )}
        </TouchableOpacity>
      </BottomSheetScrollView>
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
  contentContainer: {
    flex: 1,
  },
  contentContainerStyle: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hint: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
  },
  sendButton: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default InviteMembersSheet;

