import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, ActivityIndicator, Alert, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import GroupsService from '../services/GroupsService';
import { Group } from '../services/supabase/groupsService';

interface GroupSettingsSheetProps {
  sheetRef: React.RefObject<BottomSheetModal>;
  group: Group;
  onGroupUpdated?: (group: Group) => void;
  onGroupDeleted?: () => void;
}

const GroupSettingsSheet: React.FC<GroupSettingsSheetProps> = ({ sheetRef, group, onGroupUpdated, onGroupDeleted }) => {
  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [avatar, setAvatar] = useState(group?.avatar || null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (group) {
      setName(group.name || '');
      setDescription(group.description || '');
      setAvatar(group.avatar || null);
    }
  }, [group]);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener('keyboardWillShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const keyboardDidShow = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const keyboardWillHide = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
    });
    const keyboardDidHide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      keyboardWillShow.remove();
      keyboardDidShow.remove();
      keyboardWillHide.remove();
      keyboardDidHide.remove();
    };
  }, []);

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

  const handleSelectImage = async () => {
    try {
      Alert.alert(
        'Choisir une photo',
        '',
        [
          {
            text: 'Prendre une photo',
            onPress: async () => {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission refusée', 'L\'accès à la caméra est nécessaire pour prendre une photo.');
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
              });
              if (!result.canceled && result.assets[0]) {
                setAvatar(result.assets[0].uri);
              }
            },
          },
          {
            text: 'Choisir depuis la galerie',
            onPress: async () => {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission refusée', 'L\'accès à la galerie est nécessaire.');
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
              });
              if (!result.canceled && result.assets[0]) {
                setAvatar(result.assets[0].uri);
              }
            },
          },
          { text: 'Annuler', style: 'cancel' },
        ],
        { cancelable: true }
      );
    } catch (error) {
      console.error('Erreur sélection image:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner une image.');
    }
  };

  const handleRemoveAvatar = () => {
    setAvatar(null);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom du groupe est requis.');
      return;
    }

    try {
      setSaving(true);
      Keyboard.dismiss();

      let avatarUrl = avatar;

      // Si l'avatar est une URI locale, l'uploader
      if (avatar && avatar.startsWith('file://')) {
        setUploading(true);
        // Vérifier que la méthode existe
        if (!GroupsService.uploadGroupAvatar) {
          console.error('❌ [GroupSettingsSheet] uploadGroupAvatar n\'existe pas dans GroupsService');
          throw new Error('Méthode uploadGroupAvatar non disponible');
        }
        const uploadResult = await GroupsService.uploadGroupAvatar(group.id, avatar);
        if (uploadResult.error) {
          throw uploadResult.error;
        }
        avatarUrl = uploadResult.avatarUrl;
        setUploading(false);
      }

      // Mettre à jour le groupe
      const updateResult = await GroupsService.updateGroup(group.id, {
        name: name.trim(),
        description: description.trim(),
        avatar: avatarUrl,
      });

      if (updateResult.error) {
        throw updateResult.error;
      }

      sheetRef.current?.dismiss();
      if (onGroupUpdated && updateResult.group) {
        onGroupUpdated(updateResult.group);
      }
    } catch (error) {
      console.error('Erreur sauvegarde groupe:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder les modifications.');
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleDeleteGroup = async () => {
    Alert.alert(
      'Supprimer le groupe',
      'Êtes-vous sûr de vouloir supprimer définitivement ce groupe ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              const result: any = await GroupsService.deleteGroup(group.id);
              if (result.success) {
                sheetRef.current?.dismiss();
                if (onGroupDeleted) {
                  onGroupDeleted();
                }
              } else {
                Alert.alert('Erreur', result.error?.message || 'Suppression impossible');
              }
            } catch (error) {
              console.error('Erreur suppression groupe:', error);
              Alert.alert('Erreur', 'Une erreur s\'est produite');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      enablePanDownToClose
      enableOverDrag={false}
      enableDynamicSizing={true}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetScrollView
        style={styles.contentContainer}
        contentContainerStyle={[
          styles.contentContainerStyle,
          { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 20 : 40 }
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Paramètres du groupe</Text>
          <TouchableOpacity
            onPress={() => sheetRef.current?.dismiss()}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={22} color="#1F2937" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Photo du groupe</Text>
          <View style={styles.avatarSection}>
            {avatar ? (
              <View style={styles.avatarWrapper}>
                <View style={styles.avatarImageContainer}>
                  <Image source={{ uri: avatar }} style={styles.avatarImage} />
                  <TouchableOpacity
                    style={styles.avatarEditButton}
                    onPress={handleSelectImage}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="camera" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleRemoveAvatar}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  <Text style={styles.deleteButtonText}>Supprimer la photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addAvatarButton}
                onPress={handleSelectImage}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-outline" size={32} color="#475569" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Nom du groupe *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Nom du groupe"
            placeholderTextColor="#94A3B8"
            maxLength={50}
          />
          <Text style={styles.charCount}>{name.length}/50</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Description du groupe"
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={4}
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{description.length}/500</Text>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, (saving || uploading) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving || uploading}
          activeOpacity={0.7}
        >
          {saving || uploading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.deleteGroupButton}
          onPress={handleDeleteGroup}
          disabled={saving || uploading}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
          <Text style={styles.deleteGroupText}>Supprimer le groupe</Text>
        </TouchableOpacity>
        <Text style={styles.deleteGroupHint}>
          Cette action est irréversible et supprimera toutes les données du groupe.
        </Text>
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
  avatarSection: {
    alignItems: 'center',
    marginTop: 8,
  },
  avatarWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F1F5F9',
  },
  avatarEditButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  deleteButtonText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
    marginLeft: 6,
  },
  addAvatarButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
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
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  charCount: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 24,
  },
  deleteGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    marginBottom: 8,
  },
  deleteGroupText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  deleteGroupHint: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
});

export default GroupSettingsSheet;

