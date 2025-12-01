import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, NativeModules, Platform } from 'react-native';
import ViewShot from 'react-native-view-shot';
import Share from 'react-native-share';
import ShareCard from '../../components/ShareCard';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

const { InstagramStoriesShare } = NativeModules;

const TEMPLATES = [
  { key: 'stats-only', label: 'Stats seulement' },
  { key: 'route-stats', label: 'Carte + stats' },
  { key: 'mini-route', label: 'Mini trajet + véhicule' },
];

export default function ShareComposerScreen({ route }) {
  const ride = route?.params?.ride || {};
  const [template, setTemplate] = useState('route-stats');
  const shotRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const previewWidth = useMemo(() => {
    const screenWidth = Dimensions.get('window').width;
    return Math.min(screenWidth - 48, 360);
  }, []);

  const captureShareImage = async () => {
    if (!shotRef.current) {
      throw new Error('capture_ref_missing');
    }
    return await shotRef.current.capture();
  };

  const onExport = async () => {
    try {
      if (isProcessing) return;
      setIsProcessing(true);
      const uri = await captureShareImage();
      await Share.open({ url: uri, type: 'image/png' });
    } catch (e) {}
    finally {
      setIsProcessing(false);
    }
  };

  const onShareInstagramStory = async () => {
    try {
      if (isProcessing) return;
      setIsProcessing(true);
      const uri = await captureShareImage();

      if (Platform.OS === 'ios') {
        if (!InstagramStoriesShare) {
          console.warn('InstagramStoriesShare native module is missing');
          Alert.alert(
            'Instagram Stories',
            "Le module natif n'est pas chargé. Rebuild nécessaire et vérifier la cible iOS dans Xcode (Target Membership)."
          );
          return;
        }
        // Utiliser le module natif iOS pour Instagram Stories
        await InstagramStoriesShare.sharePNG(uri);
      } else {
        // Fallback Android
        await Share.shareSingle({
          social: Share.Social.INSTAGRAM_STORIES,
          stickerImage: uri,
          backgroundTopColor: '#0F172A',
          backgroundBottomColor: '#0F172A',
          attributionURL: 'https://revly.app',
        });
      }
    } catch (e) {
      console.error('Erreur partage Instagram:', e);
      Alert.alert(
        'Instagram Stories',
        e.message?.includes('NOT_INSTALLED') || e.message?.includes('NOT_AVAILABLE')
          ? 'Instagram n\'est pas installé. Veuillez installer Instagram depuis l\'App Store.'
          : 'Le partage vers Instagram Stories a échoué. Assurez-vous qu\'Instagram est installé et réessayez.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const onCopyToClipboard = async () => {
    try {
      if (isProcessing) return;
      setIsProcessing(true);
      const uri = await captureShareImage();
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      await Clipboard.setImageAsync(`data:image/png;base64,${base64}`);
      Alert.alert('Copié', "L'image a été copiée dans le presse-papiers.");
    } catch (e) {
      console.error('Erreur copie presse-papiers:', e);
      Alert.alert('Erreur', "Impossible de copier l'image. Réessayez.");
    } finally {
      setIsProcessing(false);
    }
  };

  const ensureMediaPermission = async () => {
    const current = await MediaLibrary.getPermissionsAsync();
    if (current.status === 'granted') return true;
    const request = await MediaLibrary.requestPermissionsAsync();
    if (request.status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez l\'accès à la galerie pour enregistrer le visuel.');
      return false;
    }
    return true;
  };

  const onSaveToLibrary = async () => {
    try {
      if (isProcessing) return;
      setIsProcessing(true);
      const hasPermission = await ensureMediaPermission();
      if (!hasPermission) return;
      const uri = await captureShareImage();
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Enregistré', 'Le visuel a été ajouté à votre galerie.');
    } catch (e) {
      console.error('Erreur enregistrement librairie:', e);
      Alert.alert('Erreur', "Impossible d'enregistrer l'image dans la galerie.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.templateSelector}>
        {TEMPLATES.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.templateBtn, template === t.key && styles.templateBtnActive]}
            onPress={() => setTemplate(t.key)}
            disabled={isProcessing}
          >
            <Text style={[styles.templateLabel, template === t.key && styles.templateLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.previewContainer}>
        <ViewShot
          ref={shotRef}
          style={[styles.previewCard, { width: previewWidth }]}
          options={{ format: 'png', quality: 1 }}
        >
          <ShareCard ride={ride} variant={template} />
        </ViewShot>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={[styles.actionBtn, styles.ghostBtn]} onPress={onCopyToClipboard} disabled={isProcessing}>
          <Text style={[styles.actionLabel, styles.ghostLabel]}>Copier</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.primaryBtn]} onPress={onExport} disabled={isProcessing}>
          <Text style={styles.primaryLabel}>Partager</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.secondaryBtn]} onPress={onSaveToLibrary} disabled={isProcessing}>
          <Text style={styles.secondaryLabel}>Enregistrer</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.storyButton} onPress={onShareInstagramStory} disabled={isProcessing}>
        <Text style={styles.storyButtonLabel}>Instagram Stories</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A', paddingBottom: 24 },
  templateSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: '#111827',
  },
  templateBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#1F2937',
  },
  templateBtnActive: { backgroundColor: '#2563EB' },
  templateLabel: { color: '#CBD5E1',},
  templateLabelActive: { color: '#FFFFFF' },
  previewContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  previewCard: {
    aspectRatio: 1080 / 1920,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
    backgroundColor: '#020617',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtn: { backgroundColor: '#2563EB' },
  secondaryBtn: { backgroundColor: '#10B981' },
  ghostBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
  },
  actionLabel: {fontSize: 15 },
  primaryLabel: { color: '#FFFFFF',fontSize: 15 },
  secondaryLabel: { color: '#FFFFFF',fontSize: 15 },
  ghostLabel: { color: '#E2E8F0' },
  storyButton: {
    marginHorizontal: 20,
    marginTop: 4,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#F97316',
  },
  storyButtonLabel: { color: '#FFFFFF',fontSize: 15 },
});


