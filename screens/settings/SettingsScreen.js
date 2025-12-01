import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
export default function SettingsScreen({ navigation }) {
  const { signOut } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [darkMode, setDarkMode] = React.useState(false);
  const [useMetric, setUseMetric] = React.useState(true);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Réglages</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Section Profil */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profil</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => navigation?.navigate('EditProfile')}>
            <View style={styles.iconCircle}><Ionicons name="person-outline" size={18} color="#1F2937" /></View>
            <Text style={styles.rowLabel}>Modifier le profil</Text>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Général</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconCircle}><Ionicons name="notifications-outline" size={18} color="#1F2937" /></View>
            <Text style={styles.rowLabel}>Notifications</Text>
            <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <View style={styles.iconCircle}><Ionicons name="moon-outline" size={18} color="#1F2937" /></View>
            <Text style={styles.rowLabel}>Thème sombre</Text>
            <Switch value={darkMode} onValueChange={setDarkMode} />
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <View style={styles.iconCircle}><Ionicons name="speedometer-outline" size={18} color="#1F2937" /></View>
            <Text style={styles.rowLabel}>Unités</Text>
            <TouchableOpacity onPress={() => setUseMetric(!useMetric)}>
              <Text style={styles.valueText}>{useMetric ? 'km' : 'miles'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>À propos</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row}>
            <View style={styles.iconCircle}><Ionicons name="information-circle-outline" size={18} color="#1F2937" /></View>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.valueText}>1.0.0</Text>
          </TouchableOpacity>
          <View style={styles.separator} />
          <TouchableOpacity style={styles.row}>
            <View style={styles.iconCircle}><Ionicons name="document-text-outline" size={18} color="#1F2937" /></View>
            <Text style={styles.rowLabel}>Mentions légales</Text>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bouton de déconnexion */}
      <View style={styles.section}>
        <View style={styles.card}>
          <TouchableOpacity 
            style={styles.logoutRow}
            onPress={() => {
              Alert.alert(
                'Déconnexion',
                'Êtes-vous sûr de vouloir vous déconnecter ?',
                [
                  {
                    text: 'Annuler',
                    style: 'cancel'
                  },
                  {
                    text: 'Déconnexion',
                    style: 'destructive',
                    onPress: signOut
                  }
                ]
              );
            }}
          >
            <View style={styles.iconCircle}><Ionicons name="log-out-outline" size={18} color="#DC2626" /></View>
            <Text style={styles.logoutLabel}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>
      </View>

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
  section: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  sectionTitle: {
      fontSize: 16, fontWeight: '400',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6E9EE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  separator: {
    height: 1,
    backgroundColor: '#E6E9EE',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(30,58,138,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowLabel: {
      fontSize: 16, fontWeight: '400',
    color: '#0F172A',
    flex: 1,
  },
  valueText: {
      fontSize: 16, fontWeight: '400',
    color: '#334155',
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  logoutLabel: {
      fontSize: 16, fontWeight: '400',
    color: '#DC2626',
    flex: 1,
  },
});


