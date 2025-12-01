import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, Keyboard, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import PostsService from '../services/PostsService';

const postCategories = ['Sortie', 'Info', 'Discussion'];

const CreatePostSheet = ({ sheetRef, groupId, userId, onPostCreated }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState(postCategories[0]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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

  const handleDismiss = useCallback(() => {
    setTitle('');
    setContent('');
    setType(postCategories[0]);
    setIsPublishing(false);
  }, []);

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  const handlePublish = async () => {
    const contentTrimmed = content.trim();
    if (!contentTrimmed) {
      Alert.alert('Erreur', 'Le contenu du post est requis.');
      return;
    }

    if (!userId || !groupId) {
      Alert.alert('Erreur', 'Vous devez être connecté pour publier.');
      return;
    }

    try {
      setIsPublishing(true);
      Keyboard.dismiss();

      const newPost = await PostsService.createPost({
        group_id: groupId,
        author_id: userId,
        title: title.trim() || null,
        content: contentTrimmed,
        type,
      });

      sheetRef.current?.dismiss();
      if (onPostCreated) {
        onPostCreated(newPost);
      }
    } catch (error) {
      console.error('Erreur publication post:', error);
      Alert.alert('Erreur', 'Impossible de publier le post. Veuillez réessayer.');
    } finally {
      setIsPublishing(false);
    }
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
      onDismiss={handleDismiss}
    >
      <BottomSheetScrollView
        style={styles.contentContainer}
        contentContainerStyle={[
          styles.contentContainerStyle,
          { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 20 : 20 }
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Créer une publication</Text>
          <TouchableOpacity
            onPress={() => sheetRef.current?.dismiss()}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={22} color="#1F2937" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Type de publication</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeRow}
          >
            {postCategories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.typeChip,
                  type === category && styles.typeChipActive,
                ]}
                onPress={() => setType(category)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.typeChipLabel,
                    type === category && styles.typeChipLabelActive,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Titre (optionnel)</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Titre du post"
            placeholderTextColor="#94A3B8"
            maxLength={100}
          />
          <Text style={styles.charCount}>{title.length}/100</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Contenu *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={content}
            onChangeText={setContent}
            placeholder="Décrivez la sortie ou partagez une information importante"
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={6}
            maxLength={1000}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{content.length}/1000</Text>
        </View>

        <TouchableOpacity
          style={[styles.publishButton, (!content.trim() || isPublishing) && styles.publishButtonDisabled]}
          onPress={handlePublish}
          disabled={!content.trim() || isPublishing}
          activeOpacity={0.7}
        >
          {isPublishing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="send" size={18} color="#FFFFFF" />
              <Text style={styles.publishButtonText}>Publier</Text>
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
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typeChipActive: {
    backgroundColor: '#1F2937',
    borderColor: '#1F2937',
  },
  typeChipLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  typeChipLabelActive: {
    color: '#FFFFFF',
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
    minHeight: 120,
    paddingTop: 14,
  },
  charCount: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 4,
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 8,
  },
  publishButtonDisabled: {
    opacity: 0.6,
  },
  publishButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CreatePostSheet;

