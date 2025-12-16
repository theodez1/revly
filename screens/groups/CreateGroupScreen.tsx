import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import GroupsService from '../../services/GroupsService';
import groupsService from '../../services/supabase/groupsService';
export default function CreateGroupScreen() {
  console.log('🎬 [CreateGroupScreen] COMPOSANT MONTÉ');
  const navigation = useNavigation();
  const { user } = useAuth();
  console.log('👤 [CreateGroupScreen] User:', user?.id);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [avatarUri, setAvatarUri] = useState(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const imagePickerSheetRef = useRef(null);
  const snapPoints = useMemo(() => ['30%'], []);

  const renderBackdrop = (props) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
  );

  const openImagePicker = () => {
    imagePickerSheetRef.current?.present();
  };

  const pickFromCamera = async () => {
    imagePickerSheetRef.current?.dismiss();
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Autorisez l\'accès à la caméra pour prendre une photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });

      const asset = result.assets && result.assets[0];
      if (!result.canceled && asset?.uri) {
        setAvatarUri(asset.uri);
      }
    } catch (e) {
      console.error('Erreur caméra:', e);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la prise de photo');
    }
  };

  const pickFromGallery = async () => {
    imagePickerSheetRef.current?.dismiss();
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Autorisez l\'accès aux photos pour définir l\'avatar du groupe.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });

      const asset = result.assets && result.assets[0];
      if (!result.canceled && asset?.uri) {
        setAvatarUri(asset.uri);
      }
    } catch (e) {
      console.error('Erreur galerie:', e);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la sélection de la photo');
    }
  };

  const handleCreate = async () => {
    console.log('🚀 [CreateGroupScreen] handleCreate appelé');
    console.log('📝 [CreateGroupScreen] État:', { name, user: user?.id });

    if (!name.trim()) {
      console.warn('⚠️ [CreateGroupScreen] Nom vide');
      Alert.alert('Nom requis', 'Merci de renseigner un nom de groupe.');
      return;
    }

    if (!user?.id) {
      console.warn('⚠️ [CreateGroupScreen] Pas d\'utilisateur');
      Alert.alert('Erreur', 'Vous devez être connecté pour créer un groupe.');
      return;
    }

    console.log('✅ [CreateGroupScreen] Validation OK, création du groupe...');
    setIsSubmitting(true);

    try {
      let avatarUrl = null;

      console.log('📤 [CreateGroupScreen] Appel GroupsService.createGroup avec:', {
        name: name.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        created_by: user.id,
      });

      // Créer le groupe d'abord
      const newGroup = await GroupsService.createGroup({
        name: name.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        avatar_url: null, // On uploadera après création
        is_private: isPrivate,
        created_by: user.id,
      });

      console.log('📥 [CreateGroupScreen] Groupe créé:', { id: newGroup?.id, memberCount: newGroup?.memberCount });

      // Upload l'avatar si une photo a été sélectionnée
      if (avatarUri && newGroup.id) {
        setIsUploadingAvatar(true);
        try {
          const { url, error } = await groupsService.uploadGroupAvatar(newGroup.id, avatarUri);
          if (error) {
            console.warn('Erreur upload avatar:', error);
          } else if (url) {
            // Mettre à jour le groupe avec la nouvelle URL
            await GroupsService.updateGroup(newGroup.id, { avatar_url: url });
            newGroup.avatar = url;
          }
        } catch (uploadError) {
          console.warn('Erreur upload avatar:', uploadError);
        } finally {
          setIsUploadingAvatar(false);
        }
      }

      Alert.alert('Groupe créé', 'Votre groupe a été créé avec succès.', [
        {
          text: 'OK',
          onPress: () => {
            navigation.goBack();
            // Naviguer vers le détail du groupe créé avec les données complètes
            (navigation as any).navigate('GroupDetail', { group: newGroup });
          },
        },
      ]);
    } catch (error) {
      console.error('Erreur création groupe:', error);
      Alert.alert('Erreur', 'Impossible de créer le groupe. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Créer un groupe</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.introSection}>
            <Text style={styles.introTitle}>Rassemblez vos amis</Text>
            <Text style={styles.introSubtitle}>
              Créez un groupe pour partager vos trajets, défis et discussions avec votre communauté.
            </Text>
          </View>

          <View style={styles.formSection}>
            {/* Avatar du groupe */}
            <View style={styles.avatarSection}>
              <Text style={styles.inputLabel}>Photo du groupe</Text>
              <View style={styles.avatarWrapper}>
                <TouchableOpacity
                  style={styles.avatarContainer}
                  onPress={openImagePicker}
                  disabled={isUploadingAvatar}
                >
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <View style={styles.avatarIconContainer}>
                        <Ionicons name="camera-outline" size={28} color="#64748B" />
                      </View>
                      <Text style={styles.avatarPlaceholderText}>Ajouter une photo</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {avatarUri && (
                  <TouchableOpacity
                    style={styles.removeAvatarButton}
                    onPress={() => setAvatarUri(null)}
                  >
                    <Ionicons name="close-circle" size={28} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Nom du groupe <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ex: Road Warriors"
                placeholderTextColor="#94A3B8"
                style={styles.textInput}
                maxLength={40}
                autoFocus
              />
              <Text style={styles.charCount}>{name.length}/40</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Décrivez votre groupe en quelques mots"
                placeholderTextColor="#94A3B8"
                style={[styles.textInput, styles.multilineInput]}
                multiline
                numberOfLines={4}
                maxLength={160}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{description.length}/160</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ville / Région</Text>
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder="Ex: Paris, Île-de-France"
                placeholderTextColor="#94A3B8"
                style={styles.textInput}
                maxLength={60}
              />
              <Text style={styles.charCount}>{location.length}/60</Text>
            </View>

            {/* Privacy Toggle */}
            <View style={styles.privacySection}>
              <View style={styles.privacyHeader}>
                <View style={styles.privacyTitleContainer}>
                  <Text style={styles.inputLabel}>Type de groupe</Text>
                  <View style={styles.privacyBadge}>
                    <Ionicons
                      name={isPrivate ? "lock-closed" : "globe-outline"}
                      size={14}
                      color={isPrivate ? "#EF4444" : "#10B981"}
                    />
                    <Text style={[styles.privacyBadgeText, isPrivate && styles.privacyBadgeTextPrivate]}>
                      {isPrivate ? 'Privé' : 'Public'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isPrivate}
                  onValueChange={setIsPrivate}
                  trackColor={{ false: '#E2E8F0', true: '#1E3A8A' }}
                  thumbColor={isPrivate ? '#FFFFFF' : '#FFFFFF'}
                  ios_backgroundColor="#E2E8F0"
                />
              </View>
              <View style={styles.privacyInfo}>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color="#64748B"
                />
                <Text style={styles.privacyInfoText}>
                  {isPrivate
                    ? "Les nouveaux membres devront être approuvés par un administrateur"
                    : "Tout le monde peut rejoindre ce groupe librement"}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Footer avec bouton */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, (isSubmitting || isUploadingAvatar) && styles.submitButtonDisabled]}
            disabled={isSubmitting || isUploadingAvatar || !name.trim()}
            onPress={handleCreate}
          >
            {(isSubmitting || isUploadingAvatar) ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Créer le groupe</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* BottomSheet pour choisir la source de l'image */}
      <BottomSheetModal
        ref={imagePickerSheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
      >
        <View style={styles.bottomSheetContent}>
          <Text style={styles.bottomSheetTitle}>Choisir une photo</Text>

          <TouchableOpacity
            style={styles.bottomSheetOption}
            onPress={pickFromCamera}
          >
            <View style={styles.bottomSheetOptionIcon}>
              <Ionicons name="camera" size={24} color="#1F2937" />
            </View>
            <Text style={styles.bottomSheetOptionText}>Prendre une photo</Text>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bottomSheetOption}
            onPress={pickFromGallery}
          >
            <View style={styles.bottomSheetOptionIcon}>
              <Ionicons name="images" size={24} color="#1F2937" />
            </View>
            <Text style={styles.bottomSheetOptionText}>Choisir depuis la galerie</Text>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20, color: '#1F2937',
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  introSection: {
    marginBottom: 32,
  },
  introTitle: {
    fontSize: 28, color: '#1F2937',
    marginBottom: 8,
  },
  introSubtitle: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 24,
  },
  formSection: {
    gap: 24,
  },
  avatarSection: {
    marginBottom: 8,
  },
  avatarWrapper: {
    width: 120,
    height: 120,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  avatarIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 13,
    color: '#64748B', textAlign: 'center',
  },
  removeAvatarButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    zIndex: 10,
  },
  inputGroup: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 16, fontWeight: '400',
    color: '#1F2937',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    minHeight: 48,
  },
  multilineInput: {
    minHeight: 100,
    paddingTop: 12,
    paddingBottom: 12,
  },
  charCount: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 4,
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 20 : 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1F2937',
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16, fontWeight: '400',
    color: '#FFFFFF',
  },
  bottomSheetBackground: {
    backgroundColor: '#FFFFFF',
  },
  bottomSheetIndicator: {
    backgroundColor: '#E2E8F0',
    width: 40,
    height: 4,
  },
  bottomSheetContent: {
    padding: 20,
    paddingTop: 10,
  },
  bottomSheetTitle: {
    fontSize: 20, color: '#1F2937',
    marginBottom: 20,
  },
  bottomSheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  bottomSheetOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bottomSheetOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  privacySection: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  privacyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  privacyTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  privacyBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  privacyBadgeTextPrivate: {
    color: '#EF4444',
  },
  privacyInfo: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  privacyInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
});
