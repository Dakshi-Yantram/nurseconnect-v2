import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '../../components/Header';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';

export default function PaymentsScreen() {
  const bookings = useStore((s) => s.bookings);
  const totalSpent = bookings.reduce((s, b) => s + b.netCost, 0);
  const totalSubsidy = bookings.reduce((s, b) => s + b.subsidy, 0);
  const totalGross = bookings.reduce((s, b) => s + b.cost, 0);

  return (
    <SafeAreaView style={styles.safe} testID="payments-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Payments & Subsidies" showBack={false} />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }}>
        {/* Hero */}
        <LinearGradient
          colors={Gradients.primary as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroLabel}>Total spent</Text>
          <Text style={styles.heroValue}>₹{totalSpent.toLocaleString('en-IN')}</Text>
          <View style={styles.heroSplit}>
            <View style={styles.splitItem}>
              <Text style={styles.splitLabel}>Gross</Text>
              <Text style={styles.splitValue}>₹{totalGross}</Text>
            </View>
            <View style={styles.splitItem}>
              <Text style={styles.splitLabel}>Subsidy saved</Text>
              <Text style={[styles.splitValue, { color: Colors.accent }]}>
                –₹{totalSubsidy}
              </Text>
            </View>
            <View style={styles.splitItem}>
              <Text style={styles.splitLabel}>Visits</Text>
              <Text style={styles.splitValue}>{bookings.length}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Methods */}
        <Text style={styles.section}>Payment methods</Text>
        <View style={styles.methodCard}>
          <View style={[styles.mIcon, { backgroundColor: Colors.infoBg }]}>
            <MaterialCommunityIcons name="credit-card-outline" size={20} color={Colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.mTitle}>HDFC Credit Card</Text>
            <Text style={styles.mSub}>•••• 4521 · Default</Text>
          </View>
          <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
        </View>
        <View style={styles.methodCard}>
          <View style={[styles.mIcon, { backgroundColor: Colors.successBg }]}>
            <MaterialCommunityIcons name="bank" size={20} color={Colors.success} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.mTitle}>UPI – Google Pay</Text>
            <Text style={styles.mSub}>aarav@okhdfc</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.addMethod} testID="add-payment-method">
          <Ionicons name="add" size={18} color={Colors.primary} />
          <Text style={styles.addMethodTxt}>Add new method</Text>
        </TouchableOpacity>

        {/* History */}
        <Text style={styles.section}>Transaction history</Text>
        {bookings.map((b) => (
          <View key={b.id} style={styles.tx}>
            <View style={[styles.txIcon, { backgroundColor: b.status === 'cancelled' ? Colors.errorBg : Colors.successBg }]}>
              <Ionicons
                name={b.status === 'cancelled' ? 'close' : 'checkmark'}
                size={16}
                color={b.status === 'cancelled' ? Colors.error : Colors.success}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.txTitle}>{b.careTitle}</Text>
              <Text style={styles.txSub}>
                {new Date(b.date).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                })}{' '}
                · {b.paymentMethod || 'UPI'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.txAmt}>₹{b.netCost}</Text>
              {b.subsidy > 0 && <Text style={styles.txSubsidy}>−₹{b.subsidy} subsidy</Text>}
            </View>
          </View>
        ))}

        {/* BPL info */}
        <View style={styles.bpl}>
          <View style={styles.bplIcon}>
            <Ionicons name="ribbon" size={20} color={Colors.accent} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.bplTitle}>BPL Subsidy active</Text>
            <Text style={styles.bplSub}>
              You receive 25% off every booking under government BPL programme
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  hero: { borderRadius: Radius.xl, padding: 20, ...Shadows.floating },
  heroLabel: { ...Typography.caption, color: 'rgba(255,255,255,0.85)' },
  heroValue: { ...Typography.h1, color: '#fff', fontWeight: '800' as const, marginTop: 4 },
  heroSplit: { flexDirection: 'row', marginTop: 16, gap: 8 },
  splitItem: { flex: 1, padding: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: Radius.md },
  splitLabel: { ...Typography.caption, color: 'rgba(255,255,255,0.85)', fontSize: 9 },
  splitValue: { ...Typography.h4, color: '#fff', fontWeight: '700' as const, marginTop: 4 },
  section: { ...Typography.h3, color: Colors.textPrimary, marginTop: 24, marginBottom: 12 },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 8,
    ...Shadows.card,
  },
  mIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  mSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  addMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    gap: 6,
  },
  addMethodTxt: { ...Typography.bodyBold, color: Colors.primary },
  tx: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: Radius.md,
    marginBottom: 6,
  },
  txIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  txTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  txSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  txAmt: { ...Typography.bodyBold, color: Colors.textPrimary, fontWeight: '800' as const },
  txSubsidy: { ...Typography.caption, color: Colors.accent, marginTop: 2 },
  bpl: {
    flexDirection: 'row',
    backgroundColor: '#FFF7ED',
    padding: 14,
    borderRadius: Radius.lg,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  bplIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bplTitle: { ...Typography.bodyBold, color: Colors.accentDark },
  bplSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
});
