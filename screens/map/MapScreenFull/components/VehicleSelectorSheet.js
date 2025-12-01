import React, { forwardRef } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';

const VehicleSelectorSheet = forwardRef(
  (
    {
      snapPoints,
      backdropComponent,
      vehicles,
      selectedVehicleId,
      onSelectVehicle,
      vehicleTypeToIcon,
      isLoading,
    },
    ref
  ) => {
    const hasVehicles = Array.isArray(vehicles) && vehicles.length > 0;

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        enableDynamicSizing={false}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
        backdropComponent={backdropComponent}
        containerStyle={styles.sheetContainer}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Sélectionnez votre véhicule</Text>
        </View>

        <BottomSheetScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#1E3A8A" />
              <Text style={styles.loadingText}>Chargement des véhicules…</Text>
            </View>
          ) : hasVehicles ? (
            <View style={styles.grid}>
              {vehicles.map((vehicle) => {
                const vehicleId = vehicle?.id;
                const isSelected =
                  String(selectedVehicleId) === String(vehicleId);

                return (
                  <TouchableOpacity
                    key={vehicleId}
                    style={[styles.card, isSelected && styles.cardSelected]}
                    onPress={() => onSelectVehicle?.(vehicleId)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.cardImageContainer}>
                      {vehicle?.photoUri || vehicle?.photos?.[0] ? (
                        <>
                          <Image
                            source={{ uri: vehicle.photoUri || vehicle.photos[0] }}
                            style={styles.cardImage}
                          />
                          <View style={styles.cardGradientOverlay} />
                          <View style={styles.cardShine} />
                        </>
                      ) : (
                        <View style={styles.cardIconContainer}>
                          <Ionicons
                            name={vehicleTypeToIcon(vehicle?.type)}
                            size={48}
                            color="#1E3A8A"
                          />
                        </View>
                      )}

                      {isSelected && (
                        <View style={styles.cardBadge}>
                          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        </View>
                      )}
                    </View>

                    <View style={styles.cardNameContainer}>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {vehicle?.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyStateTitle}>Aucun véhicule</Text>
              <Text style={styles.emptyStateSubtitle}>
                Ajoutez-en un depuis les paramètres
              </Text>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    );
  }
);

VehicleSelectorSheet.displayName = 'VehicleSelectorSheet';

const styles = StyleSheet.create({
  sheetContainer: {
    zIndex: 1000,
    elevation: 1000,
  },
  background: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  handle: {
    backgroundColor: '#CBD5E1',
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E3A8A',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  loadingState: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  card: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E8EDF3',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 16,
    position: 'relative',
  },
  cardSelected: {
    borderColor: '#10B981',
    borderWidth: 2,
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  cardImageContainer: {
    width: '100%',
    aspectRatio: 1.35,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#f8f9fa',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    backgroundColor: '#1F2937',
  },
  cardGradientOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  cardShine: {
    position: 'absolute',
    top: 0,
    left: '-100%',
    width: '300%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    transform: [{ skewX: '-15deg' }],
    opacity: 0.4,
  },
  cardIconContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(30,58,138,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardNameContainer: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'center',
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  cardBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 10,
  },
  emptyState: {
    paddingVertical: 80,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default VehicleSelectorSheet;
