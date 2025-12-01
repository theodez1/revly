import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';

const DEFAULT_VEHICLE_OPTIONS = [
  { key: 'all', label: 'Tous' },
  { key: 'car', label: 'Voiture' },
  { key: 'motorcycle', label: 'Moto' },
  { key: 'bicycle', label: 'Vélo' },
  { key: 'scooter', label: 'Trottinette' },
];

export default function RideFilterSheet({
  sheetRef,
  snapPoints = ['55%'],
  searchQuery = '',
  onSearchChange,
  filterVehicle = 'all',
  onVehicleChange,
  renderBackdrop,
  backgroundStyle,
  handleIndicatorStyle,
  onReset,
  autoCloseOnSelect = true,
  defaultVehicleKey = 'all',
  title = 'Filtres',
  placeholder = 'Rechercher...',
  vehicleOptions = DEFAULT_VEHICLE_OPTIONS,
}) {
  const trimmedQueryLength = searchQuery?.trim().length || 0;
  const showReset = useMemo(() => {
    if (typeof onReset !== 'function') return false;
    const defaultKey = defaultVehicleKey ?? 'all';
    return trimmedQueryLength > 0 || filterVehicle !== defaultKey;
  }, [onReset, trimmedQueryLength, filterVehicle, defaultVehicleKey]);

  const handleVehicleSelect = (key) => {
    onVehicleChange?.(key);
    if (autoCloseOnSelect) {
      requestAnimationFrame(() => {
        sheetRef?.current?.dismiss?.();
      });
    }
  };

  const handleClearSearch = () => {
    onSearchChange?.('');
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={backgroundStyle}
      handleIndicatorStyle={handleIndicatorStyle}
      enableDynamicSizing={false}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {showReset && (
            <TouchableOpacity style={styles.resetButton} onPress={onReset}>
              <Ionicons name="refresh" size={16} color="#2563EB" />
              <Text style={styles.resetText}>Réinitialiser</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recherche</Text>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder={placeholder}
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={onSearchChange}
              returnKeyType="search"
            />
            {trimmedQueryLength > 0 && (
              <TouchableOpacity onPress={handleClearSearch}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Type de véhicule</Text>
          <View style={styles.chipGroup}>
            {vehicleOptions.map((option) => {
              const isActive = filterVehicle === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => handleVehicleSelect(option.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 24,
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  resetText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    marginHorizontal: 10,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  chipLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});



