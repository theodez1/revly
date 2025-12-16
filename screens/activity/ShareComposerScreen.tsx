import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, NativeModules, Platform, ScrollView } from 'react-native';
import ViewShot from 'react-native-view-shot';
import Share from 'react-native-share';
import ShareCard from '../../components/ShareCard';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { Ride } from '../../services/supabase/ridesService';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const { InstagramStoriesShare } = NativeModules;

interface Template {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const TEMPLATES: Template[] = [
  { key: 'stats-only', label: 'Stats', icon: 'stats-chart' },
  { key: 'route-stats', label: 'Carte', icon: 'map' },
  { key: 'mini-route', label: 'Mini', icon: 'resize' },
];

type ShareComposerScreenRouteProp = RouteProp<{
  params: {
    ride?: Partial<Ride>;
  };
}, 'params'>;

export default function ShareComposerScreen() {
  const route = useRoute<ShareComposerScreenRouteProp>();
  const navigation = useNavigation();
  const ride = route?.params?.ride || {};
  const [template, setTemplate] = useState<string>('route-stats');
  const shotRef = useRef<ViewShot | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const previewWidth = useMemo(() => {
    const screenWidth = Dimensions.get('window').width;
    return Math.min(screenWidth - 48, 360);
  }, []);

  const captureShareImage = async (): Promise<string> => {
    if (!shotRef.current) {
      throw new Error('capture_ref_missing');
    }
    return await shotRef.current.capture();
  };

  const onExport = async (): Promise<void> => {
    try {
      if (isProcessing) return;
      setIsProcessing(true);
      const uri = await captureShareImage();
      await Share.open({ url: uri, type: 'image/png' });
    } catch (e) {
      // Ignore errors
    } finally {
      setIsProcessing(false);
    }
  };

  const onShareInstagramStory = async (): Promise<void> => {
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
    } catch (e: any) {
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

  const onCopyToClipboard = async (): Promise<void> => {
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

  const ensureMediaPermission = async (): Promise<boolean> => {
    const current = await MediaLibrary.getPermissionsAsync();
    if (current.status === 'granted') return true;
    const request = await MediaLibrary.requestPermissionsAsync();
    if (request.status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez l\'accès à la galerie pour enregistrer le visuel.');
      return false;
    }
    return true;
  };

  const onSaveToLibrary = async (): Promise<void> => {
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
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Header Custom */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Partager le trajet</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <View style={styles.templateSelectorContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.templateSelectorContent}
        >
          {TEMPLATES.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.templateBtn,
                template === t.key && styles.templateBtnActive
              ]}
              onPress={() => setTemplate(t.key)}
              disabled={isProcessing}
            >
              <Ionicons 
                name={t.icon} 
                size={18} 
                color={template === t.key ? '#FFFFFF' : '#94A3B8'} 
              />
              <Text style={[
                styles.templateLabel,
                template === t.key && styles.templateLabelActive
              ]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.previewContainer}>
        <View style={styles.previewWrapper}>
          <ViewShot
            ref={shotRef}
            style={[styles.previewCard, { width: previewWidth }]}
            options={{ format: 'png', quality: 1 }}
          >
            <ShareCard ride={ride} variant={template} />
          </ViewShot>
        </View>
      </View>

      <View style={styles.bottomSheet}>
        <View style={styles.primaryActions}>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.copyBtn]} 
            onPress={onCopyToClipboard} 
            disabled={isProcessing}
          >
            <Ionicons name="copy-outline" size={22} color="#F8FAFC" />
            <Text style={styles.actionLabel}>Copier</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, styles.saveBtn]} 
            onPress={onSaveToLibrary} 
            disabled={isProcessing}
          >
            <Ionicons name="download-outline" size={22} color="#F8FAFC" />
            <Text style={styles.actionLabel}>Sauver</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, styles.shareBtn]} 
            onPress={onExport} 
            disabled={isProcessing}
          >
            <Ionicons name="share-outline" size={22} color="#FFFFFF" />
            <Text style={styles.primaryLabel}>Partager</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.storyButton} 
          onPress={onShareInstagramStory} 
          disabled={isProcessing}
        >
          <Ionicons name="logo-instagram" size={24} color="#FFFFFF" />
          <Text style={styles.storyButtonLabel}>Story Instagram</Text>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  templateSelectorContainer: {
    paddingVertical: 20,
  },
  templateSelectorContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  templateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(30, 41, 59, 0.8)', // Slate 800 with opacity
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  templateBtnActive: {
    backgroundColor: '#2563EB', // Electric Blue
    borderColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  templateLabel: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 14,
  },
  templateLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  previewContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  previewWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 16,
  },
  previewCard: {
    aspectRatio: 1080 / 1920,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#020617',
  },
  bottomSheet: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
    backgroundColor: '#1E293B', // Slate 800
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 20,
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  copyBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  saveBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  shareBtn: {
    backgroundColor: '#2563EB',
    flex: 1.5, // Larger share button
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  storyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: 'transparent', 
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)', // Subtle Orange border
  },
  storyButtonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
});

