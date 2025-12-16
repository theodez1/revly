import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onActivateDemo?: () => void;
  onPurchaseMonthly?: () => void;
  onPurchaseYearly?: () => void;
  offerDeadlineTs?: number;
}

export default function PaywallModal({ visible, onClose, onActivateDemo, onPurchaseMonthly, onPurchaseYearly, offerDeadlineTs }: PaywallModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [now, setNow] = useState(Date.now());
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true })
      ])
    ).start();
  }, [pulse]);

  const deadline = useMemo(() => offerDeadlineTs ? new Date(offerDeadlineTs).getTime() : (Date.now() + 1000 * 60 * 60 * 2), [offerDeadlineTs]);
  const remaining = Math.max(0, deadline - now);
  const hh = String(Math.floor(remaining / 3600000)).padStart(2, '0');
  const mm = String(Math.floor((remaining % 3600000) / 60000)).padStart(2, '0');
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');

  const handlePrimary = () => {
    if (selectedPlan === 'monthly') onPurchaseMonthly && onPurchaseMonthly();
    else if (onPurchaseYearly) onPurchaseYearly && onPurchaseYearly();
    else if (onActivateDemo) onActivateDemo && onActivateDemo();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Débloquez Premium</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
              <Ionicons name="close" size={20} color="#111827" />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>No Ads • Statistiques avancées • Partage de trajets • Partage stats réseaux sociaux • Véhicules illimités</Text>

          <View style={styles.benefits}>
            <Benefit icon="stats-chart" text="Graphiques 30 jours & records" />
            <Benefit icon="flame" text="Défis & séries hebdo" />
            <Benefit icon="car" text="Véhicules illimités" />
            <Benefit icon="share-social" text="Partagez vos stats sur les réseaux sociaux" />
          </View>

          <Animated.View style={[styles.countdown, { transform: [{ scale: pulse }] }] }>
            <Ionicons name="time-outline" size={16} color="#1E3A8A" />
            <Text style={styles.countdownText}>Offre limitée • {hh}:{mm}:{ss}</Text>
            <View style={styles.saveBadge}><Text style={styles.saveText}>-40%</Text></View>
          </Animated.View>

          <View style={styles.plansRow}>
            <PlanCard 
              label="Mensuel" price="3,99€" sub="/mois" 
              selected={selectedPlan==='monthly'} onPress={() => setSelectedPlan('monthly')} 
            />
            <PlanCard 
              label="Annuel" price="29€" sub="/an" badge="7 jours offerts" 
              selected={selectedPlan==='yearly'} onPress={() => setSelectedPlan('yearly')} 
            />
          </View>

          <TouchableOpacity style={styles.primary} onPress={handlePrimary} activeOpacity={0.9}>
            <Text style={styles.primaryText}>{selectedPlan==='yearly' ? 'Commencer 7 jours gratuits' : 'Activer mensuel'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={onActivateDemo}>
            <Text style={styles.secondaryText}>Essai 14 jours (demo)</Text>
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerLink}>Conditions</Text>
            <Text style={styles.footerDot}>•</Text>
            <Text style={styles.footerLink}>Politique</Text>
            <Text style={styles.footerDot}>•</Text>
            <Text style={styles.footerLink}>Restaurer</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Benefit({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.benefitItem}>
      <View style={styles.benefitIconWrap}><Ionicons name={icon} size={16} color="#1E3A8A" /></View>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

interface PlanCardProps {
  label: string;
  price: string;
  sub: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
}

function PlanCard({ label, price, sub, badge, selected, onPress }: PlanCardProps) {
  return (
    <TouchableOpacity style={[styles.plan, selected && styles.planSelected]} onPress={onPress} activeOpacity={0.9}>
      {!!badge && <View style={styles.planRibbon}><Text style={styles.planRibbonText}>{badge}</Text></View>}
      <Text style={styles.planLabelTop}>{label}</Text>
      <Text style={styles.planPrice}>{price}</Text>
      <Text style={styles.planSub}>{sub}</Text>
      {selected && (
        <View style={styles.checkWrap}><Ionicons name="checkmark" size={14} color="#FFFFFF" /></View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', justifyContent: 'center', alignItems: 'center' },
  card: { width: '90%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#F3F4F6' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '900', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 6 },
  benefits: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  benefitItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  benefitIconWrap: { marginRight: 6 },
  benefitText: { color: '#111827', fontSize: 12, fontWeight: '600' },
  countdown: { marginTop: 14, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#E0E7FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  countdownText: { color: '#1E3A8A', fontWeight: '800', letterSpacing: 0.5 },
  saveBadge: { marginLeft: 4, backgroundColor: '#1E3A8A', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  saveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  plansRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  plan: { flex: 1, borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 14, paddingVertical: 14, alignItems: 'center', position: 'relative' },
  planSelected: { borderColor: '#1E3A8A', backgroundColor: '#F8FAFF' },
  planRibbon: { position: 'absolute', top: -10, right: -6, backgroundColor: '#60A5FA', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  planRibbonText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  planLabelTop: { color: '#6B7280', fontSize: 12, marginBottom: 4 },
  planPrice: { fontSize: 20, fontWeight: '900', color: '#111827' },
  planSub: { color: '#6B7280', fontSize: 12 },
  checkWrap: { position: 'absolute', bottom: -10, right: -10, backgroundColor: '#1E3A8A', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  primary: { backgroundColor: '#1E3A8A', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 18, shadowColor: '#1E3A8A', shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  primaryText: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.3 },
  secondary: { backgroundColor: '#F3F4F6', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  secondaryText: { color: '#111827', fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10 },
  footerLink: { color: '#6B7280', fontSize: 11 },
  footerDot: { color: '#D1D5DB' },
});

