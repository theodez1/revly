import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';

const StepsEditorModal = ({ visible, onClose, tripSteps = [] }) => {
  const hasSteps = Array.isArray(tripSteps) && tripSteps.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Éditeur d'étapes</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {hasSteps ? (
          <ScrollView style={styles.list}>
            {tripSteps.map((step) => (
              <View key={step.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>
                    {step.type === 'photo' ? '📷' : '📍'} {step.title}
                  </Text>
                  {step.timestamp ? (
                    <Text style={styles.cardTime}>
                      {new Date(step.timestamp).toLocaleTimeString('fr-FR')}
                    </Text>
                  ) : null}
                </View>
                {step.description ? (
                  <Text style={styles.cardDescription}>{step.description}</Text>
                ) : null}
                {step.photo ? (
                  <View style={styles.photoBadge}>
                    <Text style={styles.photoBadgeText}>📷 Photo ajoutée</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Aucune étape ajoutée</Text>
            <Text style={styles.emptySubtitle}>
              Utilisez le bouton &quot;📍 Étapes&quot; pour ajouter des étapes à
              votre trajet
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#64748B',
    fontWeight: '700',
  },
  list: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardTime: {
    fontSize: 14,
    color: '#64748B',
  },
  cardDescription: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
  },
  photoBadge: {
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(30, 58, 138, 0.08)',
    alignItems: 'center',
  },
  photoBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default StepsEditorModal;



