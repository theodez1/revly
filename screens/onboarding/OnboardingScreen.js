import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image, StatusBar } from 'react-native';
import Carousel from 'react-native-reanimated-carousel';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const ONBOARDING_COMPLETED_KEY = '@onboarding_completed';

const SLIDES = [
  {
    id: 1,
    title: "Bienvenue sur Revly",
    subtitle: "L'application ultime pour les passionnés d'automobile.",
    icon: "flag",
    image: require('../../assets/icon-without-back.png'),
    isLogo: true,
  },
  {
    id: 2,
    title: "Enregistrez vos trajets",
    subtitle: "Suivez vos balades avec précision et revivez vos meilleurs moments sur la route.",
    icon: "map",
  },
  {
    id: 3,
    title: "Gérez votre Garage",
    subtitle: "Ajoutez vos véhicules, suivez leur kilométrage et leurs statistiques.",
    icon: "car-sport",
  },
  {
    id: 4,
    title: "Rejoignez la Communauté",
    subtitle: "Partagez vos routes, créez des groupes et roulez avec d'autres passionnés.",
    icon: "people",
  },
];

export default function OnboardingScreen({ onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const carouselRef = useRef(null);

  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
      if (onComplete) onComplete();
    } catch (error) {
      console.error('Erreur sauvegarde onboarding:', error);
    }
  };

  const handleNext = () => {
    if (currentIndex === SLIDES.length - 1) {
      handleComplete();
    } else {
      carouselRef.current?.next();
    }
  };

  const renderItem = ({ item }) => {
    return (
      <View style={styles.slide}>
        <View style={styles.imageContainer}>
          {item.isLogo ? (
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                style={styles.logoGradient}
              >
                <Image source={item.image} style={styles.logoImage} resizeMode="contain" />
              </LinearGradient>
            </View>
          ) : (
            <View style={styles.iconCircle}>
              <LinearGradient
                colors={['rgba(59, 130, 246, 0.2)', 'rgba(37, 99, 235, 0.1)']}
                style={styles.iconGradient}
              >
                <Ionicons name={item.icon} size={80} color="#60A5FA" />
              </LinearGradient>
            </View>
          )}
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0F172A', '#1E3A8A', '#0F172A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.carouselContainer}>
          <Carousel
            ref={carouselRef}
            loop={false}
            width={width}
            height={height * 0.7}
            autoPlay={false}
            data={SLIDES}
            scrollAnimationDuration={500}
            onSnapToItem={(index) => setCurrentIndex(index)}
            renderItem={renderItem}
          />
        </View>

        <View style={styles.footer}>
          {/* Pagination Dots */}
          <View style={styles.pagination}>
            {SLIDES.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  currentIndex === index ? styles.activeDot : styles.inactiveDot,
                ]}
              />
            ))}
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            {currentIndex < SLIDES.length - 1 && (
              <TouchableOpacity onPress={handleComplete} style={styles.skipButton}>
                <Text style={styles.skipText}>Passer</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.nextButton,
                currentIndex === SLIDES.length - 1 && styles.finishButton
              ]}
              onPress={handleNext}
            >
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.nextText}>
                  {currentIndex === SLIDES.length - 1 ? "C'est parti !" : 'Suivant'}
                </Text>
                <Ionicons
                  name={currentIndex === SLIDES.length - 1 ? "rocket" : "arrow-forward"}
                  size={20}
                  color="#FFF"
                />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

// Helper to check completion
export async function isOnboardingCompleted() {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
    return value === 'true';
  } catch (error) {
    return false;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  carouselContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  imageContainer: {
    marginBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  logoGradient: {
    width: 120,
    height: 120,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: 'hidden',
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 80,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: '#3B82F6',
  },
  inactiveDot: {
    width: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
  },
  skipButton: {
    padding: 10,
  },
  skipText: {
    color: '#94A3B8',
    fontSize: 16,},
  nextButton: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 140,
  },
  finishButton: {
    flex: 1,
    marginLeft: 20,
  },
  buttonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextText: {
    color: '#FFFFFF',
    fontSize: 16,},
});

