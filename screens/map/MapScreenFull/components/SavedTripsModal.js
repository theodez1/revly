import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import MiniRoutePreview from '../../../../components/MiniRoutePreview';
import polyline from 'google-polyline';

const SavedTripsModal = ({
  visible,
  onClose,
  savedTrips,
  deleteTrip,
  deleteAllTrips,
  formatTripTime,
}) => {
  const hasTrips = Array.isArray(savedTrips) && savedTrips.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Trajets Sauvegardés</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {!hasTrips ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Aucun trajet sauvegardé</Text>
            <Text style={styles.emptySubtitle}>
              Vos trajets apparaîtront ici après les avoir sauvegardés
            </Text>
          </View>
        ) : (
          <>
            <ScrollView style={styles.list}>
              {savedTrips.map((trip, index) => {
                const polylineData = trip.polyline || trip.compressedPolyline;
                let polylineCoordinates = [];
                let polylineError = false;

                if (polylineData) {
                  try {
                    const decodedPoints = polyline.decode(polylineData);
                    polylineCoordinates = decodedPoints.map((point) => ({
                      latitude: Array.isArray(point) ? point[0] : point.latitude,
                      longitude: Array.isArray(point) ? point[1] : point.longitude,
                    }));
                  } catch (error) {
                    console.error('Erreur décodage polyline:', error);
                    polylineError = true;
                  }
                }

                return (
                  <View key={trip.id ?? index} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>Trajet #{index + 1}</Text>
                      <TouchableOpacity
                        style={styles.deleteTripButton}
                        onPress={() => deleteTrip(trip.id)}
                      >
                        <View style={styles.trashIcon}>
                          <View style={styles.trashBody} />
                          <View style={styles.trashLid} />
                          <View style={styles.trashHandle} />
                        </View>
                      </TouchableOpacity>
                    </View>

                    {polylineData && !polylineError ? (
                      <View style={styles.mapContainer}>
                        <MiniRoutePreview
                          coordinates={polylineCoordinates}
                          style={styles.miniMap}
                        />
                      </View>
                    ) : polylineError ? (
                      <View style={styles.mapContainer}>
                        <Text style={styles.errorText}>Erreur de décodage</Text>
                      </View>
                    ) : null}

                    <View style={styles.banner}>
                      <View style={styles.bannerItem}>
                        <Text style={styles.bannerLabel}>Distance</Text>
                        <Text style={styles.bannerValue}>
                          {(trip.distance || 0).toFixed(1)} km
                        </Text>
                      </View>
                      <View style={styles.bannerItem}>
                        <Text style={styles.bannerLabel}>Temps</Text>
                        <Text style={styles.bannerValue}>
                          {formatTripTime(trip.duration)}
                        </Text>
                      </View>
                      <View style={styles.bannerItem}>
                        <Text style={styles.bannerLabel}>Vitesse max</Text>
                        <Text style={styles.bannerValue}>
                          {(trip.maxSpeed || 0).toFixed(0)} km/h
                        </Text>
                      </View>
                      <View style={styles.bannerItem}>
                        <Text style={styles.bannerLabel}>Score</Text>
                        <Text style={styles.bannerValue}>
                          {trip.drivingScore || 0}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardFooter}>
                      <Text style={styles.cardDate}>
                        Sauvegardé le{' '}
                        {new Date(trip.savedAt).toLocaleDateString('fr-FR')} à{' '}
                        {new Date(trip.savedAt).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.deleteAllButton}
                onPress={deleteAllTrips}
              >
                <Text style={styles.deleteAllButtonText}>
                  Supprimer tous les trajets
                </Text>
              </TouchableOpacity>
            </View>
          </>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E3A8A',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#6c757d',
    fontWeight: 'bold',
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
    color: '#6c757d',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#adb5bd',
    textAlign: 'center',
    lineHeight: 24,
  },
  list: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E3A8A',
  },
  deleteTripButton: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trashIcon: {
    width: 20,
    height: 20,
    position: 'relative',
  },
  trashBody: {
    position: 'absolute',
    bottom: 2,
    left: 4,
    width: 12,
    height: 12,
    backgroundColor: '#dc3545',
    borderRadius: 2,
  },
  trashLid: {
    position: 'absolute',
    top: 0,
    left: 3,
    width: 14,
    height: 3,
    backgroundColor: '#dc3545',
    borderRadius: 1,
  },
  trashHandle: {
    position: 'absolute',
    top: -2,
    left: 6,
    width: 8,
    height: 2,
    backgroundColor: '#dc3545',
    borderRadius: 1,
  },
  mapContainer: {
    height: 190,
    marginBottom: 15,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f8f9fa',
  },
  miniMap: {
    width: '100%',
    height: 190,
    borderRadius: 12,
    overflow: 'hidden',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 15,
  },
  bannerItem: {
    alignItems: 'center',
    flex: 1,
  },
  bannerLabel: {
    fontSize: 10,
    color: '#6c757d',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  bannerValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E3A8A',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 15,
  },
  cardDate: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 5,
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  deleteAllButton: {
    backgroundColor: '#dc3545',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
  },
  deleteAllButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SavedTripsModal;


