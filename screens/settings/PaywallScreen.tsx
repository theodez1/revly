import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import usePremium from '../../hooks/usePremium';
import { useAuth } from '../../contexts/AuthContext';
const { width } = Dimensions.get('window');

export default function PaywallScreen({ navigation }) {
  const { isPremium } = usePremium();
  const { user } = useAuth();

  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Countdown logic (36h fictive window)
  const deadline = useMemo(() => Date.now() + 1000 * 60 * 60 * 36, []);
  const remaining = Math.max(0, deadline - now);
  const hh = String(Math.floor(remaining / 3600000)).padStart(2, '0');
  const mm = String(Math.floor((remaining % 3600000) / 60000)).padStart(2, '0');
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');

  const handlePrimary = () => {
    if (isPremium) {
      navigation?.goBack?.();
      return;
    }
    if (selectedPlan === 'monthly') {
      console.log('Purchase monthly for user', user?.id);
    } else {
      console.log('Start yearly trial for user', user?.id);
    }
  };

  const handleRestore = () => {
    console.log('Restore purchases');
  };

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient
        colors={['#0F172A', '#1E3A8A', '#0F172A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      />

      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation?.goBack?.()}>
            <BlurView intensity={20} tint="light" style={styles.closeBlur}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </BlurView>
          </TouchableOpacity>

          {/* Header Section */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                style={styles.iconGradient}
              >
                <Image
                  source={require('../../assets/icon-without-back.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </LinearGradient>
            </View>
            <Text style={styles.title}>Débloquez l'Expérience Complète</Text>
            <Text style={styles.subtitle}>
              Rejoignez <Text style={styles.highlightText}>+10 000 conducteurs</Text> qui suivent leurs trajets comme des pros.
            </Text>

            {/* Social Proof / Rating */}
            <View style={styles.ratingContainer}>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((_, i) => (
                  <Ionicons key={i} name="star" size={16} color="#FBBF24" />
                ))}
              </View>
              <Text style={styles.ratingText}>Noté 4.9/5 par les passionnés</Text>
            </View>
          </View>

          {/* Features Carousel */}
          <View style={styles.featuresContainer}>
            <FeatureItem
              icon="stats-chart"
              title="Analyses Avancées"
              desc="Analysez vos performances de conduite en détail."
            />
            <FeatureItem
              icon="car"
              title="Véhicules Illimités"
              desc="Gérez chaque voiture de votre garage séparément."
            />
            <FeatureItem
              icon="cloud-upload"
              title="Sauvegarde Cloud"
              desc="Ne perdez plus jamais votre historique de trajets."
            />
            <FeatureItem
              icon="share-social"
              title="Partage Social"
              desc="Partagez vos résumés de trajets instantanément."
            />
          </View>

          {/* Pricing Section */}
          <View style={styles.pricingContainer}>
            {/* Countdown Badge - More Prominent */}
            <LinearGradient
              colors={['rgba(220, 38, 38, 0.1)', 'rgba(220, 38, 38, 0.2)']}
              style={styles.countdownBadge}
            >
              <Ionicons name="flame" size={16} color="#EF4444" />
              <Text style={styles.countdownText}>OFFRE FLASH : -50% termine dans {hh}:{mm}:{ss}</Text>
            </LinearGradient>

            {/* Yearly Plan (Hero) */}
            <TouchableOpacity
              style={[styles.planCard, selectedPlan === 'yearly' && styles.selectedPlanCard]}
              onPress={() => setSelectedPlan('yearly')}
              activeOpacity={0.9}
            >
              {selectedPlan === 'yearly' && (
                <LinearGradient
                  colors={['#2563EB', '#1D4ED8']}
                  style={styles.selectedBorder}
                />
              )}

              {/* Discount Tag */}
              <View style={styles.discountTag}>
                <Text style={styles.discountText}>-50%</Text>
              </View>

              <View style={styles.planHeader}>
                <View>
                  <Text style={styles.planTitle}>Accès Annuel</Text>
                  <Text style={styles.planSubtitle}>7 jours d'essai gratuit</Text>
                  <View style={[styles.bestValueBadge, { alignSelf: 'flex-start', marginTop: 6 }]}>
                    <Text style={styles.bestValueText}>MEILLEURE OFFRE</Text>
                  </View>
                </View>
              </View>

              <View style={styles.priceBlock}>
                <Text style={styles.strikethroughPrice}>6,66€</Text>
                <View style={styles.priceContainer}>
                  <Text style={styles.priceBig}>3,33€</Text>
                  <Text style={styles.priceSmall}>/ mois</Text>
                </View>
              </View>

              <Text style={styles.billedText}>
                <Text style={{ textDecorationLine: 'line-through', opacity: 0.6 }}>79,99€</Text> Facturé 39,99€ / an
              </Text>
            </TouchableOpacity>

            {/* Monthly Plan */}
            <TouchableOpacity
              style={[styles.planCard, selectedPlan === 'monthly' && styles.selectedPlanCard]}
              onPress={() => setSelectedPlan('monthly')}
              activeOpacity={0.9}
            >
              {selectedPlan === 'monthly' && (
                <LinearGradient
                  colors={['#2563EB', '#1D4ED8']}
                  style={styles.selectedBorder}
                />
              )}
              <View style={styles.planHeader}>
                <Text style={styles.planTitle}>Accès Mensuel</Text>
              </View>
              <View style={styles.priceBlock}>
                <Text style={styles.strikethroughPrice}>9,99€</Text>
                <View style={styles.priceContainer}>
                  <Text style={styles.priceBig}>4,99€</Text>
                  <Text style={styles.priceSmall}>/ mois</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* CTA Button */}
          <TouchableOpacity style={styles.ctaButton} onPress={handlePrimary}>
            <LinearGradient
              colors={['#3B82F6', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <View>
                <Text style={styles.ctaSubText}>{selectedPlan === 'yearly' ? 'Économisez 40€ aujourd\'hui' : 'Sans engagement'}</Text>
                <Text style={styles.ctaText}>
                  {selectedPlan === 'yearly' ? "Commencer l'essai gratuit" : "S'abonner maintenant"}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={24} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.guaranteeText}>Annulable à tout moment. Pas de frais cachés.</Text>

          {/* Footer Links */}
          <View style={styles.footer}>
            <TouchableOpacity><Text style={styles.footerLink}>Conditions</Text></TouchableOpacity>
            <Text style={styles.footerDot}>•</Text>
            <TouchableOpacity onPress={handleRestore}><Text style={styles.footerLink}>Restaurer</Text></TouchableOpacity>
            <Text style={styles.footerDot}>•</Text>
            <TouchableOpacity><Text style={styles.footerLink}>Confidentialité</Text></TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function FeatureItem({ icon, title, desc }) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIconBox}>
        <Ionicons name={icon} size={22} color="#60A5FA" />
      </View>
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginTop: 10,
    borderRadius: 20,
    overflow: 'hidden',
  },
  closeBlur: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  iconContainer: {
    marginBottom: 20,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  title: {
      fontSize: 24, fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
      fontSize: 16, fontWeight: '400',
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  highlightText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  stars: {
    flexDirection: 'row',
    marginRight: 8,
  },
  ratingText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  featuresContainer: {
    marginBottom: 30,
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  featureIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  featureDesc: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  pricingContainer: {
    gap: 12,
    marginBottom: 24,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  countdownText: {
    color: '#EF4444',
    fontSize: 14,letterSpacing: 0.5,
  },
  planCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
    overflow: 'hidden',
  },
  selectedPlanCard: {
    backgroundColor: 'rgba(30, 41, 59, 1)',
    borderColor: '#3B82F6',
  },
  selectedBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  discountTag: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 12,
  },
  discountText: {
    color: '#FFFFFF',fontSize: 12,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  planTitle: {
      fontSize: 18, fontWeight: '700',
    color: '#FFFFFF',
  },
  planSubtitle: {
    color: '#60A5FA',
    fontSize: 13,marginTop: 2,
  },
  bestValueBadge: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bestValueText: {
    color: '#FFFFFF',
    fontSize: 11,},
  priceBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  strikethroughPrice: {
    color: '#64748B',
    fontSize: 18,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  priceBig: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
  },
  priceSmall: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
  },
  billedText: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 4,
  },
  ctaButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 16,
  },
  ctaGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ctaSubText: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  guaranteeText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  footerLink: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  footerDot: {
    color: '#475569',
    fontSize: 12,
  },
});

