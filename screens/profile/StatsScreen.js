import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function StatsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Statistiques</Text>
          <Text style={styles.subtitle}>Vos performances globales</Text>
        </View>
        
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.iconWrapper}>
              <Ionicons name="trophy-outline" size={32} color="#1E3A8A" />
            </View>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Trajets</Text>
          </View>
          
          <View style={styles.statCard}>
            <View style={styles.iconWrapper}>
              <Ionicons name="navigate-outline" size={32} color="#1E3A8A" />
            </View>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Kilomètres</Text>
          </View>
          
          <View style={styles.statCard}>
            <View style={styles.iconWrapper}>
              <Ionicons name="time-outline" size={32} color="#1E3A8A" />
            </View>
            <Text style={styles.statNumber}>0h</Text>
            <Text style={styles.statLabel}>Temps total</Text>
          </View>
          
          <View style={styles.statCard}>
            <View style={styles.iconWrapper}>
              <Ionicons name="speedometer-outline" size={32} color="#1E3A8A" />
            </View>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>km/h moyen</Text>
          </View>
        </View>
        
        <View style={styles.emptyState}>
          <View style={styles.iconCircle}>
            <Ionicons name="stats-chart-outline" size={50} color="#1E3A8A" />
          </View>
          <Text style={styles.emptyTitle}>Données indisponibles</Text>
          <Text style={styles.emptyText}>
            Commencez à enregistrer vos trajets pour voir vos statistiques
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,color: '#2c3e50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(30, 58, 138, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 28,color: '#2c3e50',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',},
  emptyState: {
    alignItems: 'center',
    marginTop: 32,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(30, 58, 138, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,color: '#2c3e50',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
  },
});

