import React, { forwardRef } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import BottomSheet, {
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';

type VehicleSelectorSheetProps = {
  snapPoints: (string | number)[];
  backdropComponent?: (props: any) => React.ReactElement | null;
  vehicles: any[];
  selectedVehicleId?: string | number | null;
  onSelectVehicle?: (vehicleId: string | number | null | undefined) => void;
  vehicleTypeToIcon: (type?: string) => React.ComponentProps<typeof Ionicons>['name'];
  isLoading?: boolean;
};

const VehicleSelectorSheet = forwardRef<any, VehicleSelectorSheetProps>(
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
          <Text style={styles.title}>Votre Garage</Text>
          <Text style={styles.subtitle}>Sélectionnez un véhicule pour le trajet</Text>
        </View>

        <BottomSheetScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#2563EB" />
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
                    activeOpacity={0.9}
                  >
                    <View style={styles.cardImageContainer}>
                      {vehicle?.photoUri || vehicle?.photos?.[0] ? (
                        <Image
                          source={{ uri: vehicle.photoUri || vehicle.photos[0] }}
                          style={styles.cardImage}
                        />
                      ) : (
                        <View style={[styles.cardIconContainer, isSelected && styles.cardIconContainerSelected]}>
                          <Ionicons
                            name={vehicleTypeToIcon(vehicle?.type)}
                            size={40}
                            color={isSelected ? "#2563EB" : "#94A3B8"}
                          />
                        </View>
                      )}
                      
                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <Ionicons name="checkmark" size={14} color="#FFF" />
                        </View>
                      )}
                    </View>

                    <View style={styles.cardInfo}>
                      <Text style={[styles.cardName, isSelected && styles.cardNameSelected]} numberOfLines={1}>
                        {vehicle?.name}
                      </Text>
                      {vehicle?.brand && (
                        <Text style={styles.cardBrand} numberOfLines={1}>
                          {vehicle.brand}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="car-sport-outline" size={48} color="#94A3B8" />
              </View>
              <Text style={styles.emptyStateTitle}>Garage vide</Text>
              <Text style={styles.emptyStateSubtitle}>
                Ajoutez votre premier véhicule dans les réglages
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
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  handle: {
    backgroundColor: '#E2E8F0',
    width: 48,
    height: 5,
    borderRadius: 2.5,
    marginTop: 12,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
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
    gap: 16,
  },
  loadingState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  card: {
    width: '47%', // Slightly less than 50% to account for gap
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardSelected: {
    borderColor: '#2563EB',
    borderWidth: 2,
    backgroundColor: '#EFF6FF',
    shadowColor: '#2563EB',
    shadowOpacity: 0.15,
  },
  cardImageContainer: {
    width: '100%',
    aspectRatio: 1.4,
    backgroundColor: '#F8FAFC',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cardIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  cardIconContainerSelected: {
    backgroundColor: '#DBEAFE',
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  cardInfo: {
    padding: 16,
    alignItems: 'center',
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
    marginBottom: 2,
  },
  cardNameSelected: {
    color: '#1E40AF',
  },
  cardBrand: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 200,
    lineHeight: 20,
  },
});

export default VehicleSelectorSheet;
