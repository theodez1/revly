import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { CameraView } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

const CameraModal = ({
  visible,
  onClose,
  cameraPermission,
  capturedPhoto,
  retakePhoto,
  confirmPhoto,
  cameraType,
  setCameraType,
  flashMode,
  setFlashMode,
  takePicture,
  setCameraRef,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {capturedPhoto ? (
          <View style={styles.previewWrapper}>
            <Image source={{ uri: capturedPhoto.uri }} style={styles.preview} />

            <View style={styles.topBar}>
              <TouchableOpacity style={styles.topButton} onPress={retakePhoto}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <View style={styles.bottomBar}>
              <View style={styles.bottomSide}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonGhost]}
                  onPress={retakePhoto}
                >
                  <Ionicons name="refresh" size={24} color="white" />
                </TouchableOpacity>
              </View>
              <View style={styles.bottomCenter} />
              <View style={styles.bottomSide}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonSuccess]}
                  onPress={confirmPhoto}
                >
                  <Ionicons name="checkmark" size={24} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : cameraPermission?.granted ? (
          <CameraView
            style={styles.camera}
            facing={cameraType}
            flash={flashMode}
            ref={(ref) => setCameraRef(ref)}
          >
            <View style={styles.topOverlay}>
              <TouchableOpacity style={styles.topButton} onPress={onClose}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>

              <View style={styles.topSpacer} />

              <TouchableOpacity
                style={styles.topButton}
                onPress={() =>
                  setCameraType(cameraType === 'back' ? 'front' : 'back')
                }
              >
                <Ionicons name="camera-reverse" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <View style={styles.sideControls}>
              <TouchableOpacity
                style={styles.sideButton}
                onPress={() => setFlashMode(flashMode === 'off' ? 'on' : 'off')}
              >
                <Ionicons
                  name={flashMode === 'off' ? 'flash-off' : 'flash'}
                  size={24}
                  color="white"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.captureBar}>
              <View style={styles.captureSide}>
                <TouchableOpacity style={styles.sideAccessory}>
                  <Ionicons name="images" size={24} color="white" />
                </TouchableOpacity>
              </View>

              <View style={styles.captureCenter}>
                <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                  <View style={styles.captureOuter}>
                    <View style={styles.captureInner} />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.captureSide}>
                <TouchableOpacity style={styles.sideAccessory}>
                  <Ionicons name="options" size={24} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </CameraView>
        ) : (
          <View style={styles.camera}>
            <Ionicons name="camera" size={48} color="white" />
            <Text style={styles.placeholder}>Caméra</Text>
            <Text style={styles.placeholderSub}>
              Permission caméra: {cameraPermission?.status || 'Vérification...'}
            </Text>
            <TouchableOpacity style={styles.closePill} onPress={onClose}>
              <Ionicons name="close" size={24} color="white" />
              <Text style={styles.closePillText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  previewWrapper: {
    flex: 1,
    backgroundColor: '#000',
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    paddingTop: 50,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    paddingTop: 50,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  topButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topSpacer: {
    flex: 1,
    alignItems: 'center',
  },
  sideControls: {
    position: 'absolute',
    top: 120,
    right: 20,
    gap: 14,
  },
  sideButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    paddingBottom: 30,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  captureBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    paddingBottom: 30,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  bottomSide: {
    flex: 1,
    alignItems: 'flex-start',
  },
  captureSide: {
    flex: 1,
    alignItems: 'flex-start',
  },
  bottomCenter: {
    flex: 1,
    alignItems: 'center',
  },
  captureCenter: {
    flex: 1,
    alignItems: 'center',
  },
  actionButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonGhost: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  actionButtonSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.8)',
  },
  sideAccessory: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
  },
  placeholder: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: 20,
  },
  placeholderSub: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 8,
  },
  closePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    marginTop: 24,
  },
  closePillText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default CameraModal;



