import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../contexts/AuthContext';
import authService from '../../services/supabase/authService';
import { RideStorageService } from '../../services/RideStorage';
export default function EditProfileScreen({ navigation }) {
  const profileDataKey = '@profileData';
  const { user, profile, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [recentDistances, setRecentDistances] = useState([]);
  const [trophies, setTrophies] = useState([]);
  const [globalStats, setGlobalStats] = useState({ totalRides: 0, totalDistance: 0, totalDuration: 0, averageSpeed: 0 });

  // Calculer les trophées à partir des rides
  const calculateTrophies = useCallback((rides) => {
    const trophiesList = [];
    
    if (!rides || rides.length === 0) return trophiesList;
    
    const totalDistance = rides.reduce((sum, r) => sum + (r.distance || 0), 0) / 1000;
    const totalDuration = rides.reduce((sum, r) => sum + (r.duration || 0), 0);
    const totalRides = rides.length;
    const totalHours = totalDuration / 3600;
    
    if (totalDistance >= 10) trophiesList.push({ id: '10km', name: '10 km', icon: 'location', color: '#1E3A8A', category: 'distance' });
    if (totalDistance >= 50) trophiesList.push({ id: '50km', name: '50 km', icon: 'location', color: '#1E3A8A', category: 'distance' });
    if (totalDistance >= 100) trophiesList.push({ id: '100km', name: '100 km', icon: 'navigate', color: '#2563EB', category: 'distance' });
    if (totalDistance >= 250) trophiesList.push({ id: '250km', name: '250 km', icon: 'map', color: '#2563EB', category: 'distance' });
    if (totalDistance >= 500) trophiesList.push({ id: '500km', name: '500 km', icon: 'map', color: '#3B82F6', category: 'distance' });
    if (totalDistance >= 1000) trophiesList.push({ id: '1000km', name: '1000 km', icon: 'earth', color: '#3B82F6', category: 'distance' });
    if (totalDistance >= 2500) trophiesList.push({ id: '2500km', name: '2500 km', icon: 'earth', color: '#60A5FA', category: 'distance' });
    if (totalDistance >= 5000) trophiesList.push({ id: '5000km', name: '5000 km', icon: 'globe', color: '#60A5FA', category: 'distance' });
    
    if (totalRides >= 1) trophiesList.push({ id: 'first', name: 'Premier trajet', icon: 'star', color: '#10B981', category: 'rides' });
    if (totalRides >= 5) trophiesList.push({ id: '5rides', name: '5 trajets', icon: 'star', color: '#10B981', category: 'rides' });
    if (totalRides >= 10) trophiesList.push({ id: '10rides', name: '10 trajets', icon: 'star', color: '#059669', category: 'rides' });
    if (totalRides >= 25) trophiesList.push({ id: '25rides', name: '25 trajets', icon: 'medal', color: '#047857', category: 'rides' });
    if (totalRides >= 50) trophiesList.push({ id: '50rides', name: '50 trajets', icon: 'medal', color: '#047857', category: 'rides' });
    if (totalRides >= 100) trophiesList.push({ id: '100rides', name: '100 trajets', icon: 'trophy', color: '#065F46', category: 'rides' });
    if (totalRides >= 250) trophiesList.push({ id: '250rides', name: '250 trajets', icon: 'trophy', color: '#065F46', category: 'rides' });
    
    if (totalHours >= 1) trophiesList.push({ id: '1h', name: '1h conduite', icon: 'time', color: '#F97316', category: 'time' });
    if (totalHours >= 5) trophiesList.push({ id: '5h', name: '5h conduite', icon: 'time', color: '#F97316', category: 'time' });
    if (totalHours >= 10) trophiesList.push({ id: '10h', name: '10h conduite', icon: 'hourglass', color: '#EA580C', category: 'time' });
    if (totalHours >= 24) trophiesList.push({ id: '24h', name: '24h conduite', icon: 'hourglass', color: '#EA580C', category: 'time' });
    if (totalHours >= 50) trophiesList.push({ id: '50h', name: '50h conduite', icon: 'hourglass-outline', color: '#DC2626', category: 'time' });
    if (totalHours >= 100) trophiesList.push({ id: '100h', name: '100h conduite', icon: 'hourglass-outline', color: '#DC2626', category: 'time' });
    
    const sortedRides = rides.sort((a, b) => {
      const prevDate = new Date(a.startTime).getTime();
      const currDate = new Date(b.startTime).getTime();
      return prevDate - currDate;
    });
    let maxStreak = 0;
    let currentStreak = 1;
    for (let i = 1; i < sortedRides.length; i++) {
      const prevDate = new Date(sortedRides[i - 1].startTime).getTime();
      const currDate = new Date(sortedRides[i].startTime).getTime();
      const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentStreak++;
      } else {
        maxStreak = Math.max(maxStreak, currentStreak);
        currentStreak = 1;
      }
    }
    maxStreak = Math.max(maxStreak, currentStreak);
    
    if (maxStreak >= 3) trophiesList.push({ id: 'streak3', name: '3 jours d\'affilée', icon: 'flame', color: '#F97316', category: 'streak' });
    if (maxStreak >= 7) trophiesList.push({ id: 'streak7', name: '1 semaine', icon: 'flame', color: '#F97316', category: 'streak' });
    if (maxStreak >= 14) trophiesList.push({ id: 'streak14', name: '2 semaines', icon: 'flame', color: '#EA580C', category: 'streak' });
    if (maxStreak >= 30) trophiesList.push({ id: 'streak30', name: '1 mois', icon: 'flash', color: '#DC2626', category: 'streak' });
    if (maxStreak >= 60) trophiesList.push({ id: 'streak60', name: '2 mois', icon: 'flash', color: '#DC2626', category: 'streak' });
    
    trophiesList.sort((a, b) => {
      const categoryOrder = { 'streak': 0, 'rides': 1, 'distance': 2, 'time': 3 };
      const catA = categoryOrder[a.category] || 99;
      const catB = categoryOrder[b.category] || 99;
      if (catA !== catB) return catA - catB;
      return a.id.localeCompare(b.id);
    });
    
    return trophiesList;
  }, []);

  const loadStats = useCallback(async () => {
    try {
      if (!user?.id) return;
      
      const stats = await RideStorageService.getUserStats(user.id);
      setGlobalStats(stats);
      
      const rides = await RideStorageService.getUserRides(user.id);
      const sortedRides = [...rides].sort((a, b) => {
        const getTimestamp = (date) => {
          if (!date) return 0;
          if (typeof date === 'string') return new Date(date).getTime();
          if (typeof date === 'number') return date;
          return 0;
        };
        const dateA = getTimestamp(a.endTime || a.startTime);
        const dateB = getTimestamp(b.endTime || b.startTime);
        return dateB - dateA;
      });
      
      const last7 = sortedRides.slice(0, 7).reverse();
      const distances = last7.map(r => Math.max(0, (r.distance || 0) / 1000));
      setRecentDistances(distances);
      
      const calculatedTrophies = calculateTrophies(rides);
      setTrophies(calculatedTrophies);
    } catch (e) {
      console.error('Erreur chargement stats:', e);
    }
  }, [user, calculateTrophies]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        if (profile) {
          setFirstName(profile.first_name || '');
          setLastName(profile.last_name || '');
          setUsername(profile.username || '');
          setBio(profile.bio || '');
        } else {
          const profileRaw = await AsyncStorage.getItem(profileDataKey);
          if (profileRaw) {
            const profileData = JSON.parse(profileRaw);
            setFirstName(profileData.firstName || '');
            setLastName(profileData.lastName || '');
            setUsername(profileData.username || '');
            setBio(profileData.bio || '');
          }
        }
      } catch (e) {
        console.error('Erreur chargement profil', e);
      }
    };
    loadProfile();
    loadStats();
  }, [profile, loadStats]);

  const saveProfile = async () => {
    try {
      if (!user?.id) {
        Alert.alert('Erreur', 'Vous devez être connecté');
        return;
      }

      const updatedProfile = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim().replace('@', ''),
        bio: bio.trim(),
      };

      // Sauvegarder dans Supabase
      const { profile: updatedProfileData, error } = await authService.updateProfile(user.id, {
        firstName: updatedProfile.firstName,
        lastName: updatedProfile.lastName,
        username: updatedProfile.username,
        bio: updatedProfile.bio,
      });

      if (error) {
        console.error('Erreur mise à jour profil:', error);
        Alert.alert('Erreur', 'Impossible de sauvegarder le profil dans Supabase');
        return;
      }

      // Sauvegarder aussi dans AsyncStorage pour compatibilité
      await AsyncStorage.setItem(profileDataKey, JSON.stringify(updatedProfile));

      // Recharger le profil depuis Supabase
      await refreshProfile();

      Alert.alert('Succès', 'Profil mis à jour !', [
        { text: 'OK', onPress: () => navigation?.goBack() }
      ]);
    } catch (e) {
      console.error('Erreur sauvegarde profil:', e);
      Alert.alert('Erreur', 'Impossible de sauvegarder le profil');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#1E3A8A" />
        </TouchableOpacity>
        <Text style={styles.title}>Modifier le profil</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Prénom</Text>
          <TextInput
            style={styles.input}
            placeholder="Votre prénom"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Nom</Text>
          <TextInput
            style={styles.input}
            placeholder="Votre nom"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Nom d'utilisateur</Text>
          <TextInput
            style={styles.input}
            placeholder="@username"
            value={username}
            onChangeText={(text) => setUsername(text.replace('@', ''))}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Bio</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            placeholder="Parlez-nous de vous (optionnel)"
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={saveProfile}>
          <Text style={styles.saveButtonText}>Enregistrer</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(30,58,138,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,color: '#0F172A',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
      fontSize: 16, fontWeight: '400',
    color: '#0F172A',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E6E9EE',
  },
  bioInput: {
    height: 100,
    paddingTop: 12,
  },
  saveButton: {
    backgroundColor: '#1E3A8A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 32,
  },
  saveButtonText: {
      fontSize: 16, fontWeight: '400',
    color: '#FFFFFF',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  chartHeader: {
    marginBottom: 24,
  },
  chartTitle: {
      fontSize: 18, fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 13,
    color: '#6B7280',},
  barChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 180,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
    marginHorizontal: 2,
  },
  barChartBar: {
    width: 32,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
    position: 'relative',
    minHeight: 16,
  },
  barChartBarToday: {
    borderWidth: 2,
    borderColor: '#1E3A8A',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  barChartBarEmpty: {
    backgroundColor: '#F9FAFB',
  },
  barChartBarFill: {
    backgroundColor: '#1E3A8A',
    borderRadius: 14,
    width: '100%',
    position: 'absolute',
    bottom: 0,
  },
  barChartLabel: {
    fontSize: 11,color: '#6B7280',
    marginTop: 4,
  },
  barChartLabelToday: {
    color: '#1E3A8A',},
  barValueText: {
    fontSize: 11,color: '#111827',
    marginTop: 6,
  },
  barValueTextToday: {
    color: '#1E3A8A',
    fontSize: 12,
  },
  barValueEmpty: {
    fontSize: 11,
    color: '#D1D5DB',
    marginTop: 6,
  },
  chartStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 16,
  },
  chartStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  chartStatValue: {
    fontSize: 20,color: '#111827',
  },
  chartStatLabel: {
    fontSize: 11,
    color: '#6B7280',},
  trophiesSection: {
    marginBottom: 24,
  },
  trophiesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  trophiesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trophiesSectionTitle: {
    fontSize: 20,color: '#111827',
  },
  trophiesCountBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  trophiesCount: {
      fontSize: 16, fontWeight: '700',
    color: '#92400E',
  },
  trophiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  trophyCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  trophyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  trophyName: {
    fontSize: 13,color: '#111827',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
  trophyPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trophyPillText: {
    fontSize: 10,textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});





