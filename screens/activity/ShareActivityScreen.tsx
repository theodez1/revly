import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions, Alert, Clipboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import ShareCard from '../../components/ShareCard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
const { width: screenWidth } = Dimensions.get('window');

export default function ShareActivityScreen({ route, navigation }) {
  const ride = route?.params?.ride || {};
  const [shareVariant, setShareVariant] = useState('strava-clean');
  const shotRef = useRef(null);

  const handleClose = () => {
    navigation.goBack();
  };

  const handleShare = async (method) => {
    try {
      if (!shotRef.current) {
        Alert.alert('Erreur', 'Impossible de générer l\'image');
        return;
      }

      // Attendre un peu pour que le composant se rende
      await new Promise(resolve => setTimeout(resolve, 500));

      const uri = await shotRef.current.capture();

      switch (method) {
        case 'instagram':
          // Pour Instagram Story, on utilise le partage natif
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
              mimeType: 'image/png',
              dialogTitle: 'Partager sur Instagram',
            });
          }
          break;

        case 'snapchat':
          // Pour Snapchat, on utilise le partage natif
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
              mimeType: 'image/png',
              dialogTitle: 'Partager sur Snapchat',
            });
          }
          break;

        case 'copy':
          // Copier l'image dans le presse-papier (base64)
          try {
            const base64 = await FileSystem.readAsStringAsync(uri, {
              encoding: 'base64',
            });
          await (Clipboard as any).setStringAsync(`data:image/png;base64,${base64}`);
            Alert.alert('Succès', 'Image copiée dans le presse-papier');
          } catch (e) {
            Alert.alert('Erreur', 'Impossible de copier l\'image');
          }
          break;

        case 'save':
          // Enregistrer dans la galerie
          try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission requise', 'L\'accès à la galerie est nécessaire pour enregistrer l\'image');
              return;
            }
            await MediaLibrary.createAssetAsync(uri);
            Alert.alert('Succès', 'Image enregistrée dans la galerie');
          } catch (e) {
            Alert.alert('Erreur', 'Impossible d\'enregistrer l\'image');
          }
          break;

        case 'copy-link':
          // Copier un lien (ici on copie juste l'URI)
          await (Clipboard as any).setStringAsync(uri as any);
          Alert.alert('Succès', 'Lien copié');
          break;

        case 'more':
          // Ouvrir le menu de partage natif
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
              mimeType: 'image/png',
              dialogTitle: 'Partager l\'activité',
            });
          }
          break;

        default:
          break;
      }
    } catch (error) {
      console.error('Erreur lors du partage:', error);
      Alert.alert('Erreur', 'Impossible de partager l\'activité');
    }
  };

  return (
    <Modal visible={true} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Fermer</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Partager l'activité</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Preview de la carte de partage */}
        <View style={styles.previewContainer}>
          <ViewShot
            ref={shotRef}
            style={styles.shotContainer}
            // @ts-ignore - backgroundColor est accepté par la lib mais pas typé dans CaptureOptions
            options={{ format: 'png', quality: 1.0, result: 'tmpfile', backgroundColor: 'transparent' } as any}
          >
            <ShareCard ride={ride} />
          </ViewShot>
        </View>

        {/* Options de partage */}
        <View style={styles.shareSection}>
          <Text style={styles.shareSectionTitle}>Partager sur</Text>
          <View style={styles.shareGrid}>
            {/* Instagram Story */}
            <TouchableOpacity
              style={styles.shareOption}
              onPress={() => handleShare('instagram')}
            >
              <View style={[styles.shareIcon, styles.instagramGradient]}>
                <Ionicons name="camera-outline" size={28} color="#FFFFFF" />
              </View>
              <Text style={styles.shareLabel}>Story</Text>
            </TouchableOpacity>

            {/* Snapchat */}
            <TouchableOpacity
              style={styles.shareOption}
              onPress={() => handleShare('snapchat')}
            >
              <View style={[styles.shareIcon, { backgroundColor: '#FFFC00' }]}>
                <Ionicons name="chatbubble-outline" size={28} color="#000000" />
              </View>
              <Text style={styles.shareLabel}>Snapchat</Text>
            </TouchableOpacity>

            {/* Copier */}
            <TouchableOpacity
              style={styles.shareOption}
              onPress={() => handleShare('copy')}
            >
              <View style={[styles.shareIcon, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' }]}>
                <Ionicons name="copy-outline" size={28} color="#000000" />
              </View>
              <Text style={styles.shareLabel}>Copier</Text>
            </TouchableOpacity>

            {/* Enregistrer */}
            <TouchableOpacity
              style={styles.shareOption}
              onPress={() => handleShare('save')}
            >
              <View style={[styles.shareIcon, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' }]}>
                <Ionicons name="download-outline" size={28} color="#000000" />
              </View>
              <Text style={styles.shareLabel}>Enregistrer</Text>
            </TouchableOpacity>

            {/* Copier le lien */}
            <TouchableOpacity
              style={styles.shareOption}
              onPress={() => handleShare('copy-link')}
            >
              <View style={[styles.shareIcon, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' }]}>
                <Ionicons name="link-outline" size={28} color="#000000" />
              </View>
              <Text style={styles.shareLabel}>Copier le lien</Text>
            </TouchableOpacity>

            {/* Plus */}
            <TouchableOpacity
              style={styles.shareOption}
              onPress={() => handleShare('more')}
            >
              <View style={[styles.shareIcon, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' }]}>
                <Ionicons name="ellipsis-horizontal-outline" size={28} color="#000000" />
              </View>
              <Text style={styles.shareLabel}>Plus</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 16, fontWeight: '400',
    color: '#1E3A8A',
  },
  headerTitle: {
    fontSize: 18, fontWeight: '700',
    color: '#111827',
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F9FAFB',
  },
  shotContainer: {
    backgroundColor: 'transparent',
  },
  shareSection: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  shareSectionTitle: {
    fontSize: 16, fontWeight: '400',
    color: '#111827',
    marginBottom: 16,
  },
  shareGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  shareOption: {
    alignItems: 'center',
    width: (screenWidth - 60) / 3,
  },
  shareIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  instagramGradient: {
    backgroundColor: '#E1306C',
    // Note: Pour un vrai dégradé Instagram, il faudrait utiliser LinearGradient
    // Mais pour simplifier, on utilise une couleur unie
  },
  shareLabel: {
    fontSize: 12,
    color: '#111827', textAlign: 'center',
  },
});

