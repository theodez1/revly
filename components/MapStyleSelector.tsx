import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Modal, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MAP_STYLE_OPTIONS } from '../config/mapboxStyles';

interface MapStyleSelectorProps {
  currentStyle: string;
  onStyleChange: (style: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

/**
 * Composant sélecteur de style de carte Mapbox
 * 
 * Usage:
 * ```javascript
 * const [mapStyle, setMapStyle] = useState(MAPBOX_STYLES.street);
 * 
 * <MapStyleSelector
 *   currentStyle={mapStyle}
 *   onStyleChange={setMapStyle}
 * />
 * ```
 */
const MapStyleSelector: React.FC<MapStyleSelectorProps> = ({ 
  currentStyle, 
  onStyleChange,
  position = 'top-right', // 'top-right', 'top-left', 'bottom-right', 'bottom-left'
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleStyleSelect = (styleValue: string) => {
    onStyleChange(styleValue);
    setIsOpen(false);
  };

  const currentOption = MAP_STYLE_OPTIONS.find(
    opt => opt.value === currentStyle
  ) || MAP_STYLE_OPTIONS[0];

  const containerStyle = [
    styles.container,
    position === 'top-right' && styles.topRight,
    position === 'top-left' && styles.topLeft,
    position === 'bottom-right' && styles.bottomRight,
    position === 'bottom-left' && styles.bottomLeft,
  ];

  return (
    <>
      {/* Bouton pour ouvrir le sélecteur */}
      <TouchableOpacity
        style={containerStyle}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.7}
      >
        <Ionicons name={currentOption.icon as keyof typeof Ionicons.glyphMap} size={20} color="#1F2937" />
      </TouchableOpacity>

      {/* Modal avec les options */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Style de carte</Text>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            {MAP_STYLE_OPTIONS.map((option) => {
              const isSelected = option.value === currentStyle;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.optionItem,
                    isSelected && styles.optionItemSelected,
                  ]}
                  onPress={() => handleStyleSelect(option.value)}
                >
                  <View style={styles.optionContent}>
                    <Ionicons
                      name={option.icon as keyof typeof Ionicons.glyphMap}
                      size={24}
                      color={isSelected ? '#2563EB' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && styles.optionTextSelected,
                      ]}
                    >
                      {option.name}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color="#2563EB" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
  },
  topRight: {
    top: 20,
    right: 20,
  },
  topLeft: {
    top: 20,
    left: 20,
  },
  bottomRight: {
    bottom: 20,
    right: 20,
  },
  bottomLeft: {
    bottom: 20,
    left: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
  },
  optionItemSelected: {
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#64748B',
  },
  optionTextSelected: {
    color: '#2563EB',
    fontWeight: '600',
  },
});

export default MapStyleSelector;

